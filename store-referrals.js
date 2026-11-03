/* L1017n referral program: customer UI only. All earning conditions and balance
 * credits are enforced by the private authenticated Supabase RPC/DB trigger. */
(function(){
  'use strict';
  const REF_STORAGE='l1017n-invited-by-code-v1';
  const HOME='https://hymozarog-jp.github.io/L1017n/';
  const isCode=v=>/^L1[0-9A-F]{12}$/.test(String(v||'').trim().toUpperCase());
  const q=s=>document.querySelector(s);
  let loading=false,session=null,code='',initAttempts=0,disposed=false,autoClaimAttempt='';
  const uiIcon=name=>'<svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-'+name+'"></use></svg>';
  function getDb(){return typeof supabaseClient==='undefined'?null:supabaseClient}
  function uiStatus(message,error){
    const n=q('#l1017ReferralStatus');if(!n)return;
    n.textContent=message||'';n.dataset.error=error?'1':'0';
  }
  function copyReferralFromQuery(){
    const u=new URL(location.href);
    const fromUrl=String(u.searchParams.get('ref')||'').trim().toUpperCase();
    if(isCode(fromUrl)){
      try{sessionStorage.setItem(REF_STORAGE,fromUrl)}catch(_){}
      return fromUrl;
    }
    try{const saved=sessionStorage.getItem(REF_STORAGE)||'';return isCode(saved)?saved:''}catch(_){return ''}
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
      +'<p>اربح <strong>1 د.ل</strong> عن كل صديق يسجّل بكودك ويُوثّق هاتفه. تُضاف المكافأة لمحفظتك عند تفعيل الدعوة، دون انتظار أي شراء.</p></div>'
      +'<div class="l1017-ref-hero-badge" aria-label="مكافأة كل صديق مؤهل: دينار ليبي واحد"><strong>1</strong><span>د.ل</span></div></div>'
      +'<div id="l1017ReferralGuest" class="l1017-ref-guest hidden"><p>سجّل دخولك لتنشئ كود الدعوة الخاص بك وتتابع مكافآتك.</p><button type="button" id="l1017RefLogin">تسجيل الدخول</button></div>'
      +'<div id="l1017ReferralAccount" class="hidden">'
      +'<section class="l1017-ref-code-card" aria-label="كود الدعوة الخاص بك">'
        +'<div class="l1017-ref-code"><label for="l1017RefCodeValue">كود الدعوة الخاص بك</label>'
        +'<div class="l1017-ref-code-value"><strong id="l1017RefCodeValue" dir="ltr" tabindex="0">—</strong>'
        +'<button type="button" id="l1017CopyRefCode">'+uiIcon('copy')+'<span>نسخ الكود</span></button></div>'
        +'<button type="button" id="l1017CreateRefCode">إنشاء كود الدعوة</button>'
        +'<div class="l1017-ref-actions">'
          +'<button type="button" id="l1017ShareRef" class="l1017-ref-whatsapp">'
          +'<svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor"><path d="M16 3a13 13 0 0 0-11.1 19.7L3 29l6.5-1.7A13 13 0 1 0 16 3zm0 23.5a10.5 10.5 0 0 1-5.3-1.4l-.4-.2-3.9 1 1-3.8-.3-.4a10.5 10.5 0 1 1 8.9 4.8zm5.8-7.9c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.7.2-.1.3-.4.5-.6.1-.2.2-.4.3-.6.1-.2 0-.5 0-.7-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.5-.3.3-1.2 1.2-1.2 2.9 0 1.7 1.3 3.3 1.4 3.5.2.2 2.5 3.8 6.1 5.3.9.4 1.5.6 2.1.7.9.3 1.7.2 2.3.2.7-.1 1.7-.7 2-1.4.3-.7.3-1.3.2-1.4 0-.2-.2-.3-.5-.4z"/></svg>'
          +'<span>مشاركة عبر واتساب</span></button>'
          +'<button type="button" id="l1017CopyRefLink">'+uiIcon('link')+'<span>نسخ رابط الدعوة</span></button>'
        +'</div></div></section>'
        +'<div class="l1017-ref-stats" aria-label="إحصائيات الدعوات">'
          +'<div class="l1017-ref-stat-card"><span class="l1017-ref-stat-icon l1017-ref-stat-purple" aria-hidden="true">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6m-3-3h6m-5 10v-2a4 4 0 0 0-3-3.9"/></svg></span>'
          +'<strong id="l1017InvitedCount">0</strong><small>أصدقاء سجّلوا بكودك</small></div>'
          +'<div class="l1017-ref-stat-card l1017-ref-stat-earn"><span class="l1017-ref-stat-icon l1017-ref-stat-green" aria-hidden="true">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9a7 7 0 0 1 7-5h4l1.5-2v4a6.5 6.5 0 0 1 2.5 5v2h2v4h-3a7 7 0 0 1-3 2v2h-3v-2H9v2H6v-4A6.5 6.5 0 0 1 5 9Z"/><path d="M8 4 6 2m11 8h.01"/></svg></span>'
          +'<strong id="l1017EarnedTotal">0.00 د.ل</strong><small>أرباحك من الدعوات</small></div>'
        +'</div>'
        +'<section class="l1017-ref-how" aria-labelledby="l1017RefHowHeading">'
          +'<h3 id="l1017RefHowHeading"><span class="l1017-ref-how-bulb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18h6m-5 3h4M8.8 15.6c-.5-1.1-2.3-2.1-2.3-5.3a5.5 5.5 0 1 1 11 0c0 3.2-1.8 4.2-2.3 5.3l-.5 1.3h-5.4l-.5-1.3Z"/></svg></span>كيف يعمل؟</h3>'
          +'<ol class="l1017-ref-steps">'
            +'<li><span class="l1017-ref-step-number">1</span><span class="l1017-ref-step-text">شارك كودك مع أصدقائك</span><span class="l1017-ref-step-icon">'+uiIcon('share')+'</span></li>'
            +'<li><span class="l1017-ref-step-number">2</span><span class="l1017-ref-step-text">يسجّل صديقك ويُفعّل كودك بعد توثيق هاتفه</span><span class="l1017-ref-step-icon">'+uiIcon('user')+'</span></li>'
            +'<li><span class="l1017-ref-step-number">3</span><span class="l1017-ref-step-text">بعد تفعيل صديقك للكود وتوثيق هاتفه، تحصل على 1 د.ل في محفظتك</span><span class="l1017-ref-step-icon">'+uiIcon('coins')+'</span></li>'
          +'</ol></section>'
        +'<div class="l1017-ref-rules">'+uiIcon('shield-check')+'تُحتسب المكافأة عند توثيق الهاتف وتفعيل الكود، لمرة واحدة لكل صديق. الحد الأقصى 10 مكافآت شهريًا.</div>'
        +'<form id="l1017ClaimReferralForm"><label for="l1017ReferredCode">وصلك كود من صديق؟ فعّله بعد تسجيل الدخول وتوثيق الهاتف</label><div class="l1017-ref-claim-row"><input id="l1017ReferredCode" type="text" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="L1XXXXXXXXXXXX" dir="ltr" required><button type="submit" id="l1017ClaimRefSubmit">تفعيل الدعوة</button></div><p class="l1017-ref-claim-help" id="l1017MyClaimNotice"></p></form>'
        +'<p class="l1017-ref-monthly" id="l1017RefMonthly"></p>'
      +'</div><p class="l1017-ref-notice" id="l1017ReferralStatus" role="status" aria-live="polite"></p>';
    host.appendChild(node);
    q('#l1017ReferredCode').value=copyReferralFromQuery();

    q('#l1017RefLogin')?.addEventListener('click',()=>{
      if(typeof window.switchView==='function')window.switchView('account');
      else q('[data-view="account"]')?.click();
    });
    q('#l1017CreateRefCode')?.addEventListener('click',()=>void createCode());
    q('#l1017CopyRefCode')?.addEventListener('click',()=>void copy(code,'الكود'));
    q('#l1017CopyRefLink')?.addEventListener('click',()=>void copy(HOME+'?ref='+encodeURIComponent(code),'الرابط'));
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
    session=db.auth.onAuthStateChange(()=>{setTimeout(()=>void load(),180)});
  }
  function showLandingInvite(){
    const from=copyReferralFromQuery();
    const host=q('#llLanding')||q('#storeView');
    if(!from||!host||q('#l1017InviteLanding'))return;
    const banner=document.createElement('div');
    banner.id='l1017InviteLanding';
    banner.className='l1017-invite-landing';
    banner.innerHTML=uiIcon('gift')+'<span>وصلك كود دعوة! سجّل دخولك ووثّق هاتفك وفعّل الكود ليحصل صاحب الدعوة على مكافأته.</span><button type="button">فتح الدعوة</button>';
    banner.querySelector('button').addEventListener('click',()=>{
      if(typeof window.switchView==='function')window.switchView('referrals');
      else q('[data-view="referrals"]')?.click();
      setTimeout(()=>q('#l1017Referrals')?.scrollIntoView({behavior:'smooth',block:'start'}),200);
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
      if(!loggedIn){code='';return}
      const {data,error}=await db.rpc('get_my_store_referral_stats');
      if(error)throw error;
      const stats=data||{};
      code=isCode(stats.code)?stats.code:'';
      q('#l1017RefCodeValue').textContent=code||'—';
      q('#l1017CreateRefCode').classList.toggle('hidden',!!code);
      for(const id of ['l1017CopyRefCode','l1017CopyRefLink','l1017ShareRef'])q('#'+id).disabled=!code;
      const totals=stats.summary||{};
      q('#l1017InvitedCount').textContent=Number(totals.invited||0).toLocaleString('ar-LY');



      q('#l1017EarnedTotal').textContent=Number(totals.credited_lyd||0).toFixed(2)+' د.ل';
      q('#l1017RefMonthly').textContent='مكافآت هذا الشهر: '+Number(stats.monthly_used||0)+' من '+Number(stats.monthly_limit||10)+' · هدية فورية لكل صديق موثّق وفعّل كود الدعوة';
      const existing=stats.my_claim;
      const form=q('#l1017ClaimReferralForm');
      form.classList.toggle('hidden',!!existing);
      q('#l1017MyClaimNotice').textContent=existing?'': '';
      if(existing)q('#l1017RefMonthly').textContent+=' · دعوتك الواردة: '+(existing.status==='pending'?'دعوة سابقة تنتظر إتمام الطلب':existing.status==='rewarded'?'تمت المكافأة':'غير مؤهلة');
      // The ?ref= link is retained through sign-in and redeemed automatically
      // once the visitor signs in with a verified phone. Manual code entry stays available.
      const incoming=copyReferralFromQuery();
      if(!existing && isCode(incoming)){
        q('#l1017ReferredCode').value=incoming;
        const attemptKey=user.id+'|'+incoming;
        if(autoClaimAttempt!==attemptKey){
          autoClaimAttempt=attemptKey;
          setTimeout(()=>void claim(),80);
        }
      }
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
      uiStatus('كود دعوتك جاهز. تقدر تنسخه أو تشاركه.');
      await load();
    }catch(err){
      console.warn('[referrals] code',err);
      const msg=String(err.message||'');
      uiStatus(msg.includes('referral_phone_verification_required')?'وثّق رقم ليبيانا من حسابي أولًا، وبعدها أنشئ كود الدعوة.':msg.includes('referral_phone_already_used')?'هذا الرقم مرتبط بكود دعوة آخر؛ تواصل مع إدارة المتجر.':'تعذر إنشاء الكود. تأكد من توثيق هاتفك وحاول مرة ثانية.',true);
    }finally{button.disabled=false}
  }
  async function copy(value,label){
    if(!code){uiStatus('أنشئ كود الدعوة أولًا.',true);return}
    try{
      if(!navigator.clipboard?.writeText)throw Error('clipboard_unavailable');
      await navigator.clipboard.writeText(value);
      uiStatus('تم نسخ '+label+'، ابعته لصديقك.');
    }catch(_){window.prompt('انسخ '+label+' يدويًا:',value)}
  }
  function shareWhatsApp(){
    if(!code){uiStatus('أنشئ كود الدعوة أولًا.',true);return}
    const url=HOME+'?ref='+encodeURIComponent(code);
    const message='انضم إلى متجر L1017n واستخدم كود دعوتي '+code+' قبل أول طلب: '+url;
    const whatsapp='https://wa.me/?text='+encodeURIComponent(message);
    window.open(whatsapp,'_blank','noopener,noreferrer');
  }
  async function claim(){
    const db=getDb(),button=q('#l1017ClaimRefSubmit');
    if(!db||!button||button.disabled)return;
    const raw=q('#l1017ReferredCode').value.trim().toUpperCase();
    if(!isCode(raw)){uiStatus('كود الدعوة غير صحيح. راجع الرمز المرسل لك.',true);return}
    button.disabled=true;uiStatus('جاري التحقق من الدعوة…');
    try{
      const {error}=await db.rpc('claim_my_store_referral_code',{p_code:raw});
      if(error)throw error;
      try{sessionStorage.removeItem(REF_STORAGE)}catch(_){}
      uiStatus('تم تفعيل الدعوة! حصل صاحب الكود على 1 د.ل في محفظته.');
      await load();
    }catch(err){
      const e=String(err.message||'');
      const messages={
        invalid_referral_code:'كود الدعوة غير موجود أو غير صحيح.',
        referral_self_invitation:'ما تقدرش تستخدم كود حسابك الشخصي.',
        referral_already_claimed:'سبق وفعّلت كود دعوة؛ كل حساب له دعوة واحدة.',
        referral_only_before_first_order:'يمكن تفعيل كود الدعوة فقط قبل أول طلب.',
        referral_monthly_limit_reached:'صاحب الكود وصل للحد الشهري (10 دعوات). جرّب الشهر القادم.',
        referral_phone_verification_required:'وثّق رقم هاتفك من حسابي قبل تفعيل الدعوة.',
        referral_same_phone:'ما ينفعش الحسابين يستخدموا نفس رقم الهاتف.',
        referral_phone_already_used:'هذا الرقم استُخدم بالفعل في دعوة أخرى.',
        referral_inviter_phone_unverified:'صاحب الكود لازم يكون هاتفه موثّق.'
      };
      let message='تعذر تفعيل الكود الآن. راجع توثيق هاتفك وحاول مرة ثانية.';
      for(const key of Object.keys(messages))if(e.includes(key)){message=messages[key];break}
      uiStatus(message,true);
    }finally{button.disabled=false}
  }
  function init(){
    build();
    if(!q('#l1017Referrals'))setTimeout(init,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
