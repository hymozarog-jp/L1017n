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
  let watcher=null, watcherCount=0;

  const style=document.createElement('style');
  style.id='auto-topup-css';
  style.textContent=[
    '#topupForm .auto-topup-status{padding:14px;margin:10px 0;border:1px solid #71877f6a;border-radius:14px;background:#152526;color:#d9f0de;line-height:1.8;font-size:13px}',
    '#topupForm .auto-topup-status.warning{border-color:#e1b66287;background:#5b411f29;color:#f4dba6}',
    '#topupForm .auto-topup-status.ok{border-color:#27a96590;background:#195f3a28;color:#c0f5cb}',
    '#topupForm .auto-topup-transfer{display:grid;gap:11px;margin:14px 0}',
    '#topupForm .auto-topup-transfer .ussd-code{padding:17px;text-align:center;direction:ltr;border:1px solid #75a8846b;border-radius:12px;background:#11231c;color:#fff;font-size:20px;letter-spacing:.3px;overflow-wrap:anywhere;user-select:all}',
    '#topupForm .auto-topup-transfer .btn{display:flex;justify-content:center;align-items:center;min-height:48px;text-align:center}',
    '#topupForm .auto-topup-transfer button{cursor:pointer}',
    '#topupForm .auto-topup-note{font-size:12px;color:#bdc9c1;line-height:1.85;margin:6px 0}',
    '#topupForm .auto-topup-status-title{font-weight:750;font-size:15px;margin-bottom:5px}'
  ].join('');
  document.head.appendChild(style);

  function el(tag,cls,value){
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(value!=null)x.textContent=String(value);
    return x;
  }
  function show(cls,title,details){
    const root=host(); if(!root)return null;
    const msg=el('div','auto-topup-status '+cls);
    msg.append(el('div','auto-topup-status-title',title));
    if(details)msg.append(el('div','',details));
    root.replaceChildren(msg);
    return root;
  }
  function stopWatcher(){if(watcher){clearInterval(watcher);watcher=null}watcherCount=0}
  function resetSelection(){chosen=false;currentRequest=null;currentAmount=null;stopWatcher();clearDialHandoff();closeVerifier();}
  function errorText(error){
    const t=String(error?.message||'');
    if(/verified_libyana_phone_required/.test(t))return 'الشحن عبر هذا الكود يتطلب رقم ليبيانا 092 أو 094 موثّق برسالة SMS من حسابي.';
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
  function closeVerifier(){
    document.getElementById('tpReturnVerify')?.remove();
    document.body.classList.remove('tpv-open');
  }
  function updateVerifier(id,data,networkError){
    const root=document.getElementById('tpReturnVerify');
    if(!root||root.dataset.requestId!==String(id))return;
    const title=root.querySelector('.tpv-title');
    const desc=root.querySelector('.tpv-subtitle');
    const foot=root.querySelector('.tpv-footnote');
    if(!title||!desc||!foot)return;
    if(networkError){
      root.dataset.state='pending';
      title.textContent='جاري التحقق من التحويل';
      desc.textContent='تعذّر تحديث الحالة الآن. تأكد من اتصال الإنترنت واضغط «تحديث حالة الطلب».';
      foot.textContent='لم يتم تأكيد الشحن بعد. لا تحول الرصيد مرة ثانية.';
      return;
    }
    if(data?.status==='approved'){
      root.dataset.state='approved';
      title.textContent='تم اعتماد الشحن!';
      desc.textContent='أكد النظام اعتماد الطلب وإضافة المبلغ لمحفظتك بنجاح.';
      foot.textContent='يمكنك إغلاق النافذة أو متابعة طلباتك.';
      clearDialHandoff();
      return;
    }
    if(data?.status==='rejected'){
      root.dataset.state='rejected';
      title.textContent='لم يتم اعتماد الشحن';
      desc.textContent='لم تتم الموافقة على الطلب. راجع حالة الطلب أو تواصل مع الإدارة.';
      foot.textContent='لا تكرر التحويل قبل معرفة سبب الرفض.';
      clearDialHandoff();
      return;
    }
    root.dataset.state='pending';
    title.textContent='جاري التحقق من التحويل';
    if(data?.sms_status==='matched'){
      desc.textContent='وصل إشعار مطابق لرقمك ومبلغ طلبك. ننتظر الاعتماد النهائي قبل إضافة الرصيد.';
    }else{
      desc.textContent='ننتظر وصول إشعار التحويل ومطابقته مع طلبك. قد يستغرق ذلك قليلًا.';
    }
    foot.textContent='الرجوع من الاتصال لا يؤكد نجاح الدفع. لا تكرر التحويل.';
  }
  function showVerifier(id,amount){
    if(!id)return;
    const existing=document.getElementById('tpReturnVerify');
    if(existing){if(existing.dataset.requestId===String(id))return;closeVerifier()}
    const root=document.createElement('section');
    root.id='tpReturnVerify';
    root.dataset.requestId=String(id);
    root.dataset.state='pending';
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','true');
    root.setAttribute('aria-labelledby','tpvHeading');
    root.setAttribute('aria-describedby','tpvDescription');
    root.dir='rtl';
    root.innerHTML='<div class="tpv-card">'
      +'<button type="button" class="tpv-close" aria-label="إغلاق شاشة التحقق">×</button>'
      +'<span class="tpv-brand">L1017n <span>•</span> ليبيانا</span>'
      +'<div class="tpv-visual" aria-hidden="true">'
        +'<span class="tpv-spark"></span><span class="tpv-ring tpv-ring-outer"></span><span class="tpv-ring tpv-ring-inner"></span>'
        +'<div class="tpv-visual-icon"><svg viewBox="0 0 48 48"><path d="M24 7 36 12v11c0 8-5 14-12 18-7-4-12-10-12-18V12Z"/><path d="m18 24 4 4 8-9"/></svg></div>'
      +'</div>'
      +'<h2 class="tpv-title" id="tpvHeading" tabindex="-1">جاري التحقق من التحويل</h2>'
      +'<p class="tpv-subtitle" id="tpvDescription" role="status" aria-live="polite">نراجع حالة طلبك ونتأكد من وصول إشعار ليبيانا. لا تحتاج إلى التحويل مرة ثانية.</p>'
      +'<div class="tpv-amount">مبلغ الشحن <b class="tpv-amount-value"></b> د.ل</div>'
      +'<div class="tpv-progress" aria-hidden="true"><div class="tpv-progress-fill"></div></div>'
      +'<div class="tpv-steps" aria-label="خطوات متابعة الشحن">'
        +'<div class="tpv-step"><i>1</i><span>تجهيز الطلب</span></div>'
        +'<div class="tpv-step"><i>2</i><span>مطابقة التحويل</span></div>'
        +'<div class="tpv-step"><i>3</i><span>اعتماد الرصيد</span></div>'
      +'</div>'
      +'<div class="tpv-actions">'
        +'<button class="tpv-action tpv-refresh" type="button">تحديث حالة الطلب</button>'
        +'<button class="tpv-action tpv-dismiss" type="button">متابعة التسوق</button>'
      +'</div>'
      +'<p class="tpv-footnote">الرجوع من الاتصال لا يؤكد نجاح الدفع. لا تكرر التحويل.</p>'
    +'</div>';
    root.querySelector('.tpv-amount-value').textContent=
      Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount).toFixed(2):'—';
    root.querySelector('.tpv-close').addEventListener('click',closeVerifier);
    root.querySelector('.tpv-dismiss').addEventListener('click',()=>{
      closeVerifier();
      const page=document.getElementById('topupDedicatedPage');
      if(page)page.querySelector('.topup-dedicated-back')?.click();
      if(typeof switchView==='function')switchView('orders');
    });
    root.querySelector('.tpv-refresh').addEventListener('click',()=>refreshRequest(id));
    document.body.appendChild(root);
    document.body.classList.add('tpv-open');
    root.querySelector('.tpv-title')?.focus({preventScroll:true});
    currentRequest=String(id);
    currentAmount=Number(amount);
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
  // The browser may reload the page after handing off to Phone.
  setTimeout(maybeShowReturnVerify,700);

  async function refreshRequest(id){
    if(!id||!host())return;
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db)return;
    try{
      const {data,error}=await db.rpc('get_my_ussd_topup_status',{p_request_id:id});
      if(error)throw error;
      const status=document.getElementById('ussdTransferStatus');
      if(currentRequest!==String(id))return;
      updateVerifier(id,data);
      if(data?.status==='approved'){
        if(status)status.textContent='✅ تم اعتماد التحويل وإضافة الرصيد لمحفظتك.';
        stopWatcher();chosen=false;
        if(typeof renderWallet==='function')Promise.resolve(renderWallet()).catch(()=>{});
        return;
      }
      if(data?.status==='rejected'){
        if(status)status.textContent='⛔ لم يُعتمد التحويل. تواصل مع إدارة المتجر مع رقم الطلب.';
        stopWatcher();return;
      }
      if(data?.sms_status==='matched'){
        if(status)status.textContent='📩 البوت طابق إشعار التحويل. جاري انتظار نتيجة الفحص الآلي؛ ما تكررّش التحويل. إذا احتاجت العملية مراجعة، تظهر حالتها هنا.';
      }else{
        if(status)status.textContent='⏳ ننتظر إشعار التحويل من ليبيانا. فتح الاتصال لا يعني نجاح التحويل؛ أكّد العملية داخل قائمة USSD. لا تكرر التحويل.';
      }
    }catch(e){
      updateVerifier(id,null,true);
      console.warn('USSD status could not be refreshed',e);
    }
  }
  function watch(id){
    stopWatcher();
    refreshRequest(id);
    watcher=setInterval(()=>{
      if(++watcherCount>45){stopWatcher();return}
      if(document.visibilityState==='visible')refreshRequest(id);
    },7000);
  }
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
    show('','جاري تجهيز كود التحويل…','نتأكد أولًا من رقم ليبيانا الموثّق، ونجهز رقم متابعة حتى يتعرف البوت على العملية.');
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db){show('warning','تعذر الاتصال بالمتجر','حدّث الصفحة وحاول مرة ثانية.');return}
    try{
      const [auth,verified,readiness]=await Promise.all([
        db.auth.getUser(),
        db.functions.invoke('l1017n-resala-otp',{body:{action:'status'}}),
        db.rpc('is_my_auto_libyana_topup_ready')
      ]);
      if(run!==generation)return;
      if(auth.error||!auth.data?.user){
        show('warning','لازم تسجّل الدخول أولًا','ارجع لحسابك وسجّل الدخول قبل شحن المحفظة.');return;
      }
      if(verified.error||!verified.data?.configured)throw Error('otp_unavailable');
      if(!verified.data?.verified){
        const parent=show('warning','لازم توثّق رقمك أولًا','افتح حسابي ووثّق رقم الهاتف برسالة SMS. ما تحولش رصيد قبل التوثيق.');
        const btn=el('button','btn btn-primary','توثيق رقم الهاتف');
        btn.type='button';btn.onclick=async()=>{if(typeof switchView==='function')switchView('account');if(typeof window.openPersonalDetails==='function')await window.openPersonalDetails({focusPhone:true});};
        parent?.append(btn);
        return;
      }
      const phone=String(verified.data?.phone||'');
      if(!/^09[24][0-9]{7}$/.test(phone)){
        show('warning','الكود هذا لليبيانا فقط','رقمك الموثّق ليس رقم ليبيانا (092 أو 094). لا تستخدم هذا الكود من شبكة المدار.');return;
      }
      if(readiness.error)throw readiness.error;
      if(readiness.data!==true){
        show('warning','الشحن الآلي غير متاح حاليًا','لا تحوّل أي رصيد قبل ما يرجع النظام يشتغل. التأكد من التوثيق أو إعدادات الإدارة مطلوب.');
        return;
      }
      const {data:intent,error:intentError}=await db.rpc('create_ussd_topup_intent',{p_amount:amount});
      if(run!==generation)return;
      if(intentError)throw intentError;
      if(!intent?.request_id)throw Error('missing_request');
      currentRequest=intent.request_id;currentAmount=amount;
      // Notify the store owner in Telegram; never treat intent creation as payment confirmation.
      void db.functions.invoke('l1017n-topup-notify',{body:{request_id:intent.request_id}})
        .then(({data,error})=>{
          if(error||!data?.ok)console.warn('[wallet/topup] Telegram notification pending; request remains reviewable.');
        }).catch(()=>console.warn('[wallet/topup] Could not notify Telegram.'));
      if(intent.state==='matched'){
        show('ok','وصل إشعار التحويل','وصل إشعار بنفس الرقم والمبلغ. يفحص النظام الطلب تلقائيًا؛ ما تحولش المبلغ مرة ثانية.');
        const current=host();
        const status=el('div','auto-topup-status','⏳ بانتظار تأكيد رصيد المحفظة.');
        status.id='ussdTransferStatus';
        current?.append(status);
        watch(intent.request_id);
        return;
      }
      const area=show('ok','تم تجهيز طلب شحن '+amount+' د.ل',
        'بعد تأكيد التحويل من ليبيانا، يطابق النظام المبلغ والرقم الموثّق بإشعار التحويل. بعض العمليات، خصوصًا المبالغ الكبيرة، تحتاج مراجعة الإدارة قبل إضافة الرصيد.');
      if(!area)return;
      const panel=el('div','auto-topup-transfer');
      panel.append(el('div','','المبلغ: '+amount.toFixed(2)+' د.ل'));
      panel.append(el('strong','ussd-code',codeFor(amount)));
      const dial=el('a','btn btn-primary full-width','📞 فتح الاتصال وتحويل '+amount+' د.ل');
      dial.href='tel:'+codeFor(amount).replace('#','%23');
      dial.setAttribute('aria-label','فتح الهاتف بكود تحويل ليبيانا');
      dial.addEventListener('click',()=>{armDialHandoff(intent.request_id,amount);watch(intent.request_id)});
      panel.append(dial);
      const copy=el('button','btn btn-soft full-width','نسخ كود USSD');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try{
          await navigator.clipboard.writeText(codeFor(amount));
          armDialHandoff(intent.request_id,amount);
          copy.textContent='تم نسخ الكود ✓';
        }
        catch(_){window.prompt('انسخ كود الاتصال إلى تطبيق الهاتف:',codeFor(amount))}
      });
      panel.append(copy);
      const status=el('div','auto-topup-status','⏳ رقم الطلب جاهز. بعد الاتصال، أكد التحويل كما تطلب ليبيانا.');
      status.id='ussdTransferStatus';
      const refresh=el('button','btn btn-soft full-width','تحديث حالة التحويل');
      refresh.type='button';refresh.addEventListener('click',()=>{
        if(dialHandoff){dialHandoff.shown=true;saveDialHandoff();clearDialHandoff();}
        showVerifier(intent.request_id,amount);
      });
      panel.append(status,refresh);
      panel.append(el('p','auto-topup-note','مهم: الاتصال يفتح خدمة تحويل ليبيانا، وتحتاج تأكيد التحويل بنفسك. شحن المحفظة قد يتم آليًا بعد وصول إشعار SMS مطابق من هاتف المتجر. إشعارات SMS ليست تأكيدًا رسميًا من مشغّل الشبكة؛ التحويلات غير المطابقة تحتاج مراجعة.'));
      area.append(panel);
      refreshRequest(intent.request_id);
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
      state.textContent='✓ رقم موثّق';state.className='tp-phone-state is-verified';
    }catch(error){number.textContent='تعذر جلب الرقم';state.textContent='أعد المحاولة';state.className='tp-phone-state is-error'}
  }
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
