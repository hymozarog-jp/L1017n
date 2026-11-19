// Server-only reseller credentials. No keys in query strings or request logs.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DIGITAL=/^digital_[a-f0-9]{32}$/;
const LOCAL=/^local_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const origins=new Set(['https://hymozarog-jp.github.io','https://l1017n.ct.ws']);
const errors=new Set(['unauthorized','rate_limited','invalid_action','invalid_product','invalid_purchase','invalid_product_fields','missing_product_field','unsupported_product_fields','product_not_available','price_changed','quote_expired','quote_rate_limit','supplier_sales_paused','supplier_price_unavailable','supplier_out_of_stock','supplier_wallet_changed','supplier_price_requires_review','insufficient_balance','phone_required_before_purchase','too_many_pending_orders','supplier_order_already_pending','idempotency_conflict','order_not_found','robux_out_of_stock','invalid_roblox_username','quote_already_used']);
async function readJSON(req){
 const reader=req.body?.getReader();if(!reader)throw Error('invalid_json');let size=0;const chunks=[];
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('payload_too_large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{const b=JSON.parse(new TextDecoder().decode(bytes));if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b}catch{throw Error('invalid_json')}
}
export function createHandler({database,rpc,supplier,fieldsSchema,checkFields,scheduleJob,hash}){
 return async(req)=>{
  const origin=req.headers.get('origin')||'';
  const cors=origins.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'POST,OPTIONS'}:{};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...cors,...(status===429?{'retry-after':'60'}:{})}});
  if(origin&&!origins.has(origin))return reply({error:'server_to_server_only'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  if(new URL(req.url).search)return reply({error:'query_parameters_not_supported'},400);
  const token=req.headers.get('authorization')?.match(/^Bearer (l1017n_live_[a-f0-9]{64})$/)?.[1];
  if(!token)return reply({error:'unauthorized'},401);
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply({error:'json_required'},415);
  let body;try{body=await readJSON(req)}catch(e){return reply({error:e.message},e.message==='payload_too_large'?413:400)}
  const allowed=new Set(['products','balance','quote','purchase','order']);if(!allowed.has(body.action))return reply({error:'invalid_action'},400);
  const db=database();const digest=await hash(token);
  const call=(action,data={})=>rpc(db,'reseller_api_dispatch',{p_hash:digest,p_action:action,p_data:data});
  try{
   const account=await call('authorize');
   if(body.action==='balance'||body.action==='products')return reply(await call(body.action));
   if(body.action==='order'){
    if(!UUID.test(body.order_id||''))throw Error('order_not_found');
    const order=await call('order',{order_id:body.order_id});
    if(DIGITAL.test(order.product_id||'')&&!['completed','refunded'].includes(order.state))await scheduleJob(db,order.order_id,account.user_id).catch(()=>{});
    return reply(order);
   }
   const digital=DIGITAL.test(body.product_id||'');if(!digital&&!LOCAL.test(body.product_id||''))throw Error('invalid_product');
   if(body.action==='quote'){
    if(!digital)return reply(await call('quote_local',{product_id:body.product_id}));
    const id=body.product_id.slice(8);const known=await rpc(db,'omnex_product_for_service',{p_product:id});if(!known)throw Error('product_not_available');
    const res=await supplier(db,'product',id),p=res.body?.product;
    if(res.status!==200||!p||p.id!==id||res.body.price_status!=='fresh')throw Error('supplier_price_unavailable');
    const category=known.supplier_category_id|| (known.game==='pubg'?'30faee6b9893e3f424961c15a785efc3':'cd40561b622c4fa9ed9984c31f0c697f');
    if(!category||p.category!==category)throw Error('product_not_available');
    if(p.purchase_available===false||[0,'0'].includes(res.body.stock)||[0,'0'].includes(p.stock))throw Error('supplier_out_of_stock');
    const quote=await call('quote_digital',{product_id:body.product_id,cost:p.price,wallet:res.body.wallet||p.wallet,stock:res.body.stock??p.stock??null,schema:fieldsSchema(res.body.fields||[])});
    delete quote.id;return reply(quote);
   }
   if(body.accepted_terms!==true||!UUID.test(body.request_id||'')||!['string','number'].includes(typeof body.expected_price)||!Number.isFinite(Number(body.expected_price))||Number(body.expected_price)<=0)throw Error('invalid_purchase');
   let fields=body.fields||{};
   if(digital){
    if(!UUID.test(body.quote_id||''))throw Error('quote_expired');
    const quote=await rpc(db,'omnex_quote_for_service',{p_user:account.user_id,p_quote:body.quote_id});
    // For a retry after expiry, the same stored quote remains available; the
    // atomic reservation returns an existing request before checking expiry.
    if(!quote||quote.product_id!==body.product_id.slice(8))throw Error('quote_expired');
    fields=checkFields(quote.fields_schema,fields);
   }
   const order=await call(digital?'purchase_digital':'purchase_local',{product_id:body.product_id,request_id:body.request_id,expected_price:body.expected_price,accepted_terms:true,quote_id:body.quote_id,fields});
   if(digital&&!['completed','refunded'].includes(order.state))await scheduleJob(db,order.order_id,account.user_id).catch(()=>{});
   return reply(order,order.status==='completed'?200:202);
  }catch(e){
   const code=errors.has(e.message)?e.message:'service_unavailable';
   return reply({error:code},code==='unauthorized'?401:code==='order_not_found'?404:['rate_limited','quote_rate_limit'].includes(code)?429:['insufficient_balance','price_changed','idempotency_conflict'].includes(code)?409:code==='service_unavailable'?503:400);
  }
 };
}
