/* L1017n — customer FAQ. Information only: no wallet, checkout or order writes. */
(function(){
 'use strict';
 const questions=[
  {category:'orders',q:'كيف أطلب روبوكس أو سلاح MM2؟',
   a:'سجّل دخولك، وثّق رقم هاتفك إذا طُلب منك، ثم افتح قسم المنتج واختر الباقة. تأكد من اسم حساب Roblox أو معرف اللاعب وأكّد الشراء من المحفظة. بعد نجاح الطلب تقدر تتابعه من «طلباتي».'},
  {category:'wallet',q:'كيف أشحن محفظتي في المتجر؟',
   a:'افتح «المحفظة»، اختر طريقة الشحن المتاحة والمبلغ، ثم اتبع تعليمات التحويل التي تظهر لك. لا يُضاف الرصيد إلا بعد التحقق من التحويل واعتماده في النظام.'},
  {category:'wallet',q:'هل اختيار الباقة يخصم الرصيد فورًا؟',
   a:'لا. اختيار الباقة وحده لا يخصم شيئًا؛ الخصم يتم عند تأكيد الشراء ونجاح إنشاء الطلب، ويظهر المبلغ من محفظتك.'},
  {category:'orders',q:'كيف أتابع حالة طلبي؟',
   a:'افتح قسم «طلباتي»، واضغط على بطاقة الطلب. تظهر التفاصيل فورًا في نافذة فيها الحالة ومراحل التقدم والمبلغ ورقم الطلب. تقدر تضغط «تحديث الحالة» للحصول على آخر تحديث.'},
  {category:'orders',q:'ما معنى حالات الطلب المختلفة؟',
   a:'«قيد الانتظار» يعني أن الطلب مسجّل. «تم القبول» يعني أن الإدارة وافقت عليه، وليس أنه وصل. «قيد المعالجة» تعني تجهيز الطلب، و«قيد التنفيذ» تعني بدء التسليم. «تم التنفيذ» يعني أن الإدارة أكدت اكتماله.'},
  {category:'orders',q:'كم يستغرق تسليم الروبوكس أو أغراض الألعاب؟',
   a:'ما فيش مدة ثابتة مضمونة حاليًا للطلبات اليدوية. يتم التنفيذ بعد مراجعة الطلب، وتظهر تحديثاته في «طلباتي». الأكواد الرقمية الموصوفة بأنها فورية تُسلَّم حسب توفرها ونجاح الشراء.'},
  {category:'wallet',q:'شن يصير لو رُفض طلب الشراء؟',
   a:'عند رفض طلب شراء لم يُنفَّذ، يُرجع النظام قيمة الطلب إلى محفظة الزبون داخل المتجر. ما يعنيش هذا تحويل المبلغ إلى رصيد الهاتف أو إلى حساب بنكي. إذا فيه مشكلة، تواصل مع الدعم واذكر رقم الطلب.'},
  {category:'wallet',q:'ولو رُفض طلب شحن المحفظة؟',
   a:'إذا رُفض طلب الشحن، لا يُضاف المبلغ إلى محفظة المتجر. الرفض لا يلغي أي تحويل فعلي أجريته من شركة الاتصالات؛ إذا تم خصم رصيد الهاتف بالفعل، تواصل مع الدعم لتتم مراجعة التحويل.'},
  {category:'wallet',q:'حولت رصيد، لكن ما ظهر في المحفظة، شنسوي؟',
   a:'افتح «طلباتي» أولًا وافحص حالة الشحن. لا تكرر التحويل بنفسك لحل المشكلة. إذا المبلغ خُصم وما ظهر، راسل الدعم وأرسل رقم الطلب ووقت التحويل وإثباته المتاح، بدون مشاركة رمز تحقق أو كلمة مرور.'},
  {category:'account',q:'هل لازم أوثّق رقم هاتفي قبل الشراء؟',
   a:'نعم، بعض عمليات الشراء والشحن تشترط ربط رقم هاتف موثّق بحسابك. افتح «حسابي» ثم «توثيق رقم الهاتف»، واتبع خطوات رمز SMS. لا تعطِ رمز التحقق لأي شخص.'},
  {category:'account',q:'هل يمكنني تسجيل الدخول بحساب Google؟',
   a:'نعم. تقدر تسجّل الدخول باستخدام Google أو البريد الإلكتروني من صفحة الحساب. احرص على استخدام حسابك أنت وعدم مشاركة كلمة المرور.'},
  {category:'orders',q:'هل أقدر أغيّر اسم اللاعب بعد إنشاء الطلب؟',
   a:'إذا أدخلت اسمًا غير صحيح، تواصل مع الدعم بأسرع وقت واذكر رقم الطلب واسم اللاعب الصحيح. لا يمكن ضمان التعديل بعد بدء المعالجة أو التسليم.'},
  {category:'orders',q:'كيف أتواصل لو عندي مشكلة في طلبي؟',
   a:'افتح الطلب من «طلباتي» واضغط «تقديم شكوى عبر واتساب»، أو استخدم زر «التواصل مع الدعم» هنا. إرسال رقم الطلب ووصف المشكلة يساعد في مراجعتها، ولا تشارك كلمة المرور أو رمز SMS.'},
  {category:'account',q:'هل أسعار المتجر بالدينار الليبي؟',
   a:'نعم، الأسعار الظاهرة في المتجر بعملة الدينار الليبي (د.ل). تأكد من السعر النهائي الظاهر قبل تأكيد أي عملية شراء.'}
 ];
 const categories=[
   {key:'all',label:'الكل'},
   {key:'orders',label:'الشراء والطلبات'},
   {key:'wallet',label:'الرصيد والشحن'},
   {key:'account',label:'الحساب'}
 ];
 let page=null,opener=null,previousOverflow='',closing=false,filter='all';
 function escapeHtml(s){
   return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 }
 function normalize(s){
   return String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'')
     .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim();
 }
 function render(){
   const list=page?.querySelector('#faqList'),count=page?.querySelector('#faqResultCount');
   if(!list)return;
   const query=normalize(page.querySelector('#faqSearch')?.value);
   let visible=0;
   list.querySelectorAll('.faq-card').forEach(card=>{
     const matchesCategory=filter==='all'||card.dataset.faqCategory===filter;
     const matchesText=!query||normalize(card.dataset.faqSearch).includes(query);
     const show=matchesCategory&&matchesText;
     card.hidden=!show;
     if(!show)card.open=false;
     if(show)visible++;
   });
   if(count)count.textContent=visible+' سؤال';
   const empty=page.querySelector('#faqEmpty');
   if(empty)empty.hidden=visible!==0;
 }
 function dismiss(){
   if(!page)return;
   const old=page;page=null;
   try{if(old.open)old.close()}catch(_){}
   old.remove();
   document.body.style.overflow=previousOverflow;
   closing=false;filter='all';
   if(opener?.isConnected)opener.focus({preventScroll:true});
   opener=null;
 }
 function close(){
   if(!page||closing)return;
   closing=true;
   if(history.state?.l1017nFaqPage)history.back();
   else dismiss();
 }
 function open(trigger){
   if(page){page.querySelector('#faqSearch')?.focus();return}
   opener=trigger||document.activeElement;
   previousOverflow=document.body.style.overflow;
   page=document.createElement('dialog');
   page.id='l1017nFaqPage';
   page.dir='rtl';
   page.setAttribute('aria-labelledby','faqTitle');
   const categoryArt={
     orders:'<path d="m12 2 8 4v12l-8 4-8-4V6l8-4Z"/><path d="m4 6 8 5 8-5M12 11v11"/><path d="m9 5 7 4"/>',
     wallet:'<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 10h18M14 13h8v5h-8a2.5 2.5 0 0 1 0-5Z"/>',
     account:'<path d="m12 2 8 4v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/>'
   };
   const artIcon=category=>'<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+categoryArt[category]+'</svg>';
   const cards=questions.map((item,i)=>
     '<details class="faq-card" data-faq-category="'+item.category+'" data-faq-search="'+escapeHtml(item.q+' '+item.a)+'">'
      +'<summary><span class="faq-number" data-category="'+item.category+'">'+artIcon(item.category)+'</span>'
      +'<span class="faq-question">'+escapeHtml(item.q)+'</span>'
      +'<span class="faq-chevron" aria-hidden="true"></span></summary>'
      +'<div class="faq-answer"><p>'+escapeHtml(item.a)+'</p></div></details>').join('');
   page.innerHTML=
     '<div class="faq-shell">'
       +'<header class="faq-topbar"><button class="faq-back" type="button" aria-label="العودة إلى المتجر">'
       +'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg> رجوع</button>'
       +'<span class="faq-brand">L1017n <span aria-hidden="true">/</span> HELP CENTER</span></header>'
       +'<section class="faq-hero">'
         +'<span class="faq-hero-kicker">مركز المساعدة</span>'
         +'<span class="faq-hero-art" aria-hidden="true">'
  +'<svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" fill="none">'
  +'<defs><linearGradient id="faqphoneGrad" x1="71" y1="0" x2="152" y2="153"><stop stop-color="#6554AC"/><stop offset="1" stop-color="#292E55"/></linearGradient><linearGradient id="faqchatGrad" x1="22" y1="20" x2="115" y2="87"><stop stop-color="#A084EA"/><stop offset="1" stop-color="#654BA9"/></linearGradient><linearGradient id="faqwalletGrad" x1="135" y1="90" x2="200" y2="126"><stop stop-color="#5AE0B5"/><stop offset="1" stop-color="#24798F"/></linearGradient></defs>'
  +'<circle cx="111" cy="82" r="74" stroke="#9075D5" stroke-opacity=".4" stroke-dasharray="3 8"/><circle cx="109" cy="83" r="67" fill="#64479B" opacity=".21"/>'
  +'<g transform="rotate(8 119 80)"><rect x="85" y="6" width="77" height="144" rx="17" fill="#14182A" stroke="#C3B2F6" stroke-width="2.5"/><rect x="91" y="13" width="65" height="128" rx="12" fill="url(#faqphoneGrad)"/><rect x="97" y="32" width="53" height="95" rx="8" fill="#1B2541"/><rect x="110" y="17" width="28" height="5" rx="2.5" fill="#13182D"/><rect x="107" y="46" width="34" height="34" rx="11" fill="#544A8C"/><path d="M117 58a7 7 0 0 1 14 0c0 4-7 5-7 9M124 74h.01" stroke="#E2D5FF" stroke-width="3" stroke-linecap="round"/><rect x="105" y="90" width="37" height="5" rx="2.5" fill="#B4A2E5" opacity=".8"/><rect x="105" y="101" width="26" height="5" rx="2.5" fill="#B4A2E5" opacity=".5"/><path d="m109 119 6 5 11-12" stroke="#7CEAC7" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/></g>'
  +'<g transform="rotate(-10 59 51)"><path d="M17 16h88a13 13 0 0 1 13 13v37a13 13 0 0 1-13 13H56L40 91V79H17A13 13 0 0 1 4 66V29a13 13 0 0 1 13-13Z" fill="url(#faqchatGrad)" stroke="#D4C2FF" stroke-width="2"/><path d="M24 36h67M24 49h47M24 62h53" stroke="#EDE4FF" stroke-width="5.5" stroke-linecap="round" opacity=".87"/></g>'
  +'<g transform="rotate(12 174 113)"><rect x="148" y="92" width="64" height="43" rx="12" fill="#154D4C" stroke="#A2F7D8" stroke-width="2"/><rect x="154" y="97" width="52" height="32" rx="8" fill="url(#faqwalletGrad)"/><path d="m168 111 7 7 12-15" stroke="#F5FFF9" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>'
  +'<path d="M42 114v11m-5-5.5h11M184 23v10m-5-5h10" stroke="#F6D48D" stroke-width="2" stroke-linecap="round"/>'
  +'</svg></span>'
         +'<h1 id="faqTitle" tabindex="-1">الأسئلة الشائعة</h1>'
         +'<p>كل اللي تحتاج تعرفه عن الشحن والشراء ومتابعة طلباتك في مكان واحد.</p>'
       +'</section>'
       +'<div class="faq-search-wrap">'
         +'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>'
         +'<input id="faqSearch" type="search" inputmode="search" autocomplete="off" aria-label="ابحث في الأسئلة الشائعة" placeholder="ابحث عن سؤالك...">'
       +'</div>'
       +'<div class="faq-filters" role="group" aria-label="تصفية الأسئلة">'
         +categories.map(c=>'<button class="faq-filter'+(c.key==='all'?' is-active':'')+'" type="button" data-faq-filter="'+c.key+'" aria-pressed="'+(c.key==='all'?'true':'false')+'">'+c.label+'</button>').join('')
       +'</div>'
       +'<div class="faq-result-label"><strong>الأسئلة والإجابات</strong><span id="faqResultCount">'+questions.length+' سؤال</span></div>'
       +'<div id="faqList" class="faq-list">'+cards+'</div>'
       +'<p id="faqEmpty" class="faq-no-results" hidden>ما لقيناش سؤال مطابق. جرّب كلمة ثانية أو تواصل معنا.</p>'
       +'<section class="faq-support"><span class="faq-support-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 16 0v5c0 1.5-1 2.5-2.5 2.5H15"/><rect x="2.5" y="12" width="4" height="6" rx="2"/><rect x="17.5" y="12" width="4" height="6" rx="2"/><path d="M10 20h4"/></svg></span><div><strong>ما لقيتش جواب لسؤالك؟</strong>'
         +'<p>فريق المتجر يقدر يراجع طلبك عبر واتساب. اذكر رقم الطلب لو عندك طلب قائم.</p></div>'
         +'<a href="https://wa.me/218925620538?text='+encodeURIComponent('السلام عليكم، عندي استفسار عن متجر L1017n.')+'" target="_blank" rel="noopener noreferrer">تواصل مع الدعم <span aria-hidden="true">↗</span></a></section>'
       +'<p class="faq-security">تنبيه: الدعم ما يحتاج كلمة المرور أو رمز التحقق من هاتفك.</p>'
     +'</div>';
   page.querySelector('.faq-back').addEventListener('click',close);
   page.querySelector('#faqSearch').addEventListener('input',render);
   page.querySelectorAll('[data-faq-filter]').forEach(button=>button.addEventListener('click',()=>{
     filter=button.dataset.faqFilter;
     page.querySelectorAll('[data-faq-filter]').forEach(b=>{
       const selected=b===button;
       b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));
     });
     render();
   }));
   page.querySelectorAll('.faq-card').forEach(card=>card.addEventListener('toggle',()=>{
     if(!card.open)return;
     page.querySelectorAll('.faq-card').forEach(other=>{if(other!==card)other.open=false});
   }));
   page.addEventListener('cancel',e=>{e.preventDefault();close()});
   page.addEventListener('click',e=>{if(e.target===page)close()});
   document.body.appendChild(page);
   document.body.style.overflow='hidden';
   history.pushState({...history.state,l1017nFaqPage:true},'');
   try{page.showModal();page.querySelector('#faqTitle')?.focus({preventScroll:true})}
   catch(err){console.warn('[faq]',err);dismiss()}
 }
 window.addEventListener('popstate',()=>{if(page&&!history.state?.l1017nFaqPage)dismiss()});
 document.addEventListener('click',e=>{
   const button=e.target.closest('[data-account-action="faq"],[data-faq-open]');
   if(!button)return;
   e.preventDefault();e.stopImmediatePropagation();
   document.getElementById('accountSettingsDetail')?.classList.add('hidden');
   open(button);
 },true);
})();