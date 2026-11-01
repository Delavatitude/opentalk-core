const {test}=require('node:test');
const assert=require('node:assert/strict');
const esbuild=require('esbuild');
async function load(file) {
 const r=await esbuild.build({entryPoints:[file],bundle:true,write:false,platform:'node',format:'esm'});
 return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
}
test('wall time resolves winter, summer, DST gaps and folds',async()=>{
 const {zonedToUTC,localDayBounds}=await load('server/shared/time.ts');
 const examples=[['2027-03-28','01:30','Europe/Paris','2027-03-28T00:30:00.000Z'],['2027-01-10','09:00','Europe/Paris','2027-01-10T08:00:00.000Z'],['2027-07-10','09:00','Europe/Paris','2027-07-10T07:00:00.000Z'],['2027-10-31','02:30','Europe/Paris','2027-10-31T00:30:00.000Z'],['2027-06-01','09:00','Asia/Kathmandu','2027-06-01T03:15:00.000Z'],['2027-06-01','09:00','America/New_York','2027-06-01T13:00:00.000Z']];
 for(const [date,time,tz,expected] of examples) assert.equal(zonedToUTC(date,time,tz).toISOString(),expected);
 assert.throws(()=>zonedToUTC('2027-03-28','02:30','Europe/Paris'),/Nonexistent/);
 assert.throws(()=>zonedToUTC('2027-02-30','09:00','UTC'));
 for(const [date,hours] of [['2027-03-28',23],['2027-10-31',25]]) {
  const {start,end}=localDayBounds(date,'Europe/Paris');assert.equal((Date.parse(end)-Date.parse(start))/3600000,hours);
 }
});
test('availability skips gap boundaries and rejects nonpositive duration',async()=>{
 const {computeAvailability}=await load('server/shared/availability.ts');
 const p={bookingType:{duration:30,booking_window_days:999},availabilityRules:[{day_of_week:0,start_time:'02:30',end_time:'04:00'}],blockedPeriods:[],existingBookings:[],calendarBusy:[],referenceTimezone:'Europe/Paris',now:new Date('2027-03-01T00:00:00Z'),dateRange:[{date:'2027-03-28',dayOfWeek:0}]};
 assert.deepEqual(await computeAvailability(p),[]);
 await assert.rejects(()=>computeAvailability({...p,bookingType:{duration:0}}),/Invalid booking duration/);
});
test('public input rejects excessive ranges, malformed dates, timezones and payloads',async()=>{
 const {publicBody}=await load('server/shared/publicInput.ts');
 const req=b=>new Request('https://example.test',{method:'POST',body:JSON.stringify(b)});
 for(const body of [{days:1000000},{days:0},{days:'14'},{start_date:'2027-02-30'},{timezone:'invalid/timezone'},{topic:'x'.repeat(2001)},[]])await assert.rejects(()=>publicBody(req(body),'availability'));
 await assert.rejects(()=>publicBody(req({topic:'x'.repeat(20000)}),'availability'),/request_too_large/);
 await assert.rejects(()=>publicBody(req({start_at:'2027-02-30T10:00:00Z',end_at:'2027-03-02T11:00:00Z'}),'create'));
 assert.equal((await publicBody(req({days:31,start_date:'2027-03-28',timezone:'Europe/Paris'}),'availability')).days,31);
});
