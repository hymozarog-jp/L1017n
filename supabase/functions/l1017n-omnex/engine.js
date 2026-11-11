/* The supplier's idempotent request body is persisted before the first POST.
   This pure state machine is tested with mock responses, never paid test orders. */
export function millis(value){
 const raw=String(value??'');if(!/^\d{1,8}(\.\d{1,3})?$/.test(raw))return null;
 const [a,b='']=raw.split('.');return Number(a)*1000+Number(b.padEnd(3,'0'));
}
export function deliveryCodes(delivery){
 const rows=Array.isArray(delivery)?delivery:Array.isArray(delivery?.codes)?delivery.codes:[];
 const out=[];for(const row of rows){
  const code=typeof row==='string'?row:typeof row?.code==='string'?row.code:typeof row?.code==='number'?String(row.code):'';
  if(!code.trim()||code.length>4000)continue;
  const pin=typeof row==='object'&&row&&typeof row.pin==='string'?row.pin:'';
  out.push(code.trim()+(pin?'\nPIN: '+pin:''));
 }
 return out.slice(0,12).join('').length<=16000?out:[];
}
export async function processSupplierJob(job,request,settle){
 const args={p_order:job.order_id,p_lease:job.lease_token};
 const finish=(state,remote=null,codes=[],error=null,retry=30)=>settle({...args,p_state:state,p_remote:remote,p_codes:codes,p_error:error,p_retry:retry});
 try{
  const response=job.remote_order_id?await request('order',job.remote_order_id):await request('purchase','',job.payload_text);
  const body=response.body||{},order=body.order;
  if((response.status===200||response.status===201)&&order&&/^[a-f0-9]{32}$/.test(String(order.id||''))){
   const remote=order.id;
   if(job.remote_order_id&&job.remote_order_id!==remote)return finish('review',null,[],'supplier_order_id_mismatch',300);
   if(order.wallet!==job.wallet||millis(order.amount)!==millis(job.supplier_cost))return finish('review',remote,[],'supplier_amount_or_wallet_mismatch',300);
   if(order.status==='refunded')return finish('refunded',remote,[],null,30);
   if(order.status==='completed'){
    const codes=deliveryCodes(order.delivery);
    const manual=order.type==='manual'&&job.fields&&Object.keys(job.fields).length>0;
    if(!codes.length&&!manual)return finish('review',remote,[],'completed_without_delivery',300);
    return finish('completed',remote,codes,null,30);
   }
   if(order.needs_review===true)return finish('review',remote,[],'supplier_needs_review',300);
   if(['pending','sending','processing'].includes(order.status))return finish('processing',remote,[],null,15);
   return finish('review',remote,[],'unknown_supplier_status',300);
  }
  const error=typeof body.error==='string'?body.error.slice(0,100):'supplier_response_invalid';
  // Only explicit pre-purchase rejection codes can release the held wallet amount.
  // Generic request_failed, network errors, 401/403, malformed JSON, 5xx and an
  // unknown 409 are not proof that the supplier did not create an order.
  const definitive=new Set(['invalid_purchase','price_changed','wallet_changed','product_not_found','product_unavailable','out_of_stock','insufficient_stock','insufficient_balance']);
  if(!job.remote_order_id&&[400,404,409,422].includes(response.status)&&definitive.has(error))return finish('refunded',null,[],error,30);
  if(response.status===429)return finish('unknown',null,[],error,Math.max(15,Math.min(3600,Number(response.retry_after)||Number(body.retry_after)||60)));
  if(Number(job.attempts)>=8&&!job.remote_order_id)return finish('review',null,[],error,300);
  return finish(job.remote_order_id?'processing':'unknown',null,[],error,Math.min(600,15*2**Math.min(Number(job.attempts)||1,5)));
 }catch(_){
  return finish(Number(job.attempts)>=8&&!job.remote_order_id?'review':job.remote_order_id?'processing':'unknown',null,[],'supplier_connection_unknown',60);
 }
}
