import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {openDatabase} from '../server/database.ts';
import {createApplication} from '../server/app.ts';
import {createAccount} from '../server/auth.ts';
const origin='http://localhost:5173';
function api(app,cookie='') {
  return async(path,body,headers={})=>app.fetch(new Request(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{'Content-Type':'application/json','X-OpenTalk-Request':'1',origin}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
}
const typeInput={name:'Meeting',slug:'meeting',duration:30,minimum_notice_minutes:0,buffer_before:0,buffer_after:0,booking_window_days:30,max_per_day:20,active:true,location_type:'custom',location_value:'Local meeting',contexts:['general']};
async function seed(db) {
  const type=await db.entities.BookingType.create(typeInput);
  const tomorrow=new Date(Date.now()+86400000);const date=tomorrow.toISOString().slice(0,10);
  await db.entities.AvailabilityRule.create({day_of_week:tomorrow.getUTCDay(),start_time:'09:00',end_time:'17:00',timezone:'UTC',active:true});
  await db.entities.Setting.create({key:'reference_timezone',value:'UTC'});
  const page={name:'Demo',slug:'/',context_key:'general',active:true,language_mode:'auto',booking_type_ids:[type.id],type_overrides:[]};
  const saved=await db.entities.BookingPage.create({...page,status:'published',published_slug:'/',published_json:JSON.stringify(page)});
  return {type,date,page:saved};
}
test('real SQLite lifecycle: login, public page, availability, competing bookings, move, cancel, persistence and logout',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'opentalk-'));let db=openDatabase(join(dir,'test.sqlite'));
  try {
    const app=createApplication({db,origin}),anonymous=api(app);
    await createAccount(db,'admin@example.test','synthetic-password-for-tests');
    assert.equal((await anonymous('auth/me')).status,401);
    assert.equal((await anonymous('entities/Setting/filter',{})).status,403);
    assert.equal((await anonymous('auth/register',{role:'admin'})).status,404);
    assert.equal((await anonymous('functions/adminPages',{})).status,403);
    assert.equal((await anonymous('auth/login',{email:'admin@example.test',password:'wrong'})).status,401);
    const logged=await anonymous('auth/login',{email:'admin@example.test',password:'synthetic-password-for-tests'});
    assert.equal(logged.status,200);
    assert.match(logged.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    assert.equal((await logged.clone().json()).password,undefined);
    const cookie=logged.headers.get('set-cookie').split(';')[0],admin=api(app,cookie);
    assert.equal((await admin('auth/me')).status,200);
    const {type,date,page}=await seed(db);
    const resolved=await anonymous('functions/resolveBookingPage',{slug:'/'});
    assert.equal(resolved.status,200);assert.equal((await resolved.json()).types[0].id,type.id);
    const response=await anonymous('functions/getAvailabilityWithCalendars',{booking_type_id:type.id,booking_page_id:page.id,start_date:date,days:1,timezone:'UTC'});
    const available=await response.json();assert.equal(response.status,200,JSON.stringify(available));
    const slots=available.days.flatMap(d=>d.slots);assert(slots.length>2);
    const body={booking_type_id:type.id,booking_page_id:page.id,...slots[0],name:'Synthetic guest',email:'guest@example.test',timezone:'UTC',locale:'en',context:'general'};
    const competing=await Promise.all([anonymous('functions/createBookingWithMeeting',body),anonymous('functions/createBookingWithMeeting',body)]);
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    const booking=(await competing.find(r=>r.status===200).json()).booking;
    assert.equal(booking.calendar_sync_status,'disabled');
    assert.equal((await db.entities.Booking.filter({})).length,1);
    assert.equal((await anonymous('functions/getBookingByToken',{token:'bad'})).status,404);
    const lookup=await anonymous('functions/getBookingByToken',{token:booking.reschedule_token});
    const publicBooking=(await lookup.json()).booking;assert.equal(publicBooking.cancel_token,undefined);assert.equal(publicBooking.call_transcript,undefined);
    const moved=await anonymous('functions/rescheduleBookingMultiCalendar',{token:booking.reschedule_token,new_start_at:slots[2].start_at,new_end_at:slots[2].end_at});
    assert.equal(moved.status,200,await moved.text());
    const cancel=await anonymous('functions/cancelBookingMultiCalendar',{token:booking.cancel_token});
    assert.equal(cancel.status,200);assert.equal((await db.entities.Booking.get(booking.id)).status,'cancelled');
    assert.equal((await admin('entities/Booking/update',{id:booking.id,data:{call_transcript:'Private synthetic note'}})).status,200);
    assert.equal((await anonymous('entities/Booking/get',{id:booking.id})).status,403);
    assert.equal((await admin('entities/User/create',{data:{role:'admin'}})).status,404);
    assert.equal((await admin('entities/Setting/filter',{}, {origin:'https://other.example.test'})).status,403);
    assert.equal((await admin('auth/logout',{})).status,200);assert.equal((await admin('auth/me')).status,401);
    db.close();db=openDatabase(join(dir,'test.sqlite'));assert.equal((await db.entities.Booking.get(booking.id)).status,'cancelled');
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
test('non-admin sessions cannot read private entities, mutate records, execute admin functions or promote themselves',async()=>{
  const db=openDatabase(':memory:');try {
    const app=createApplication({db,origin}),call=api(app);
    await createAccount(db,'user@example.test','synthetic-user-password','User','user');
    const response=await call('auth/login',{email:'user@example.test',password:'synthetic-user-password'});
    const user=api(app,response.headers.get('set-cookie').split(';')[0]);
    for(const entity of ['Booking','Setting','BlockedPeriod','Contact','EmailLog','User']) assert.equal((await user(`entities/${entity}/filter`,{})).status,403);
    assert.equal((await user('entities/User/update',{id:'self',data:{role:'admin'}})).status,403);
    assert.equal((await user('functions/adminStats',{})).status,403);
    assert.equal((await user('functions/processReminders',{})).status,403);
  } finally {db.close();}
});
test('SQLite arbitrates writes from independent workers and retains buffers during moves',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'opentalk-race-')),path=join(dir,'test.sqlite'),db=openDatabase(path);
  try {
    const type=await db.entities.BookingType.create({...typeInput,buffer_before:10,buffer_after:10});
    const start='2026-12-10T12:00:00.000Z',end='2026-12-10T12:30:00.000Z';
    const shared=new SharedArrayBuffer(4),barrier=new Int32Array(shared);
    const moduleUrl=new URL('../server/database.ts',import.meta.url).href;
    const run=()=>new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./race-worker.mjs',import.meta.url),{workerData:{path,typeId:type.id,shared,moduleUrl,start,end}});
      worker.on('message',resolve);worker.on('error',reject);
    });
    const attempts=[run(),run()];
    while(Atomics.load(barrier,0)<2)await new Promise(r=>setTimeout(r,5));
    Atomics.store(barrier,0,3);Atomics.notify(barrier,0);
    assert.deepEqual((await Promise.all(attempts)).sort(),[200,409]);
    const [first]=await db.entities.Booking.filter({});
    await assert.rejects(()=>db.entities.Booking.create({booking_type_id:type.id,name:'Other',email:'other@example.test',start_at:'2026-12-10T12:40:00Z',end_at:'2026-12-10T13:10:00Z',status:'confirmed'}),{status:409});
    const second=await db.entities.Booking.create({booking_type_id:type.id,name:'Other',email:'other@example.test',start_at:'2026-12-10T13:00:00Z',end_at:'2026-12-10T13:30:00Z',status:'confirmed'});
    await assert.rejects(()=>db.entities.Booking.update(second.id,{start_at:start,end_at:end}),{status:409});
    assert.equal((await db.entities.Booking.get(second.id)).start_at,'2026-12-10T13:00:00Z');
    await db.entities.Booking.update(first.id,{status:'cancelled'});
    assert.equal((await db.entities.Booking.update(second.id,{start_at:start,end_at:end})).start_at,start);
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
test('JSON and origin protection plus shared login throttling',async()=>{
  const db=openDatabase(':memory:');try {
    const app=createApplication({db,origin}),call=api(app);
    assert.equal((await app.fetch(new Request(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}))).status,403);
    for(let i=0;i<10;i++)assert.equal((await call('auth/login',{email:'absent@example.test',password:'test'})).status,401);
    assert.equal((await call('auth/login',{email:'absent@example.test',password:'test'})).status,429);
  }finally{db.close();}
});
