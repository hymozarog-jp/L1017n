/* L1017n: simple carrier top-up journey inspired by familiar Libyan wallet UX.
 * Presentation only. No balance writes, receipt approval, or payment bypass.
 * Native Libyana USSD and Madar server-side submissions remain authoritative. */
(function(){
  'use strict';
  const $=(selector,base=document)=>base.querySelector(selector);
  const money=value=>{
    const n=Number(String(value||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)));
    return Number.isFinite(n)&&n>0?n.toLocaleString('en-US',{maximumFractionDigits:0})+' د.ل':'—';
  };
  function renderWalletIntro(){
    const wallet=$('#walletView'),actions=$('#walletView .wallet-actions');
    if(!wallet||!actions||$('#tlWalletGuide'))return;
    const guide=document.createElement('section');
    guide.id='tlWalletGuide';
    guide.className='tl-wallet-guide';
    guide.dir='rtl';
    guide.innerHTML='<div class="tl-wallet-guide-head"><span class="tl-kicker">شحن المحفظة</span><h3>رصيدك جاهز في 3 خطوات</h3><p>اختار شركة الاتصال، جهّز المبلغ، وبعد التحويل تابع حالة الشحن. لكل شركة محفظتها المستقلة.</p></div>'
      +'<div class="tl-guide-steps" aria-label="خطوات تعبئة المحفظة"><span><b>1</b> اختر المحفظة</span><span><b>2</b> حوّل الرصيد</span><span><b>3</b> انتظر التأكيد</span></div>'
      +'<div class="tl-wallet-choices"><button type="button" data-tl-wallet="libyana"><span class="tl-provider-dot libyana" aria-hidden="true">L</span><span><strong>شحن ليبيانا</strong><small>من رصيد خط ليبيانا</small></span><span aria-hidden="true">‹</span></button><button type="button" data-tl-wallet="madar"><span class="tl-provider-dot madar" aria-hidden="true">M</span><span><strong>شحن المدار</strong><small>من رصيد خط المدار</small></span><span aria-hidden="true">‹</span></button></div>';
    actions.before(guide);
    guide.addEventListener('click',e=>{
      const button=e.target.closest('[data-tl-wallet]');
      if(!button)return;
      if(button.dataset.tlWallet==='madar'){
        if(typeof window.openMadarTopup==='function')void window.openMadarTopup();
        else $('#madarWalletTopup')?.click();
      }else{
        $('#walletActionTopup')?.click();
      }
    });
  }
  function enhanceLibyana(){
    const box=$('#topupForm .dt-purple-form');
    if(!box||$('#tlLibyanaChooser',box))return;
    const header=$('.dt-purple-form-top',box);
    const amount=$('#dtAmount',box),sender=$('#dtSender',box),receiver=$('#dtReceiver',box);
    const amountField=amount?.closest('.dt-purple-field');
    const senderField=$('.dt-sender-field',box);
    const notice=$('#dtPhoneStatus',box);
    if(!header||!amount||!sender||!receiver||!amountField||!senderField||!notice)return;
    header.querySelector('h2').textContent='شحن محفظة ليبيانا';
    header.querySelector('p').textContent='اختر محفظتك، اكتب المبلغ، ثم حوّل من رقمك';
    const chooser=document.createElement('section');
    chooser.id='tlLibyanaChooser';
    chooser.className='tl-topup-chooser';
    chooser.setAttribute('aria-label','اختيار محفظة الشحن');
    chooser.innerHTML='<span class="tl-mini-label"><b>1</b> اختر المحفظة</span><div class="tl-carriers" role="group" aria-label="شركة الاتصال">'
      +'<button type="button" class="is-active" aria-pressed="true" data-tl-pick="libyana"><span class="tl-provider-dot libyana" aria-hidden="true">L</span><strong>ليبيانا</strong><small>المحددة</small></button>'
      +'<button type="button" aria-pressed="false" data-tl-pick="madar"><span class="tl-provider-dot madar" aria-hidden="true">M</span><strong>المدار</strong><small>محفظة مستقلة</small></button></div>';
    header.after(chooser);
    chooser.addEventListener('click',e=>{
      const target=e.target.closest('[data-tl-pick]');
      if(!target)return;
      if(target.dataset.tlPick==='madar'){
        if(typeof window.openMadarTopup==='function')void window.openMadarTopup();
        else $('#madarTopupProvider')?.click();
      }else amount.focus();
    });
    // Put amount before phone, without replacing legacy fields or their listeners.
    senderField.before(amountField);
    const quick=document.createElement('div');
    quick.className='tl-topup-quick';
    quick.innerHTML='<span>مبالغ سريعة</span><div role="group" aria-label="مبالغ شحن ليبيانا">'
      +[5,10,20,30,50,100].map(n=>'<button type="button" data-tl-amount="'+n+'" aria-pressed="false">'+n+' د.ل</button>').join('')
      +'</div>';
    amountField.after(quick);
    const summary=document.createElement('section');
    summary.className='tl-topup-summary';
    summary.setAttribute('aria-label','مراجعة بيانات التحويل');
    summary.innerHTML='<div class="tl-mini-label"><b>3</b> راجع التحويل قبل الاتصال</div><div class="tl-review-grid">'
      +'<div><small>المبلغ</small><strong data-tl-summary="amount">—</strong></div>'
      +'<div><small>من رقمك</small><strong data-tl-summary="sender" dir="ltr">—</strong></div>'
      +'<div><small>إلى رقم المتجر</small><strong data-tl-summary="receiver" dir="ltr">—</strong></div></div>'
      +'<p class="tl-topup-explain">بعد فتح الاتصال، أكّد التحويل من شريحتك. الضغط على زر التحويل وحده لا يخصم منك ولا يضيف رصيدًا للمحفظة.</p>';
    notice.before(summary);
    amountField.insertAdjacentHTML('afterbegin','<span class="tl-mini-label tl-amount-step"><b>2</b> المبلغ المطلوب</span>');
    const refresh=()=>{
      const raw=amount.value.trim();
      const selected=String(sender.value||'').trim();
      $('[data-tl-summary="amount"]',summary).textContent=money(raw);
      $('[data-tl-summary="sender"]',summary).textContent=selected||'اختر رقمك';
      $('[data-tl-summary="receiver"]',summary).textContent=receiver.value||'جاري التحميل';
      quick.querySelectorAll('[data-tl-amount]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tlAmount===raw)));
    };
    quick.addEventListener('click',e=>{
      const button=e.target.closest('[data-tl-amount]');
      if(!button)return;
      amount.value=button.dataset.tlAmount;
      amount.dispatchEvent(new Event('input',{bubbles:true}));
      amount.focus();
    });
    amount.addEventListener('input',refresh);
    sender.addEventListener('change',refresh);
    $('#dtPickSender',box)?.addEventListener('click',()=>setTimeout(refresh,0));
    notice.addEventListener('click',refresh);
    window.addEventListener('l1017n-direct-ready',refresh);
    window.addEventListener('l1017n:account-phones-updated',()=>setTimeout(refresh,200));
    window.addEventListener('focus',refresh);
    new MutationObserver(refresh).observe(sender,{childList:true,subtree:true});
    const submit=$('#dtConfirm',box);
    if(submit){
      const label=$('span',submit);
      if(label)label.textContent='جهّز تحويل ليبيانا';
      submit.addEventListener('click',refresh);
    }
    refresh();
  }
  function enhanceMadar(){
    const dialog=$('#madarTopupDialog');
    const form=$('#madarTransferForm',dialog||document);
    if(!dialog||!form||$('#tlMadarSteps',dialog))return;
    const fields=$('.madar-transfer-fields',form),review=$('.madar-transfer-review',form);
    if(!fields||!review)return;
    const intro=document.createElement('div');
    intro.id='tlMadarSteps';
    intro.className='tl-madar-intro';
    intro.innerHTML='<p class="tl-kicker">شحن المدار الجديد</p><div class="tl-guide-steps" aria-label="مراحل تحويل المدار">'
      +'<span data-tl-madar-step="1"><b>1</b> اختر الرقم والمبلغ</span><span data-tl-madar-step="2"><b>2</b> انسخ الكود وحوّل</span><span data-tl-madar-step="3"><b>3</b> سجّل التحويل</span></div>'
      +'<div class="tl-madar-switch"><button type="button" data-tl-switch="libyana">ليبيانا</button><button type="button" data-tl-switch="madar" aria-current="true">المدار</button></div>';
    form.before(intro);
    intro.querySelector('[data-tl-switch="libyana"]').addEventListener('click',()=>{
      dialog.close();
      const dedicated=$('#topupDedicatedPage');
      if(dedicated&&!dedicated.hidden&&dedicated.getClientRects().length){
        $('#dtAmount')?.focus();
      }else $('#walletActionTopup')?.click();
    });
    const amount=form.elements.amount,sender=form.elements.sender;
    const summary=document.createElement('div');
    summary.className='tl-madar-summary';
    summary.innerHTML='<strong>مراجعة التحويل</strong><div><span>من <b data-tl-madar="sender">—</b></span><span>المبلغ <b data-tl-madar="amount">—</b></span></div>'
      +'<small>لكل محفظة رصيد منفصل. يجب التحويل من رقم المدار المحفوظ في حسابك.</small>';
    const action=$('[data-madar-prepare]',fields);
    action?.before(summary);
    const tip=document.createElement('p');
    tip.className='tl-madar-tip';
    tip.textContent='بعد إتمام التحويل من خط المدار اضغط «تم التحويل» لتسجيل طلبك. الرصيد لا يُعتمد قبل التحقق من وصول التحويل.';
    review.prepend(tip);
    const update=()=>{
      $('[data-tl-madar="sender"]',summary).textContent=sender.value||'اختر رقمك';
      $('[data-tl-madar="amount"]',summary).textContent=money(amount.value);
      const step=review.hidden?'1':'2';
      intro.querySelectorAll('[data-tl-madar-step]').forEach(el=>el.classList.toggle('is-current',el.dataset.tlMadarStep===step));
    };
    amount.addEventListener('input',update);
    sender.addEventListener('change',update);
    dialog.addEventListener('close',update);
    dialog.addEventListener('click',()=>requestAnimationFrame(update));
    new MutationObserver(update).observe(fields,{attributes:true,attributeFilter:['hidden']});
    new MutationObserver(update).observe(review,{attributes:true,attributeFilter:['hidden']});
    update();
  }
  function init(){
    enhanceMadar();
    enhanceLibyana();
    renderWalletIntro();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  // The dedicated top-up page can be attached after the initial document is built.
  let attempts=0;
  const delayed=setInterval(()=>{
    init();
    if(++attempts>=20||($('#tlLibyanaChooser')&&$('#tlWalletGuide')&&$('#tlMadarSteps')))clearInterval(delayed);
  },550);
})();
