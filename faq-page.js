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
   const cards=questions.map((item,i)=>
     '<details class="faq-card" data-faq-category="'+item.category+'" data-faq-search="'+escapeHtml(item.q+' '+item.a)+'">'
      +'<summary><span class="faq-number">'+String(i+1).padStart(2,'0')+'</span>'
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
         +'<span class="faq-hero-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2.6c-1 .6-2 1.3-2 2.8M12 17.5h.01"/></svg></span>'
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
       +'<section class="faq-support"><div><strong>ما لقيتش جواب لسؤالك؟</strong>'
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