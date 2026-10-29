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
  function resetSelection(){chosen=false;currentRequest=null;currentAmount=null;stopWatcher();}
  function errorText(error){
    const t=String(error?.message||'');
    if(/verified_libyana_phone_required/.test(t))return 'الشحن عبر هذا الكود يتطلب رقم ليبيانا 092 أو 094 موثّق برسالة SMS من حسابي.';
    if(/ussd_daily_limit/.test(t))return 'طلبات كثيرة في وقت قصير؛ جرّب بعد شوية أو تواصل مع الإدارة.';
    if(/invalid_ussd_amount/.test(t))return 'اكتب مبلغًا صحيحًا بالدينار الليبي، ويجب أن يكون عددًا صحيحًا موجبًا.';
    return 'تعذر تجهيز طلب التحويل. لا تحوّل رصيدًا قبل ظهور رقم الطلب وكود الاتصال.';
  }
  async function refreshRequest(id){
    if(!id||!host())return;
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db)return;
    try{
      const {data,error}=await db.rpc('get_my_ussd_topup_status',{p_request_id:id});
      if(error)throw error;
      const status=document.getElementById('ussdTransferStatus');
      if(!status||currentRequest!==id)return;
      if(data?.status==='approved'){
        status.textContent='✅ تم اعتماد التحويل وإضافة الرصيد لمحفظتك.';
        stopWatcher();chosen=false;
        if(typeof renderWallet==='function')Promise.resolve(renderWallet()).catch(()=>{});
        return;
      }
      if(data?.status==='rejected'){
        status.textContent='⛔ لم يُعتمد التحويل. تواصل مع إدارة المتجر مع رقم الطلب.';
        stopWatcher();return;
      }
      if(data?.sms_status==='matched'){
        status.textContent='📩 البوت طابق إشعار التحويل. جاري انتظار نتيجة الفحص الآلي؛ ما تكررّش التحويل. إذا احتاجت العملية مراجعة، تظهر حالتها هنا.';
      }else{
        status.textContent='⏳ ننتظر إشعار التحويل من ليبيانا. فتح الاتصال لا يعني نجاح التحويل؛ أكّد العملية داخل قائمة USSD. لا تكرر التحويل.';
      }
    }catch(e){console.warn('USSD status could not be refreshed',e)}
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
      dial.addEventListener('click',()=>{watch(intent.request_id)});
      panel.append(dial);
      const copy=el('button','btn btn-soft full-width','نسخ كود USSD');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(codeFor(amount));copy.textContent='تم نسخ الكود ✓'}
        catch(_){window.prompt('انسخ كود الاتصال إلى تطبيق الهاتف:',codeFor(amount))}
      });
      panel.append(copy);
      const status=el('div','auto-topup-status','⏳ رقم الطلب جاهز. بعد الاتصال، أكد التحويل كما تطلب ليبيانا.');
      status.id='ussdTransferStatus';
      const refresh=el('button','btn btn-soft full-width','تحديث حالة التحويل');
      refresh.type='button';refresh.addEventListener('click',()=>refreshRequest(intent.request_id));
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
  amountInput()?.addEventListener('input',()=>{
    clearTimeout(inputDebounce);
    inputDebounce=setTimeout(clearIntent,100);
  });
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
