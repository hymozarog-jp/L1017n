/* Instant digital code checkout. Wallet debit and stock allocation happen atomically in Postgres. */
(function(){
  'use strict';
  let busy = false;
  function client(){
    return typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  }
  function message(error) {
    const text = String(error && (error.message || error.details) || error || '');
    if (/insufficient_balance/i.test(text)) return 'رصيد محفظتك غير كافٍ. اشحن المحفظة أولاً.';
    if (/code_out_of_stock/i.test(text)) return 'الأكواد نفدت لهذه الباقة. لم يتم خصم أي مبلغ.';
    if (/product_not_available|manual_fulfillment_required/i.test(text)) return 'هذه الباقة غير متاحة للتسليم الفوري.';
    if (/not_authenticated|JWT|unauthorized/i.test(text)) return 'سجّل الدخول أولاً للشراء.';
    return 'تعذر إتمام الشراء. تحقق من طلباتك قبل المحاولة مرة ثانية.';
  }
  function showDeliveredCode(name,code){
    const old = document.getElementById('instantCodeOverlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'instantCodeOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','كود الشراء');
    overlay.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl';
    const box = document.createElement('div');
    box.style.cssText='width:min(96vw,480px);border-radius:22px;background:#102020;color:#fff;padding:25px;box-shadow:0 18px 70px #0009;text-align:center';
    const title=document.createElement('h2');
    title.textContent='✅ تم الشراء واستلام الكود';
    const product=document.createElement('p');
    product.textContent=name;
    const help=document.createElement('p');
    help.textContent='احتفظ بالكود. يمكنك الرجوع له دائمًا من صفحة «طلباتي».';
    const value=document.createElement('div');
    value.dir='ltr';
    value.style.cssText='margin:16px 0;padding:17px;background:#061312;border:1px solid #3a8d76;border-radius:14px;overflow-wrap:anywhere;font-size:1.16rem;font-weight:bold;user-select:all';
    value.textContent=code;
    const copy=document.createElement('button');
    copy.type='button'; copy.textContent='نسخ الكود';
    copy.className='btn btn-primary';
    copy.style.marginInlineEnd='8px';
    copy.onclick=async()=>{
      try{await navigator.clipboard.writeText(code);copy.textContent='تم النسخ ✓';}
      catch(_){copy.textContent='حدد الكود بالأعلى وانسخه';}
    };
    const close=document.createElement('button');
    close.type='button';close.className='btn btn-soft';close.textContent='إغلاق';
    close.onclick=()=>overlay.remove();
    box.append(title,product,value,help,copy,close);
    overlay.append(box);
    document.body.append(overlay);
    close.focus();
  }
  window.showInstantCode=showDeliveredCode;
  window.openInstantCodeCheckout=async function(productId, productName, amount){
    if(busy) return;
    const db=client();
    if(!db){alert('تعذر تحميل المتجر. أعد تحميل الصفحة.');return;}
    if(!confirm('شراء '+productName+' بمبلغ '+Number(amount).toFixed(2)+' د.ل واستلام الكود فورًا من محفظتك؟'))return;
    busy=true;
    try {
      const {data:{user},error:authError}=await db.auth.getUser();
      if(authError||!user){alert('سجّل دخولك أولاً للشراء.');return;}
      const {data,error}=await db.rpc('buy_instant_code',{p_product_id:productId});
      if(error)throw error;
      if(!data||typeof data.code!=='string')throw new Error('unexpected_response');
      showDeliveredCode(String(data.product_name||productName),data.code);
      try{if(typeof renderWallet==='function')await renderWallet();}catch(_){}
      try{if(typeof renderOrders==='function')await renderOrders();}catch(_){}
    }catch(error){
      alert(message(error));
    }finally{busy=false;}
  };
  window.getMyInstantCodes=async function(){
    const db=client();
    if(!db)return [];
    const {data,error}=await db.rpc('get_my_purchased_codes');
    if(error)throw error;
    return Array.isArray(data)?data:[];
  };
})();