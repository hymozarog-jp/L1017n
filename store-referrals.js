/* L1017n referral program: customer UI only. All earning conditions and balance
 * credits are enforced by the private authenticated Supabase RPC/DB trigger. */
(function(){
  'use strict';
  const REF_STORAGE='l1017n-invited-by-code-v1';
  const REF_PERSIST_STORAGE='l1017n-invite-link-with-expiry-v2';
  const REF_TTL=7*24*60*60*1000;
  const HOME='https://hymozarog-jp.github.io/L1017n/';
  const isCode=v=>/^L1[0-9A-F]{12}$/.test(String(v||'').trim().toUpperCase());
  const q=s=>document.querySelector(s);
  let loading=false,session=null,code='',initAttempts=0,disposed=false,autoClaimAttempt='',inviteLoginShown=false;
  const uiIcon=name=>'<svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-'+name+'"></use></svg>';
  function getDb(){return typeof supabaseClient==='undefined'?null:supabaseClient}
  function uiStatus(message,error){
    const n=q('#l1017ReferralStatus');if(!n)return;
    n.textContent=message||'';n.dataset.error=error?'1':'0';
  }
  function copyReferralFromQuery(){
    // A referral is an actual website link (?ref=...), not a stand-alone code.
    // Keep it across account creation and Google/email redirects; expire old links.
    const fromUrl=String(new URL(location.href).searchParams.get('ref')||'').trim().toUpperCase();
    if(isCode(fromUrl)){
      try{sessionStorage.setItem(REF_STORAGE,fromUrl)}catch(_){}
      try{localStorage.setItem(REF_PERSIST_STORAGE,JSON.stringify({code:fromUrl,time:Date.now()}))}catch(_){}
      return fromUrl;
    }
    try{
      const saved=JSON.parse(localStorage.getItem(REF_PERSIST_STORAGE)||'null');
      if(saved&&isCode(saved.code)&&Date.now()-Number(saved.time)<REF_TTL&&Date.now()>=Number(saved.time))return saved.code;
      if(saved)localStorage.removeItem(REF_PERSIST_STORAGE);
    }catch(_){}
    // Backward compatible with invite links opened before this deployment.
    try{
      const saved=sessionStorage.getItem(REF_STORAGE)||'';
      if(isCode(saved)){
        try{localStorage.setItem(REF_PERSIST_STORAGE,JSON.stringify({code:saved,time:Date.now()}))}catch(_){}
        return saved;
      }
    }catch(_){}
    return '';
  }
  function clearIncomingInvitation(){
    try{sessionStorage.removeItem(REF_STORAGE)}catch(_){}
    try{localStorage.removeItem(REF_PERSIST_STORAGE)}catch(_){}
    try{
      const url=new URL(window.location.href);
      if(isCode(url.searchParams.get('ref'))){
        url.searchParams.delete('ref');
        history.replaceState(history.state,'',url.pathname+url.search+url.hash);
      }
    }catch(_){}
    q('#l1017InviteLanding')?.remove();
  }
  function referralLink(value){return HOME+'?ref='+encodeURIComponent(value)}
  function renderCompactMissions(monthlyCount){
    const holder=q('#l1017RefCompactList');
    const summary=q('#l1017RefCompactProgress');
    if(!holder)return;
    const completed=Math.min(10,Math.max(0,Math.floor(Number(monthlyCount)||0)));
    if(summary)summary.textContent=completed+' / 10 دعوات هذا الشهر';
    const progress=q('#l1017RefMissionBar');
    if(progress){
      progress.style.width=(completed*10)+'%';
      progress.parentElement?.setAttribute('aria-valuenow',String(completed));
    }
    // Additional milestones are previews of cumulative referral earnings,
    // not extra prizes. Server credit remains 1 LYD per confirmed sign-in.
    const targets=[1,2,3,4,5,7,10];
    holder.innerHTML=targets.map(target=>{
      const done=completed>=target;
      const active=!done&&(target===targets.find(x=>completed<x));
      const kind=done?'is-done':active?'is-current':'is-next';
      const label=target===1?'دعوة صديق واحد':'دعوة '+target+' أصدقاء';
      const status=done?'مكتملة':active?'المهمة الحالية':'قادمة';
      return '<div class="l1017-ref-compact-row '+kind+'">'
        +'<span class="l1017-ref-compact-check" aria-hidden="true">'+(done?'✓':target)+'</span>'
        +'<span class="l1017-ref-compact-description"><strong>'+label+'</strong><small>'+status+'</small></span>'
        +'<span class="l1017-ref-compact-money"><strong>'+target+' د.ل</strong><small>الإجمالي</small></span>'
      +'</div>';
    }).join('');
  }
  // These tabs display existing, verifiable milestones. Only referral sign-ins
  // produce wallet rewards; purchase and account tasks never write balances.
  let currentMissionTab='referrals',purchaseFetchInFlight=false;
  const renderTask=(index,title,detail,done,progress,unit)=>'<div class="l1017-ref-compact-row '+(done?'is-done':'is-next')+'">'
    +'<span class="l1017-ref-compact-check" aria-hidden="true">'+(done?'✓':index)+'</span>'
    +'<span class="l1017-ref-compact-description"><strong>'+title+'</strong><small>'+detail+'</small></span>'
    +'<span class="l1017-ref-compact-money l1017-mission-counter"><strong>'+progress+'</strong><small>'+unit+'</small></span>'
  +'</div>';
  function setTaskProgress(barId,count,max,summaryId,summary){
    const bar=q('#'+barId);
    if(bar){bar.style.width=(Math.min(max,Math.max(0,count))/max*100)+'%';
      bar.parentElement?.setAttribute('aria-valuenow',String(Math.min(max,Math.max(0,count))));}
    const label=q('#'+summaryId);if(label)label.textContent=summary;
  }
  async function setMissionTab(tab){
    if(!['referrals','purchases','login'].includes(tab))return;
    currentMissionTab=tab;
    q('#l1017Referrals')?.querySelectorAll('[data-l1017-mission-tab]').forEach(button=>{
      const active=button.dataset.l1017MissionTab===tab;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
    const panels={referrals:'#l1017MissionPanelReferrals',purchases:'#l1017MissionPanelPurchases',login:'#l1017MissionPanelLogin'};
    for(const [name,selector] of Object.entries(panels)){
      const panel=q(selector);if(panel)panel.hidden=name!==tab;
    }
    if(tab==='purchases')await loadPurchaseMissions();
    if(tab==='login')await loadLoginMissions();
  }
  async function loadPurchaseMissions(){
    const list=q('#l1017PurchaseMissionList'),db=getDb();
    if(!list||!db||purchaseFetchInFlight)return;
    purchaseFetchInFlight=true;
    list.innerHTML='<p class="l1017-mission-loading">جاري تحميل المشتريات المكتملة…</p>';
    try{
      const {data:{user},error:userError}=await db.auth.getUser();
      if(userError||!user)throw Error('auth_required');
      // Owner-only RLS on purchase_orders. Count actually completed purchases,
      // not unpaid, rejected, or still-in-progress orders.
      const {count,error}=await db.from('purchase_orders')
        .select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('status','completed');
      if(error||count===null)throw error||Error('count_unavailable');
      const completed=Math.max(0,Number(count)||0),targets=[1,3,5,10];
      list.innerHTML=targets.map((target,i)=>renderTask(i+1,
        target===1?'أكمل أول عملية شراء':'أكمل '+target+' عمليات شراء',
        completed>=target?'مكتملة':'من المشتريات التي تم تنفيذها',
        completed>=target,Math.min(target,completed)+' / '+target,'طلبات')).join('');
      setTaskProgress('l1017PurchaseMissionBar',completed,10,'l1017PurchaseMissionSummary',completed+' مشتريات مكتملة');
    }catch(err){
      list.innerHTML='<p class="l1017-mission-loading">تعذر تحميل المشتريات. افتح القسم مجددًا للمحاولة.</p>';
      const summary=q('#l1017PurchaseMissionSummary');if(summary)summary.textContent='غير متاح مؤقتًا';
      console.warn('[referrals/purchase missions]',String(err?.message||err).slice(0,125));
    }finally{purchaseFetchInFlight=false}
  }
  async function loadLoginMissions(){
    const list=q('#l1017LoginMissionList'),db=getDb();
    if(!list||!db)return;
    list.innerHTML='<p class="l1017-mission-loading">جاري التحقق من حسابك…</p>';
    try{
      const {data:{user},error}=await db.auth.getUser();
      if(error||!user)throw Error('auth_required');
      const {data:wallet,error:walletError}=await db.from('wallet_accounts')
        .select('libyana_phone').eq('user_id',user.id).maybeSingle();
      // Account preparation tasks can be checked from auth and the wallet profile.
      // A saved phone is not claimed to be SMS-verified here.
      const tasks=[
        {label:'سجّل الدخول إلى المتجر',detail:'الحساب مفتوح الآن',done:true},
        {label:'أكّد بريدك الإلكتروني',detail:user.email_confirmed_at?'تم تأكيد البريد':'افتح رسالة تأكيد البريد الإلكتروني',done:!!user.email_confirmed_at},
        {label:'اربط رقم هاتفك بالحساب',detail:walletError?'تعذر التحقق من بيانات الهاتف':wallet?.libyana_phone?'تم حفظ رقم الهاتف':'أضف رقم هاتفك من حسابي',done:!walletError&&!!wallet?.libyana_phone}
      ];
      const done=tasks.filter(t=>t.done).length;
      list.innerHTML=tasks.map((t,i)=>renderTask(i+1,t.label,t.detail,t.done,t.done?'مكتملة':'بانتظارك','الحالة')).join('');
      setTaskProgress('l1017LoginMissionBar',done,3,'l1017LoginMissionSummary',done+' / 3 مهام');
    }catch(err){
      list.innerHTML='<p class="l1017-mission-loading">تعذر التحقق من حسابك. جرّب مرة ثانية.</p>';
      console.warn('[referrals/login missions]',String(err?.message||err).slice(0,125));
    }
  }
  function build(){
    const host=q('#referralsView');
    if(!host||q('#l1017Referrals'))return;
    const node=document.createElement('section');
    node.id='l1017Referrals';
    node.className='l1017-referrals';
    node.setAttribute('aria-label','دعوة صديق ومكافأة المحفظة');
    node.innerHTML='<div class="l1017-ref-earn-hero">'
      +'<div class="l1017-ref-hero-copy"><h2>ادعُ أصدقاءك واربح معهم</h2>'
      +'<p>اربح <strong>1 د.ل</strong> عن كل صديق يفتح رابط دعوتك ويسجّل الدخول بحساب مؤكّد. تُضاف المكافأة لمحفظتك تلقائيًا، بدون شراء أو توثيق هاتف.</p></div>'
      +'<div class="l1017-ref-hero-badge" aria-label="مكافأة كل صديق مؤهل: دينار ليبي واحد"><strong>1</strong><span>د.ل</span></div></div>'
      +'<div id="l1017ReferralGuest" class="l1017-ref-guest hidden"><p>سجّل دخولك لتنشئ كود الدعوة الخاص بك وتتابع مكافآتك.</p><button type="button" id="l1017RefLogin">تسجيل الدخول</button></div>'
      +'<div id="l1017ReferralAccount" class="hidden">'
      +'<section class="l1017-ref-code-card" aria-label="رابط الدعوة الذي يفتح المتجر">'
        +'<div class="l1017-ref-code"><div class="l1017-ref-invite-label">رابط دعوتك الشخصي — افتح الموقع وسجّل الدخول</div>'
        +'<div class="l1017-ref-link-row"><small>انسخ الرابط وارسله لصديقك. بمجرد تسجيل دخوله بحساب مؤكّد تنحسب الدعوة:</small>'
        +'<div class="l1017-ref-link-copy"><a id="l1017RefLinkValue" href="#" aria-disabled="true" tabindex="-1" target="_blank" rel="noopener noreferrer" dir="ltr" aria-label="فتح رابط الدعوة في المتجر">أنشئ رابط دعوتك أولاً</a>'
        +'<button type="button" id="l1017CopyRefLink" aria-label="نسخ رابط الدعوة">'+uiIcon('copy')+'<span>نسخ الرابط</span></button></div></div>'
        +'<button type="button" id="l1017CreateRefCode">إنشاء رابط الدعوة</button>'
        +'<div class="l1017-ref-actions">'
          +'<button type="button" id="l1017ShareRef" class="l1017-ref-whatsapp">'
          +'<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M16 3a13 13 0 0 0-11.1 19.7L3 29l6.5-1.7A13 13 0 1 0 16 3zm0 23.5a10.5 10.5 0 0 1-5.3-1.4l-.4-.2-3.9 1 1-3.8-.3-.4a10.5 10.5 0 1 1 8.9 4.8zm5.8-7.9c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.2-.1.3-.4.5-.6.1-.2.2-.4.3-.6.1-.2 0-.5 0-.7-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.5-.3.3-1.2 1.2-1.2 2.9 0 1.7 1.3 3.3 1.4 3.5.2.2 2.5 3.8 6.1 5.3.9.4 1.5.6 2.1.7.9.3 1.7.2 2.3.2.7-.1 1.7-.7 2-1.4.3-.7.3-1.3.2-1.4 0-.2-.2-.3-.5-.4z"/></svg>'
          +'<span>مشاركة عبر واتساب</span></button>'
        +'</div>'
        +'</div></section>'
        +'<div class="l1017-ref-stats" aria-label="إحصائيات الدعوات">'
          +'<div class="l1017-ref-stat-card"><span class="l1017-ref-stat-icon l1017-ref-stat-purple" aria-hidden="true">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6m-3-3h6m-5 10v-2a4 4 0 0 0-3-3.9"/></svg></span>'
          +'<strong id="l1017InvitedCount">0</strong><small>أصدقاء سجّلوا برابطك</small></div>'
          +'<div class="l1017-ref-stat-card l1017-ref-stat-earn"><span class="l1017-ref-stat-icon l1017-ref-stat-green" aria-hidden="true">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9a7 7 0 0 1 7-5h4l1.5-2v4a6.5 6.5 0 0 1 2.5 5v2h2v4h-3a7 7 0 0 1-3 2v2h-3v-2H9v2H6v-4A6.5 6.5 0 0 1 5 9Z"/><path d="M8 4 6 2m11 8h.01"/></svg></span>'
          +'<strong id="l1017EarnedTotal">0.00 د.ل</strong><small>أرباحك من الدعوات</small></div>'
        +'</div>'
        +'<section class="l1017-ref-compact-missions" aria-label="مهام المتجر">'
          +'<div class="l1017-mission-tabs" role="tablist" aria-label="اختيار نوع المهام">'
            +'<button type="button" role="tab" class="is-active" id="l1017MissionTabReferrals" data-l1017-mission-tab="referrals" aria-controls="l1017MissionPanelReferrals" aria-selected="true" tabindex="0">'
            +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M17 8v8m-4-4h8"/></svg><span>مهام الدعوات</span></button>'
            +'<button type="button" role="tab" id="l1017MissionTabPurchases" data-l1017-mission-tab="purchases" aria-controls="l1017MissionPanelPurchases" aria-selected="false" tabindex="-1">'
            +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h16l-1.2 11H5.2L4 9ZM8 10V7a4 4 0 0 1 8 0v3"/><path d="m9 15 2 2 4-4"/></svg><span>مهام المشتريات</span></button>'
            +'<button type="button" role="tab" id="l1017MissionTabLogin" data-l1017-mission-tab="login" aria-controls="l1017MissionPanelLogin" aria-selected="false" tabindex="-1">'
            +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="12" height="18" rx="2"/><path d="M10 12h11m-4-4 4 4-4 4"/></svg><span>مهام تسجيل الدخول</span></button>'
          +'</div>'
          +'<div id="l1017MissionPanelReferrals" role="tabpanel" tabindex="0" aria-labelledby="l1017MissionTabReferrals">'
            +'<div class="l1017-ref-compact-heading"><h3 id="l1017RefCompactHeading">تقدم الدعوات</h3><small id="l1017RefCompactProgress">0 / 10 دعوات هذا الشهر</small></div>'
            +'<div class="l1017-ref-mission-underline" aria-hidden="true"></div>'
            +'<div class="l1017-ref-mission-progress" role="progressbar" aria-label="تقدم مهام الدعوات هذا الشهر" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0"><span id="l1017RefMissionBar"></span></div>'
            +'<div class="l1017-ref-compact-list" id="l1017RefCompactList" aria-live="polite"></div>'
            +'<p class="l1017-ref-compact-note">المبالغ إجمالي أرباح الدعوات في الشهر، وليست جوائز إضافية.</p>'
          +'</div>'
          +'<div id="l1017MissionPanelPurchases" role="tabpanel" tabindex="0" aria-labelledby="l1017MissionTabPurchases" hidden>'
            +'<div class="l1017-ref-compact-heading"><h3>تقدم المشتريات</h3><small id="l1017PurchaseMissionSummary">مراجعة الطلبات…</small></div>'
            +'<div class="l1017-ref-mission-underline" aria-hidden="true"></div>'
            +'<div class="l1017-ref-mission-progress" role="progressbar" aria-label="مشتريات مكتملة من 10" aria-valuemin="0" aria-valuemax="10" aria-valuenow="0"><span id="l1017PurchaseMissionBar"></span></div>'
            +'<div class="l1017-ref-compact-list" id="l1017PurchaseMissionList" aria-live="polite"><p class="l1017-mission-loading">اضغط على القسم لعرض مهام المشتريات.</p></div>'
            +'<p class="l1017-ref-compact-note">تُحتسب المشتريات التي تم تنفيذها فقط. هذه مهام إنجاز، ولا تُضاف عنها أرباح مالية.</p>'
          +'</div>'
          +'<div id="l1017MissionPanelLogin" role="tabpanel" tabindex="0" aria-labelledby="l1017MissionTabLogin" hidden>'
            +'<div class="l1017-ref-compact-heading"><h3>تقدم تسجيل الدخول</h3><small id="l1017LoginMissionSummary">0 / 3 مهام</small></div>'
            +'<div class="l1017-ref-mission-underline" aria-hidden="true"></div>'
            +'<div class="l1017-ref-mission-progress" role="progressbar" aria-label="مهام تسجيل الدخول" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0"><span id="l1017LoginMissionBar"></span></div>'
            +'<div class="l1017-ref-compact-list" id="l1017LoginMissionList" aria-live="polite"><p class="l1017-mission-loading">اضغط على القسم لعرض مهام حسابك.</p></div>'
            +'<p class="l1017-ref-compact-note">مهام إعداد الحساب تُحتسب مرة واحدة لكل خطوة، ولا تمنح أرصدة إضافية.</p>'
          +'</div>'
        +'</section>'
        +'<section class="l1017-ref-how" aria-labelledby="l1017RefHowHeading">'
          +'<h3 id="l1017RefHowHeading"><span class="l1017-ref-how-bulb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18h6m-5 3h4M8.8 15.6c-.5-1.1-2.3-2.1-2.3-5.3a5.5 5.5 0 1 1 11 0c0 3.2-1.8 4.2-2.3 5.3l-.5 1.3h-5.4l-.5-1.3Z"/></svg></span>كيف يعمل؟</h3>'
          +'<ol class="l1017-ref-steps">'
            +'<li><span class="l1017-ref-step-number">1</span><span class="l1017-ref-step-text">شارك رابط دعوتك مع أصدقائك</span><span class="l1017-ref-step-icon">'+uiIcon('share')+'</span></li>'
            +'<li><span class="l1017-ref-step-number">2</span><span class="l1017-ref-step-text">يفتح صديقك الرابط ويسجّل الدخول في المتجر</span><span class="l1017-ref-step-icon">'+uiIcon('user')+'</span></li>'
            +'<li><span class="l1017-ref-step-number">3</span><span class="l1017-ref-step-text">بمجرد تسجيل دخوله بحساب مؤكّد، تحصل على 1 د.ل في محفظتك</span><span class="l1017-ref-step-icon">'+uiIcon('coins')+'</span></li>'
          +'</ol></section>'
        +'<div class="l1017-ref-rules">'+uiIcon('shield-check')+'تُحتسب الدعوة تلقائيًا بعد دخول الصديق بحساب مؤكّد، مرة واحدة لكل حساب، وبحد 10 مكافآت شهريًا.</div>'
        +'<form id="l1017ClaimReferralForm"><label for="l1017ReferredCode">وصلك رمز فقط بدون رابط؟ تقدر تدخله هنا. الأفضل تستخدم رابط الدعوة الذي يفتح الموقع تلقائيًا.</label><div class="l1017-ref-claim-row"><input id="l1017ReferredCode" type="text" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="L1XXXXXXXXXXXX" dir="ltr" required><button type="submit" id="l1017ClaimRefSubmit">تفعيل الدعوة</button></div><p class="l1017-ref-claim-help" id="l1017MyClaimNotice"></p></form>'
        +'<p class="l1017-ref-monthly" id="l1017RefMonthly"></p>'
      +'</div><p class="l1017-ref-notice" id="l1017ReferralStatus" role="status" aria-live="polite"></p>';
    host.appendChild(node);
    q('#l1017ReferredCode').value=copyReferralFromQuery();

    q('#l1017RefLogin')?.addEventListener('click',()=>{
      if(typeof window.switchView==='function')window.switchView('account');
      else q('[data-view="account"]')?.click();
    });
    q('#l1017CreateRefCode')?.addEventListener('click',()=>void createCode());
    q('#l1017Referrals .l1017-mission-tabs')?.addEventListener('click',e=>{
      const button=e.target.closest('[data-l1017-mission-tab]');
      if(button)void setMissionTab(button.dataset.l1017MissionTab);
    });
    q('#l1017Referrals .l1017-mission-tabs')?.addEventListener('keydown',e=>{
      const tabs=Array.from(q('#l1017Referrals .l1017-mission-tabs').querySelectorAll('[data-l1017-mission-tab]'));
      const current=tabs.indexOf(document.activeElement);
      const key=e.key;
      if(key!=='ArrowLeft'&&key!=='ArrowRight'&&key!=='Home'&&key!=='End')return;
      e.preventDefault();
      const next=key==='Home'?0:key==='End'?tabs.length-1:(current+(key==='ArrowLeft'?1:-1)+tabs.length)%tabs.length;
      tabs[next]?.focus();
      if(tabs[next])void setMissionTab(tabs[next].dataset.l1017MissionTab);
    });
    q('#l1017CopyRefLink')?.addEventListener('click',()=>copy(referralLink(code),'الرابط'));
    q('#l1017ShareRef')?.addEventListener('click',shareWhatsApp);
    q('#l1017ClaimReferralForm')?.addEventListener('submit',e=>{e.preventDefault();void claim()});
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-view="referrals"],#l1017ReferralRefresh')){
        autoClaimAttempt='';
        setTimeout(()=>void load(),130);
      }
    });
    const db=getDb();
    if(db)bindAuth(db);
    void load();
    showLandingInvite();
  }
  function bindAuth(db){
    if(session)return;
    session=db.auth.onAuthStateChange((event,login)=>{
      // Supabase auth callbacks must be synchronous: schedule DB work afterward.
      if(event==='SIGNED_IN'||event==='INITIAL_SESSION'){
        if(login?.user?.id&&isCode(copyReferralFromQuery())){
          setTimeout(()=>void redeemAfterLogin(db,login.user),0);
        }
      }
      if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='SIGNED_OUT'){
        setTimeout(()=>void load(),180);
      }
    });
  }
  async function redeemAfterLogin(db,user){
    const invite=copyReferralFromQuery();
    if(!user?.id||!isCode(invite))return;
    const attemptKey=user.id+'|'+invite;
    if(autoClaimAttempt===attemptKey)return;
    autoClaimAttempt=attemptKey;
    try{
      const {error}=await db.rpc('claim_my_store_referral_code',{p_code:invite});
      if(error)throw error;
      clearIncomingInvitation();
      uiStatus('تم احتساب دخولك من رابط الدعوة بنجاح، وصديقك حصل على 1 د.ل.');
      if(typeof window.toast==='function')window.toast('تم احتساب دعوة صديقك عند تسجيل دخولك.');
      // Refresh visible statistics without requiring a visit to this page.
      setTimeout(()=>void load(),50);
    }catch(err){
      const e=String(err?.message||err||'');
      const permanent=['referral_already_claimed','referral_self_invitation','invalid_referral_code'];
      if(permanent.some(code=>e.includes(code))){
        clearIncomingInvitation();
        uiStatus(e.includes('referral_self_invitation')?'ما تقدرش تستخدم رابط دعوتك أنت.':e.includes('referral_already_claimed')?'هذا الحساب سبق احتساب دعوته.':'رابط الدعوة غير صالح.',true);
      }else{
        // A pending confirmation, connection issue or monthly limit must not
        // silently erase the invite; allow a later authenticated retry.
        uiStatus(e.includes('referral_confirmed_login_required')
          ?'تأكد من بريدك الإلكتروني أولًا ثم سجّل الدخول لتُحتسب الدعوة.'
          :e.includes('referral_monthly_limit_reached')
            ?'وصل صاحب الرابط للحد الشهري من الدعوات.'
            :'تعذر احتساب الدعوة الآن. جرّب تسجيل الدخول مجددًا.',true);
      }
      autoClaimAttempt='';
      console.warn('[referrals/automatic claim]',e.slice(0,145));
    }
  }
  function showLandingInvite(){
    const from=copyReferralFromQuery();
    const host=q('#llLanding')||q('#storeView');
    if(!from||!host||q('#l1017InviteLanding'))return;
    const banner=document.createElement('div');
    banner.id='l1017InviteLanding';
    banner.className='l1017-invite-landing';
    banner.innerHTML=uiIcon('gift')+'<span>دخلت من رابط دعوة! سجّل دخولك وسيتم احتساب الدعوة لصديقك تلقائيًا بعد تأكيد الحساب.</span><button type="button">تسجيل الدخول</button>';
    banner.querySelector('button').addEventListener('click',()=>{
      if(typeof window.switchView==='function')window.switchView('account');
      else q('[data-view="account"]')?.click();
    });
    host.prepend(banner);
  }
  async function load(){
    if(loading||disposed)return;
    const db=getDb();
    if(!db){
      if(++initAttempts<15)setTimeout(()=>void load(),400);
      return;
    }
    bindAuth(db);
    loading=true;
    try{
      const {data:{user},error:authError}=await db.auth.getUser();
      const loggedIn=!!user&&!authError;
      q('#l1017ReferralGuest')?.classList.toggle('hidden',loggedIn);
      q('#l1017ReferralAccount')?.classList.toggle('hidden',!loggedIn);
      if(!loggedIn){
        code='';
        if(!inviteLoginShown&&isCode(copyReferralFromQuery())){
          inviteLoginShown=true;
          // A referral link goes straight to the existing login page.
          setTimeout(()=>{
            if(typeof window.switchView==='function')window.switchView('account');
            else q('[data-view="account"]')?.click();
            const intro=q('#authIntro');
            if(intro)intro.textContent='سجّل دخولك لتُحتسب دعوة صديقك تلقائيًا.';
          },0);
        }
        return;
      }
      // Credit the referral at sign-in before loading any referral page UI.
      await redeemAfterLogin(db,user);
      const {data,error}=await db.rpc('get_my_store_referral_stats');
      if(error)throw error;
      const stats=data||{};
      code=isCode(stats.code)?stats.code:'';
      const invitation=q('#l1017RefLinkValue');
      if(invitation){
        invitation.href=code?referralLink(code):'#';
        invitation.textContent=code?referralLink(code):'أنشئ كودك لعرض رابط الدعوة';
        invitation.setAttribute('aria-disabled',String(!code));
        invitation.tabIndex=code?0:-1;
      }
      q('#l1017CreateRefCode').classList.toggle('hidden',!!code);
      for(const id of ['l1017CopyRefLink','l1017ShareRef'])q('#'+id).disabled=!code;
      const totals=stats.summary||{};
      q('#l1017InvitedCount').textContent=Number(totals.invited||0).toLocaleString('ar-LY');



      q('#l1017EarnedTotal').textContent=Number(totals.credited_lyd||0).toFixed(2)+' د.ل';
      renderCompactMissions(stats.monthly_used);
      if(currentMissionTab==='purchases')void loadPurchaseMissions();
      if(currentMissionTab==='login')void loadLoginMissions();
      q('#l1017RefMonthly').textContent='مكافآت هذا الشهر: '+Number(stats.monthly_used||0)+' من '+Number(stats.monthly_limit||10)+' · تُحتسب الدعوة عند تسجيل الدخول بحساب مؤكّد';
      const existing=stats.my_claim;
      const form=q('#l1017ClaimReferralForm');
      form.classList.toggle('hidden',!!existing);
      q('#l1017MyClaimNotice').textContent=existing?'': '';
      if(existing)q('#l1017RefMonthly').textContent+=' · دعوتك الواردة: '+(existing.status==='pending'?'دعوة سابقة تنتظر إتمام الطلب':existing.status==='rewarded'?'تمت المكافأة':'غير مؤهلة');
      // Incoming referral links are redeemed at authentication time by
      // redeemAfterLogin(), not by manually opening this page or buying.
      const incoming=copyReferralFromQuery();
      if(isCode(incoming))q('#l1017ReferredCode').value=incoming;
    }catch(err){
      console.warn('[referrals] stats',err);
      uiStatus('تعذر تحميل إحصائيات الدعوات. جرّب تحديث الصفحة.',true);
    }finally{loading=false}
  }
  async function createCode(){
    const db=getDb(),button=q('#l1017CreateRefCode');
    if(!db||!button)return;
    button.disabled=true;uiStatus('جاري إنشاء كودك…');
    try{
      const {data,error}=await db.rpc('get_my_store_referral_code');
      if(error)throw error;
      if(!isCode(data))throw Error('invalid_code_generated');
      code=data;
      uiStatus('رابط دعوتك جاهز! أرسله لصديقك، وبتنحسب الدعوة عند تسجيل دخوله بحساب مؤكد.');
      await load();
    }catch(err){
      console.warn('[referrals] code',err);
      const msg=String(err.message||'');
      uiStatus(msg.includes('referral_phone_verification_required')?'لإنشاء كود دعوة خاص بك، وثّق هاتفك أولًا من حسابي. الصديق المدعو لا يحتاج إلى توثيق هاتفه.':msg.includes('referral_phone_already_used')?'هذا الرقم مرتبط بكود دعوة آخر؛ تواصل مع إدارة المتجر.':'تعذر إنشاء الكود. حاول مرة ثانية.',true);
    }finally{button.disabled=false}
  }
  // Copy immediately in the tap event (important for iOS in-app browsers).
  // Prefer the synchronous selection copy; the modern API may never resolve
  // when clipboard permission hangs. In that case show a manual-copy fallback.
  function legacyCopy(text){
    const field=document.createElement('textarea');
    field.value=text;
    field.readOnly=true;
    field.setAttribute('aria-hidden','true');
    field.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none;font-size:16px;z-index:-1';
    document.body.appendChild(field);
    let copied=false;
    try{
      field.focus({preventScroll:true});
      field.select();
      field.setSelectionRange(0,text.length);
      copied=document.execCommand('copy')===true;
    }catch(_){}
    finally{field.remove();}
    return copied;
  }
  function selectReferralLink(){
    const value=q('#l1017RefLinkValue');
    if(!value)return;
    const selection=window.getSelection?.();
    if(!selection)return;
    const range=document.createRange();
    range.selectNodeContents(value);
    selection.removeAllRanges();
    selection.addRange(range);
    value.focus?.({preventScroll:true});
  }
  function copy(value,label){
    if(!code){uiStatus('أنشئ كود الدعوة أولًا.',true);return}
    const text=String(value||'');
    if(!text)return;
    const button=q('#l1017CopyRefLink');
    const textNode=button?.querySelector('span');
    const original=textNode?.textContent||'';
    function feedback(ok){
      uiStatus(ok?'تم نسخ رابط الدعوة بنجاح. أرسله لصديقك.':'تعذر النسخ تلقائيًا. اضغط مطولًا على رابط الدعوة لنسخه.',!ok);
      if(!ok)selectReferralLink();
      if(textNode){
        textNode.textContent=ok?'تم النسخ ✓':'انسخ الرابط يدويًا';
        window.setTimeout(()=>{if(textNode.isConnected)textNode.textContent=original},1800);
      }
    }
    if(legacyCopy(text)){feedback(true);return}
    if(!navigator.clipboard?.writeText){feedback(false);return}
    let complete=false;
    const done=ok=>{if(complete)return;complete=true;clearTimeout(timer);feedback(ok)};
    const timer=setTimeout(()=>done(false),1800);
    try{
      // Invoke during the original click handler, before user activation expires.
      Promise.resolve(navigator.clipboard.writeText(text)).then(()=>done(true),()=>done(false));
    }catch(_){done(false)}
  }
  function shareWhatsApp(){
    if(!code){uiStatus('أنشئ كود الدعوة أولًا.',true);return}
    const url=referralLink(code);
    const message='سجّل دخولك إلى متجر L1017n عبر رابط دعوتي، وبتنحسب دعوتك تلقائيًا! '+url;
    const whatsapp='https://wa.me/?text='+encodeURIComponent(message);
    window.open(whatsapp,'_blank','noopener,noreferrer');
  }
  async function claim(automatic=false){
    const db=getDb(),button=q('#l1017ClaimRefSubmit');
    if(!db||!button||button.disabled)return;
    const raw=q('#l1017ReferredCode').value.trim().toUpperCase();
    if(!isCode(raw)){uiStatus('كود الدعوة غير صحيح. راجع الرمز المرسل لك.',true);return}
    button.disabled=true;uiStatus('جاري التحقق من الدعوة…');
    try{
      const {error}=await db.rpc('claim_my_store_referral_code',{p_code:raw});
      if(error)throw error;
      clearIncomingInvitation();
      uiStatus('تم احتساب الدعوة بنجاح! أُضيف 1 د.ل لمحفظة صاحب الرابط.');
      if(automatic&&typeof window.toast==='function')window.toast('تم احتساب دعوتك لصديقك بنجاح!');
      await load();
    }catch(err){
      const e=String(err.message||'');
      const messages={
        invalid_referral_code:'كود الدعوة غير موجود أو غير صحيح.',
        referral_self_invitation:'ما تقدرش تستخدم كود حسابك الشخصي.',
        referral_already_claimed:'سبق وفعّلت كود دعوة؛ كل حساب له دعوة واحدة.',
        referral_confirmed_login_required:'لازم تسجّل الدخول بحساب بريد إلكتروني مؤكّد لاحتساب الدعوة.',
        referral_monthly_limit_reached:'صاحب الكود وصل للحد الشهري (10 دعوات). جرّب الشهر القادم.',
        referral_phone_verification_required:'وثّق رقم هاتفك من حسابي قبل تفعيل الدعوة.',
        referral_same_phone:'ما ينفعش الحسابين يستخدموا نفس رقم الهاتف.',
        referral_phone_already_used:'هذا الرقم استُخدم بالفعل في دعوة أخرى.',
        referral_inviter_phone_unverified:'صاحب الكود لازم يكون هاتفه موثّق.'
      };
      let message='تعذر احتساب الدعوة الآن. تأكد من تسجيل الدخول وحاول مجددًا.';
      for(const key of Object.keys(messages))if(e.includes(key)){message=messages[key];break}
      uiStatus(message,true);
      if(automatic&&typeof window.toast==='function')window.toast(message);
    }finally{button.disabled=false}
  }
  function init(){
    build();
    if(!q('#l1017Referrals'))setTimeout(init,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
