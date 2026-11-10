/* L1017n customer experience layer. Does not authorize transfers, credit wallets or submit orders. */
(function(){
  'use strict';
  const $ = selector => document.querySelector(selector);
  // Original, lightweight inline vector drawings for the three main actions.
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 10h18M14 13h8v5h-8a2.5 2.5 0 0 1 0-5Z"/><circle cx="17" cy="15.5" r=".7" fill="currentColor" stroke="none"/></svg>';
  const storeArt='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 7 3h10l3 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"/><path d="M4 9h16M9 21v-7h6v7"/><path d="M9 3v6m6-6v6"/></svg>';
  const ordersArt='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="19" rx="3"/><path d="M9 8h6m-6 4h4m-4 4h2"/><path d="m14 17 2 2 4-4"/></svg>';
  const shield = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/><path d="m8 12 3 3 5-5"/></svg>';
  const format = number => Number(number).toLocaleString('ar-LY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const unsafeOverlays = '#robuxPurchaseScreen,#robuxModal,#rgpMm2Checkout,#robloxGamePage,#sabCheckout,#pubgAccountCheckoutOverlay';

  function navigate(view){
    if(typeof window.switchView==='function')window.switchView(view);
    else {
      const nav=$('.mobile-nav [data-view="'+view+'"],.desktop-nav [data-view="'+view+'"]');
      nav?.click();
    }
  }
  function closeCheckoutViews(){
    // Only the customer-facing overlays are dismissed; no server action is called.
    const screen=$('#robuxPurchaseScreen');
    if(screen){const back=screen.querySelector('.robux-purchase-back');back?.click();}
    if(typeof window.closeRobuxPackages==='function')window.closeRobuxPackages();
    for(const node of document.querySelectorAll(unsafeOverlays)){
      if(node.id==='robuxModal')node.classList.add('hidden');
      else node.remove();
    }
  }
  function goWallet(amount){
    closeCheckoutViews();
    navigate('wallet');
    const field=$('#topupAmount');
    if(field&&Number.isFinite(amount)&&amount>=1&&amount<=10000){
      field.value=String(Math.ceil(amount));
      field.dispatchEvent(new Event('input',{bubbles:true}));
    }
    setTimeout(()=>{const form=$('#topupForm'),gate=$('#libyanaTopupGate');const destination=(form&&form.style.display!=='none'?form:gate||form);destination?.scrollIntoView({behavior:'smooth',block:'start'});},180);
  }
  function ensureHome(){
    const home=$('#storeView');
    if(!home||$('#gbQuickActions'))return;
    const panel=document.createElement('section');
    panel.id='gbQuickActions';
    panel.setAttribute('aria-label','اختصارات الشراء والشحن');
    panel.innerHTML='<div class="gbqa-heading"><b>ابدأ من هنا</b><small>شحن أو شراء أو متابعة</small></div>'+
      '<div class="gbqa-buttons">'+
      '<button type="button" class="gbqa-action gbqa-primary" data-gbqa="wallet"><span class="gbqa-art gbqa-art-wallet" aria-hidden="true">'+icon+'</span><span>شحن الرصيد</span></button>'+
      '<button type="button" class="gbqa-action" data-gbqa="catalog"><span class="gbqa-art gbqa-art-store" aria-hidden="true">'+storeArt+'</span><span>الأقسام</span></button>'+
      '<button type="button" class="gbqa-action" data-gbqa="orders"><span class="gbqa-art gbqa-art-orders" aria-hidden="true">'+ordersArt+'</span><span>طلباتي</span></button></div>'+
      '<p class="gbqa-footer">'+shield+'الدفع من المحفظة بعد توثيق رقمك. الرصيد يُضاف فقط بعد تأكيد التحويل.</p>';
    const target=home.querySelector('#llLanding .ll-search-wrap,.ph-search-wrap,.section-head');
    if(target)target.parentNode.insertBefore(panel,target);else home.prepend(panel);
    panel.addEventListener('click',event=>{
      const btn=event.target.closest('[data-gbqa]');if(!btn)return;
      if(btn.dataset.gbqa==='wallet')goWallet();
      else if(btn.dataset.gbqa==='orders')navigate('orders');
      else $('#productGrid')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  // The wallet now has a built-in three-step top-up wizard. The former
  // large "شحن المحفظة في 3 خطوات" helper duplicated the entire flow.
  // Remove leftover legacy guide elements, including on re-renders.
  function ensureWallet(){
    document.getElementById('gbWalletGuide')?.remove();
  }
  function priceOf(overlay){
    const container=overlay.closest('#robuxPurchaseScreen,#rgpMm2Checkout,#sabCheckout,#pubgAccountCheckoutOverlay')||overlay;
    const candidates=[
      container.querySelector('.robux-menu-summary span')?.textContent,
      container.querySelector('#purchaseForm h3')?.textContent,
      container.querySelector('.mm2-checkout-box p')?.textContent,
      container.querySelector('strong')?.textContent
    ];
    for(const value of candidates){
      const match=String(value||'').match(/([0-9]+(?:[.,][0-9]+)?)\s*د\s*\.?\s*ل/);
      if(match){const n=Number(match[1].replace(',','.'));if(Number.isFinite(n)&&n>0)return n}
    }
    return null;
  }
  async function showRealBalance(form,panel,price){
    const line=panel.querySelector('.gbj-total');
    try {
      if(typeof supabaseClient==='undefined')return;
      const db=supabaseClient;
      const {data:auth,error:authError}=await db.auth.getUser();
      if(!panel.isConnected)return;
      if(authError||!auth?.user){line.textContent='سجّل الدخول لتعبئة المحفظة والشراء.';return}
      const {data,error}=await db.from('wallet_accounts').select('balance').eq('user_id',auth.user.id).maybeSingle();
      if(!panel.isConnected||error||!data)return;
      const balance=Number(data.balance);
      if(!Number.isFinite(balance)||balance<0)return;
      const diff=price===null?null:Math.max(0,Math.round((price-balance)*100)/100);
      const compact=!!form.closest('#robuxPurchaseScreen');
      line.textContent=(compact?'رصيدك: ':'رصيد محفظتك: ')+format(balance)+' د.ل'+(diff===null?'':diff>0?' · ينقصك '+format(diff)+' د.ل':compact?'':' · رصيدك يكفي قيمة الباقة');
      if(compact){const actions=panel.querySelector('.gbj-actions');if(actions)actions.hidden=diff!==null&&diff<=0;}
      if(diff!==null&&diff>0&&diff<=10000){
        const button=panel.querySelector('[data-gbj="topup"]');
        if(button){button.dataset.shortfall=String(Math.ceil(diff));button.textContent='اشحن المبلغ الناقص ('+format(diff)+' د.ل)'}
      }
    }catch(_){/* Keep a neutral message when wallet lookup is unavailable. */}
  }
  const checked=new WeakSet();
  function enhanceCheckout(form){
    if(checked.has(form)||!form.isConnected)return;
    checked.add(form);
    const panel=document.createElement('div');
    panel.className='gb-journey';
    panel.setAttribute('role','note');
    panel.innerHTML='<h3 class="gbj-title">قبل تأكيد الشراء</h3>'+
      '<p class="gbj-desc">راجع اسم المستخدم والباقة. المبلغ يُخصم فقط عند نجاح الطلب من النظام. إذا رصيدك ما يكفي، اشحن محفظتك أولاً.</p>'+
      '<div class="gbj-total" aria-live="polite">جاري فحص رصيد محفظتك…</div>'+
      '<div class="gbj-actions"><button type="button" data-gbj="topup">شحن المحفظة</button></div>';
    const submit=form.querySelector('[type="submit"]');
    const anchor=submit&&(submit.closest('.mm2-actions,.sab-actions,.pubg-actions')||submit);
    if(anchor&&anchor.parentElement===form)form.insertBefore(panel,anchor);
    else form.appendChild(panel);
    const price=priceOf(form);
    showRealBalance(form,panel,price);
    panel.querySelector('[data-gbj="topup"]').addEventListener('click',()=>{
      const n=Number(panel.querySelector('[data-gbj="topup"]').dataset.shortfall||0);
      goWallet(n||undefined);
    });
  }
  let scheduled=false;
  function refresh(){
    scheduled=false;
    ensureHome();
    ensureWallet();
    document.querySelectorAll('#robuxPurchaseScreen #purchaseForm,#rgpMm2Checkout form,#sabCheckout form,#pubgAccountCheckoutOverlay form').forEach(enhanceCheckout);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh)}
  function boot(){
    schedule();
    if(typeof MutationObserver==='function'){
      new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    }
    document.addEventListener('click',event=>{
      if(event.target.closest('#topupForm [data-amount],#walletActionTopup,[data-view="wallet"]'))schedule();
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();