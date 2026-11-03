/* L1017n referral program: customer UI only. All earning conditions and balance
 * credits are enforced by the private authenticated Supabase RPC/DB trigger. */
(function(){
  'use strict';
  const REF_STORAGE='l1017n-invited-by-code-v1';
  const HOME='https://hymozarog-jp.github.io/L1017n/';
  const isCode=v=>/^L1[0-9A-F]{12}$/.test(String(v||'').trim().toUpperCase());
  const q=s=>document.querySelector(s);
  let loading=false,session=null,code='',initAttempts=0,disposed=false;
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
    node.innerHTML='<div class="l1017-ref-head"><span class="l1017-ref-brand">'+uiIcon('gift')+'</span>'
      +'<div><small>INVITE & EARN / L1017n</small><h2>ادعُ صديقك واربح</h2><p>خذ <strong>1 د.ل في محفظتك</strong> بعد إكمال أول طلب لصديقك بقيمة 15 د.ل أو أكثر.</p></div></div>'
      +'<div class="l1017-ref-rules">'+uiIcon('shield-check')+'الهاتف الموثّق مطلوب للطرفين · لا مكافأة لمجرد التسجيل · حتى 10 مكافآت شهريًا</div>'
      +'<div id="l1017ReferralGuest" class="l1017-ref-guest hidden"><p>سجّل دخولك لتأخذ كود دعوة خاص بك وتتابع أصدقاءك.</p><button type="button" id="l1017RefLogin">تسجيل الدخول</button></div>'
      +'<div id="l1017ReferralAccount" class="hidden">'
      +'<div class="l1017-ref-code"><label for="l1017RefCodeValue">كود دعوتك</label>'
      +'<div class="l1017-ref-code-value"><strong id="l1017RefCodeValue" dir="ltr" tabindex="0">—</strong><button type="button" id="l1017CreateRefCode">إنشاء كود الدعوة</button></div>'
      +'<div class="l1017-ref-actions"><button type="button" id="l1017CopyRefCode">'+uiIcon('copy')+' نسخ الكود</button>'
      +'<button type="button" id="l1017CopyRefLink">'+uiIcon('link')+' نسخ رابط الدعوة</button>'
      +'<button type="button" id="l1017ShareRef">'+uiIcon('share')+' مشاركة</button></div></div>'
      +'<div class="l1017-ref-stats" aria-label="نتائج دعواتك"><div><small>الدعوات المسجّلة</small><strong id="l1017InvitedCount">0</strong></div><div><small>بانتظار أول شراء</small><strong id="l1017PendingCount">0</strong></div><div><small>مكافآت مستلمة</small><strong id="l1017RewardedCount">0</strong></div><div><small>رصيد هدايا الدعوات</small><strong id="l1017EarnedTotal">0 د.ل</strong></div></div>'
      +'<form id="l1017ClaimReferralForm"><label for="l1017ReferredCode">وصلك كود من صديق؟ فعّله قبل أول طلب</label>'
      +'<div class="l1017-ref-claim-row"><input id="l1017ReferredCode" type="text" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="L1XXXXXXXXXXXX" dir="ltr" required><button type="submit" id="l1017ClaimRefSubmit">تفعيل الدعوة</button></div>'
      +'<p class="l1017-ref-claim-help" id="l1017MyClaimNotice"></p></form>'
      +'<p class="l1017-ref-monthly" id="l1017RefMonthly"></p></div>'
      +'<p class="l1017-ref-notice" id="l1017ReferralStatus" role="status" aria-live="polite"></p>';
    host.appendChild(node);
    q('#l1017ReferredCode').value=copyReferralFromQuery();
    q('#l1017RefLogin')?.addEventListener('click',()=>{
      if(typeof window.switchView==='function')window.switchView('account');
      else q('[data-view="account"]')?.click();
    });
    q('#l1017CreateRefCode')?.addEventListener('click',()=>void createCode());
    q('#l1017CopyRefCode')?.addEventListener('click',()=>void copy(code,'الكود'));
    q('#l1017CopyRefLink')?.addEventListener('click',()=>void copy(HOME+'?ref='+encodeURIComponent(code),'الرابط'));
    q('#l1017ShareRef')?.addEventListener('click',()=>void share());
    q('#l1017ClaimReferralForm')?.addEventListener('submit',e=>{e.preventDefault();void claim()});
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-view="referrals"],#l1017ReferralRefresh'))setTimeout(()=>void load(),130);
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
    banner.innerHTML=uiIcon('gift')+'<span>وصلك كود دعوة! وثّق رقم هاتفك وفعّله قبل أول عملية شراء.</span><button type="button">فتح الدعوة</button>';
    banner.querySelector('button').addEventListener('click',()=>{
      const nav=q('[data-view="referrals"]');
      if(nav)nav.click();else if(typeof window.switchView==='function')window.switchView('referrals');
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
      q('#l1017PendingCount').textContent=Number(totals.pending||0).toLocaleString('ar-LY');
      q('#l1017RewardedCount').textContent=Number(totals.rewarded||0).toLocaleString('ar-LY');
      q('#l1017EarnedTotal').textContent=Number(totals.credited_lyd||0).toFixed(2)+' د.ل';
      q('#l1017RefMonthly').textContent='مكافآت هذا الشهر: '+Number(stats.monthly_used||0)+' من '+Number(stats.monthly_limit||10)+' · هدية واحدة لكل صديق مؤهّل';
      const existing=stats.my_claim;
      const form=q('#l1017ClaimReferralForm');
      form.classList.toggle('hidden',!!existing);
      q('#l1017MyClaimNotice').textContent=existing?'': '';
      if(existing)q('#l1017RefMonthly').textContent+=' · دعوتك الواردة: '+(existing.status==='pending'?'بانتظار الطلب الأول':existing.status==='rewarded'?'تمت المكافأة':'غير مؤهلة');
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
  async function share(){
    if(!code){uiStatus('أنشئ كود الدعوة أولًا.',true);return}
    const url=HOME+'?ref='+encodeURIComponent(code);
    if(navigator.share){
      try{await navigator.share({title:'دعوة لمتجر L1017n',text:'سجّل في متجر L1017n وفعّل كود الدعوة قبل أول شراء: '+code,url})}
      catch(error){if(error?.name!=='AbortError')void copy(url,'الرابط')}
    }else void copy(url,'الرابط');
  }
  async function claim(){
    const db=getDb(),button=q('#l1017ClaimRefSubmit');
    if(!db||!button)return;
    const raw=q('#l1017ReferredCode').value.trim().toUpperCase();
    if(!isCode(raw)){uiStatus('كود الدعوة غير صحيح. راجع الرمز المرسل لك.',true);return}
    button.disabled=true;uiStatus('جاري التحقق من الدعوة…');
    try{
      const {error}=await db.rpc('claim_my_store_referral_code',{p_code:raw});
      if(error)throw error;
      try{sessionStorage.removeItem(REF_STORAGE)}catch(_){}
      uiStatus('تم ربط دعوتك! سيحصل صديقك على 1 د.ل عند اكتمال أول طلب لك بقيمة 15 د.ل أو أكثر.');
      await load();
    }catch(err){
      const e=String(err.message||'');
      const messages={
        invalid_referral_code:'كود الدعوة غير موجود أو غير صحيح.',
        referral_self_invitation:'ما تقدرش تستخدم كود حسابك الشخصي.',
        referral_already_claimed:'سبق وفعّلت كود دعوة؛ كل حساب له دعوة واحدة.',
        referral_only_before_first_order:'كود الدعوة لازم يتفعّل قبل أول طلب.',
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
