import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {openDatabase} from './database.ts';
import {createAccount,hashPassword} from './auth.ts';
let muted=false;
const output=new Writable({write(chunk,_encoding,callback){if(!muted)process.stdout.write(chunk);callback();}});
const input=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
const db=openDatabase();
try {
  const email=await input.question('Administrator email: ');
  process.stdout.write('Password (12+ characters): ');muted=true;
  const password=await input.question('');muted=false;process.stdout.write('\n');
  if(process.argv.includes('--reset-password')) {
    const result=db.sql.prepare('UPDATE accounts SET password=? WHERE email=?').run(await hashPassword(password),email.trim().toLowerCase());
    if(!result.changes)throw Error('Account not found');
    db.sql.prepare('DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email=?)').run(email.trim().toLowerCase());
    console.log('Password changed; all existing sessions revoked.');
  }else {await createAccount(db,email,password);console.log('Administrator created. Sign in at /login.');}
} finally {input.close();db.close();}
