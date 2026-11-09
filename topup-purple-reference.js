/* L1017N | purple compact top-up form — presentation and native USSD intent only.
   Authorization, SMS receipt validation and balance approval remain server-side. */
(function(){
  'use strict';
  const form=document.getElementById('topupForm');
  const legacyAmount=document.getElementById('topupAmount');
  if(!form||!legacyAmount||form.querySelector('.dt-purple-home'))return;
  const icon={
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
    '<section class="dt-card dt-purple-form" aria-labelledby="dtPurpleTitle">'+
      '<div class="dt-purple-form-top"><span class="dt-purple-form-icon">'+svg('wallet')+'</span><div><h2 id="dtPurpleTitle">بيانات التحويل</h2><p>اكتب بيانات التحويل من ليبيانا إلى المتجر</p></div></div>'+
      '<div class="dt-purple-field"><label for="dtSender"><span class="dt-purple-field-icon">'+svg('user')+'</span><span>الرقم المحوّل منه</span></label><input id="dtSender" inputmode="tel" type="tel" autocomplete="tel" dir="ltr" placeholder="092xxxxxxx" maxlength="16" aria-describedby="dtPhoneStatus"></div>'+
      '<div class="dt-purple-field"><label for="dtReceiver"><span class="dt-purple-field-icon">'+svg('exchange')+'</span><span>الرقم المحوّل إليه</span></label><div class="dt-purple-receiver"><input id="dtReceiver" type="text" dir="ltr" value="—" readonly aria-label="رقم المتجر المحوّل إليه"><button class="dt-copy" type="button" aria-label="نسخ رقم المتجر" title="نسخ الرقم">'+svg('copy')+'</button></div></div>'+
      '<div class="dt-purple-field"><label for="dtAmount"><span class="dt-purple-field-icon">'+svg('coins')+'</span><span>المبلغ المحوّل</span></label><div class="dt-purple-amount"><input id="dtAmount" type="text" inputmode="numeric" autocomplete="off" dir="ltr" placeholder="مثال: 10" maxlength="5" aria-label="قيمة المبلغ بالدينار الليبي"><span>د.ل</span></div></div>'+
      '<p class="dt-purple-message" id="dtPhoneStatus" role="status" aria-live="polite">اضغط «تأكيد الشحن» لفتح اتصال ليبيانا، وبعد التحويل سنتحقق من وصول الرصيد.</p>'+
      '<button class="dt-purple-submit" id="dtConfirm" type="button">'+svg('check')+'<span>تأكيد الشحن</span></button>'+
      '<a class="dt-purple-fallback" id="dtFallback" hidden>فتح الاتصال يدويًا إذا لم يعمل تلقائيًا</a>'+
    '</section>'+
    '<section class="dt-card dt-purple-guide" aria-labelledby="dtPurpleGuideTitle">'+
      '<h3 id="dtPurpleGuideTitle"><span class="dt-purple-guide-icon">⚡</span> طريقة الشحن</h3>'+
      '<div class="dt-purple-steps">'+
        '<div><span class="dt-purple-step-icon">'+svg('user')+'<b>1</b></span><strong>اكتب بياناتك</strong><small>رقمك والمبلغ</small></div>'+
        '<i aria-hidden="true">←</i>'+
        '<div><span class="dt-purple-step-icon">'+svg('exchange')+'<b>2</b></span><strong>أكّد التحويل</strong><small>من هاتف ليبيانا</small></div>'+
        '<i aria-hidden="true">←</i>'+
        '<div><span class="dt-purple-step-icon">'+svg('check')+'<b>3</b></span><strong>تابع التحقق</strong><small>الشحن بعد الاعتماد</small></div>'+
      '</div>'+
    '</section>';
  form.appendChild(panel);
  form.classList.add('dt-enabled');
  for(const child of form.children){
    if(child!==panel){child.hidden=true;child.style.setProperty('display','none','important');}
  }
  const sender=panel.querySelector('#dtSender');
  const receiverInput=panel.querySelector('#dtReceiver');
  const enteredAmount=panel.querySelector('#dtAmount');
  const msg=panel.querySelector('#dtPhoneStatus');
  const confirm=panel.querySelector('#dtConfirm');
  const copy=panel.querySelector('.dt-copy');
  const fallback=panel.querySelector('#dtFallback');
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
  let busy=false,prepared=null;
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
    detail.textContent='نجهّز الاتصال، وبعد تحويل الرصيد سنتابع التحقق تلقائيًا.';
    text.append(title,detail);
    box.replaceChildren(dots,text);
  }
  function hidePreparing(){
    const box=document.getElementById('dtInlineTopupStatus');
    if(box?.dataset.state==='preparing')box.remove();
  }
  const shopNumber=()=>normalize(window.L1017nDirectTransfer?.receiver);
  const senderNumber=()=>{
    const candidate=normalize(sender.value)||normalize(document.getElementById('topupVerifiedNumber')?.textContent);
    const shop=shopNumber();
    return candidate&&(!shop||candidate!==shop)?candidate:'';
  };
  window.L1017nTopupWizard={
    getStep:()=>3,
    getSenderPhone:senderNumber,
    reset:()=>{prepared=null;},
  };
  function resetApprovedPresentation(){
    const done=document.getElementById('dtInlineTopupStatus');
    if(done?.dataset.state==='approved'||done?.dataset.state==='rejected')done.remove();
    if(confirm.disabled){
      confirm.disabled=false;
      const label=confirm.querySelector('span');
      if(label)label.textContent='تأكيد الشحن';
    }
  }
  sender.addEventListener('input',()=>{
    prepared=null;fallback.hidden=true;
    resetApprovedPresentation();
    if(shopNumber()&&normalize(sender.value)===shopNumber())message('هذا رقم المتجر؛ أدخل رقم ليبيانا الذي ستحوّل منه.','error');
    else message('اضغط «تأكيد الشحن» لفتح اتصال ليبيانا، وبعد التحويل سنتحقق من وصول الرصيد.','');
  });
  enteredAmount.addEventListener('input',()=>{
    prepared=null;fallback.hidden=true;
    resetApprovedPresentation();
    message('اضغط «تأكيد الشحن» لفتح اتصال ليبيانا، وبعد التحويل سنتحقق من وصول الرصيد.','');
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
    const number=normalize(document.getElementById('topupVerifiedNumber')?.textContent);
    const shop=normalize(receiver);
    if(number&&number!==shop&&!sender.value)sender.value=number;
    if(shop&&normalize(sender.value)===shop){
      sender.value='';
      message('رقم المتجر للاستقبال فقط. اكتب رقمك الذي ستحوّل منه.','error');
    }
    // An active verification marker belongs to the in-progress USSD request.
    // Do not clear its dial link every time the status DOM updates.
  }
  panel.querySelector('.dt-purple-submit').addEventListener('click',async()=>{
    if(busy)return;
    const transfer=window.L1017nDirectTransfer;
    if(!transfer||!shopNumber()){message('خدمة التحويل لم تجهز بعد. تحقق من الإنترنت وحاول مرة ثانية.','error');return;}
    const from=senderNumber();
    if(!from){message('أدخل رقم ليبيانا صحيحًا يبدأ بـ 092 أو 094، غير رقم المتجر.','error');sender.focus();return;}
    const raw=enteredAmount.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
    const value=Number(raw);
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<1||value>10000){
      message('اكتب مبلغًا صحيحًا من 1 إلى 10000 دينار.','error');enteredAmount.focus();return;
    }
    const key=from+':'+value;
    if(prepared?.key===key&&prepared.link?.isConnected){
      prepared.link.click();
      message('الكود جاهز؛ أكّد التحويل في تطبيق الهاتف، وبعدها تابع التحقق.','success');
      return;
    }
    busy=true;confirm.disabled=true;
    confirm.querySelector('span').textContent='جاري تجهيز الاتصال…';
    fallback.hidden=true;
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
        message(document.getElementById('transferInstructions')?.textContent?.trim()||'تعذر تجهيز التحويل. حاول مرة ثانية.','error');
        return;
      }
      prepared={key,link};
      fallback.href=link.href;fallback.hidden=false;
      fallback.onclick=(e)=>{e.preventDefault();link.click();};
      message('الكود جاهز. أكّد الاتصال من هاتفك لإرسال التحويل؛ الرصيد يُضاف بعد مطابقته.','success');
      link.click();
    }catch(err){
      hidePreparing();
      message('تعذّر تجهيز التحويل. تحقق من الاتصال ثم حاول مرة ثانية.','error');
    }finally{
      busy=false;
      const state=document.getElementById('dtInlineTopupStatus')?.dataset.state;
      if(state==='approved'){
        confirm.disabled=true;
        confirm.querySelector('span').textContent='تم الشحن ✓';
      }else{
        confirm.disabled=false;
        confirm.querySelector('span').textContent=
          state==='pending'||state==='matched'||state==='delayed'
            ?'فتح الاتصال مرة أخرى':'تأكيد الشحن';
      }
    }
  });
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('l1017n-direct-ready',sync);
  sync();
})();