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
async function fetchCatalog(db){
 const r=await supplier(db,'catalog');
 if(r.status!==200||!Array.isArray(r.body?.products))throw Error('supplier_unavailable');
 return r.body;
}
function catalogAvailable(product){
 return product.purchase_available===true&&product.stock!==0&&product.stock!=='0';
}
async function syncCatalog(db,cat){
 cat=cat??await fetchCatalog(db);const groups=new Map((cat.groups||[]).filter(g=>g.category==='cd40561b622c4fa9ed9984c31f0c697f').map(g=>[g.id,g.name]));
 const items=cat.products.filter(p=>p.category==='cd40561b622c4fa9ed9984c31f0c697f').map(p=>({id:p.id,category:p.category,name:p.name,group_name:groups.get(p.group)||'',price:p.price,stock:p.stock,available:catalogAvailable(p),image_url:p.image_url||''}));
 return rpc(db,'sync_omnex_roblox_catalog',{p_items:items,p_wallet:cat.wallet});
}

/* PlayStation gift-card catalog: discover the supplier's category by its own
   name; never trust customer-supplied category IDs. Unrecognized catalogs fail closed. */
async function syncPsn(db,cat){
 cat=cat??await fetchCatalog(db);
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
  price:p.price,stock:p.stock,available:catalogAvailable(p),image_url:p.image_url||''
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

async function syncPubg(db,cat){
 cat=cat??await fetchCatalog(db);
 const category='30faee6b9893e3f424961c15a785efc3';
 const groups=new Map((Array.isArray(cat.groups)?cat.groups:Object.values(cat.groups||{}))
  .filter(g=>g&&g.id).map(g=>[g.id,g.name||g.title||'']));
 const items=cat.products.filter(p=>p?.category===category&&/^[a-f0-9]{32}$/.test(p.id||'')).map(p=>({
  id:p.id,category,name:p.name,group_name:groups.get(p.group)||p.group_name||'',
  price:p.price,stock:p.stock,available:catalogAvailable(p),image_url:p.image_url||''
 }));
 if(!items.length||items.length>500)throw Error('pubg_catalog_unavailable');
 return rpc(db,'sync_omnex_pubg_catalog',{p_items:items,p_wallet:cat.wallet});
}

async function worker(db){
 const tasks=[];for(let i=0;i<6;i++){const job=await rpc(db,'claim_omnex_job');if(!job)break;tasks.push(runJob(db,job));}
 await Promise.allSettled(tasks);
 const catalogs=[
  ['omnex_catalog_sync_due',syncCatalog],
  ['omnex_psn_catalog_sync_due',syncPsn],
  ['omnex_pubg_catalog_sync_due',syncPubg]
 ];
 const checks=await Promise.allSettled(catalogs.map(([due])=>rpc(db,due)));
 const pending=catalogs.filter((_,index)=>checks[index].status==='fulfilled'&&checks[index].value===true);
 if(!pending.length)return;
 try{
  const catalog=await fetchCatalog(db);
  // Reuse one supplier response, and keep each category's failure isolated.
  for(const [name,sync] of pending){
   try{await sync(db,catalog)}
   catch(error){console.warn('[omnex-catalog-sync]',name,String(error?.message||'unknown').slice(0,100))}
  }
 }catch(error){console.warn('[omnex-catalog-sync]',String(error?.message||'unknown').slice(0,100))}
}
function fieldsSchema(raw){
 if(!Array.isArray(raw)||raw.length>10)throw Error('unsupported_product_fields');
 return raw.map(field=>{
  const key=String(field.key||field.code||'');if(!/^[A-Za-z0-9_]{1,60}$/.test(key)||/password|passwd|secret|otp|token/i.test(key))throw Error('unsupported_product_fields');
  const rawType=String(field.type||'text');const type=['string','email','textarea','tel'].includes(rawType)?'text':rawType;if(!['text','number','select'].includes(type))throw Error('unsupported_product_fields');
  const options=Array.isArray(field.options)?field.options.map(v=>typeof v==='object'?{value:String(v.value??v.id??''),label:String(v.label??v.name??v.value??'').slice(0,100)}:{value:String(v),label:String(v)}).filter(o=>o.value&&o.value.length<=200):[];
  if(type==='select'&&!options.length)throw Error('unsupported_product_fields');
  return {key,label:String(field.label||field.name||key).slice(0,100),required:field.required!==false,type,options};
 });
}
function checkFields(schema,values){
 if(!values||typeof values!=='object'||Array.isArray(values)||JSON.stringify(values).length>4000)throw Error('invalid_product_fields');
 const out={};for(const field of schema){const raw=values[field.key];if(raw!==undefined&&typeof raw!=='string')throw Error('invalid_product_fields');const value=String(raw||'').trim();if(value.length>200||field.required&&!value)throw Error('missing_product_field');if(field.type==='number'&&value&&!/^\d{1,40}$/.test(value))throw Error('invalid_product_fields');if(field.type==='select'&&value&&!field.options.some(o=>o.value===value))throw Error('invalid_product_fields');if(value)out[field.key]=value;}
 if(Object.keys(values).some(k=>!schema.some(s=>s.key===k)))throw Error('invalid_product_fields');return out;
}

export { database, rpc, supplier, fieldsSchema, checkFields, scheduleJob };

