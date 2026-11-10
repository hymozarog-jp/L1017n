/* L1017n account phone change — authenticated, SMS-verified, no client-side phone writes. */
(function(){
 "use strict";
 const errors={
  phone_limit:"ربطت 3 أرقام بالفعل؛ هذا هو الحد الأقصى للحساب.",primary_verification_required:"وثّق رقم حسابك الحالي أولاً من خيار توثيق الهاتف.",
  unauthorized:"سجّل دخولك إلى حسابك أولاً.",phone_required:"لازم يكون عندك رقم محفوظ أولاً.",
  invalid_phone:"اكتب رقمًا ليبيًا صحيحًا يبدأ بـ 09.",same_phone:"هذا هو رقم الحساب الأساسي؛ اكتب رقمًا مختلفًا.",
  phone_already_registered:"الرقم مسجّل في حساب آخر. استعمل رقمًا آخر.",
  cooldown:"تقدر تعيد إرسال الرمز بعد انتهاء الأربع دقائق.",
  hour_limit:"وصلت للحد المسموح من الرسائل خلال الساعة.",
  day_limit:"وصلت للحد المسموح من الرسائل اليوم.",
  not_configured:"إرسال رسائل التحقق غير مفعّل حالياً.",
  sms_gateway_unavailable:"خدمة رسائل SMS غير متاحة. حاول مرة ثانية لاحقًا.",
  invalid:"رمز التحقق غير صحيح.",invalid_format:"اكتب رمزًا من 6 أرقام.",
  expired:"انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
  locked:"محاولات كثيرة؛ اطلب رمزًا جديدًا بعد انتهاء العدّاد.",
  phone_changed:"رقم حسابك تغيّر من جهاز آخر. حدّث الصفحة.",
  not_requested:"اطلب رمزًا للرقم الجديد أولاً.",
  database_unavailable:"تعذر الاتصال بالخادم. حاول مرة ثانية."
 };
 let panel=null,busy=false,ticker=null,deadline=0,sequence=0,requested="",lastFocus=null;
 const q=selector=>panel?.querySelector(selector);
 const arDigits=s=>String(s||"").replace(/[٠-٩]/g,x=>String(x.charCodeAt(0)-1632)).replace(/[۰-۹]/g,x=>String(x.charCodeAt(0)-1776));
 function normalize(input){
  let d=arDigits(input).replace(/[^0-9]/g,"");
  if(d.startsWith("00218"))d=d.slice(5);else if(d.startsWith("218"))d=d.slice(3);
  if(d.startsWith("0"))d=d.slice(1);
  return /^9[1-4][0-9]{7}$/.test(d)?d:"";
 }
 function clock(s){return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
 function setStatus(message,failed=false){const label=q(".pc-status");if(label){label.textContent=message;label.dataset.error=String(failed)}}
 function stopTicker(){if(ticker)clearInterval(ticker);ticker=null}
 function countdown(seconds){
  stopTicker();deadline=Date.now()+Math.max(0,Number(seconds)||0)*1000;
  function tick(){
   if(!panel?.classList.contains("visible")){stopTicker();return}
   const left=Math.max(0,Math.ceil((deadline-Date.now())/1000)),btn=q(".pc-resend"),counter=q(".pc-timer");
   if(counter)counter.textContent=clock(left);
   if(btn){btn.disabled=busy||left>0;btn.textContent=left?"إعادة إرسال بعد "+clock(left):"إعادة إرسال الرمز"}
   if(!left)stopTicker();
  }
  tick();if(Date.now()<deadline)ticker=setInterval(tick,1000);
 }
 function step(stage){
  ["entry","code","done"].forEach(s=>{const el=q(".pc-"+s);if(el)el.hidden=s!==stage});
  const heading=q(".pc-heading");
  if(heading)heading.textContent=stage==="code"?"تأكيد الرقم الجديد":stage==="done"?"تم توثيق الرقم":"أرقام التحويل";
 }
 function lock(value){
  busy=value;
  panel?.querySelectorAll(".pc-entry button,.pc-code button,.pc-code input,.pc-entry input").forEach(el=>{
   if(el.classList.contains("pc-resend"))return;
   el.disabled=value;
  });
  countdown(Math.ceil(Math.max(0,deadline-Date.now())/1000));
 }
 async function invoke(action,extras={}){
  const client=typeof supabaseClient!=="undefined"?supabaseClient:null;
  if(!client)throw Error("خدمة المتجر غير جاهزة.");
  const {data,error}=await client.functions.invoke("l1017n-change-phone",{body:{action,...extras}});
  if(error){
   let details={};try{details=await error.context?.json()||{}}catch(_){}
   const key=String(details.error||"database_unavailable");
   const err=Error(errors[key]||"تعذر إكمال العملية. حاول مرة ثانية.");
   err.reason=key;err.retryAfter=Number(details.retry_after_seconds)||0;throw err;
  }
  return data||{};
 }
 function phoneHint(number){
  const display=q(".pc-current"),target=q(".pc-sent-to");
  if(display&&number)display.textContent=number;
  if(target&&requested)target.textContent="0"+requested;
 }
 async function load(seq){
  setStatus("جاري فحص إعدادات الرقم…");
  try{
   const state=await invoke("status");if(seq!==sequence)return;
   if(state.configured===false)throw Error(errors.not_configured);
   phoneHint(state.current_phone);
   const list=q(".pc-linked-list");list.replaceChildren();
   (state.phones||[]).slice(0,3).forEach(item=>{
    const row=document.createElement("div");row.style.cssText="display:flex;justify-content:space-between;align-items:center;padding:14px;border:1px solid #70618b55;border-radius:16px;margin:8px 0;background:#ffffff06";
    const number=document.createElement("strong");number.dir="ltr";number.textContent=item.phone;
    const badge=document.createElement("span");badge.textContent=item.primary?"✓ موثّق · أساسي":"✓ موثّق";badge.style.color="#a9d5bb";
    row.append(number,badge);list.append(row);
   });
   if(!(state.phones||[]).length){
    const verify=document.createElement("button");verify.type="button";verify.className="pc-primary";verify.textContent="توثيق رقم الحساب الأساسي";verify.onclick=()=>{close();window.openPhoneVerificationPage?.()};list.append(verify);
   }
   const total=document.createElement("p");total.textContent=(state.phones||[]).length+" / 3 أرقام موثّقة";list.append(total);
   panel.dataset.full=String((state.phones||[]).length>=3);
   if(state.code_pending&&normalize(state.pending_phone)){
    requested=normalize(state.pending_phone);
    step("code");phoneHint();countdown(state.retry_after_seconds||0);
    setStatus("وصل رمز إلى الرقم الجديد؟ اكتبه لإضافة الرقم.");
   }else{
    requested="";step("entry");q(".pc-entry").hidden=!(state.phones||[]).length||(state.phones||[]).length>=3;countdown(state.retry_after_seconds||0);
    setStatus(state.retry_after_seconds?"يمكن طلب رمز جديد بعد انتهاء العدّاد.":"");
   }
  }catch(e){if(seq===sequence)setStatus(e.message||errors.database_unavailable,true)}
 }
 async function send(event){
  event?.preventDefault();if(busy)return;
  const phone=normalize(q(".pc-new-number").value);
  if(!phone){setStatus(errors.invalid_phone,true);return}
  const current=normalize(q(".pc-current").textContent);
  if(phone===current){setStatus(errors.same_phone,true);return}
  lock(true);setStatus("جاري إرسال رمز التحقق إلى الرقم الجديد…");
  try{
   const reply=await invoke("send",{phone});
   if(!reply.sent)throw Error("تعذر إرسال الرمز.");
   requested=phone;
   step("code");phoneHint();countdown(reply.retry_after_seconds||240);
   setStatus("تم طلب إرسال رمز SMS. الرمز صالح لمدة 5 دقائق.");
   q(".pc-code-input")?.focus();
  }catch(e){
   setStatus(e.message||"تعذر إرسال الرمز.",true);
   if(e.reason==="cooldown"){
    try{const state=await invoke("status");if(state.code_pending&&normalize(state.pending_phone)){
      requested=normalize(state.pending_phone);step("code");phoneHint();
    }countdown(state.retry_after_seconds||e.retryAfter)}catch(_){countdown(e.retryAfter||240)}
   }
  }finally{lock(false)}
 }
 async function verify(event){
  event.preventDefault();if(busy)return;
  const code=arDigits(q(".pc-code-input").value).trim();
  if(!/^[0-9]{6}$/.test(code)){setStatus(errors.invalid_format,true);return}
  lock(true);setStatus("جاري تأكيد ملكية الرقم الجديد…");
  try{
   const result=await invoke("verify",{code});
   if(!result.added&&!result.changed)throw Error("تعذر إضافة الرقم.");
   stopTicker();step("done");q(".pc-done-number").textContent=result.phone||"0"+requested;
   setStatus("تم ربط الرقم بنفس محفظتك.");
   if(typeof renderAccount==="function")void Promise.resolve(renderAccount()).catch(()=>{});
   if(typeof renderWallet==="function")void Promise.resolve(renderWallet()).catch(()=>{});
   if(typeof window.L1017nPersonalPremium?.refreshFromServer==="function")
      void Promise.resolve(window.L1017nPersonalPremium.refreshFromServer()).catch(()=>{});
  }catch(e){setStatus(e.message||"تعذر التحقق.",true)}
  finally{lock(false)}
 }
 function close(){
  window.dispatchEvent(new Event("l1017n:account-phones-updated"));
  sequence++;stopTicker();panel?.classList.remove("visible");if(panel)panel.hidden=true;
  document.body.classList.remove("phone-change-open");
  if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
 }
 function create(){
  if(panel)return;
  panel=document.createElement("section");panel.id="phoneChangeWizard";panel.hidden=true;
  panel.dir="rtl";panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
  panel.setAttribute("aria-labelledby","phoneChangeTitle");
  panel.innerHTML='<div class="pc-shell"><header class="pc-header"><button type="button" class="pc-back" aria-label="إغلاق أرقام التحويل">‹</button><b>L1017n • أمان الحساب</b><span>🔒</span></header>'+
  '<div class="pc-hero"><span class="pc-hero-icon">☎</span><h2 class="pc-heading" id="phoneChangeTitle">أرقام التحويل</h2><p>اربط حتى 3 أرقام موثّقة بمحفظتك. أي تحويل يصل من أحدها يُضاف لنفس الحساب.</p></div>'+
  '<div class="pc-linked-list" aria-label="الأرقام الموثّقة"></div><div class="pc-current-panel"><span>رقم الحساب الأساسي</span><strong dir="ltr" class="pc-current">—</strong></div>'+
  '<form class="pc-entry"><label for="pcNewPhone">إضافة رقم آخر</label><div class="pc-input-row"><span dir="ltr">+218</span><input id="pcNewPhone" class="pc-new-number" type="tel" inputmode="tel" dir="ltr" autocomplete="tel-national" placeholder="09xxxxxxxx" maxlength="15" required></div>'+
   '<p>لازم يكون الرقم الجديد ملكك وغير مربوط بحساب آخر.</p><button type="submit" class="pc-primary">إرسال رمز التحقق</button></form>'+
  '<div class="pc-code" hidden><p>أرسلنا رمزًا من 6 أرقام إلى <strong class="pc-sent-to" dir="ltr"></strong></p>'+
   '<form class="pc-verify"><label for="pcOtpCode">رمز التحقق</label><input id="pcOtpCode" class="pc-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" dir="ltr" required>'+
   '<button type="submit" class="pc-primary">توثيق وإضافة الرقم</button></form><div class="pc-resend-box"><span>إرسال رمز جديد</span><b class="pc-timer" dir="ltr">04:00</b></div>'+
   '<button type="button" class="pc-resend" disabled>إعادة إرسال بعد 04:00</button><p>لا تشارك رمز التحقق مع أي شخص. الرمز صالح لخمس دقائق.</p></div>'+
  '<div class="pc-done" hidden><span>✓</span><h3>تم توثيق الرقم بنجاح</h3><p>رقمك الجديد <strong class="pc-done-number" dir="ltr"></strong> تم تأكيده برسالة SMS. تحويلاته تصل لنفس المحفظة.</p>'+
   '<button type="button" class="pc-primary pc-finish">العودة إلى حسابي</button></div>'+
  '<p class="pc-status" role="status" aria-live="polite"></p></div>';
  document.body.appendChild(panel);
  q(".pc-back").addEventListener("click",close);q(".pc-finish").addEventListener("click",close);
  q(".pc-entry").addEventListener("submit",send);
  q(".pc-verify").addEventListener("submit",verify);
  q(".pc-resend").addEventListener("click",async()=>{
   if(busy||Date.now()<deadline)return;
   q(".pc-new-number").value="0"+requested;
   await send();
  });
  panel.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
 }
 function open(){
  lastFocus=document.activeElement;create();stopTicker();busy=false;requested="";
  panel.hidden=false;panel.classList.add("visible");document.body.classList.add("phone-change-open");
  step("entry");q(".pc-new-number").value="";q(".pc-code-input").value="";
  const seq=++sequence;countdown(0);q(".pc-back").focus({preventScroll:true});void load(seq);
 }
 window.openPhoneChangePage=open;
 window.openAccountPhonesPage=open;
 window.closePhoneChangePage=close;
})();
