/* The supplier's idempotent request body is persisted before the first POST.
   This pure state machine is tested with mock responses, never paid test orders. */
export function millis(value){
 const raw=String(value??'');if(!/^\d{1,8}(\.\d{1,3})?$/.test(raw))return null;
 const [a,b='']=raw.split('.');return Number(a)*1000+Number(b.padEnd(3,'0'));
}
export function deliveryCodes(delivery, allowBare=true){
 const out=[];
 const codeKeys=['code','card_code','cardCode','voucher_code','voucherCode','redeem_code','redeemCode','gift_code','giftCode','code_value','codeValue','activation_code','activationCode','license_key','licenseKey'];
 const containers=['codes','cards','vouchers','items','delivery','delivery_codes','deliveryCodes','digital_codes','gift_codes','giftCards','delivery_data','deliveryData','delivery_details','deliveryDetails','data','result'];
 const add=(raw,pin)=>{if(typeof raw!=='string'&&typeof raw!=='number')return;const code=String(raw).trim();if(!code||code.length>4000)return;if(!/^[A-Za-z0-9][A-Za-z0-9 -]{3,3999}$/.test(code)||!/[0-9]/.test(code)||/^(?:pending|processing|completed|success|undefined|null|unavailable|refunded|not available|no code)/i.test(code))return;const p=typeof pin==='string'||typeof pin==='number'?String(pin).trim():'';if(p&&(!/^[A-Za-z0-9-]{1,128}$/.test(p)))return;const v=code+(p?'\\nPIN: '+p:'');if(!out.includes(v)&&out.length<12)out.push(v);};
 function scan(v,depth,bare){
  if(depth>5||v==null)return;
  if(typeof v==='string'||typeof v==='number'){if(bare)add(v);return;}
  if(Array.isArray(v)){for(const row of v.slice(0,50))scan(row,depth+1,bare);return;}
  if(typeof v!=='object')return;
  for(const k of codeKeys)if(Object.hasOwn(v,k))add(v[k],v.pin??v.PIN);
  for(const k of containers)if(Object.hasOwn(v,k))scan(v[k],depth+1,!['items','data','result','delivery_details','deliveryDetails'].includes(k));
 }
 scan(delivery,0,allowBare);
 return out.join('').length<=16000?out:[];
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
    const codes=[...new Set([...deliveryCodes(order.delivery),...deliveryCodes({codes:order.codes,delivery_codes:order.delivery_codes,deliveryCodes:order.deliveryCodes,delivery_data:order.delivery_data,deliveryData:order.deliveryData,cards:order.cards,vouchers:order.vouchers,code:order.code,card_code:order.card_code,voucher_code:order.voucher_code,pin:order.pin},false),...deliveryCodes({codes:body.codes,delivery:body.delivery,delivery_codes:body.delivery_codes,cards:body.cards,vouchers:body.vouchers},false)])];
    if(!codes.length && job.remote_order_id==='10a26ed96ed7bfb14525dcd567a6c1c2'){
      // Only structural information; never log voucher values, customer data or credentials.
      const known=new Set(['order','delivery','codes','code','items','data','result','cards','vouchers','serial','serial_number','serialNumber','pin','PIN','value','type','status','content','text','details','card','card_code','cardCode','voucher','voucher_code','voucherCode','redeem_code','redeemCode','product','quantity','delivery_data','delivery_codes','deliveryData','deliveryCodes','payload','message','number','key','digital_codes','gift_codes','giftCards','code_value','codeValue','license_key','licenseKey','activation_code','activationCode','delivery_details','deliveryDetails','credentials','rows','list','response','success','id','amount','wallet','name','description','reference','created_at','updated_at','delivered_at','needs_review']);
      const shape=(v,d=0)=>{if(v===null)return 'null';if(d>4)return typeof v;if(Array.isArray(v))return {array:v.length,first:v.length?shape(v[0],d+1):null};if(typeof v==='object'){const ks=Object.keys(v);return {fields:Object.fromEntries(ks.filter(k=>known.has(k)).slice(0,30).map(k=>[k,shape(v[k],d+1)])),other:ks.length-ks.filter(k=>known.has(k)).length};}return typeof v;};
      console.info('[omnex-delivery-shape]',JSON.stringify(shape(body)));
    }
    const manual=order.type==='manual'&&job.fields&&Object.keys(job.fields).length>0;
    if(!codes.length&&!manual){
     return finish('review',remote,[],'completed_without_delivery',30);
    }
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

