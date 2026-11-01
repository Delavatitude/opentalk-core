import {readdirSync, readFileSync, statSync} from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase, HttpError} from './database.ts';
import {currentUser, login, logout, rateLimit} from './auth.ts';
import {requestContext} from './context.ts';
const publicFunctions = new Set(['getAvailability','getAvailabilityWithCalendars','createBooking','createBookingMultiCalendar','createBookingWithCalendars','createBookingWithMeeting','rescheduleBooking','rescheduleBookingMultiCalendar','rescheduleBookingWithCalendars','cancelBooking','cancelBookingMultiCalendar','cancelBookingWithCalendars','getBookingByToken','resolveBookingLink','resolveBookingPage','prepareBookingMeeting','syncBookingCalendars']);
const handlers=Object.fromEntries(await Promise.all(readdirSync(new URL('./functions/',import.meta.url)).map(async name=>[name,(await import(`./functions/${name}/entry.ts`)).default])));
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'};
export function createApplication({db=openDatabase(),origin=process.env.APP_ORIGIN || 'http://localhost:5173'}={}) {
  const secure=new URL(origin).protocol==='https:';
  if(process.env.NODE_ENV==='production' && !secure) throw new Error('Production requires an HTTPS APP_ORIGIN');
  async function dispatch(req: Request,remoteAddress='local') {
    const url=new URL(req.url),path=url.pathname;
    if(!path.startsWith('/api/')) {
      if(req.method!=='GET' && req.method!=='HEAD')throw new HttpError(405,'method_not_allowed');
      let file=resolve(root,'.'+decodeURIComponent(path));
      if(!file.startsWith(root+sep))file=resolve(root,'index.html');
      try { if(!statSync(file).isFile())file=resolve(root,'index.html'); } catch { file=resolve(root,'index.html'); }
      try { return new Response(req.method==='HEAD'?null:readFileSync(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}}); }
      catch {throw new HttpError(503,'Build the frontend with npm run build, or use npm run dev');}
    }
    if(req.method!=='GET' && req.method!=='POST')throw new HttpError(405,'method_not_allowed');
    if(req.method==='POST') {
      // Custom header + JSON disallow simple cross-origin forms. Origin is pinned,
      // never derived from Host or untrusted X-Forwarded-* headers.
      if(req.headers.get('origin') && req.headers.get('origin')!==origin)throw new HttpError(403,'invalid_origin');
      if(req.headers.get('x-opentalk-request')!=='1' || !/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))throw new HttpError(403,'invalid_request_headers');
      rateLimit(db,'instance',1200);
      rateLimit(db,'ip:'+remoteAddress,120);
    }
    if(path==='/api/health' && req.method==='GET')return Response.json({ok:true});
    if(path==='/api/public-settings' && req.method==='GET')return Response.json({id:'opentalk',public_settings:{}});
    if(path==='/api/auth/login' && req.method==='POST') {
      rateLimit(db,'login:'+remoteAddress,10);
      const body=await req.json();
      rateLimit(db,'login-account:'+String(body.email||'').trim().toLowerCase(),10);
      return login(db,body,secure);
    }
    if(path==='/api/auth/logout' && req.method==='POST')return logout(db,req,secure);
    const user=currentUser(db,req);
    if(path==='/api/auth/me' && req.method==='GET') {
      if(!user)throw new HttpError(401,'authentication_required');
      return Response.json(user);
    }
    const match=/^\/api\/entities\/([A-Za-z]+)\/(filter|list|get|create|update|delete)$/.exec(path);
    if(match && req.method==='POST') {
      if(user?.role!=='admin')throw new HttpError(403,'admin_required');
      const [,name,operation]=match,entity=db.entities[name];
      if(!entity)throw new HttpError(404,'entity_not_found');
      const body=await req.json();
      if(operation==='filter')return Response.json(await entity.filter(body.filter,body.sort,body.limit,body.skip));
      if(operation==='list')return Response.json(await entity.list(body.sort,body.limit,body.skip));
      if(operation==='get' || operation==='delete')return Response.json(await entity[operation](body.id));
      // Only the backend computes arbitration metadata.
      for(const key of Object.keys(body.data||{}))if(key.startsWith('_'))throw new HttpError(400,'reserved_field');
      if(operation==='create')return Response.json(await entity.create(body.data));
      return Response.json(await entity.update(body.id,body.data));
    }
    const fn=/^\/api\/functions\/([A-Za-z]+)$/.exec(path)?.[1];
    if(fn && handlers[fn] && req.method==='POST') {
      if(!publicFunctions.has(fn) && user?.role!=='admin')throw new HttpError(403,'admin_required');
      const pending: Promise<any>[]=[];
      const context={auth:{me:async()=>user},asServiceRole:{entities:db.entities,connectors:{getConnection:async()=>{
        throw new HttpError(503,'calendar_connector_not_configured');
      }}},pending};
      const response=await requestContext.run(context,()=>handlers[fn](req));
      // Local tasks complete before the response; no platform runtime is needed.
      await Promise.allSettled(pending);
      return response;
    }
    throw new HttpError(404,'endpoint_not_found');
  }
  return {db, async fetch(req: Request,remoteAddress?: string) {
    let response: Response;
    try {response=await dispatch(req,remoteAddress);}
    catch(error){
      const status=error instanceof HttpError?error.status:error instanceof SyntaxError?400:500;
      response=Response.json({error:status===500?'internal_error':error.message},{status});
      if(status===500)console.error('request_failed',error.name);
    }
    response.headers.set('Cache-Control','no-store');
    response.headers.set('X-Content-Type-Options','nosniff');
    response.headers.set('Referrer-Policy','no-referrer');
    response.headers.set('X-Frame-Options','DENY');
    return response;
  }};
}
