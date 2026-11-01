import {workerData,parentPort} from 'node:worker_threads';
const {openDatabase}=await import(workerData.moduleUrl);
const db=openDatabase(workerData.path),barrier=new Int32Array(workerData.shared);
Atomics.add(barrier,0,1);
while(Atomics.load(barrier,0)<3)Atomics.wait(barrier,0,Atomics.load(barrier,0),100);
try {
 await db.entities.Booking.create({booking_type_id:workerData.typeId,name:'Synthetic',email:'test@example.test',start_at:workerData.start,end_at:workerData.end,status:'confirmed'});
 parentPort.postMessage(200);
}catch(e){parentPort.postMessage(e.status||500);}finally{db.close();}
