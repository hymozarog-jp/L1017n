import {createClient} from "npm:@supabase/supabase-js@2.75.0";
const originOK=new Set(["https://hymozarog-jp.github.io","https://l1017n.ct.ws"]);
const reply=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...(originOK.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"}:{})}});
async function provider(action:string,id=""){
 const key=(Deno.env.get("OMNEX_API_KEY")||"").trim();
 if(!key)return {status:503,body:{error:"omnex_not_configured"}};
 const url=new URL("https://omnex.ly/api/v1.php");url.searchParams.set("action",action);if(id)url.searchParams.set("id",id);
 try{const r=await fetch(url,{headers:{"authorization":"Bearer "+key,"accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(18000)});return {status:r.status,body:await r.json()}}catch{return {status:502,body:{error:"supplier_unavailable"}}}
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:originOK.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"}:{}});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
 let body:any;try{body=await req.json()}catch{return reply({error:"invalid_json"},400,origin)}
 const bearer=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";
 if(!bearer)return reply({error:"unauthorized"},401,origin);
 let role=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!role){try{role=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{}}
 const db=createClient(Deno.env.get("SUPABASE_URL")||"",role,{global:{headers:{Authorization:"Bearer "+bearer}},auth:{persistSession:false}});
 const {data:auth,error}=await db.auth.getUser(bearer);if(error||!auth.user||auth.user.is_anonymous)return reply({error:"unauthorized"},401,origin);
 const {data:admin,error:adminError}=await db.rpc("is_store_admin");if(adminError||admin!==true)return reply({error:"forbidden"},403,origin);
 if(body.action==="status")return reply({configured:!!Deno.env.get("OMNEX_API_KEY"),scope:"roblox",purchasing_enabled:false},200,origin);

 if(body.action==="catalog"){
  const {data,error}=await db.rpc("get_omnex_roblox_admin_catalog");return error?reply({error:"catalog_unavailable"},503,origin):reply(data,200,origin);
 }
 if(body.action==="sync"){
  const {data:cached,error:cacheError}=await db.rpc("get_omnex_roblox_admin_catalog");
  if(!cacheError&&cached?.synced_at&&Date.now()-Date.parse(cached.synced_at)<30000)return reply({ok:true,imported:cached.products?.length||0,scope:"roblox",purchasing_enabled:false,cached:true},200,origin);
  const result=await provider("catalog");
  if(result.status!==200||!Array.isArray(result.body?.products))return reply({error:result.body?.error||"supplier_unavailable",provider_status:result.status},502,origin);
  const catalog=result.body;
  const groupNames=new Map((catalog.groups||[]).filter((g:any)=>g.category==="cd40561b622c4fa9ed9984c31f0c697f").map((g:any)=>[g.id,g.name]));
  const items=catalog.products.filter((p:any)=>p.category==="cd40561b622c4fa9ed9984c31f0c697f").map((p:any)=>({id:p.id,category:p.category,name:p.name,group_name:groupNames.get(p.group)||"",price:p.price,stock:p.stock,available:p.purchase_available===true,image_url:p.image_url||""}));
  let roleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";if(!roleKey){try{roleKey=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{}}
  const service=createClient(Deno.env.get("SUPABASE_URL")||"",roleKey,{auth:{persistSession:false}});
  const {data:count,error:syncError}=await service.rpc("sync_omnex_roblox_catalog",{p_items:items,p_wallet:catalog.wallet});
  return syncError?reply({error:"catalog_sync_failed"},503,origin):reply({ok:true,imported:count,scope:"roblox",purchasing_enabled:false},200,origin);
 }
 return reply({error:"invalid_action"},400,origin);
});