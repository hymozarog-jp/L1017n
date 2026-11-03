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
  // Every qualifying first purchase pays 1 LYD exactly once. These are
  // cumulative reward totals, NOT extra bonuses for completing a milestone.
  const TASK_TARGETS=Object.freeze([1,5,10]);
  const TASK_NAMES=Object.freeze(['ادعُ صديقًا واحدًا','ادعُ 5 أصدقاء','ادعُ 10 أصدقاء']);
  const TASK_LABELS=Object.freeze(['الخطوة الأولى','الخطوة الثانية','الخطوة الثالثة']);
  function renderReferralTasks(rewarded){
    const root=q('#l1017ReferralTasksList');
    if(!root)return;
    const done=Math.max(0,Math.floor(Number(rewarded)||0));
    let activeStage=TASK_TARGETS.findIndex(target=>done<target);
    if(activeStage<0)activeStage=TASK_TARGETS.length;
    root.innerHTML=TASK_TARGETS.map((target,index)=>{
      const completed=done>=target;
      const active=index===activeStage;
      const progress=Math.min(done,target);
      const remaining=Math.max(0,target-done);
      const state=completed?'مكتملة':active?'المهمة الحالية':'المهمة القادمة';
      const taskClass=completed?'is-done':active?'is-active':'is-locked';
      const marker=completed?'check-circle':active?'gift':'lock';
      const percent=Math.round(progress/target*100);
      const detail=completed
        ?'حصلت على مكافآت '+target+' دعوات مؤهلة'
        :active?'باقي '+remaining+' '+(remaining===1?'صديق مؤهّل':'أصدقاء مؤهّلين')+' لإكمال المرحلة'
          :'تُفتح بعد إكمال المرحلة السابقة';
      return '<article class="l1017-ref-task '+taskClass+'" aria-label="'+TASK_NAMES[index]+' — '+state+' — إجمالي المكافأة '+target+' دينار ليبي">'
        +'<div class="l1017-ref-task-top">'
          +'<span class="l1017-ref-task-mark">'+uiIcon(marker)+'</span>'
          +'<div class="l1017-ref-task-main"><small>المهمة '+(index+1)+' من 3 · '+TASK_LABELS[index]+'</small>'
          +'<strong>'+TASK_NAMES[index]+'</strong></div>'
          +'<div class="l1017-ref-task-reward"><small>إجمالي المكافأة</small><strong>'+target+' <span>د.ل</span></strong></div>'
        +'</div>'
        +'<div class="l1017-ref-task-details"><span class="l1017-ref-task-state">'+state+'</span>'
        +'<span class="l1017-ref-task-count">التقدم <b dir="ltr">'+progress+' / '+target+'</b></span></div>'
        +'<div class="l1017-ref-task-track" role="progressbar" aria-valuemin="0" aria-valuemax="'+target+'" aria-valuenow="'+progress+'" aria-label="تقدم مهمة '+TASK_NAMES[index]+'"><span style="width:'+percent+'%"></span></div>'
        +'<p class="l1017-ref-task-detail">'+detail+'</p>'
        +'</article>';
    }).join('');
    const finished=TASK_TARGETS.filter(target=>done>=target).length;
    const total=q('#l1017TasksCompleted');
    if(total)total.textContent=finished+' / 3 مهام مكتملة';
    const headline=q('#l1017TasksHeadline');
    if(headline)headline.textContent=activeStage===TASK_TARGETS.length
      ?'مبروك! أنهيت مستويات دعوة الأصدقاء'
      :'المهمة الحالية: '+TASK_NAMES[activeStage];
    const overall=q('#l1017RefOverallCount');
    if(overall)overall.textContent=Math.min(done,10)+' / 10';
    const summary=q('#l1017RefOverviewStatus');
    if(summary)summary.textContent=done>=10?'أنهيت المراحل الثلاث':
      'تبقّى '+Math.max(0,10-done)+' '+(10-done===1?'دعوة مؤهلة':'دعوات مؤهلة')+' للوصول للمستوى الأخير';
  }
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
      +'<div class="l1017-ref-rules">'+uiIcon('shield-check')+'تُحسب الدعوة بعد توثيق الهاتف وإكمال أول طلب مؤهل بقيمة 15 د.ل أو أكثر · حتى 10 مكافآت شهريًا</div>'
      +'<div class="l1017-ref-earn-hero"><div><small>هدية كل صديق مؤهل</small><strong>1 <span>د.ل</span></strong></div>'
      +'<div class="l1017-ref-earn-hero-side"><small>مجموع المكافآت عند دعوة 10 أصدقاء</small><strong>10 د.ل</strong><span>تُجمع تدريجيًا، دون مكافأة إضافية للمستوى</span></div></div>'
      +'<div class="l1017-ref-tasks" aria-label="مهام دعوة الأصدقاء">'
      +'<div class="l1017-ref-tasks-heading"><div><small>MISSIONS · 01 / 03</small><h3>مهام الدعوات</h3><p id="l1017TasksHeadline">المهمة الحالية: ادعُ صديقًا واحدًا</p></div>'
      +'<span id="l1017TasksCompleted">0 / 3 مهام مكتملة</span></div>'
      +'<div class="l1017-ref-overall"><span>تقدمك نحو 10 دعوات</span><strong id="l1017RefOverallCount" dir="ltr">0 / 10</strong><small id="l1017RefOverviewStatus">تبقّى 10 دعوات مؤهلة للوصول للمستوى الأخير</small></div>'
      +'<div id="l1017ReferralTasksList" class="l1017-ref-tasks-list" aria-live="polite"></div>'
      +'<p class="l1017-ref-tasks-disclaimer">'+uiIcon('shield-check')+' المبالغ الظاهرة هي <strong>إجمالي</strong> المكافآت عند الوصول لكل مستوى، وليست جوائز إضافية. مكافأة 1 د.ل تُضاف للمحفظة عند اكتمال طلب كل صديق مؤهل.</p></div>'
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
    renderReferralTasks(0);
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
      if(!loggedIn){code='';renderReferralTasks(0);return}
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
      renderReferralTasks(totals.rewarded);
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
