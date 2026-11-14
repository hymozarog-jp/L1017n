import {createClient} from "npm:@supabase/supabase-js@2.75.0";
import {processSupplierJob,millis} from "./engine.js";
const allowed=new Set(["https://hymozarog-jp.github.io","https://l1017n.ct.ws"]);
const cors=(origin)=>allowed.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"}:{};
const reply=(body,status=200,origin="")=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store",...cors(origin)}});
function serviceKey(){const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(key)return key;try{return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||''}catch{return ''}}
function database(bearer=''){return createClient(Deno.env.get('SUPABASE_URL')||'',serviceKey(),{...(bearer?{global:{headers:{Authorization:'Bearer '+bearer}}}:{}),auth:{persistSession:false,autoRefreshToken:false}})}
async function rpc(db,name,args={}){const {data,error}=await db.rpc(name,args);if(error)throw Error(error.message);return data}
async function supplier(db,action,id='',payload=''){
 const key=(Deno.env.get('OMNEX_API_KEY')||'').trim();if(!key)return {status:503,body:{error:'omnex_not_configured'}};
 if(!await rpc(db,'omnex_rate_slot'))return {status:429,retry_after:60,body:{error:'supplier_rate_limit'}};
 const url=new URL('https://omnex.ly/api/v1.php');url.searchParams.set('action',action);if(id)url.searchParams.set('id',id);
 const headers={authorization:'Bearer '+key,accept:'application/json',...(payload?{'content-type':'application/json'}:{})};
 try{
  const r=await fetch(url,{method:payload?'POST':'GET',headers,...(payload?{body:payload}:{}),redirect:'error',signal:AbortSignal.timeout(payload?80000:18000)});
  const text=await r.text();if(text.length>5000000)return {status:502,body:{error:'supplier_response_invalid'}};
  let body;try{body=JSON.parse(text)}catch{return {status:502,body:{error:'supplier_response_invalid'}}}
  return {status:r.status,body,retry_after:Number(r.headers.get('retry-after'))||0};
 }catch{return {status:503,body:{error:'supplier_connection_unknown'}}}
}
async function runJob(db,job){if(!job)return;await processSupplierJob(job,(action,id='',payload='')=>supplier(db,action,id,payload),args=>rpc(db,'finish_omnex_job',args));}
function background(work){if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil(work.catch(()=>{}));else return work.catch(()=>{});}
async function scheduleJob(db,id,user){const job=await rpc(db,'claim_omnex_job',{p_order:id,p_user:user});if(job)await background(runJob(db,job));}
async function syncCatalog(db){
 const r=await supplier(db,'catalog');if(r.status!==200||!Array.isArray(r.body?.products))throw Error('supplier_unavailable');
 const cat=r.body;const groups=new Map((cat.groups||[]).filter(g=>g.category==='cd40561b622c4fa9ed9984c31f0c697f').map(g=>[g.id,g.name]));
 const items=cat.products.filter(p=>p.category==='cd40561b622c4fa9ed9984c31f0c697f').map(p=>({id:p.id,category:p.category,name:p.name,group_name:groups.get(p.group)||'',price:p.price,stock:p.stock,available:p.purchase_available===true,image_url:p.image_url||''}));
 return rpc(db,'sync_omnex_roblox_catalog',{p_items:items,p_wallet:cat.wallet});
}

/* PlayStation gift-card catalog: discover the supplier's category by its own
   name; never trust customer-supplied category IDs. Unrecognized catalogs fail closed. */
async function syncPsn(db){
 const r=await supplier(db,'catalog');
 if(r.status!==200||!Array.isArray(r.body?.products))throw Error('supplier_unavailable');
 const cat=r.body;
 const isPsn=s=>/(?:play\s*station|psn|بلاي\s*ستيشن|بليستيشن|بلايستيشن)/i.test(String(s||''));
 const candidates=new Set();
 const entries=value=>Array.isArray(value)?value:(value&&typeof value==='object'?Object.values(value):[]);
 for(const group of [cat.categories,cat.category_list,cat.card_categories,cat.sections]){
  for(const c of entries(group)){
   if(!c||typeof c!=='object')continue;
   const id=String(c.id||c.category_id||'');
   if(/^[a-f0-9]{32}$/.test(id)&&isPsn([c.name,c.title,c.label,c.slug].filter(Boolean).join(' ')))candidates.add(id);
  }
 }
 for(const g of entries(cat.groups)){
  const id=String(g.category||'');
  if(/^[a-f0-9]{32}$/.test(id)&&isPsn([g.category_name,g.category_title,g.parent_name,g.section_name].filter(Boolean).join(' ')))candidates.add(id);
 }
 for(const product of cat.products){
  const id=String(product.category||'');
  if(/^[a-f0-9]{32}$/.test(id)&&isPsn([product.category_name,product.category_title,product.category_label].filter(Boolean).join(' ')))candidates.add(id);
 }
 if(!candidates.size)throw Error('psn_category_not_found');
 const groups=new Map(entries(cat.groups).map(g=>[g.id,g.name||g.title||'']));
 const items=cat.products.filter(p=>candidates.has(String(p.category||''))).map(p=>({
  id:p.id,category:p.category,name:p.name,
  group_name:groups.get(p.group)||p.group_name||'',
  price:p.price,stock:p.stock,available:p.purchase_available===true,image_url:p.image_url||''
 }));
 if(!items.length||items.length>500){
  const counts={};for(const p of cat.products){const id=String(p.category||'');counts[id]=(counts[id]||0)+1}
  console.warn('[omnex-psn-debug]',JSON.stringify({matches:[...candidates].slice(0,12),
    itemCount:items.length,catalogProducts:cat.products.length,
    productCategoryCounts:Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,18),
    categoryKeys:Object.keys(cat).filter(x=>/categor|group|section|product/i.test(x)).slice(0,15)}));
  throw Error('psn_catalog_unavailable');
 }
 return rpc(db,'sync_omnex_psn_catalog',{p_items:items,p_wallet:cat.wallet});
}

async function worker(db){
 const tasks=[];for(let i=0;i<6;i++){const job=await rpc(db,'claim_omnex_job');if(!job)break;tasks.push(runJob(db,job));}
 await Promise.allSettled(tasks);
 const {data:state}=await db.rpc('get_public_omnex_roblox_catalog');
 // Quotes always verify live prices. The periodic catalog refresh is only a listing cache.
 const {data:due}=await db.rpc('omnex_catalog_sync_due');if(due)try{await syncCatalog(db)}catch{}
 const {data:psnDue}=await db.rpc('omnex_psn_catalog_sync_due');if(psnDue)try{await syncPsn(db)}catch(error){console.warn('[omnex-psn-sync]',String(error?.message||'unknown').slice(0,100))}
}
function fieldsSchema(raw){
 if(!Array.isArray(raw)||raw.length>10)throw Error('unsupported_product_fields');
 return raw.map(field=>{
  const key=String(field.key||field.code||'');if(!/^[A-Za-z0-9_]{1,60}$/.test(key)||/password|passwd|secret|otp|token/i.test(key))throw Error('unsupported_product_fields');
  const type=String(field.type||'text');if(!['text','number','select'].includes(type))throw Error('unsupported_product_fields');
  const options=Array.isArray(field.options)?field.options.map(v=>typeof v==='object'?{value:String(v.value??v.id??''),label:String(v.label??v.name??v.value??'').slice(0,100)}:{value:String(v),label:String(v)}).filter(o=>o.value&&o.value.length<=200):[];
  if(type==='select'&&!options.length)throw Error('unsupported_product_fields');
  return {key,label:String(field.label||field.name||key).slice(0,100),required:field.required===true,type,options};
 });
}
function checkFields(schema,values){
 if(!values||typeof values!=='object'||Array.isArray(values)||JSON.stringify(values).length>4000)throw Error('invalid_product_fields');
 const out={};for(const field of schema){const raw=values[field.key];if(raw!==undefined&&typeof raw!=='string')throw Error('invalid_product_fields');const value=String(raw||'').trim();if(value.length>200||field.required&&!value)throw Error('missing_product_field');if(field.type==='number'&&value&&!/^\d{1,40}$/.test(value))throw Error('invalid_product_fields');if(field.type==='select'&&value&&!field.options.some(o=>o.value===value))throw Error('invalid_product_fields');if(value)out[field.key]=value;}
 if(Object.keys(values).some(k=>!schema.some(s=>s.key===k)))throw Error('invalid_product_fields');return out;
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405,origin);
 if(Number(req.headers.get('content-length')||0)>12000)return reply({error:'request_too_large'},413,origin);
 let body;try{const text=await req.text();if(text.length>12000)return reply({error:'request_too_large'},413,origin);body=JSON.parse(text)}catch{return reply({error:'invalid_json'},400,origin)}
 const service=database();
 if(body.action==='worker'){
  try{if(!await rpc(service,'omnex_worker_allowed',{p_token:req.headers.get('x-omnex-worker')||''}))return reply({error:'unauthorized'},401,origin);await background(worker(service));return reply({accepted:true},202,origin)}catch{return reply({error:'worker_unavailable'},503,origin)}
 }
 const bearer=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]||'';
 if(!bearer)return reply({error:'unauthorized'},401,origin);
 const userDb=database(bearer);const {data:auth,error:authError}=await userDb.auth.getUser(bearer);
 if(authError||!auth.user||auth.user.is_anonymous)return reply({error:'unauthorized'},401,origin);
 const uid=auth.user.id;
 try{
  if(body.action==='quote'){
   if(!/^[a-f0-9]{32}$/.test(body.id||''))throw Error('invalid_product');
   const known=await rpc(service,'omnex_product_for_service',{p_product:body.id});if(!known)throw Error('product_not_available');
   const r=await supplier(service,'product',body.id),p=r.body?.product;
   if(r.status!==200||!p||p.id!==body.id||r.body.price_status!=='fresh')throw Error('supplier_price_unavailable');
   const expectedCategory=known.game==='psn'?known.supplier_category_id:known.game==='pubg'?'30faee6b9893e3f424961c15a785efc3':'cd40561b622c4fa9ed9984c31f0c697f';
   if(!expectedCategory||p.category!==expectedCategory)throw Error('product_not_available');
   if(p.purchase_available===false||r.body.stock===0||p.stock===0)throw Error('supplier_out_of_stock');
   const cost=millis(p.price);if(cost===null||cost<=0)throw Error('supplier_price_unavailable');
   const quote=await rpc(service,'make_omnex_quote',{p_user:uid,p_product:body.id,p_cost:p.price,p_wallet:r.body.wallet||p.wallet,p_stock:r.body.stock??p.stock??null,p_schema:fieldsSchema(r.body.fields||[])});
   return reply(quote,200,origin);
  }
  if(body.action==='purchase'){
   if(!/^[a-f0-9]{32}$/.test(body.id||'')||!/^[-a-f0-9]{36}$/.test(body.quote_id||'')||!/^[-a-f0-9]{36}$/.test(body.client_key||'')||body.accepted_terms!==true)throw Error('invalid_purchase');
   // On an uncertain retry, the persisted client key returns the original order.
   const existing=await rpc(service,'omnex_order_snapshot',{p_user:uid,p_client:body.client_key});
   if(existing){if(existing.product_id!==body.id)throw Error('idempotency_conflict');await scheduleJob(service,existing.order_id,uid);return reply(existing,200,origin)}
   const quote=await rpc(service,'omnex_quote_for_service',{p_user:uid,p_quote:body.quote_id});if(!quote||quote.product_id!==body.id)throw Error('quote_expired');
   const fields=checkFields(quote.fields_schema,body.fields||{});
   const order=await rpc(service,'reserve_omnex_purchase',{p_user:uid,p_product:body.id,p_quote:body.quote_id,p_client:body.client_key,p_fields:fields,p_terms:true});
   await scheduleJob(service,order.order_id,uid);return reply(order,202,origin);
  }
  if(body.action==='order'||body.action==='resume'){
   const args={p_user:uid,...(body.action==='order'?{p_order:body.order_id}:{p_client:body.client_key})};
   const order=await rpc(service,'omnex_order_snapshot',args);if(!order)return reply({order:null},200,origin);
   await scheduleJob(service,order.order_id,uid);return reply(order,200,origin);
  }
  if(await rpc(userDb,'is_store_admin')!==true)return reply({error:'forbidden'},403,origin);
  if(body.action==='status'){const state=await rpc(userDb,'get_omnex_roblox_admin_catalog');return reply({configured:!!Deno.env.get('OMNEX_API_KEY'),scope:'roblox',purchasing_enabled:state.purchasing_enabled},200,origin)}
  if(body.action==='catalog')return reply(await rpc(userDb,'get_omnex_roblox_admin_catalog'),200,origin);
  if(body.action==='sync')return reply({ok:true,imported:await syncCatalog(service),scope:'roblox'},200,origin);
  if(body.action==='sync_psn')return reply({ok:true,imported:await syncPsn(service),scope:'psn'},200,origin);
  return reply({error:'invalid_action'},400,origin);
 }catch(error){
  const known=new Set(['invalid_product','product_not_available','unsupported_product_fields','invalid_product_fields','missing_product_field','invalid_purchase','quote_expired','supplier_sales_paused','supplier_price_unavailable','supplier_out_of_stock','supplier_wallet_changed','supplier_price_requires_review','insufficient_balance','phone_verification_required_before_purchase','too_many_pending_orders','supplier_order_already_pending','idempotency_conflict','quote_rate_limit']);
  const code=String(error?.message||'');return reply({error:known.has(code)?code:'supplier_unavailable'},code==='insufficient_balance'?409:400,origin);
 }
});
