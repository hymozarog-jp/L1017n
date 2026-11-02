/* L1017n customer experience layer. Does not authorize transfers, credit wallets or submit orders. */
(function(){
  'use strict';
  const $ = selector => document.querySelector(selector);
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/></svg>';
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
    panel.innerHTML='<div class="gbqa-heading"><b>تبّي تطلب بسرعة؟</b><small>اختار الخطوة المناسبة ليك</small></div>'+
      '<div class="gbqa-buttons">'+
      '<button type="button" class="gbqa-action gbqa-primary" data-gbqa="wallet">'+icon+'شحن الرصيد</button>'+
      '<button type="button" class="gbqa-action" data-gbqa="catalog">تصفح الباقات</button>'+
      '<button type="button" class="gbqa-action" data-gbqa="orders">متابعة طلباتي</button></div>'+
      '<p class="gbqa-footer">'+shield+'الدفع من المحفظة بعد توثيق رقمك. الرصيد يُضاف فقط بعد تأكيد التحويل.</p>';
    const target=home.querySelector('.ph-search-wrap,.section-head');
    if(target)home.insertBefore(panel,target);else home.prepend(panel);
    panel.addEventListener('click',event=>{
      const btn=event.target.closest('[data-gbqa]');if(!btn)return;
      if(btn.dataset.gbqa==='wallet')goWallet();
      else if(btn.dataset.gbqa==='orders')navigate('orders');
      else $('#productGrid')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }
  function ensureWallet(){
    const form=$('#topupForm');
    if(!form||$('#gbWalletGuide'))return;
    const guide=document.createElement('section');
    guide.id='gbWalletGuide';
    guide.setAttribute('aria-label','دليل تعبئة المحفظة');
    guide.innerHTML='<strong>شحن المحفظة في 3 خطوات</strong>'+
      '<div class="gbwg-steps"><span>1 · اختار المبلغ</span><span>2 · تأكد من رقم ليبيانا</span><span>3 · حوّل وتابع التحقق</span></div>'+
      '<p class="gbwg-next" id="gbWalletNext" role="status" aria-live="polite">اختار المبلغ اللي تبيه من تحت.</p>'+
      '<div class="gbwg-tools"><button type="button" class="gbwg-next-action" data-gbwg="proceed">متابعة الشحن</button><button type="button" data-gbwg="store">تصفح المتجر</button></div>';
    form.prepend(guide);
    guide.addEventListener('click',e=>{
      const action=e.target.closest('[data-gbwg]')?.dataset.gbwg;
      if(action==='store')navigate('store');
      else if(action==='proceed'){
        const amount=$('#topupAmount');
        if(!Number.isSafeInteger(Number(amount?.value))||Number(amount?.value)<1){
          amount?.focus();amount?.scrollIntoView({behavior:'smooth',block:'center'});return;
        }
        $('#topupProceed')?.click();$('#topupProceed')?.scrollIntoView({behavior:'smooth',block:'center'});
      }
    });
    const amount=$('#topupAmount');
    amount?.addEventListener('input',updateWalletNext,{passive:true});
    updateWalletNext();
  }
  function updateWalletNext(){
    const status=$('#gbWalletNext'),action=$('#gbWalletGuide [data-gbwg="proceed"]');
    if(!status||!action)return;
    const input=$('#topupAmount'),amount=Number(input?.value||0);
    const verified=$('#topupPhoneState')?.classList.contains('is-verified');
    let message,label;
    if(!Number.isSafeInteger(amount)||amount<1||amount>10000){
      message='اختار مبلغًا صحيحًا من الأزرار أو اكتبه بالدينار الليبي.';
      label='اختار المبلغ أولاً';
    }else if(!verified){
      message='المبلغ '+format(amount)+' د.ل. تأكد أن رقم ليبيانا موثّق في حسابك قبل التحويل.';
      label='متابعة والتحقق من الرقم';
    }else{
      message='المبلغ '+format(amount)+' د.ل ورقم ليبيانا موثّق. اضغط متابعة لعرض كود التحويل.';
      label='عرض كود التحويل';
    }
    if(status.textContent!==message)status.textContent=message;
    if(action.textContent!==label)action.textContent=label;
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
      line.textContent='رصيد محفظتك: '+format(balance)+' د.ل'+(diff===null?'':diff>0?' · ينقصك '+format(diff)+' د.ل':' · رصيدك يكفي قيمة الباقة');
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
    updateWalletNext();
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