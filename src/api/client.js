async function request(path,body) {
  const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-OpenTalk-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'request_failed');error.status=response.status;error.data=data;error.response={status:response.status,data};throw error;}
  return data;
}
const entities=new Proxy({}, {get:(_target,name)=>({
  filter:(filter={},sort='created_date',limit=10000,skip=0)=>request(`entities/${String(name)}/filter`,{filter,sort,limit,skip}),
  list:(sort='created_date',limit=10000,skip=0)=>request(`entities/${String(name)}/list`,{sort,limit,skip}),
  get:id=>request(`entities/${String(name)}/get`,{id}),
  create:data=>request(`entities/${String(name)}/create`,{data}),
  update:(id,data)=>request(`entities/${String(name)}/update`,{id,data}),
  delete:id=>request(`entities/${String(name)}/delete`,{id})
})});
export const api={
  entities,
  functions:{invoke:async(name,data={})=>({data:await request(`functions/${name}`,data)})},
  app:{getPublicSettings:()=>request('public-settings')},
  auth:{
    me:()=>request('auth/me'),
    loginViaEmailPassword:(email,password)=>request('auth/login',{email,password}),
    logout:async()=>{await request('auth/logout',{});window.location.assign('/login');},
    redirectToLogin:()=>window.location.assign('/login')
  }
};
