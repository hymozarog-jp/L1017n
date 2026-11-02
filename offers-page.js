/* L1017n Offers page. Read-only catalog; checkout remains the existing
   server-authorized Roblox username verification / wallet order flow. */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const price=value=>Number(value).toFixed(2)+' د.ل';
  const promoPrefix='robux-promo-';
  const deliveryText=()=>window.L1017nDeliveryPolicy?.label('roblox')||'وقت التسليم: لم تُحدَّد مدة ثابتة حاليًا. التنفيذ يدوي بعد مراجعة الطلب، وليس فوريًا.';
  let requestId=0;
  let cached={};
  function client(){
    return typeof supabaseClient!=='undefined'?supabaseClient:null;
  }
  function display(p,available){
    const amount=Number(p.amount);
    const title=String(p.name||'عرض روبوكس');
    const match=title.match(/\+\s*(\d{1,5})\s*هدية/);
    const bonus=match?Number(match[1]):0;
    const base=bonus>0&&amount>=bonus?amount-bonus:amount;
    const note=bonus>0
      ? '<span class="l1017-offer-bonus">+'+bonus+' روبوكس هدية</span>'
      : '<span class="l1017-offer-bonus l1017-offer-standard">عرض خاص</span>';
    return '<article class="l1017-offer-card">'
      +'<div class="l1017-offer-art"><img src="game-covers/robux-100-tokens.svg?v=robux-art2" alt="عملات روبوكس" loading="lazy"></div>'
      +'<div class="l1017-offer-details"><div class="l1017-offer-card-top"><span class="l1017-offer-brand">ROBLOX / ROBUX</span>'+note+'</div>'
      +'<h3>'+escape(title)+'</h3>'
      +'<div class="l1017-offer-sum"><span>'+base+' روبوكس أساسي</span><span>الإجمالي <strong>'+amount+' روبوكس</strong></span></div>'
      +'<div class="l1017-offer-bottom"><div class="l1017-offer-cost"><small>سعر العرض</small><strong>'+price(p.price)+'</strong></div>'
      +'<button type="button" class="l1017-offer-buy" data-offer-id="'+escape(p.id)+'"'
      +(available?'':' disabled aria-disabled="true"')+'>'
      +(available?'اطلب العرض <span aria-hidden="true">←</span>':'غير متوفر حاليًا')+'</button></div>'
      +'<p class="l1017-offer-availability '+(available?'available':'unavailable')+'">'
      +(available?'متوفر · التنفيذ بعد مراجعة الطلب':'الكمية غير متوفرة حاليًا')+'</p>'
      +(available?'<div class="l1017-delivery-time" role="note"><svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-clock"></use></svg><span>'+escape(deliveryText())+'</span></div>':'')
      +'</div></article>';
  }
  async function render(){
    const root=byId('offersView'),target=byId('offersList');
    if(!root||!target||root.classList.contains('hidden'))return;
    const token=++requestId;
    target.innerHTML='<div class="l1017-offer-message" role="status">جاري تحميل العروض المتوفرة…</div>';
    const db=client();
    if(!db){
      target.innerHTML='<div class="l1017-offer-message">جاري تهيئة المتجر. حاول مرة ثانية.</div>';
      return;
    }
    try{
      const [productsResult,inventoryResult]=await Promise.all([
        db.from('products').select('id,product_key,name,game,amount,price,active,sort_order')
          .eq('active',true).like('product_key',promoPrefix+'%').order('sort_order'),
        db.from('store_inventory').select('robux_available').eq('id',true).maybeSingle()
      ]);
      if(token!==requestId||!root.isConnected||root.classList.contains('hidden'))return;
      if(productsResult.error)throw productsResult.error;
      const availableStock=!inventoryResult.error&&inventoryResult.data
        ?Number(inventoryResult.data.robux_available):null;
      const list=(productsResult.data||[]).filter(p=>
        p.active===true&&
        String(p.game||'').toLowerCase()==='roblox'&&
        String(p.product_key||'').startsWith(promoPrefix)&&
        Number.isInteger(Number(p.amount))&&Number(p.amount)>0&&
        Number.isFinite(Number(p.price))&&Number(p.price)>0
      );
      cached={};
      for(const item of list)cached[item.id]={...item,available:availableStock!==null&&availableStock>=Number(item.amount)};
      byId('offersCount').textContent=list.length?list.length+' عرض متوفر بالقائمة':'لا توجد عروض حاليًا';
      if(!list.length){
        target.innerHTML='<div class="l1017-offer-message"><strong>مافيش عروض متاحة حاليًا</strong><p>العروض الجديدة بتظهر هنا وقت ما تتفعّل في المتجر.</p></div>';
        return;
      }
      target.innerHTML=list.map(p=>display(p,cached[p.id].available)).join('');
      if(availableStock===null){
        target.querySelectorAll('.l1017-offer-availability').forEach(x=>x.textContent='تعذر التحقق من المخزون؛ حدّث الصفحة.');
      }
    }catch(error){
      console.warn('[offers] unavailable',error);
      target.innerHTML='<div class="l1017-offer-message"><strong>تعذر تحميل العروض</strong><p>تحقق من الإنترنت وحاول مرة ثانية.</p><button type="button" data-offers-retry>إعادة المحاولة</button></div>';
    }
  }
  async function openOffer(id,button){
    const product=cached[id];
    if(!product||!product.available)return;
    if(typeof window.openRobuxPackages!=='function'){
      const msg=byId('offersList');
      if(msg)msg.insertAdjacentHTML('afterbegin','<p class="l1017-offer-alert" role="alert">قسم شحن روبوكس غير جاهز حاليًا؛ حدّث الصفحة.</p>');
      return;
    }
    button.disabled=true;
    button.textContent='جاري فتح الباقة…';
    try{
      if(typeof loadProducts==='function')await loadProducts();
      // Prices and stock always come from the server for actual purchase.
      window.openRobuxPackages();
      const modal=byId('robuxModal');
      const offerTile=modal&&Array.from(modal.querySelectorAll('.robux-package[data-robux]'))
        .find(tile=>tile.dataset.robux===id);
      if(!offerTile||offerTile.disabled){
        if(typeof window.closeRobuxPackages==='function')window.closeRobuxPackages();
        await render();
        return;
      }
      offerTile.click(); // Existing package selection + checkout continuation.
    }catch(e){
      console.warn('[offers] checkout navigation',e);
      if(typeof window.closeRobuxPackages==='function')window.closeRobuxPackages();
      alert('تعذر فتح العرض حاليًا. حاول مرة ثانية.');
    }finally{
      if(button.isConnected){
        button.disabled=false;
        button.innerHTML='اطلب العرض <span aria-hidden="true">←</span>';
      }
    }
  }
  function init(){
    const section=byId('offersView');
    if(!section||section.dataset.offersBound)return;
    section.dataset.offersBound='1';
    section.addEventListener('click',event=>{
      const retry=event.target.closest('[data-offers-retry]');
      if(retry){void render();return}
      const button=event.target.closest('[data-offer-id]');
      if(button&&!button.disabled)void openOffer(button.dataset.offerId,button);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.L1017nOffers={render};
})();
