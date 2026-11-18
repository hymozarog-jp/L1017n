/* L1017n customer experience layer. Does not authorize transfers, credit wallets or submit orders. */
(function(){
  'use strict';
  const $ = selector => document.querySelector(selector);
  // Original, lightweight inline vector drawings for the three main actions.
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 10h18M14 13h8v5h-8a2.5 2.5 0 0 1 0-5Z"/><circle cx="17" cy="15.5" r=".7" fill="currentColor" stroke="none"/></svg>';
  const storeArt='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 7 3h10l3 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"/><path d="M4 9h16M9 21v-7h6v7"/><path d="M9 3v6m6-6v6"/></svg>';
  const ordersArt='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="19" rx="3"/><path d="M9 8h6m-6 4h4m-4 4h2"/><path d="m14 17 2 2 4-4"/></svg>';
  const shield = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/><path d="m8 12 3 3 5-5"/></svg>';
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
  function goWallet(){
    closeCheckoutViews();
    navigate('wallet');
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
  let scheduled=false;
  function refresh(){
    scheduled=false;
    ensureHome();
    ensureWallet();
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