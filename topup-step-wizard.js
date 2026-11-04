/* L1017n — dedicated wallet top-up wizard.
   Navigation only on steps 1 and 2. The original, server-verified USSD
   handler continues to own the final step and all payment intent creation. */
(function(){
 'use strict';
 const form=document.getElementById('topupForm');
 const proceed=document.getElementById('topupProceed');
 const amount=document.getElementById('topupAmount');
 const phone=document.getElementById('topupVerifiedNumber');
 const phoneStatus=document.getElementById('topupPhoneState');
 const phonePanel=form?.querySelector('.tp-phone-panel');
 const progress=form?.querySelector('.tp-progress');
 const instructions=document.getElementById('transferInstructions');
 if(!form||!proceed||!amount||!phone||!phonePanel||!progress||!instructions)return;
 if(form.dataset.tpWizardMounted==='1')return;
 form.dataset.tpWizardMounted='1';
 const page=()=>document.getElementById('topupDedicatedPage');
 const statusIsVerified=()=>phoneStatus?.classList.contains('is-verified')&&/^09[24][0-9]{7}$/.test(phone.textContent.trim());
 const isValidAmount=()=>Number.isSafeInteger(Number(amount.value))&&amount.value.trim()!==''&&Number(amount.value)>=1&&Number(amount.value)<=10000;
 const selected=document.createElement('div');
 selected.className='tp-wizard-selected';
 selected.innerHTML='<span>المبلغ الذي اخترته</span><strong id="tpWizardSelectedAmount" dir="ltr">—</strong>';
 progress.insertAdjacentElement('afterend',selected);
 const phoneActions=document.createElement('div');
 phoneActions.className='tp-wizard-phone-actions';
 phoneActions.innerHTML='<button type="button" class="tp-wizard-recheck">تحديث حالة التوثيق</button>'+
  '<button type="button" class="tp-wizard-verify">توثيق رقم الهاتف</button>';
 phonePanel.appendChild(phoneActions);
 const review=document.createElement('section');
 review.className='tp-wizard-review';
 review.setAttribute('aria-labelledby','tpWizardReviewTitle');
 review.innerHTML='<div class="tp-wizard-review-head">'+
  '<span class="tp-wizard-review-icon" aria-hidden="true">✓</span>'+
  '<div><h3 id="tpWizardReviewTitle">مراجعة طلب الشحن</h3>'+
  '<p>راجع المبلغ ورقم ليبيانا قبل تجهيز كود التحويل.</p></div></div>'+
  '<div class="tp-wizard-review-line"><span>طريقة الشحن</span><strong>ليبيانا</strong></div>'+
  '<div class="tp-wizard-review-line"><span>المبلغ</span><strong id="tpWizardReviewAmount" dir="ltr">—</strong></div>'+
  '<div class="tp-wizard-review-line"><span>الرقم الموثّق</span><strong id="tpWizardReviewPhone" dir="ltr">—</strong></div>'+
  '<p class="tp-wizard-safety">تجهيز الطلب لا يخصم الرصيد من الهاتف. بعد ظهور الكود، أنت اللي تختار تنفيذ التحويل، ويُضاف رصيد المحفظة فقط بعد التحقق والموافقة.</p>';
 proceed.insertAdjacentElement('beforebegin',review);
 const alert=document.createElement('p');
 alert.id='tpWizardAlert';alert.className='tp-wizard-alert';alert.setAttribute('role','alert');
 alert.hidden=true;
 proceed.insertAdjacentElement('beforebegin',alert);
 const previous=document.createElement('button');
 previous.type='button';previous.className='tp-wizard-back';previous.textContent='رجوع للخطوة السابقة ←';
 proceed.insertAdjacentElement('beforebegin',previous);
 let stage=1,phoneCheck=null;
 const move=(node)=>{if(node&&page())node.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});};
 const money=()=>isValidAmount()?Number(amount.value).toFixed(2)+' د.ل':'—';
 const warning=message=>{
  alert.textContent=message||'';
  alert.hidden=!message;
 };
 function updateDisplay(){
  selected.querySelector('#tpWizardSelectedAmount').textContent=money();
  review.querySelector('#tpWizardReviewAmount').textContent=money();
  review.querySelector('#tpWizardReviewPhone').textContent=statusIsVerified()?phone.textContent.trim():'غير موثّق';
 }
 function setStage(next,scroll=true){
  stage=next;
  form.dataset.tpWizardStep=String(stage);
  warning('');
  updateDisplay();
  progress.querySelectorAll('[data-tp-step]').forEach(button=>{
   const number=Number(button.dataset.tpStep);
   button.disabled=number>stage;
   button.classList.toggle('tp-wizard-done',number<stage);
   if(number===stage)button.setAttribute('aria-current','step');
   else button.removeAttribute('aria-current');
  });
  const titles={1:'متابعة إلى رقم الهاتف',2:'متابعة إلى المراجعة',3:'تجهيز كود التحويل'};
  proceed.innerHTML=titles[stage]+' <span aria-hidden="true">←</span>';
  proceed.setAttribute('aria-label',titles[stage]);
  if(stage===2){
   const check=window.renderTopupPhoneStatus?.();
   phoneCheck=Promise.resolve(check).catch(()=>{});
  }
  const hero=page()?.querySelector('.tp-clean-copy p');
  if(hero)hero.textContent=stage===1?'الخطوة الأولى: اختار مبلغ الشحن':stage===2?
   'الخطوة الثانية: تأكد من رقم ليبيانا الموثّق':'الخطوة الثالثة: راجع تفاصيل الشحن';
  if(scroll)move(progress);
 }
 function initPage(){
  if(!page())return;
  // Reopening an already prepared transfer should keep its real USSD code.
  const hasTransfer=!!instructions.querySelector('.auto-topup-transfer');
  form.dataset.tpWizardReady=hasTransfer?'true':'false';
  setStage(hasTransfer?3:1,false);
  window.scrollTo({top:0,behavior:'auto'});
 }
 // Capture prevents the original topupProceed handler from creating an intent
 // until BOTH navigation stages were completed intentionally by the customer.
 document.addEventListener('click',async function(event){
  const current=page();
  if(!current||!current.contains(form))return;
  const nav=event.target.closest('[data-tp-step]');
  if(nav&&progress.contains(nav)){
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   const desired=Number(nav.dataset.tpStep);
   if(desired<=stage&&desired>=1&&!instructions.querySelector('.auto-topup-transfer'))setStage(desired);
   return;
  }
  const button=event.target.closest('#topupProceed');
  if(!button||button!==proceed||stage===3)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(stage===1){
   if(!isValidAmount()){
    warning('اختار مبلغًا صحيحًا من 1 إلى 10000 دينار قبل المتابعة.');
    amount.focus({preventScroll:true});move(form.querySelector('.tp-amount-panel'));return;
   }
   setStage(2);return;
  }
  if(stage===2){
   button.disabled=true;
   try{
    if(phoneCheck)await phoneCheck;
    if(!statusIsVerified()&&typeof window.renderTopupPhoneStatus==='function'){
      await window.renderTopupPhoneStatus();
    }
    if(!page()||stage!==2)return;
    if(!statusIsVerified()){
     warning('لازم يكون عندك رقم ليبيانا موثّق. اضغط «توثيق رقم الهاتف» أو حدّث الحالة.');
     return;
    }
    setStage(3);
   }finally{button.disabled=false;}
  }
 },true);
 previous.addEventListener('click',()=>{
  if(stage>1&&!instructions.querySelector('.auto-topup-transfer'))setStage(stage-1);
 });
 phoneActions.querySelector('.tp-wizard-recheck').addEventListener('click',async()=>{
  const button=phoneActions.querySelector('.tp-wizard-recheck');
  button.disabled=true;
  try{await window.renderTopupPhoneStatus?.();if(statusIsVerified())warning('');updateDisplay();}
  finally{button.disabled=false;}
 });
 phoneActions.querySelector('.tp-wizard-verify').addEventListener('click',async()=>{
  page()?.querySelector('.topup-dedicated-back')?.click();
  if(typeof window.switchView==='function')window.switchView('account');
  else document.querySelector('[data-view="account"]')?.click();
  if(typeof window.openPersonalDetails==='function')await window.openPersonalDetails({focusPhone:true});
 });
 // Actual changes to the selected amount invalidate the review.
 amount.addEventListener('input',()=>{updateDisplay();if(stage>1)setStage(1,false)});
 const transferObserver=new MutationObserver(()=>{
  form.dataset.tpWizardReady=instructions.querySelector('.auto-topup-transfer')?'true':'false';
 });
 transferObserver.observe(instructions,{childList:true,subtree:true});
 const pageObserver=new MutationObserver(records=>{
  for(const record of records){
   for(const node of record.addedNodes){
    if(node.nodeType===1&&(node.id==='topupDedicatedPage'||node.querySelector?.('#topupDedicatedPage'))){
     initPage();return;
    }
   }
  }
 });
 pageObserver.observe(document.body,{childList:true});
 if(page())initPage();
 window.L1017nTopupWizard={getStep:()=>stage,reset:()=>setStage(1,false)};
})();
