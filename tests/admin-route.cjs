const fs=require("fs"),vm=require("vm"),assert=require("assert/strict"),{transformSync}=require("./helpers.cjs");
const source=transformSync(fs.readFileSync("src/components/ProtectedRoute.jsx","utf8"),{loader:"jsx",format:"cjs",jsx:"transform"}).code;
async function scenario(user,reject=false){
 let state,effect;
 const Navigate=()=>{},Outlet=()=>{};
 const ctx={module:{exports:{}},exports:{},React:{createElement:(type,props)=>({type,props})},require:name=>{
  if(name==="react")return {useState:initial=>[state ??= initial,v=>{state=v;}],useEffect:fn=>{effect=fn;}};
  if(name==="react-router-dom")return {Navigate,Outlet};
  if(name==="@/api/client")return {api:{auth:{me:()=>reject?Promise.reject(Error("expired")):Promise.resolve(user)}}};
  throw Error(name);
 }};
 vm.runInNewContext(source,ctx);
 const render=()=>ctx.module.exports.default({requiredRole:"admin"});
 assert.notEqual(render().type,Outlet);
 effect();await new Promise(resolve=>setImmediate(resolve));
 return {result:render(),Navigate,Outlet};
}
(async()=>{
 for(const [user,reject,target] of [[null,false,"/login"],[{role:"user"},false,"/"],[{},false,"/"],[null,true,"/login"]]){
  const s=await scenario(user,reject);assert.equal(s.result.type,s.Navigate);assert.equal(s.result.props.to,target);
 }
 const s=await scenario({role:"admin"});assert.equal(s.result.type,s.Outlet);
 console.log("PASS: admin allowed; regular/missing role denied; anonymous/expired session redirected; no child before auth check.");
})().catch(e=>{console.error(e);process.exitCode=1;});
