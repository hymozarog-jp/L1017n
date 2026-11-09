/* L1017N — verified Libyana USSD transfer intents, matched to signed SMS by the bot.
   Opening the phone dialer never proves payment; only verified backend receipts
   can change the wallet balance. */
(function(){
  'use strict';
  const RECEIVER='0925620538';
  const codeFor=amount=>'*122*'+RECEIVER+'*'+Math.round(amount*1000)+'#';
  const host=()=>document.getElementById('transferInstructions');
  const amountInput=()=>document.getElementById('topupAmount');
  let chosen=false, generation=0, currentRequest=null, currentAmount=null;
  let watcher=null, watcherId=null, refreshBusy=false, liveChannel=null;
  const VERIFY_SESSION_KEY='l1017n-active-topup-verify-v2';
  function rememberVerifier(id,amount){
    try{sessionStorage.setItem(VERIFY_SESSION_KEY,JSON.stringify({id:String(id),amount:Number(amount),savedAt:Date.now()}))}catch(_){}
  }
  function forgetVerifier(){try{sessionStorage.removeItem(VERIFY_SESSION_KEY)}catch(_){}}
  function restoreVerifier(){
    if(document.getElementById('tpReturnVerify'))return;
    try{
      const saved=JSON.parse(sessionStorage.getItem(VERIFY_SESSION_KEY)||'null');
      if(!saved)return;
      if(!/^[0-9a-f-]{36}$/i.test(String(saved.id))||!Number.isFinite(saved.savedAt)
        ||Date.now()-saved.savedAt>24*60*60*1000){forgetVerifier();return}
      showVerifier(saved.id,saved.amount);
    }catch(_){forgetVerifier()}
  }

  const style=document.createElement('style');
  style.id='auto-topup-css';
  style.textContent=[
    '#topupForm .auto-topup-status{padding:14px;margin:10px 0;border:1px solid #71877f6a;border-radius:14px;background:#152526;color:#d9f0de;line-height:1.8;font-size:13px}',
    '#topupForm .auto-topup-status.warning{border-color:#e1b66287;background:#5b411f29;color:#f4dba6}',
    '#topupForm .auto-topup-status.ok{border-color:#27a96590;background:#195f3a28;color:#c0f5cb}',
    '#topupForm .auto-topup-transfer{display:grid;gap:11px;margin:14px 0}',
    '#topupForm .auto-topup-transfer .ussd-code{padding:17px;text-align:center;direction:ltr;border:1px solid #75a8846b;border-radius:12px;background:#11231c;color:#fff;font-size:20px;letter-spacing:.3px;overflow-wrap:anywhere;user-select:all;display:block;text-decoration:none}',
    '#topupForm .auto-topup-transfer .btn{display:flex;justify-content:center;align-items:center;min-height:48px;text-align:center}',
    '#topupForm .auto-topup-transfer button{cursor:pointer}',
    '#topupForm .auto-topup-note{font-size:12px;color:#bdc9c1;line-height:1.85;margin:6px 0}',
    '#topupForm .auto-topup-status-title{font-weight:750;font-size:15px;margin-bottom:5px}',
    '#topupForm .dt-inline-credit-symbol.dt-wait-dots{display:inline-flex;align-items:center;justify-content:center;gap:4px;width:31px;min-width:31px;height:25px;flex-shrink:0;background:none;color:inherit;line-height:1}',
    '#topupForm .dt-wait-dot{width:6px;height:6px;display:block;border-radius:50%;background:#c5a9ff;animation:l1017n-wait-dot 1.05s ease-in-out infinite}',
    '#topupForm .dt-wait-dot:nth-child(2){animation-delay:.15s}',
    '#topupForm .dt-wait-dot:nth-child(3){animation-delay:.3s}',
    '@keyframes l1017n-wait-dot{0%,65%,100%{transform:translateY(0);opacity:.48}32%{transform:translateY(-6px);opacity:1}}',
    '@media(prefers-reduced-motion:reduce){#topupForm .dt-wait-dot{animation:none!important;opacity:1}}'
  ].join('');
  document.head.appendChild(style);

  function el(tag,cls,value){
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(value!=null)x.textContent=String(value);
    return x;
  }
  function setIconText(target,name,label){
    if(!target)return;
    const ns='http://www.w3.org/2000/svg';
    const icon=document.createElementNS(ns,'svg');
    icon.setAttribute('class','l1017-icon');
    icon.setAttribute('aria-hidden','true');
    const use=document.createElementNS(ns,'use');
    use.setAttribute('href','#l1017-icon-'+name);
    icon.appendChild(use);
    target.replaceChildren(icon,document.createTextNode(' '+String(label)));
  }
  function show(cls,title,details){
    const root=host(); if(!root)return null;
    const msg=el('div','auto-topup-status '+cls);
    msg.append(el('div','auto-topup-status-title',title));
    if(details)msg.append(el('div','',details));
    root.replaceChildren(msg);
    return root;
  }
  function stopWatcher(){
    if(watcher){clearInterval(watcher);watcher=null}
    watcherId=null;refreshBusy=false;
    if(liveChannel){
      const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
      try{void db?.removeChannel(liveChannel)}catch(_){}
      liveChannel=null;
    }
  }
  function resetSelection(){chosen=false;currentRequest=null;currentAmount=null;stopWatcher();clearDialHandoff();closeVerifier();}
  function errorText(error){
    const t=String(error?.message||'');
    if(/verified_libyana_phone_required/.test(t))return 'لو ما وثّقت رقمك، اكتب رقم المحوّل في الخطوة الثانية للشحن بالمراجعة اليدوية.';
    if(/manual_topup_daily_limit/.test(t))return 'وصلت الحد اليومي لطلبات الشحن اليدوية. حاول غدوة أو تواصل مع الإدارة.';
    if(/invalid_sender_phone/.test(t))return 'رقم المحوّل غير صحيح. يجب أن يبدأ بـ 092 أو 094.';
    if(/sender_phone_reserved/.test(t))return 'هذا الرقم يحتاج مراجعة الإدارة قبل استخدامه في الشحن.';
    if(/shared_sender_receipt_not_verified/.test(t))return 'الشحن من رقم تابع لحساب آخر ينتظر مطابقة رسالة تحويل حقيقية وموافقة الإدارة.';
    if(/sender_has_pending_request/.test(t))return 'فيه طلب شحن آخر بنفس رقم المحوّل والمبلغ. حاول بعد انتهائه أو تواصل مع الإدارة.';
    if(/ussd_daily_limit/.test(t))return 'طلبات كثيرة في وقت قصير؛ جرّب بعد شوية أو تواصل مع الإدارة.';
    if(/invalid_ussd_amount/.test(t))return 'اكتب مبلغًا صحيحًا بالدينار الليبي، ويجب أن يكون عددًا صحيحًا موجبًا.';
    return 'تعذر تجهيز طلب التحويل. لا تحوّل رصيدًا قبل ظهور رقم الطلب وكود الاتصال.';
  }
  // USSD hands control to the native Phone app. Returning is not proof of
  // transfer: this overlay only reads the authenticated existing request.
  const DIAL_HANDOFF_KEY='l1017n-ussd-return-v1';
  let dialHandoff=null;
  function saveDialHandoff(){
    try{
      if(dialHandoff)sessionStorage.setItem(DIAL_HANDOFF_KEY,JSON.stringify(dialHandoff));
      else sessionStorage.removeItem(DIAL_HANDOFF_KEY);
    }catch(_){/* private browsing can block session storage */}
  }
  function restoreDialHandoff(){
    if(dialHandoff)return dialHandoff;
    try{
      const saved=JSON.parse(sessionStorage.getItem(DIAL_HANDOFF_KEY)||'null');
      if(saved && typeof saved.id==='string' && saved.id.length>=10
        && Number.isFinite(saved.startedAt) && Date.now()-saved.startedAt>=0
        && Date.now()-saved.startedAt<30*60*1000 && saved.shown!==true){
        dialHandoff=saved;
      }else if(saved){sessionStorage.removeItem(DIAL_HANDOFF_KEY);}
    }catch(_){}
    return dialHandoff;
  }
  function clearDialHandoff(){dialHandoff=null;saveDialHandoff()}
  function armDialHandoff(id,amount){
    if(!id)return;
    dialHandoff={id:String(id),amount:Number(amount),startedAt:Date.now(),hidden:false,shown:false};
    saveDialHandoff();
  }
  // Keep verification in this wallet form. Never open a full-screen status dialog.
  function inlineTopupStatus(state,title,detail){
    const panel=document.querySelector('#topupForm .dt-purple-form');
    const line=document.getElementById('dtPhoneStatus');
    const messageText=title+(detail?' — '+detail:'');
    if(line){
      line.textContent=messageText;
      line.dataset.kind=state==='approved'?'success':state==='rejected'?'error':'';
    }
    if(!panel)return;
    let result=document.getElementById('dtInlineTopupStatus');
    if(!result){
      result=el('div','dt-inline-credit');
      result.id='dtInlineTopupStatus';
      result.setAttribute('role','status');
      result.setAttribute('aria-live','polite');
      const lineNode=panel.querySelector('#dtPhoneStatus');
      if(lineNode)lineNode.insertAdjacentElement('afterend',result);
      else panel.querySelector('#dtConfirm')?.insertAdjacentElement('beforebegin',result);
    }
    result.hidden=false;
    result.dataset.state=state;
    const submit=document.getElementById('dtConfirm');
    if(submit && state==='approved'){
      // Prevent a second tap from generating a duplicate payment request.
      submit.disabled=true;
      const label=submit.querySelector('span');
      if(label)label.textContent='تم الشحن ✓';
    }
    const waiting=state==='pending'||state==='matched';
    const symbol=el('span','dt-inline-credit-symbol',
      state==='approved'?'✓':state==='rejected'?'!':state==='delayed'?'!':'');
    if(waiting){
      // Three staggered animated dots are visual only; the status text
      // remains accessible and success requires an approved backend request.
      symbol.classList.add('dt-wait-dots');
      symbol.replaceChildren(el('i','dt-wait-dot'),el('i','dt-wait-dot'),el('i','dt-wait-dot'));
    }
    symbol.setAttribute('aria-hidden','true');
    const words=el('span','dt-inline-credit-copy');
    words.append(el('strong','',title));
    if(detail)words.append(el('small','',detail));
    result.replaceChildren(symbol,words);
  }
  function closeVerifier(){
    document.getElementById('tpReturnVerify')?.remove();
    document.getElementById('dtInlineTopupStatus')?.remove();
    document.body.classList.remove('tpv-open');
    stopWatcher();
    forgetVerifier();
  }
  function updateVerifier(id,data,networkError){
    const root=document.getElementById('tpReturnVerify');
    if(!root||root.dataset.requestId!==String(id))return;
    // RLS-backed topup_requests.status='approved' is the only success condition.
    if(root.dataset.state==='approved'||root.dataset.state==='rejected')return;
    if(networkError){
      inlineTopupStatus('pending','تعذّر تحديث حالة التحويل',
        'سنواصل المحاولة تلقائيًا عند توفر الاتصال. لا تحوّل الرصيد مرة ثانية.');
      return;
    }
    if(data?.status==='approved'){
      root.dataset.state='approved';
      const value=Number(data.amount);
      const amount=Number.isFinite(value)&&value>0?' بقيمة '+value.toFixed(2)+' د.ل':'';
      inlineTopupStatus('approved','تم الشحن ✓',
        'تم تأكيد وصول التحويل واعتماد رصيد محفظتك'+amount+'.');
      forgetVerifier();
      clearDialHandoff();
      return;
    }
    if(data?.status==='rejected'){
      root.dataset.state='rejected';
      inlineTopupStatus('rejected','لم يتم اعتماد الشحن',
        'راجع طلباتك أو تواصل مع إدارة المتجر قبل إعادة التحويل.');
      forgetVerifier();
      clearDialHandoff();
      return;
    }
    root.dataset.state='pending';
    const ageMs=data?.created_at?Date.now()-Date.parse(data.created_at):0;
    const delayed=Number.isFinite(ageMs)&&ageMs>=5*60*1000;
    if(data?.sms_status==='matched'){
      inlineTopupStatus('matched','وصل إشعار تحويل مطابق',
        'الطلب بانتظار الاعتماد؛ سيتم عرض «تم الشحن» فقط بعد إضافة الرصيد.');
    }else if(delayed){
      root.dataset.state='delayed';
      inlineTopupStatus('delayed','لم يتم تأكيد التحويل بعد',
        'إذا تم الخصم ولم يصل إشعار ليبيانا، راجع طلباتك ولا تعِد التحويل.');
    }else{
      inlineTopupStatus('pending','بانتظار وصول التحويل',
        'سيتم تحديث الحالة تلقائيًا بعد مطابقة رسالة ليبيانا واعتماد الرصيد.');
    }
  }
  const adminNotified=new Set();
  const adminNotificationInFlight=new Set();
  function notifyAdminForReview(id){
    const key=String(id||'');
    if(!key||adminNotified.has(key)||adminNotificationInFlight.has(key))return;
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db)return;
    adminNotificationInFlight.add(key);
    void db.functions.invoke('l1017n-topup-notify',{body:{request_id:key,action:'dial_opened'}})
      .then(({data,error})=>{
        if(!error&&data?.ok){
          adminNotified.add(key);
        }else{
          console.warn('[wallet/topup] Admin review notification was not delivered.');
        }
      }).catch(()=>console.warn('[wallet/topup] Admin review notification failed.'))
      .finally(()=>adminNotificationInFlight.delete(key));
  }
  function showVerifier(id,amount){
    if(!id)return;
    const existing=document.getElementById('tpReturnVerify');
    if(existing?.dataset.requestId===String(id)){
      if(!watcherId)watch(id);
      return;
    }
    if(existing)closeVerifier();
    // A hidden marker maintains request identity for polling/realtime without
    // any modal, focus trap or new screen. CSS for the old overlay cannot show it.
    const root=el('span','','');
    root.id='tpReturnVerify';
    root.dataset.requestId=String(id);
    root.dataset.state='pending';
    root.dataset.amount=String(amount||'');
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
    root.style.setProperty('display','none','important');
    root.style.setProperty('position','static','important');
    (document.getElementById('topupForm')||document.body).appendChild(root);
    document.body.classList.remove('tpv-open');
    // When returning from the dialer/reloading, show the normal top-up form,
    // not the former separate verification overlay.
    if(!document.getElementById('topupDedicatedPage')
      && typeof window.openDedicatedTopup==='function')window.openDedicatedTopup();
    inlineTopupStatus('pending','بانتظار وصول التحويل',
      'نراجع حالة الطلب في الخلفية؛ لا تحوّل المبلغ مرة ثانية.');
    currentRequest=String(id);
    currentAmount=Number(amount);
    rememberVerifier(id,amount);
    watch(id);
  }
  function maybeShowReturnVerify(){
    const h=restoreDialHandoff();
    if(!h||h.shown||document.visibilityState==='hidden')return;
    const elapsed=Date.now()-h.startedAt;
    if(elapsed<1400||elapsed>30*60*1000)return;
    // Some iOS/Android in-app browsers never dispatch visibility=hidden.
    // In that case, allow a later focus event but not the immediate tap.
    if(!h.hidden && elapsed<4000)return;
    if(currentRequest && String(currentRequest)!==h.id)return;
    h.shown=true;saveDialHandoff();
    // Retry the click-originated notification when returning from the dialer.
    notifyAdminForReview(h.id);
    showVerifier(h.id,h.amount);
    clearDialHandoff();
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      const h=restoreDialHandoff();
      if(h){h.hidden=true;saveDialHandoff();}
    }else setTimeout(maybeShowReturnVerify,260);
  });
  window.addEventListener('focus',()=>setTimeout(maybeShowReturnVerify,270));
  window.addEventListener('pageshow',()=>setTimeout(maybeShowReturnVerify,430));
  // Restore the in-form pending status after a browser reload; permissions
  // are checked again server-side for the logged-in customer.
  setTimeout(()=>{maybeShowReturnVerify();if(!document.getElementById('tpReturnVerify'))restoreVerifier()},1150);

  async function refreshRequest(id){
    if(!id)return;
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db)return;
    const root=document.getElementById('tpReturnVerify');
    // The visible request is authoritative: a new wallet render must not
    // silently detach its approval watcher from the customer-facing dialog.
    if(root && root.dataset.requestId!==String(id))return;
    try{
      // Read the actual approved/rejected status directly with user-scoped RLS.
      // The older SMS detail RPC is optional; its failure must not hide an
      // already-approved wallet credit.
      const {data:row,error}=await db.from('topup_requests')
        .select('id,status,amount,created_at')
        .eq('id',String(id)).maybeSingle();
      if(error)throw error;
      if(!row){
        if(root)updateVerifier(id,null,true);
        return;
      }
      const data={status:row.status,amount:row.amount,created_at:row.created_at,sms_status:'not_received'};
      if(row.status==='pending'){
        try{
          const detail=await db.rpc('get_my_ussd_topup_status',{p_request_id:id});
          if(!detail.error && detail.data?.sms_status)data.sms_status=detail.data.sms_status;
        }catch(_){/* status from RLS table remains authoritative */}
      }
      const status=document.getElementById('ussdTransferStatus');
      if(root?.dataset.requestId===String(id))currentRequest=String(id);
      if(currentRequest!==String(id) && !root)return;
      updateVerifier(id,data);
      if(data.status==='approved'){
        setIconText(status,'check-circle','تم الشحن! أُضيف الرصيد إلى محفظتك.');
        // Only a verified credited transaction (not an SMS or pending request)
        // can launch the falling balance animation.
        await window.L1017nCreditDrop?.approved?.(String(id));
        stopWatcher();chosen=false;forgetVerifier();
        if(typeof renderWallet==='function')Promise.resolve(renderWallet()).catch(()=>{});
        return;
      }
      if(data.status==='rejected'){
        setIconText(status,'ban','تم رفض طلب الشحن. تواصل مع إدارة المتجر مع رقم الطلب.');
        stopWatcher();forgetVerifier();return;
      }
      if(data.sms_status==='matched'){
        setIconText(status,'mail','وصل إشعار تحويل مطابق. الطلب الآن قيد المراجعة، لا تكرر التحويل.');
      }else if(status){
        const ageMs=Date.now()-Date.parse(row.created_at||'');
        const delayed=Number.isFinite(ageMs)&&ageMs>=5*60*1000;
        setIconText(status,delayed?'alert':'clock',delayed
          ?'لم تصل رسالة تحويل مطابقة بعد 5 دقائق. إذا خُصم الرصيد، تواصل مع المتجر برقم الطلب ولا تكرر التحويل.'
          :'بانتظار رسالة ليبيانا ومطابقة التحويل. لا تكرر التحويل.');
      }
    }catch(e){
      updateVerifier(id,null,true);
      console.warn('USSD status could not be refreshed',e);
    }
  }
  function watch(id){
    stopWatcher();
    watcherId=String(id);
    void refreshRequest(id);
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    // Realtime pushes approved/rejected updates as soon as Telegram
    // changes the request. Polling remains a fallback for in-app browsers.
    if(db?.channel){
      try{
        liveChannel=db.channel('l1017n-topup-'+String(id))
          .on('postgres_changes',{
            event:'UPDATE',schema:'public',table:'topup_requests',filter:'id=eq.'+String(id)
          },()=>{if(document.getElementById('tpReturnVerify')?.dataset.requestId===String(id))void refreshRequest(id)})
          .subscribe();
      }catch(err){console.warn('Realtime unavailable, using polling',err)}
    }
    watcher=setInterval(()=>{
      if(watcherId===String(id)&&document.visibilityState==='visible'&&!refreshBusy){
        refreshBusy=true;
        Promise.resolve(refreshRequest(id)).finally(()=>{refreshBusy=false});
      }
    },1800);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&watcherId&&!refreshBusy)void refreshRequest(watcherId);
  });
  window.addEventListener('pageshow',()=>{
    if(watcherId)void refreshRequest(watcherId);
  });
  window.addEventListener('online',()=>{
    if(watcherId)void refreshRequest(watcherId);
  });
  async function render(){
    const root=host(), amountEl=amountInput();
    if(!root||!amountEl)return;
    const run=++generation;
    if(!chosen){
      show('','جاهز للشحن','اكتب المبلغ أو اختاره من الأزرار، ثم اضغط «متابعة شحن المحفظة». لا يتم تحويل أي رصيد بمجرد اختيار المبلغ.');
      return;
    }
    const amount=Number(amountEl.value);
    if(!Number.isSafeInteger(amount)||amount<1||amount>10000){
      show('warning','مبلغ غير صحيح','أدخل مبلغًا صحيحًا بالدينار الليبي. تأكد أن المبلغ يتوافق مع شروط خدمة تحويل ليبيانا.');
      return;
    }
    show('','جاري تجهيز كود التحويل…','نجهّز كود التحويل؛ الشحن يتم تلقائيًا بعد مطابقة رقم المحوّل والمبلغ برسالة ليبيانا الواردة.');
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db){show('warning','تعذر الاتصال بالمتجر','حدّث الصفحة وحاول مرة ثانية.');return}
    try{
      const [auth,verified,readiness]=await Promise.all([
        db.auth.getUser(),
        db.functions.invoke('l1017n-resala-otp',{body:{action:'status'}}),
        db.rpc('is_libyana_topup_intake_enabled')
      ]);
      if(run!==generation)return;
      if(auth.error||!auth.data?.user){
        show('warning','لازم تسجّل الدخول أولًا','ارجع لحسابك وسجّل الدخول قبل شحن المحفظة.');return;
      }
      // OTP is optional for manually reviewed top-ups. Never interpret a failed
      // OTP-status lookup as a verified phone or as proof of payment.
      const maybePhone=verified.error||verified.data?.verified!==true
        ?'':String(verified.data?.phone||'');
      const phone=/^09[24][0-9]{7}$/.test(maybePhone)?maybePhone:'';
      if(readiness.error)throw readiness.error;
      if(readiness.data!==true){
        show('warning','خدمة استقبال طلبات الشحن غير متاحة حاليًا','ما تحوّلش رصيد قبل ما ترجع خدمة المطابقة والمراجعة تشتغل.');
        return;
      }
      // The account must be signed in. An OTP-verified sender uses the original
      // path; other senders are matched against their entered number and the incoming carrier SMS.
      const senderPicker=window.L1017nTopupWizard?.getSenderPhone;
      const sender=typeof senderPicker==='function'?senderPicker():phone;
      if(!/^09[24][0-9]{7}$/.test(sender)){
        show('warning','رقم المحوّل غير صحيح','اكتب رقم ليبيانا يبدأ بـ 092 أو 094 في خطوة رقم الهاتف.');
        return;
      }
      const otherSender=!phone||sender!==phone;
      const intentCall=otherSender
        ?db.rpc('create_ussd_topup_intent_for_sender',{p_amount:amount,p_sender_phone:sender})
        :db.rpc('create_ussd_topup_intent',{p_amount:amount});
      const {data:intent,error:intentError}=await intentCall;
      if(run!==generation)return;
      if(intentError)throw intentError;
      if(!intent?.request_id)throw Error('missing_request');
      currentRequest=intent.request_id;currentAmount=amount;
      // Preparing the USSD request does not notify Telegram; opening the dial code does.
      if(intent.state==='matched'){
        show('ok','وصل إشعار التحويل','وصل إشعار بنفس الرقم والمبلغ، وطلبك بانتظار قرار الإدارة. لا تحوّل المبلغ مرة ثانية.');
        const current=host();
        const status=el('div','auto-topup-status');setIconText(status,'clock','بانتظار تأكيد رصيد المحفظة.');
        status.id='ussdTransferStatus';
        current?.append(status);
        showVerifier(intent.request_id,amount);
        return;
      }
      const area=show('ok','تم تجهيز طلب شحن '+amount+' د.ل',
        'تقدر تفتح تطبيق المكالمات من الزر أو تنسخ كود التحويل وتطلبه بنفسك. سنتابع طلبك تلقائيًا، ويظهر الشحن بعد اعتماد وصول الرصيد الحقيقي إلى المتجر.');
      if(!area)return;
      const panel=el('div','auto-topup-transfer');
      panel.append(el('div','','المبلغ: '+amount.toFixed(2)+' د.ل'));
      panel.append(el('div','','رقم المحوّل: '+sender));
      panel.append(el('p','auto-topup-note','الطلب مربوط بالرقم والمبلغ أعلاه. لازم تحوّل من نفس الرقم بالضبط، سواء من التطبيق أو عبر زر الاتصال.'));
      if(otherSender)panel.append(el('p','auto-topup-note','نفّذ التحويل من الرقم المكتوب فقط. إذا كان رقم شخص آخر، لازم موافقته ومطابقة تحويله قبل شحن محفظتك.'));
      const dialHref='tel:'+codeFor(amount).replace('#','%23');
      const onDialCode=()=>{
        armDialHandoff(intent.request_id,amount);
        notifyAdminForReview(intent.request_id);
        // Start unobtrusive monitoring on the same page as soon as the dialer opens.
        showVerifier(intent.request_id,amount);
      };
      const code=el('a','ussd-code',codeFor(amount));
      code.href=dialHref;
      code.setAttribute('aria-label','اضغط كود ليبيانا لفتح الاتصال');
      code.addEventListener('click',onDialCode);
      panel.append(code);
      const dial=el('a','btn btn-primary full-width');setIconText(dial,'phone','فتح الاتصال وتحويل '+amount+' د.ل');
      dial.href=dialHref;
      dial.setAttribute('aria-label','فتح الهاتف بكود تحويل ليبيانا من رقم المحوّل المحدّد');
      dial.addEventListener('click',onDialCode);
      panel.append(dial);
      const copy=el('button','btn btn-soft full-width','نسخ الكود للتحويل من تطبيق المكالمات');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try{
          await navigator.clipboard.writeText(codeFor(amount));
          armDialHandoff(intent.request_id,amount);
          showVerifier(intent.request_id,amount);
          setIconText(copy,'check','تم نسخ الكود — افتح تطبيق المكالمات');
        }
        catch(_){window.prompt('انسخ كود الاتصال إلى تطبيق الهاتف:',codeFor(amount))}
      });
      panel.append(copy);
      const status=el('div','auto-topup-status','⏳ رقم الطلب جاهز. فتح كود الاتصال ينبه الإدارة ببدء المحاولة، وليس بإتمام الدفع.');
      status.id='ussdTransferStatus';
      const refresh=el('button','btn btn-soft full-width','تحديث حالة التحويل');
      refresh.type='button';refresh.addEventListener('click',()=>{
        if(dialHandoff){dialHandoff.shown=true;saveDialHandoff();clearDialHandoff();}
        showVerifier(intent.request_id,amount);
      });
      panel.append(status,refresh);
      panel.append(el('p','auto-topup-note','تقدر تحول من تطبيق المكالمات مباشرة بالكود الظاهر، حتى لو كتبته يدويًا، بعد تجهيز هذا الطلب. مش محتاج تضغط «تم التحويل»؛ سنتابع وصول التحويل تلقائيًا. فتح الاتصال وحده لا يثبت الدفع، ولا تكرر التحويل إذا تأخر التأكيد.'));
      area.append(panel);
      // Monitor the existing intent before the customer switches to the native dialer.
      // A prepared intent alone never grants credit; only authenticated approval does.
      showVerifier(intent.request_id,amount);
    }catch(err){
      if(run!==generation)return;
      console.warn('USSD transfer preparation failed',err);
      show('warning','تعذر تجهيز التحويل',errorText(err));
    }
  }

  // Do not generate payment intents merely by changing the number: only
  // an explicit Continue click prepares the verified USSD payment.
  let inputDebounce=null;
  function refreshQuickAmounts(){
    const value=String(amountInput()?.value||'').trim();
    document.querySelectorAll('#topupForm [data-amount]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.amount===value));
    });
  }
  function clearIntent(){
    resetSelection();generation++;
    refreshQuickAmounts();
    show('','جاهز للشحن','اختار المبلغ المناسب واضغط «متابعة». أي مبلغ تختاره لازم تسمح به خدمة تحويل ليبيانا.');
  }
  // Capture before older wallet listeners call refreshAutoTopup: no intent
  // may be generated just because the amount field changes.
  amountInput()?.addEventListener('input',()=>{
    clearTimeout(inputDebounce);
    clearIntent();
  },true);
  document.querySelectorAll('#topupForm [data-amount]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(amountInput())amountInput().value=btn.dataset.amount;
      clearTimeout(inputDebounce);
      clearIntent();
    });
  });
  document.getElementById('topupProceed')?.addEventListener('click',async e=>{
    const button=e.currentTarget;
    if(button.disabled)return;
    chosen=true;
    button.disabled=true;
    try{await render()}
    finally{button.disabled=false}
  });
  async function renderTopupPhoneStatus(){
    const number=document.getElementById('topupVerifiedNumber');
    const state=document.getElementById('topupPhoneState');
    if(!number||!state)return;
    number.textContent='جاري التحقق…';state.textContent='فحص التوثيق';
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db){number.textContent='غير متاح';state.textContent='تعذر الاتصال';state.className='tp-phone-state is-error';return}
    try{
      const [user,verified]=await Promise.all([
        db.auth.getUser(),db.functions.invoke('l1017n-resala-otp',{body:{action:'status'}})
      ]);
      if(user.error||!user.data?.user){number.textContent='سجّل الدخول أولًا';state.textContent='غير مسجّل';state.className='tp-phone-state is-error';return}
      const phone=String(verified.data?.phone||'');
      if(verified.error||!verified.data?.verified||!/^09[24][0-9]{7}$/.test(phone)){
        number.textContent='لم يتم توثيق رقم ليبيانا';
        state.textContent='وثّق رقمك في حسابي';state.className='tp-phone-state is-error';return;
      }
      number.textContent=phone;
      setIconText(state,'check-circle','رقم موثّق');state.className='tp-phone-state is-verified';
    }catch(error){number.textContent='تعذر جلب الرقم';state.textContent='أعد المحاولة';state.className='tp-phone-state is-error'}
  }
  let directBusy=false;
  window.L1017nDirectTransfer=Object.freeze({receiver:RECEIVER,prepare:async()=>{
    if(directBusy)return null;
    directBusy=true;chosen=true;
    try{await render();return host()?.querySelector('a.ussd-code')||null}
    finally{directBusy=false}
  }});
  window.dispatchEvent(new Event('l1017n-direct-ready'));
  window.renderTopupPhoneStatus=renderTopupPhoneStatus;
  window.refreshAutoTopup=()=>render();
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-view="wallet"],#walletActionTopup,#topupModalContinue')){
      if(chosen)setTimeout(render,50);
      if(event.target.closest('#walletActionTopup'))renderTopupPhoneStatus();
    }
  });
  if(typeof supabaseClient!=='undefined'){
    supabaseClient.auth.onAuthStateChange(event=>{
      if(event==='SIGNED_OUT'){resetSelection();render();}
    });
  }
  render();
})();
