import {randomBytes, randomUUID, scrypt, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {HttpError} from './database.ts';
const derive=promisify(scrypt);
const digest=(token: string)=>createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string) {
  if(typeof password!=='string' || password.length<12 || password.length>256) throw new HttpError(400,'password_requires_12_to_256_characters');
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt:${salt}:${Buffer.from(key).toString('hex')}`;
}
export async function createAccount(db: any,email: string,password: string,name=email,role='admin') {
  email=String(email).trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'invalid_email');
  const encoded=await hashPassword(password);
  const id=randomUUID();
  db.sql.prepare('INSERT INTO accounts(id,email,password,name,role) VALUES(?,?,?,?,?)').run(id,email,encoded,name,role);
  return {id,email,full_name:name,role};
}
export function currentUser(db: any,req: Request) {
  const token=/(?:^|;\s*)opentalk_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];
  if(!token)return null;
  const user=db.sql.prepare('SELECT a.id,a.email,a.name AS full_name,a.role FROM accounts a JOIN sessions s ON a.id=s.account_id WHERE s.hash=? AND s.expires>?').get(digest(token),Date.now());
  return user || null;
}
export function rateLimit(db: any,key: string,max=120) {
  const window=Math.floor(Date.now()/60000);
  db.sql.prepare(`INSERT INTO rate_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window`).run(key,window);
  if(db.sql.prepare('SELECT count FROM rate_limits WHERE key=?').get(key).count>max) throw new HttpError(429,'rate_limited');
  db.sql.prepare('DELETE FROM rate_limits WHERE window<?').run(window-2);
}
export async function login(db: any,body: any,secure: boolean) {
  const email=String(body.email||'').trim().toLowerCase(),password=body.password;
  if(typeof password!=='string' || password.length>256)throw new HttpError(401,'invalid_credentials');
  const account=db.sql.prepare('SELECT * FROM accounts WHERE email=?').get(email);
  const [,salt,key]=(account?.password || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const candidate=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  if(!timingSafeEqual(Buffer.from(candidate),Buffer.from(key,'hex')) || !account)throw new HttpError(401,'invalid_credentials');
  const token=randomBytes(32).toString('hex'),expires=Date.now()+7*86400000;
  db.sql.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.sql.prepare('INSERT INTO sessions(hash,account_id,expires) VALUES(?,?,?)').run(digest(token),account.id,expires);
  return Response.json({id:account.id,email:account.email,full_name:account.name,role:account.role},{headers:{'Set-Cookie':`opentalk_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure?'; Secure':''}`}});
}
export function logout(db: any,req: Request,secure: boolean) {
  const token=/(?:^|;\s*)opentalk_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.get('cookie')||'')?.[1];
  if(token)db.sql.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));
  return Response.json({ok:true},{headers:{'Set-Cookie':`opentalk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`}});
}
