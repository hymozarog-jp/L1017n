/* L1017N | purple compact top-up form — presentation and native USSD intent only.
   Authorization, SMS receipt validation and balance approval remain server-side. */
(function(){
  'use strict';
  const form=document.getElementById('topupForm');
  const legacyAmount=document.getElementById('topupAmount');
  if(!form||!legacyAmount||form.querySelector('.dt-purple-home'))return;
  const icon={
    chevron:'<path d="m6 9 6 6 6-6"/>',
    addPhone:'<rect x="4" y="3" width="10" height="18" rx="2"/><path d="M8 17h2m8-8v6m-3-3h6"/>',
    numbers:'<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h1m3 0h4M8 14h1m3 0h4"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    user:'<circle cx="12" cy="7.7" r="3.3"/><path d="M5.3 20v-1.8a6.7 6.7 0 0 1 13.4 0V20"/>',
    exchange:'<path d="M4 7h16m0 0-4-4m4 4-4 4M20 17H4m0 0 4-4m-4 4 4 4"/>',
    coins:'<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m7.7 12 2.7 2.7 5.9-6"/>',
    copy:'<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
    wallet:'<rect x="3" y="6.5" width="18" height="13.5" rx="3"/><path d="M3.8 8a3 3 0 0 1 3-4h11M16 13h3"/>'
  };
  const svg=(name)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon[name]+'</svg>';
  const panel=document.createElement('section');
  panel.className='dt-home dt-purple-home';
  panel.dir='rtl';
  panel.innerHTML=
    '<section class="dt-card dt-topup-methods" aria-labelledby="dtMethodTitle">'+
      '<h2 id="dtMethodTitle">اختار طريقة شحن ليبيانا</h2>'+
      '<div class="dt-topup-method-options">'+
        '<button type="button" data-topup-method="ussd" aria-pressed="false" aria-controls="dtTransferDetails">'+svg('numbers')+'<span><strong>شحن بكود USSD</strong><small>افتح تطبيق الهاتف بكود التحويل جاهز</small></span></button>'+
        '<button type="button" data-topup-method="manual" aria-pressed="false" aria-controls="dtTransferDetails">'+svg('exchange')+'<span><strong>تحويل يدوي</strong><small>حوّل بنفسك إلى رقم المتجر</small></span></button>'+
      '</div></section>'+
    '<div id="dtTransferDetails" hidden>'+
    '<section class="dt-card dt-purple-form" aria-labelledby="dtPurpleTitle">'+
      '<div class="dt-purple-form-top"><span class="dt-purple-form-icon">'+svg('wallet')+'</span><div><h2 id="dtPurpleTitle">بيانات التحويل</h2><p>اختر رقمك وحدّد مبلغ التحويل</p></div></div>'+
      '<div class="dt-purple-field dt-sender-field"><label for="dtPickSender"><span class="dt-purple-field-icon">'+svg('user')+'</span><span>الرقم المحوّل منه</span></label><div class="dt-sender-picker"><select id="dtSender" hidden disabled><option value="">جاري تحميل أرقامك…</option></select><button id="dtPickSender" type="button" aria-haspopup="dialog" aria-describedby="dtSenderCount" disabled><span>جاري تحميل أرقامك…</span>'+svg('chevron')+'</button><button id="dtAddSender" type="button">'+svg('addPhone')+'<span>إضافة رقم</span></button></div><small id="dtSenderCount" class="dt-sender-count" role="status"></small></div>'+
      '<div class="dt-purple-field"><label for="dtReceiver"><span class="dt-purple-field-icon">'+svg('exchange')+'</span><span>الرقم المحوّل إليه</span></label><div class="dt-purple-receiver"><input id="dtReceiver" type="text" dir="ltr" value="—" readonly aria-label="رقم المتجر المحوّل إليه"><button class="dt-copy" type="button" aria-label="نسخ رقم المتجر" title="نسخ الرقم">'+svg('copy')+'</button></div></div>'+
      '<div class="dt-purple-field"><label for="dtAmount"><span class="dt-purple-field-icon">'+svg('coins')+'</span><span>المبلغ المحوّل</span></label><div class="dt-purple-amount"><input id="dtAmount" type="text" inputmode="numeric" autocomplete="off" dir="ltr" placeholder="مثال: 10" maxlength="5" aria-label="قيمة المبلغ بالدينار الليبي"><span>د.ل</span></div></div>'+
      '<p class="dt-purple-message" id="dtPhoneStatus" role="status" aria-live="polite">اختار طريقة شحن ليبيانا أولًا.</p>'+
      '<button class="dt-purple-submit" id="dtConfirm" type="button">'+svg('check')+'<span>متابعة الشحن</span></button>'+
      '<a class="dt-purple-fallback" id="dtFallback" hidden>فتح تطبيق الهاتف</a>'+
      '<p id="dtManualInstructions" class="dt-manual-instructions" hidden>الطلب جاهز. حوّل من الرقم اللي اخترته وبنفس المبلغ، وبعدها تابع الحالة هنا.</p>'+
    '</section>'+
    '<section class="dt-card dt-purple-guide dt-recharge-guide" aria-labelledby="dtPurpleGuideTitle">'+
      '<div class="dt-recharge-head"><span class="dt-recharge-head-icon" aria-hidden="true">'+svg('wallet')+'</span><div><h3 id="dtPurpleGuideTitle">طريقة الشحن</h3><p>اتبع الخطوات بالترتيب لشحن محفظتك بليبيانا</p></div><span class="dt-recharge-count">4 خطوات</span></div>'+
      '<ol class="dt-recharge-timeline">'+
        '<li><span class="dt-recharge-number" aria-hidden="true">1</span><div class="dt-recharge-copy"><strong>اختر رقمك والمبلغ</strong><small>اختر رقمًا من أرقامك المحفوظة وحدّد المبلغ بالدينار.</small></div></li>'+
        '<li><span class="dt-recharge-number" aria-hidden="true">2</span><div class="dt-recharge-copy"><strong>اضغط «التحويل مباشرة»</strong><small>الموقع يجهّز لك تحويل الرصيد إلى رقم المتجر بالمبلغ اللي اخترته.</small></div></li>'+
        '<li><span class="dt-recharge-number" aria-hidden="true">3</span><div class="dt-recharge-copy"><strong>أكمل التحويل من ليبيانا</strong><small>أكّد التحويل من نفس شريحة ليبيانا وبنفس المبلغ.</small></div></li>'+
        '<li><span class="dt-recharge-number" aria-hidden="true">4</span><div class="dt-recharge-copy"><strong>انتظر التحقق التلقائي</strong><small>الموقع يطابق التحويل مع رقمك والمبلغ، ويضيف الرصيد بعد اعتماده فعليًا.</small></div></li>'+
      '</ol>'+
      '<p class="dt-recharge-hint">'+svg('check')+'<span>لو تأخّر التأكيد، ما تعاودش التحويل. تابع حالة الطلب في المحفظة.</span></p>'+
    '</section></div>';
  form.appendChild(panel);
  form.classList.add('dt-enabled');
  for(const child of form.children){
    if(child!==panel){child.hidden=true;child.style.setProperty('display','none','important');}
  }
  const sender=panel.querySelector('#dtSender');
  const pickSender=panel.querySelector('#dtPickSender');
  const picker=document.createElement('dialog');
  picker.className='dt-number-dialog';
  picker.setAttribute('aria-labelledby','dtNumberTitle');
  picker.dir='rtl';
  picker.innerHTML='<h2 id="dtNumberTitle">اختر الرقم المحوّل منه</h2><div class="dt-number-options"></div><div class="dt-number-actions"><button type="button" data-number-close autofocus>'+svg('close')+'<span>إغلاق</span></button><button type="button" data-number-manage>'+svg('numbers')+'<span>إدارة الأرقام</span></button></div>';
  panel.appendChild(picker);
  function refreshSenderButton(){
    const value=sender.selectedOptions[0]?.textContent||'اختر رقم ليبيانا';
    const label=pickSender.firstElementChild;
    if(label.textContent!==value)label.textContent=value;
    pickSender.disabled=sender.disabled||busy;
  }
  pickSender.addEventListener('click',()=>{
    if(picker.open||sender.disabled)return;
    const choices=document.createDocumentFragment();
    for(const option of sender.options){
      if(!option.value||option.disabled)continue;
      const choice=document.createElement('button');
      choice.type='button';choice.dir='ltr';
      const label=document.createElement('span');
      label.textContent=option.textContent;
      choice.appendChild(label);
      const selected=option.value===sender.value;
      if(selected)choice.insertAdjacentHTML('beforeend',svg('check'));
      choice.setAttribute('aria-pressed',String(selected));
      choice.addEventListener('click',()=>{
        if(!Array.from(sender.options).some(current=>!current.disabled&&current.value===option.value)){picker.close();return;}
        if(sender.value!==option.value){
          sender.value=option.value;
          sender.dispatchEvent(new Event('change'));
        }
        picker.close();
      });
      choices.appendChild(choice);
    }
    picker.querySelector('.dt-number-options').replaceChildren(choices);
    picker.showModal();
  });
  picker.querySelector('[data-number-close]').addEventListener('click',()=>picker.close());
  picker.querySelector('[data-number-manage]').addEventListener('click',()=>{
    picker.close();
    panel.querySelector('#dtAddSender').click();
  });
  const receiverInput=panel.querySelector('#dtReceiver');
  const enteredAmount=panel.querySelector('#dtAmount');
  const msg=panel.querySelector('#dtPhoneStatus');
  const confirm=panel.querySelector('#dtConfirm');
  const copy=panel.querySelector('.dt-copy');
  const fallback=panel.querySelector('#dtFallback');
  const transferDetails=panel.querySelector('#dtTransferDetails');
  const manualInstructions=panel.querySelector('#dtManualInstructions');
  const guide=panel.querySelector('.dt-purple-guide');
  const transferTitle=panel.querySelector('#dtPurpleTitle');
  const receiverLabel=panel.querySelector('label[for="dtReceiver"] span:last-child');
  const receiverField=receiverInput.closest('.dt-purple-field');
  const senderField=pickSender.closest('.dt-purple-field');
  const methodButtons=Array.from(panel.querySelectorAll('[data-topup-method]'));
  const normalize=(v)=>{
    let d=String(v||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))
      .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/\D/g,'');
    if(d.startsWith('218'))d=d.slice(3);
    if(/^9[24]\d{7}$/.test(d))d='0'+d;
    return /^09[24]\d{7}$/.test(d)?d:'';
  };
  const message=(text,kind)=>{
    if(msg.textContent!==text)msg.textContent=text;
    if(msg.dataset.kind!==(kind||''))msg.dataset.kind=kind||'';
  };
  let busy=false,prepared=null,method=null;
  const isManual=()=>method==='manual';
  const actionLabel=()=>isManual()?'تسجيل طلب التحويل':'التحويل مباشرة';
  const helperText=()=>isManual()
    ?'جهّز الطلب أولًا، وبعدها حوّل من نفس الرقم وبنفس المبلغ إلى رقم المتجر.'
    :'افتح كود USSD من تطبيق الهاتف، وبعد التحويل سنتحقق من وصول الرصيد.';
  function refreshMethodActions(){
    const ready=Boolean(prepared?.link?.isConnected);
    fallback.hidden=isManual()||!ready;
    manualInstructions.hidden=!isManual()||!ready;
    copy.disabled=busy||(isManual()&&!ready);
  }
  methodButtons.forEach(button=>button.addEventListener('click',()=>{
    if(busy)return;
    method=button.dataset.topupMethod;
    methodButtons.forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
    const manual=isManual();
    transferDetails.hidden=false;
    guide.hidden=manual;
    transferTitle.textContent=manual?'بيانات التحويل اليدوي':'بيانات التحويل';
    receiverLabel.textContent=manual?'رقم المتجر':'الرقم المحوّل إليه';
    const firstField=manual?receiverField:senderField;
    const secondField=manual?senderField:receiverField;
    if(firstField.nextElementSibling!==secondField){
      firstField.parentElement.insertBefore(firstField,secondField);
    }
    refreshMethodActions();
    if(!confirm.disabled)confirm.querySelector('span').textContent=actionLabel();
    if(!prepared&&!document.getElementById('dtInlineTopupStatus'))message(helperText(),'');
  }));
  // Preparing a new USSD intent is not a rejection. Keep a visible loading
  // indicator until the backend either provides the dial link or reports an error.
  function showPreparing(){
    let box=document.getElementById('dtInlineTopupStatus');
    if(!box){
      box=document.createElement('div');
      box.className='dt-inline-credit';
      box.id='dtInlineTopupStatus';
      box.setAttribute('role','status');
      box.setAttribute('aria-live','polite');
      msg.insertAdjacentElement('afterend',box);
    }
    box.hidden=false;
    box.dataset.state='preparing';
    const dots=document.createElement('span');
    dots.className='dt-inline-credit-symbol dt-wait-dots';
    dots.setAttribute('aria-hidden','true');
    for(let i=0;i<3;i++){
      const dot=document.createElement('i');
      dot.className='dt-wait-dot';
      dots.appendChild(dot);
    }
    const text=document.createElement('span');
    text.className='dt-inline-credit-copy';
    const title=document.createElement('strong');
    title.textContent='جاري تجهيز طلب التحويل';
    const detail=document.createElement('small');
    detail.textContent='بعد تحويل الرصيد سنتابع التحقق تلقائيًا.';
    text.append(title,detail);
    box.replaceChildren(dots,text);
  }
  function hidePreparing(){
    const box=document.getElementById('dtInlineTopupStatus');
    if(box?.dataset.state==='preparing')box.remove();
  }
  const shopNumber=()=>normalize(window.L1017nDirectTransfer?.receiver);
  const senderNumber=()=>{
    const candidate=normalize(sender.value);
    const shop=shopNumber();
    return candidate&&(!shop||candidate!==shop)?candidate:'';
  };
  window.L1017nTopupWizard={
    getStep:()=>3,
    getSenderPhone:senderNumber,
    reset:()=>{prepared=null;refreshMethodActions();},
  };
  function resetApprovedPresentation(){
    const done=document.getElementById('dtInlineTopupStatus');
    if(done?.dataset.state==='approved'||done?.dataset.state==='rejected')done.remove();
    if(confirm.disabled){
      confirm.disabled=false;
      const label=confirm.querySelector('span');
      if(label)label.textContent=actionLabel();
    }
  }
  sender.addEventListener('change',()=>{
    refreshSenderButton();
    prepared=null;refreshMethodActions();
    resetApprovedPresentation();
    if(shopNumber()&&normalize(sender.value)===shopNumber())message('هذا رقم المتجر؛ أدخل رقم ليبيانا الذي ستحوّل منه.','error');
    else message(helperText(),'');
  });
  enteredAmount.addEventListener('input',()=>{
    prepared=null;refreshMethodActions();
    resetApprovedPresentation();
    message(helperText(),'');
  });
  copy.addEventListener('click',async()=>{
    const receiver=window.L1017nDirectTransfer?.receiver;
    if(!receiver)return;
    try{await navigator.clipboard.writeText(receiver);message('تم نسخ رقم المتجر.','success');}
    catch(_){receiverInput.focus();receiverInput.select();message('حدّد الرقم وانسخه من هاتفك.','');}
  });
  function sync(){
    const receiver=window.L1017nDirectTransfer?.receiver;
    if(receiver&&receiverInput.value!==receiver)receiverInput.value=receiver;
    const shop=normalize(receiver);
    if(shop&&normalize(sender.value)===shop){
      sender.value='';
      refreshSenderButton();
      message('رقم المتجر للاستقبال فقط. اكتب رقمك الذي ستحوّل منه.','error');
    }
    // An active verification marker belongs to the in-progress USSD request.
    // Do not clear its dial link every time the status DOM updates.
  }
  panel.querySelector('.dt-purple-submit').addEventListener('click',async()=>{
    if(busy||!method)return;
    const transfer=window.L1017nDirectTransfer;
    if(!transfer||!shopNumber()){message('خدمة التحويل لم تجهز بعد. تحقق من الإنترنت وحاول مرة ثانية.','error');return;}
    const from=senderNumber();
    if(!from){message('اختر رقم ليبيانا محفوظًا أو أضف رقمك أولًا.','error');(pickSender.disabled?addSender:pickSender).focus();return;}
    const raw=enteredAmount.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
    const value=Number(raw);
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<1||value>10000){
      message('اكتب مبلغًا صحيحًا من 1 إلى 10000 دينار.','error');enteredAmount.focus();return;
    }
    const key=from+':'+value;
    if(prepared?.key===key&&prepared.link?.isConnected){
      if(!isManual())prepared.link.click();
      else refreshMethodActions();
      return;
    }
    busy=true;confirm.disabled=true;
    methodButtons.forEach(button=>{button.disabled=true});
    enteredAmount.disabled=true;addSender.disabled=true;refreshSenderButton();
    confirm.querySelector('span').textContent='جاري تجهيز التحويل…';
    refreshMethodActions();
    try{
      legacyAmount.value=String(value);
      // This input event intentionally invalidates any prior request. Put the
      // loading card AFTER it so resetSelection cannot erase the spinner.
      legacyAmount.dispatchEvent(new Event('input',{bubbles:true}));
      showPreparing();
      message('جاري تجهيز طلب التحويل والتحقق من بياناته…','');
      const link=await transfer.prepare();
      // auto-topup now starts watching the request BEFORE returning the link.
      // The presence of tpReturnVerify therefore indicates progress, NOT
      // an error and NOT a reason to skip opening the native Phone app.
      if(!link||!link.href){
        const state=document.getElementById('tpReturnVerify')?.dataset.state;
        if(state==='pending'||state==='delayed'){
          message('طلبك قيد التحقق. لا تكرر التحويل إذا سبق أن حوّلت الرصيد.','');
          return;
        }
        hidePreparing();
        message(document.querySelector('#transferInstructions .auto-topup-status-detail')?.textContent?.trim()||'تعذر تجهيز التحويل. حاول مرة ثانية.','error');
        return;
      }
      if(senderNumber()!==from||!link.isConnected)return;
      prepared={key,link};
      fallback.href=link.href;
      refreshMethodActions();
      fallback.onclick=(e)=>{e.preventDefault();link.click();};
      if(!isManual())link.click();
    }catch(err){
      hidePreparing();
      message('تعذّر تجهيز التحويل. تحقق من الاتصال ثم حاول مرة ثانية.','error');
    }finally{
      busy=false;
      methodButtons.forEach(button=>{button.disabled=false});
      enteredAmount.disabled=false;addSender.disabled=false;refreshSenderButton();
      refreshMethodActions();
      const state=document.getElementById('dtInlineTopupStatus')?.dataset.state;
      if(state==='approved'){
        confirm.disabled=true;
        confirm.querySelector('span').textContent='تم الشحن';
      }else{
        confirm.disabled=false;
        confirm.querySelector('span').textContent=actionLabel();
      }
    }
  });
  const addSender=panel.querySelector('#dtAddSender');
  const senderCount=panel.querySelector('#dtSenderCount');
  let phoneGeneration=0,phonesLoading=false,phonesLoaded=false,authWatching=false;
  function resetSenderOptions(label){
    const option=document.createElement('option');option.value='';option.textContent=label;
    sender.replaceChildren(option);sender.disabled=true;
    if(picker.open)picker.close();
    refreshSenderButton();
  }
  async function loadSenderPhones(){
    const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!db)return;
    if(!authWatching){
      authWatching=true;
      db.auth.onAuthStateChange((event)=>{
        if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='USER_UPDATED'){
          phoneGeneration++;phonesLoaded=false;phonesLoading=false;prepared=null;refreshMethodActions();
          resetSenderOptions('جاري تحميل أرقامك…');senderCount.textContent='';
          setTimeout(()=>{void loadSenderPhones()},0);
        }
      });
    }
    const generation=++phoneGeneration,previous=sender.value;
    phonesLoading=true;if(!previous)resetSenderOptions('جاري تحميل أرقامك…');
    try{
      const auth=await db.auth.getUser();
      if(generation!==phoneGeneration)return;
      if(auth.error||!auth.data?.user){
        resetSenderOptions('سجّل الدخول لاختيار رقمك');addSender.hidden=true;senderCount.textContent='';return;
      }
      const {data,error}=await db.rpc('get_my_saved_sender_phones');
      if(generation!==phoneGeneration)return;
      if(error)throw error;
      const phones=Array.isArray(data)?data.slice(0,3):[];
      sender.replaceChildren();
      let available=0;
      phones.forEach(item=>{
        // Almadar can be verified for the account, but this form transfers Libyana credit.
        const phone=normalize(item.phone);
        const option=document.createElement('option');option.value=phone;
        option.textContent=String(item.phone||'')+(item.primary?' · الأساسي':'')+(phone?'':' · المدار');
        option.disabled=!phone||phone===shopNumber();
        if(!option.disabled)available++;
        sender.appendChild(option);
      });
      if(!available)resetSenderOptions('لا يوجد رقم ليبيانا محفوظ');
      else{
        sender.disabled=false;
        const keep=Array.from(sender.options).find(o=>o.value===previous&&!o.disabled);
        const first=keep||Array.from(sender.options).find(o=>!o.disabled);
        sender.value=first.value;
      }
      addSender.hidden=false;
      const full=phones.length>=3;
      const label=addSender.querySelector('span');
      const action=full?'إدارة الأرقام':'إضافة رقم';
      if(label.textContent!==action){
        label.textContent=action;
        addSender.querySelector('svg').outerHTML=svg(full?'numbers':'addPhone');
      }
      refreshSenderButton();
      senderCount.textContent='الأرقام المحفوظة: '+phones.length+' من 3'+(!available?' · أضف رقم ليبيانا للشحن':'');
      if(previous!==sender.value){prepared=null;refreshMethodActions();resetApprovedPresentation()}
    }catch(_){
      if(generation===phoneGeneration){resetSenderOptions('تعذر تحميل الأرقام');senderCount.textContent='أعد فتح المحفظة أو حدّث الصفحة.';addSender.hidden=false}
    }finally{if(generation===phoneGeneration){phonesLoading=false;phonesLoaded=true}}
  }
  addSender.addEventListener('click',()=>{
    prepared=null;refreshMethodActions();
    if(typeof window.openPhoneRegistrationPage==='function')window.openPhoneRegistrationPage();
    else message('حدّث الصفحة لفتح إدارة أرقامك.','error');
  });
  window.addEventListener('l1017n:account-phones-updated',()=>{void loadSenderPhones()});
  window.addEventListener('focus',()=>{if(!phonesLoading)void loadSenderPhones()});
  const ensurePhones=()=>{if(!phonesLoaded&&!phonesLoading)void loadSenderPhones()};
  new MutationObserver(()=>{sync();ensurePhones()}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('l1017n-direct-ready',ensurePhones);
  ensurePhones();
  window.addEventListener('l1017n-direct-ready',sync);
  sync();
})();
