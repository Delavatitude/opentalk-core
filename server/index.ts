import {createServer} from 'node:http';
import {createApplication} from './app.ts';
const app=createApplication();
const origin=process.env.APP_ORIGIN || 'http://localhost:5173';
const server=createServer(async(req,res)=>{
  try {
    const chunks: Buffer[]=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>262144){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const request=new Request(new URL(req.url||'/',origin),{method:req.method,headers:req.headers as any,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
    const response=await app.fetch(request,req.socket.remoteAddress);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(400);res.end('{"error":"invalid_request"}');}
});
server.requestTimeout=30000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log(`OpenTalk listening on http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3001}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{app.db.close();process.exit(0);}));
