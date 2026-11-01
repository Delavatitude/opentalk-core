import {openDatabase} from './database.ts';
import {requestContext} from './context.ts';
import handler from './functions/processReminders/entry.ts';
const db=openDatabase();
try {
 const context={auth:{me:async()=>({role:'admin'})},asServiceRole:{entities:db.entities,connectors:{getConnection:async()=>{throw Error('calendar_connector_not_configured');}}},pending:[]};
 const result=await requestContext.run(context,()=>handler(new Request(process.env.APP_ORIGIN||'http://localhost:3001',{method:'POST',body:'{}'})));
 if(!result.ok)throw Error('Reminder job failed');console.log(await result.text());
}finally{db.close();}
