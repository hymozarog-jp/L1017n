/* Direct-transfer presentation. Existing backend intent and receipt checks own payment. */
(function(){
 'use strict';
 const form=document.getElementById('topupForm'),amount=document.getElementById('topupAmount');
 if(!form||!amount)return;
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2c0 9 7 16 16 16a2 2 0 0 0 2-2v-3l-5-2-2 3a14 14 0 0 1-7-7l3-2z"/><path d="M16 3h5v5m0-5-6 6"/></svg>';
 const panel=document.createElement('section');panel.className='dt-home';
 panel.innerHTML='<article class="dt-card"><div class="dt-heading"><span class="dt-icon">'+icon+'</span><div><h2>حوّل إلى رقم المتجر</h2><p>اشحن محفظتك بتحويل رصيد ليبيانا</p></div></div><div class="dt-number"><b dir="ltr" class="dt-receiver">—</b><button type="button" class="dt-copy" aria-label="نسخ رقم المتجر">⧉</button></div><button type="button" class="dt-primary dt-open">'+icon+' تحويل الآن</button></article><article class="dt-card"><h3>رقم المحوّل</h3><p>استخدم رقم ليبيانا الذي ستُجري منه التحويل.</p><label for="dtSender">رقم الهاتف</label><input id="dtSender" inputmode="tel" type="tel" autocomplete="tel" dir="ltr" placeholder="092xxxxxxx" maxlength="16"><small class="dt-phone-status" role="status"></small></article><article class="dt-card"><h3>طريقة شحن المحفظة</h3><ol><li>أدخل رقم ليبيانا الذي سيحوّل الرصيد.</li><li>اضغط «تحويل الآن» واكتب المبلغ.</li><li>اضغط «اتصال» وأكّد التحويل من هاتفك.</li><li>تابع التحقق؛ يُضاف الرصيد بعد اعتماد التحويل.</li></ol></article>';
 form.append(panel);form.classList.add('dt-enabled');
 // Keep legacy controls available to payment code, but out of the visible UI.
 for(const child of form.children){if(child!==panel){child.hidden=true;child.style.setProperty('display','none','important');}}
 const sender=panel.querySelector('#dtSender');
 function normalize(value){let d=String(value||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\D/g,'');if(d.startsWith('218'))d=d.slice(3);if(/^9[24]\d{7}$/.test(d))d='0'+d;return /^09[24]\d{7}$/.test(d)?d:''}
 window.L1017nTopupWizard={getStep:()=>3,getSenderPhone:()=>normalize(sender.value)||normalize(document.getElementById('topupVerifiedNumber')?.textContent),reset:()=>{}};
 const modal=document.createElement('dialog');modal.id='dtDialog';modal.dir='rtl';
 modal.setAttribute('aria-labelledby','dtTitle');
 modal.innerHTML='<div class="dt-heading"><span class="dt-icon">'+icon+'</span><h2 id="dtTitle">تحويل الآن</h2></div><form method="dialog" id="dtTransferForm"><label class="dt-sr" for="dtAmount">قيمة التحويل بالدينار</label><input id="dtAmount" inputmode="numeric" type="text" placeholder="قيمة التحويل" autocomplete="off" maxlength="5"><p class="dt-error" role="status" aria-live="polite"></p><div class="dt-actions"><button type="button" class="dt-cancel">إلغاء</button><button type="submit" class="dt-primary dt-call">'+icon+'<span>اتصال</span></button></div><a class="dt-fallback" hidden>اضغط هنا إذا لم يفتح تطبيق الهاتف</a></form>';
 document.body.append(modal);
 const input=modal.querySelector('#dtAmount'),error=modal.querySelector('.dt-error'),call=modal.querySelector('.dt-call'),fallback=modal.querySelector('.dt-fallback');
 let busy=false,prepared=null,lastFocus=null;
 function close(){if(busy)return;modal.close();lastFocus?.focus()}
 modal.querySelector('.dt-cancel').onclick=close;
 modal.addEventListener('cancel',event=>{if(busy)event.preventDefault()});
 modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close()}});
 panel.querySelector('.dt-open').onclick=()=>{
   if(!window.L1017nDirectTransfer){panel.querySelector('.dt-phone-status').textContent='جاري تحميل خدمة التحويل، حاول بعد لحظة.';return}
   if(!window.L1017nTopupWizard.getSenderPhone()){panel.querySelector('.dt-phone-status').textContent='اكتب رقم ليبيانا الصحيح أولًا.';sender.focus();return}
   lastFocus=document.activeElement;error.textContent='';fallback.hidden=true;modal.showModal();
   setTimeout(()=>{if(modal.open)input.focus({preventScroll:true})},240);
 };
 input.addEventListener('input',()=>{prepared=null;fallback.hidden=true;error.textContent=''});
 sender.addEventListener('input',()=>{prepared=null;panel.querySelector('.dt-phone-status').textContent=''});
 modal.querySelector('form').addEventListener('submit',async event=>{
   event.preventDefault();if(busy)return;
   const raw=input.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
   const value=Number(raw);
   if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<1||value>10000){error.textContent='أدخل مبلغًا صحيحًا من 1 إلى 10000 دينار.';input.focus();return}
   const key=value+':'+window.L1017nTopupWizard.getSenderPhone();
   if(prepared?.key===key&&prepared.link.isConnected){prepared.link.click();return}
   busy=true;call.disabled=true;input.disabled=true;modal.querySelector('.dt-cancel').disabled=true;call.querySelector('span').textContent='جاري التجهيز…';error.textContent='';
   try{
     amount.value=String(value);amount.dispatchEvent(new Event('input',{bubbles:true}));
     const link=await window.L1017nDirectTransfer.prepare();
     if(document.getElementById('tpReturnVerify')){modal.close();return}
     if(!link){error.textContent=document.getElementById('transferInstructions')?.textContent||'تعذر تجهيز التحويل. حاول مرة أخرى.';return}
     prepared={key,link};fallback.href=link.href;fallback.hidden=false;
     fallback.onclick=event=>{event.preventDefault();link.click()};
     error.textContent='الكود جاهز. أكّد الاتصال من هاتفك لإتمام التحويل.';
     link.click();
   }catch(_){error.textContent='تعذر تجهيز التحويل. تحقق من اتصالك وحاول مجددًا.'}
   finally{busy=false;call.disabled=false;input.disabled=false;modal.querySelector('.dt-cancel').disabled=false;call.querySelector('span').textContent='اتصال'}
 });
 panel.querySelector('.dt-copy').onclick=async()=>{const receiver=window.L1017nDirectTransfer?.receiver;if(!receiver)return;try{await navigator.clipboard.writeText(receiver);panel.querySelector('.dt-phone-status').textContent='تم نسخ رقم المتجر'}catch(_){panel.querySelector('.dt-phone-status').textContent='اضغط مطولًا على الرقم لنسخه'}};
 function sync(){
   const receiver=window.L1017nDirectTransfer?.receiver;if(receiver&&panel.querySelector('.dt-receiver').textContent!==receiver)panel.querySelector('.dt-receiver').textContent=receiver;
   const phone=normalize(document.getElementById('topupVerifiedNumber')?.textContent);if(phone&&!sender.value)sender.value=phone;
   if(document.getElementById('tpReturnVerify')){prepared=null;if(modal.open)modal.close();}
 }
 new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
 window.addEventListener('l1017n-direct-ready',sync);sync();
})();
