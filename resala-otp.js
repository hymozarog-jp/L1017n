/* L1017N — server-authenticated Resala SMS OTP UI.
   Personal details embeds this existing widget: no verification in localStorage,
   no SMS API secrets, no frontend-only claim of verified ownership. */
(function(){
"use strict";
let lastSentFor="";
const messages={
 unauthorized:"انتهت جلسة تسجيل الدخول. ادخل لحسابك من جديد.",
 phone_required:"احفظ رقم هاتفك في المعلومات الشخصية أولاً.",
 cooldown:"تقدر تطلب رمزًا جديدًا بعد دقيقة.",
 hour_limit:"وصلت لحد الرسائل المسموح خلال الساعة. جرّب بعدين.",
 day_limit:"وصلت لحد الرسائل اليومي. جرّب بكرة.",
 invalid:"الرمز مش صحيح، تأكد منه وحاول ثانية.",
 expired:"انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
 locked:"محاولات كثيرة، اطلب رمزًا جديدًا بعد دقيقة.",
 not_requested:"اطلب رمز تحقق أولاً.",
 phone_mismatch:"رقم الهاتف تغير. حدّث الصفحة وحاول ثانية.",
 sms_gateway_unavailable:"تعذر إرسال SMS حاليًا. حاول بعد قليل.",
 database_unavailable:"تعذر الاتصال بالخدمة. حاول بعد قليل.",
 invalid_format:"الرمز لازم يكون 6 أرقام.",
 not_configured:"خدمة الرسائل لم تُفعّل من الإدارة بعد."
};
const css=document.createElement("style");
css.id="resala-account-verification-style-v2";
css.textContent=[
 "#resalaVerifyBox{padding:18px;margin:14px 0;border:1px solid #617ba985;border-radius:17px;background:linear-gradient(135deg,#132441,#111931);color:#f2f5ff;text-align:right;direction:rtl}",
 "#resalaVerifyBox .resala-head{display:flex;align-items:center;gap:12px;margin-bottom:10px}",
 "#resalaVerifyBox .resala-symbol{display:grid;place-items:center;flex:0 0 43px;width:43px;height:43px;background:#7961eb25;border:1px solid #887eff88;border-radius:13px;color:#c4b6ff}",
 "#resalaVerifyBox .resala-symbol svg{width:25px;height:25px}",
 "#resalaVerifyBox h3{margin:0 0 4px;font-size:16px;font-weight:800;color:#f4f4ff}",
 "#resalaVerifyBox .resala-subtitle{color:#a8b7d9;font-size:12px}",
 "#resalaVerifyBox p{margin:9px 0 15px;font-size:13px;line-height:1.8;color:#bfcee7}",
 "#resalaVerifyBox b[dir=ltr]{font:700 15px Arial,sans-serif;white-space:nowrap;unicode-bidi:isolate;color:#fff}",
 "#resalaVerifyBox .resala-verified{color:#92ecc5}",
 "#resalaVerifyBox .resala-ok{display:inline-flex;gap:7px;align-items:center;background:#1c66593a;border:1px solid #43bc9578;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;color:#a9f4d4}",
 "#resalaVerifyBox .resala-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}",
 "#resalaVerifyBox .resala-code{width:175px;max-width:100%;min-width:120px;flex:1;letter-spacing:.24em;text-align:center;direction:ltr;font-size:22px;padding:12px 10px;border:1px solid #7183b3;border-radius:12px;background:#0b1226;color:#fff;outline-offset:3px}",
 "#resalaVerifyBox .resala-code:focus{border-color:#ad92ff;outline:2px solid #a889ff50}",
 "#resalaVerifyBox .resala-code-form{margin-top:14px}",
 "#resalaVerifyBox button{border:0;border-radius:12px;background:linear-gradient(125deg,#a17af8,#7052ed);color:#fff;font:inherit;font-weight:800;padding:12px 17px;min-height:45px;cursor:pointer}",
 "#resalaVerifyBox .resala-code-form button{background:#243d7a;border:1px solid #677ec4}",
 "#resalaVerifyBox button:disabled{opacity:.55;cursor:wait}",
 "#resalaVerifyBox .resala-status{min-height:22px;color:#ffddac;margin:10px 0 0;line-height:1.7}",
 "#resalaVerifyBox .resala-done-note{margin-bottom:0;color:#c1d6dc}",
 "#personalDetailsPage #resalaVerifyBox{margin:4px 0 0;border:0;border-top:1px solid #314464;border-radius:0 0 18px 18px;background:transparent;padding:19px 16px 18px}",
 "#personalDetailsPage #resalaVerifyBox .resala-ok{margin-top:3px}"
].join("\n");
document.head.appendChild(css);
const shield='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>';
async function invoke(action,code){
 const body=code?{action,code}:{action};
 const {data,error}=await supabaseClient.functions.invoke("l1017n-resala-otp",{body});
 if(!error)return data||{};
 let key="database_unavailable";
 try{key=(await error.context.json()).error||key}catch(_){}
 throw new Error(messages[key]||"تعذر إكمال العملية. حاول ثانية.");
}
function clear(){document.getElementById("resalaVerifyBox")?.remove()}
function badge(state){
 const el=document.getElementById("personalPhoneBadge");
 if(!el)return;
 if(!state){el.textContent="تعذر التحقق";el.dataset.state="unknown";return}
 if(!state.phone){el.textContent="أضف الرقم";el.dataset.state="empty";return}
 el.textContent=state.verified?"موثّق":"غير موثّق";
 el.dataset.state=state.verified?"verified":"unverified";
}
window.renderResalaOtp=async function(user){
 const gate=document.getElementById("accountPhoneGate");
 if(!user||!gate){clear();badge(null);return}
 let state;
 try{state=await invoke("status")}
 catch(error){
  console.warn("[phone/verification] Status unavailable",error);
  badge(null);
  let old=document.getElementById("resalaVerifyBox");
  if(old)old.remove();
  return;
 }
 if(!state.configured){clear();badge(null);return}
 badge(state);
 if(gate.classList.contains("hidden")){clear();return}
 let box=document.getElementById("resalaVerifyBox");
 if(!box){box=document.createElement("section");box.id="resalaVerifyBox";box.setAttribute("aria-label","تأكيد ملكية رقم الهاتف")}
 // Keep one widget in the same location as the saved-phone form; when
 // Personal Details moves the form, move this node too.
 gate.insertAdjacentElement("afterend",box);
 const phone=String(state.phone||"");
 const heading='<div class="resala-head"><span class="resala-symbol">'+shield+'</span><div><h3>تأكيد ملكية رقم الهاتف</h3><span class="resala-subtitle">حماية الحساب والطلبات</span></div></div>';
 if(state.verified){
  lastSentFor="";
  box.innerHTML=heading+
   '<span class="resala-ok">تم توثيق الرقم بنجاح</span>'+
   '<p class="resala-done-note">الرقم <b dir="ltr"></b> مؤكد برسالة SMS. تقدر تشتري من محفظتك لما يكون رصيدك كافي.</p>';
  box.querySelector("b").textContent=phone;
  return;
 }
 if(!phone){
  box.innerHTML=heading+'<p>احفظ رقم ليبيانا أو المدار في المربع اللي فوق، وبعدها اضغط إرسال الرمز.</p>';
  return;
 }
 box.innerHTML=heading+
  '<p>بنرسل رمزًا مكوّنًا من 6 أرقام إلى <b dir="ltr"></b>. الرمز صالح لمدة 5 دقائق.</p>'+
  '<div class="resala-row"><button type="button" class="resala-send">إرسال رمز التحقق</button></div>'+
  '<form class="resala-code-form" hidden><label for="resalaOtpCode">رمز التحقق</label><div class="resala-row">'+
  '<input id="resalaOtpCode" class="resala-code" type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" placeholder="000000" required>'+
  '<button type="submit">تأكيد الرمز</button></div></form>'+
  '<p class="resala-status" role="status" aria-live="polite"></p>';
 box.querySelector("b").textContent=phone;
 const send=box.querySelector(".resala-send"),form=box.querySelector(".resala-code-form"),field=box.querySelector(".resala-code"),status=box.querySelector(".resala-status");
 const key=user.id+":"+phone;
 if(lastSentFor===key){form.hidden=false;send.textContent="إعادة إرسال الرمز"}
 send.addEventListener("click",async function(){
  send.disabled=true;status.textContent="جاري إرسال الرمز…";
  try{
   const result=await invoke("send");
   if(result.verified){await window.renderResalaOtp(user);return}
   if(!result.sent)throw Error("تعذر إرسال الرمز.");
   lastSentFor=key;status.textContent="تم طلب الرسالة. أدخل الرمز اللي وصلك، ويمكن إعادة الإرسال بعد دقيقة.";
   form.hidden=false;send.textContent="إعادة إرسال الرمز";field.focus();
  }catch(error){status.textContent=error.message||"تعذر إرسال الرمز."}
  finally{send.disabled=false}
 });
 form.addEventListener("submit",async function(event){
  event.preventDefault();
  const code=field.value.trim();
  if(!/^[0-9]{6}$/.test(code)){status.textContent=messages.invalid_format;return}
  const confirm=form.querySelector('button[type="submit"]');
  confirm.disabled=true;status.textContent="جاري التأكد من الرمز…";
  try{
   const result=await invoke("verify",code);
   if(!result.verified)throw Error("تعذر تأكيد الرمز.");
   lastSentFor="";
   await window.renderResalaOtp(user);
  }catch(error){status.textContent=error.message||"تعذر تأكيد الرمز."}
  finally{confirm.disabled=false}
 });
};
})();