/* Customer-submitted Libyana prepaid cards, reviewed by private Telegram store admin. */
(function(){
 "use strict";
 let page=null,working=false,requestId="",requestSnapshot="",submittedCards=null,focusBefore=null;
 const maxCards=8;
 const $=s=>page?.querySelector(s);
 const $$=s=>[...(page?.querySelectorAll(s)||[])];
 const errors={
   unauthorized:"سجّل دخولك إلى حسابك أولاً.",
   phone_required:"لازم تحفظ رقم هاتف في حسابك أولاً.",
   invalid_card_count:"تقدر تضيف من كرت واحد إلى 8 كروت في الطلب.",
   invalid_card_entry:"راجع بيانات الكروت.",
   invalid_card_number:"رقم الكرت لازم يحتوي 8 إلى 24 رقم.",
   invalid_card_amount:"اكتب قيمة صحيحة لكل كرت من 1 إلى 1000 دينار.",
   duplicate_card:"لا تكرر نفس رقم الكرت في الطلب.",
   card_already_submitted:"أحد الكروت مسجّل في طلب سابق ولا يمكن إرساله مرة ثانية.",
   card_total_limit:"الحد الأعلى لمجموع الطلب 5000 دينار.",
   card_request_conflict:"تغيّرت بيانات الطلب. حدّث الصفحة وحاول مرة ثانية.",
   card_submission_rate_limit:"وصلت لحد طلبات الكروت خلال الفترة الحالية. جرّب لاحقًا.",
   server_not_configured:"خدمة استقبال الكروت غير جاهزة حاليًا.",
   submission_failed:"تعذّر تسجيل طلب الكروت. حاول مرة ثانية.",
   submission_saved_secure_store_failed:"سُجّل طلبك، لكن تعذّر تخزين الأرقام بأمان. أعد المحاولة بنفس الكروت.",
   submission_saved_notify_unavailable:"تم تسجيل الطلب، لكن تعذّر تأكيد إرسال التنبيه. لا تغلق الصفحة وحاول مرة ثانية.",
   submission_saved_notify_failed:"تم حفظ الطلب، لكن تعذّر وصول التنبيه إلى تيليجرام. جرّب إعادة الإرسال بدون تعديل الأرقام."
 };
 function digits(input){
   return String(input||"").replace(/[٠-٩]/g,x=>String(x.charCodeAt(0)-1632))
     .replace(/[۰-۹]/g,x=>String(x.charCodeAt(0)-1776));
 }
 function codeValue(value){return digits(value).replace(/[\s-]/g,"")}
 function setMessage(message,error=false){
   const out=$(".ct-status");
   if(out){out.textContent=message;out.dataset.error=String(error)}
 }
 function createRow(position){
   const card=document.createElement("article");card.className="ct-card";
   card.innerHTML='<div class="ct-card-head"><span class="ct-card-count"></span><button type="button" class="ct-remove-card" aria-label="حذف الكرت">حذف</button></div>'+
   '<div class="ct-amount-heading"><span>قيمة الكرت</span><small>اختر قيمة أو اكتب مبلغًا آخر</small></div>'+
   '<div class="ct-preset-grid" role="group" aria-label="قيمة كرت ليبيانا">'+[3,5,10,30,40,100].map(value=>'<button type="button" class="ct-preset" data-amount="'+value+'" aria-pressed="false"><strong>'+value+'</strong><small>دينار</small></button>').join('')+'</div>'+
   '<label class="ct-custom-amount-label">قيمة أخرى (د.ل)<div class="ct-amount-input"><input class="ct-card-amount" type="number" min="1" max="1000" step="1" inputmode="numeric" placeholder="أو اكتب المبلغ" required><span>د.ل</span></div></label>'+
   '<label class="ct-secret-label">الرقم السري للكرت<input class="ct-card-code" type="password" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="36" placeholder="اكتب الرقم السري هنا" required></label>'+
   '<div class="ct-code-tools"><small>اكتب الأرقام فقط دون رموز الاتصال</small><button type="button" class="ct-reveal">إظهار الرقم</button></div>';
   const num=card.querySelector(".ct-card-count");num.textContent="الكرت "+position;
   const amountInput=card.querySelector(".ct-card-amount");
   function syncPresets(){
     const chosen=String(amountInput.value||"");
     card.querySelectorAll(".ct-preset").forEach(button=>{
       const selected=button.dataset.amount===chosen;
       button.classList.toggle("selected",selected);
       button.setAttribute("aria-pressed",String(selected));
     });
   }
   card.querySelectorAll(".ct-preset").forEach(button=>{
     button.addEventListener("click",()=>{
       if(working||submittedCards)return;
       amountInput.value=button.dataset.amount;
       amountInput.dispatchEvent(new Event("input",{bubbles:true}));
       syncPresets();
     });
   });
   amountInput.addEventListener("input",syncPresets);
   card.querySelector(".ct-reveal").addEventListener("click",()=>{
     const inp=card.querySelector(".ct-card-code");inp.type=inp.type==="password"?"text":"password";
     card.querySelector(".ct-reveal").textContent=inp.type==="password"?"إظهار الرقم":"إخفاء الرقم";
   });
   card.querySelector(".ct-remove-card").addEventListener("click",()=>{
     if(working||submittedCards)return;
     if($$(".ct-card").length===1){setMessage("لازم يكون عندك كرت واحد على الأقل.",true);return}
     card.remove();update();
   });
   card.addEventListener("input",()=>{
     if(!submittedCards){requestId="";requestSnapshot="";update();setMessage("")}
   });
   return card;
 }
 function update(){
   const rows=$$(".ct-card");
   rows.forEach((row,i)=>{
     row.querySelector(".ct-card-count").textContent="الكرت "+(i+1);
     row.querySelector(".ct-remove-card").hidden=rows.length===1;
   });
   const total=rows.reduce((sum,row)=>{
     const value=Number(row.querySelector(".ct-card-amount").value);
     return sum+(Number.isInteger(value)&&value>0&&value<=1000?value:0);
   },0);
   $(".ct-total").textContent=total.toFixed(2)+" د.ل";
   $(".ct-count").textContent=String(rows.length);
   $(".ct-add").disabled=working||!!submittedCards||rows.length>=maxCards;
   $(".ct-submit").disabled=working||!!submittedCards;
 }
 function readCards(){
   const rows=$$(".ct-card");if(rows.length<1||rows.length>maxCards)throw Error(errors.invalid_card_count);
   const cards=[],seen=new Set();
   for(let i=0;i<rows.length;i++){
     const code=codeValue(rows[i].querySelector(".ct-card-code").value);
     if(!/^[0-9]{8,24}$/.test(code))throw Error("راجع رقم الكرت "+(i+1)+": "+errors.invalid_card_number);
     if(seen.has(code))throw Error(errors.duplicate_card);seen.add(code);
     const amount=Number(rows[i].querySelector(".ct-card-amount").value);
     if(!Number.isInteger(amount)||amount<1||amount>1000)throw Error("راجع الكرت "+(i+1)+": "+errors.invalid_card_amount);
     cards.push({code,amount});
   }
   if(cards.reduce((s,c)=>s+c.amount,0)>5000)throw Error(errors.card_total_limit);
   return cards;
 }
 function safeId(text){return String(text||"").replace(/[^a-zA-Z0-9-]/g,"").slice(0,36)}
 function setBusy(active){
   working=active;$(".ct-submit").disabled=active||!!submittedCards;
   $(".ct-add").disabled=active||!!submittedCards||$$(".ct-card").length>=maxCards;
   $(".ct-submit").textContent=active?"جاري تسجيل الطلب…":"إرسال طلب التعبئة للمراجعة";
 }
 async function submit(event){
   event.preventDefault();if(working||submittedCards)return;
   let cards;
   try{cards=readCards()}catch(e){setMessage(e.message||"بيانات غير صحيحة.",true);return}
   const client=typeof supabaseClient!=="undefined"?supabaseClient:null;
   if(!client){setMessage("المتجر غير جاهز. حاول تحديث الصفحة.",true);return}
   const snapshot=JSON.stringify(cards);
   if(requestSnapshot!==snapshot){requestId=crypto.randomUUID();requestSnapshot=snapshot}
   setBusy(true);setMessage("جاري تسجيل طلبك وإرسال تنبيه للإدارة…");
   try{
     const {data,error}=await client.functions.invoke("l1017n-card-topup",{
       body:{submission_id:requestId,cards}
     });
     let details=data||{};
     if(error){
       try{details=await error.context?.json()||details}catch(_){}
       const key=String(details.error||"submission_failed");
       throw Object.assign(Error(errors[key]||"تعذّر إرسال الطلب. حاول ثانية."),{reason:key,saved:!!details.saved});
     }
     if(!data?.saved)throw Error("تعذّر تأكيد تسجيل الطلب. حاول ثانية.");
     submittedCards=cards.map(c=>({amount:c.amount,code:''}));
     $(".ct-success-id").textContent=safeId(requestId);
     $(".ct-success-total").textContent=cards.reduce((n,c)=>n+c.amount,0).toFixed(2)+" د.ل";
     $(".ct-success-count").textContent=String(cards.length);
     $(".ct-entry").hidden=true;
     $(".ct-success").hidden=false;
     $(".ct-current-step").textContent="تم إرسال الطلب للمراجعة";
     $$(".ct-card-code").forEach(input=>{input.value=""});
     setMessage("تم تسجيل طلب الكروت بأمان. أرقامها محفوظة مشفّرة في لوحة مسؤول المتجر.");
     // The backend has encrypted the submitted codes; wipe input values locally.
   }catch(e){
     setMessage((e.message||"تعذر إتمام الطلب.")+(e.saved?" لا تغيّر الكروت واضغط تسجيل الطلب مرة ثانية لإعادة المحاولة.":""),true);
   }finally{setBusy(false);update()}
 }
 function close(){
   if(working)return;
   page?.classList.remove("visible");if(page){page.remove();page=null}submittedCards=null;requestId="";requestSnapshot="";
   document.body.classList.remove("card-topup-open");
   if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
 }
 function create(){
   if(page)return;
   page=document.createElement("section");page.id="cardTopupPage";page.hidden=true;page.dir="rtl";
   page.setAttribute("role","dialog");page.setAttribute("aria-modal","true");page.setAttribute("aria-labelledby","cardTopupTitle");
   page.innerHTML='<div class="ct-shell"><header class="ct-head"><button type="button" class="ct-back" aria-label="إغلاق صفحة تعبئة الكروت">×</button><span>L1017n WALLET</span><span class="ct-safe">مراجعة آمنة</span></header>'+
   '<div class="ct-hero"><div class="ct-hero-art" aria-hidden="true"><svg viewBox="0 0 72 72" width="57" height="57" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="9" y="15" width="54" height="42" rx="8"/><path d="M9 28h54M17 45h17M48 42h6"/></svg></div><span class="ct-current-step">ليبيانا · كروت الشحن</span><h1 id="cardTopupTitle">تعبئة بكرت ليبيانا</h1><p>اختار قيمة الكرت، واكتب رقمه السري. يتم إرسال الطلب للإدارة ومراجعته قبل إضافة الرصيد.</p></div>'+
   '<div class="ct-top-alert" role="note"><span class="ct-alert-icon" aria-hidden="true">!</span><p><strong>تنبيه مهم</strong> تأكد من الرقم السري وقيمة الكرت قبل الإرسال. لا تشارك الرقم مع الآخرين؛ تتم التعبئة بعد اعتماد المسؤول فقط.</p></div>'+
   '<section class="ct-entry"><form id="cardTopupForm"><div class="ct-list"></div><button type="button" class="ct-add"><span>＋</span> إضافة كرت جديد</button>'+
   '<div class="ct-summary"><div><small>عدد الكروت</small><strong class="ct-count">1</strong></div><div><small>مجموع المبالغ</small><strong class="ct-total">0.00 د.ل</strong></div></div>'+
   '<p class="ct-warning">إرسال البيانات لا يعني شحن المحفظة فورًا. يظهر الرصيد بعد مراجعة المسؤول للكرت والتأكد من قيمته واعتماد طلبك.</p>'+
   '<button class="ct-submit" type="submit">إرسال طلب التعبئة للمراجعة</button></form></section>'+
   '<section class="ct-success" hidden><div class="ct-ok-icon" aria-hidden="true">✓</div><h2>تم تسجيل طلب الكروت</h2><p>رقم الطلب <strong class="ct-success-id" dir="ltr"></strong></p>'+
   '<div class="ct-success-summary"><span>الكروت: <b class="ct-success-count"></b></span><span>المبلغ: <b class="ct-success-total"></b></span></div>'+
   '<p>أرقام الكروت محفوظة بصورة مشفّرة في لوحة الإدارة، ويتم عرضها فقط للمسؤول المعتمد بعد تسجيل الدخول. الرصيد ينتظر مراجعة المسؤول.</p>'+
   '<button type="button" class="ct-go-wallet">العودة إلى المحفظة</button></section>'+
   '<p class="ct-status" aria-live="polite" role="status"></p></div>';
   document.body.appendChild(page);
   $(".ct-list").appendChild(createRow(1));
   $(".ct-add").addEventListener("click",()=>{
     if(working||submittedCards)return;
     if($$(".ct-card").length>=maxCards){setMessage("الحد الأقصى 8 كروت لكل طلب.",true);return}
     $(".ct-list").appendChild(createRow($$(".ct-card").length+1));update();
   });
   $("#cardTopupForm").addEventListener("submit",submit);
   $(".ct-back").addEventListener("click",close);
   $(".ct-go-wallet").addEventListener("click",close);
   page.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
   update();
 }
 function open(){
   focusBefore=document.activeElement;create();
   // No raw voucher number persists after closing the submitted form.
   page.hidden=false;page.classList.add("visible");document.body.classList.add("card-topup-open");
   $(".ct-back").focus({preventScroll:true});
 }
 document.addEventListener("click",e=>{
   const button=e.target.closest("#walletActionCard,#topupDedicatedCardEntry");
   if(!button)return;
   e.preventDefault();open();
 });
 window.openCardTopupPage=open;
})();