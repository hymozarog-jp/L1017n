/* L1017n verified phone wizard; server is authoritative for the resend timer. */
(function(){
"use strict";
const ERR={cooldown:"انتظر حتى ينتهي العدّاد قبل إرسال رمز جديد.",hour_limit:"وصلت لحد الرسائل خلال الساعة.",day_limit:"وصلت لحد الرسائل اليومي.",invalid:"رمز التحقق غير صحيح.",expired:"انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",locked:"تجاوزت عدد محاولات التحقق.",phone_mismatch:"الرقم لا يطابق الرقم المحفوظ.",sms_gateway_unavailable:"خدمة رسائل SMS غير متاحة حاليًا.",database_unavailable:"تعذر الاتصال بالخادم.",unauthorized:"انتهت جلسة الدخول.",not_configured:"إرسال الرسائل غير مفعّل حاليًا.",phone_required:"اكتب رقم الهاتف أولًا."};
let panel=null,ticker=null,until=0,saved="",locked=false,busy=false,opened=0,focusBefore=null;
const $=q=>panel?.querySelector(q);
function normalize(v){let s=String(v||"").replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\D/g,"");if(s.startsWith("00218"))s=s.slice(5);else if(s.startsWith("218"))s=s.slice(3);if(s.startsWith("0"))s=s.slice(1);return /^9[1-4][0-9]{7}$/.test(s)?s:""}
const format=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
function status(s,error=false){const x=$(".pv-status");if(x){x.textContent=s;x.dataset.error=String(error)}}
function stop(){if(ticker)clearInterval(ticker);ticker=null}
function progress(seconds){
 stop();until=Date.now()+Math.max(0,Number(seconds)||0)*1000;
 const tick=()=>{
  if(!panel?.classList.contains("visible")){stop();return}
  const remaining=Math.max(0,Math.ceil((until-Date.now())/1000));
  $(".pv-time").textContent=format(remaining);
  $(".pv-bar-fill").style.width=Math.min(100,(240-remaining)/240*100)+"%";
  const a=$(".pv-resend"),b=$(".pv-send");
  a.disabled=b.disabled=busy||remaining>0||locked;
  a.textContent=remaining?"إعادة إرسال الرمز بعد "+format(remaining):"إرسال رمز جديد";
  b.textContent=remaining?"رمز جديد بعد "+format(remaining):"إرسال رمز التحقق";
  if(!remaining)stop();
 };
 tick();if(Date.now()<until)ticker=setInterval(tick,1000);
}
function step(which){
 ["phone","code","done"].forEach(k=>$(".pv-"+k).hidden=k!==which);
 $(".pv-phase").textContent=which==="code"?"الخطوة الثانية • إدخال الرمز":which==="done"?"تم توثيق الرقم":"الخطوة الأولى • إدخال الهاتف";
 $(".pv-heading").textContent=which==="code"?"تأكيد رقم هاتفك":which==="done"?"تم التوثيق بنجاح":"توثيق رقم الهاتف";
 $(".pv-wait").hidden=which==="done";
}
function client(){return typeof supabaseClient==="undefined"?null:supabaseClient}
async function invoke(action,code){
 const c=client();if(!c)throw Error("المتجر غير جاهز.");
 const {data,error}=await c.functions.invoke("l1017n-resala-otp",{body:code?{action,code}:{action}});
 if(error){
  let details={};try{details=await error.context?.json()||{}}catch(_){}
  const key=String(details.error||"database_unavailable");
  throw Object.assign(Error(ERR[key]||"تعذر إتمام العملية."),{code:key,retryAfter:Number(details.retry_after_seconds)||0});
 }
 return data||{};
}
function verified(){
 locked=true;stop();step("done");status("");
 $(".pv-verified-number").textContent="0"+saved;
 if(typeof window.L1017nPersonalPremium?.refreshFromServer==="function")
   void window.L1017nPersonalPremium.refreshFromServer();
}
function setBusy(on){
 busy=on;$(".pv-check").disabled=on;$(".pv-number").disabled=on||!!saved;
 progress(Math.max(0,Math.ceil((until-Date.now())/1000)));
}
function applyState(data){
 if(data.verified){verified();return}
 const seconds=Math.max(0,Math.min(240,Number(data.retry_after_seconds)||0));
 if(data.code_pending){
  step("code");$(".pv-code-number").textContent="0"+saved;
 }else step("phone");
 progress(seconds);
}
async function load(seq){
 status("جاري فحص رقم الهاتف…");
 try{
  const c=client();if(!c)throw Error("الصفحة غير جاهزة. حاول تحديثها.");
  const {data:{session}}=await c.auth.getSession();
  if(seq!==opened)return;
  if(!session){status("سجّل دخولك من «حسابي» أولًا.",true);return}
  const {data,error}=await c.from("wallet_accounts").select("libyana_phone")
    .eq("user_id",session.user.id).maybeSingle();
  if(seq!==opened)return;
  if(error)throw Error("تعذر تحميل الرقم.");
  saved=normalize(data?.libyana_phone||"");
  $(".pv-number").value=saved?"0"+saved:"";
  $(".pv-number").readOnly=!!saved;
  $(".pv-hint").textContent=saved?"هذا رقمك المحفوظ في حسابك. تغييره يحتاج التواصل مع المتجر.":"أدخل رقم ليبيانا أو المدار اللي تملكه. سيُربط بحسابك عند الحفظ.";
  if(!saved){step("phone");progress(0);status("");return}
  const state=await invoke("status");
  if(seq!==opened)return;
  if(state.configured===false){status(ERR.not_configured,true);return}
  applyState(state);
  status(state.code_pending?"أدخل رمز SMS الذي وصلك.":state.retry_after_seconds?"انتظر انتهاء العدّاد قبل رمز جديد.":"");
 }catch(e){if(seq===opened)status(e.message||"تعذر تحميل الرقم.",true)}
}
async function send(){
 if(busy||locked||Date.now()<until)return;
 const v=normalize($(".pv-number").value);
 if(!v){step("phone");status("اكتب رقمًا ليبيًا صحيحًا يبدأ بـ09 (10 أرقام).",true);$(".pv-number").focus();return}
 if(saved&&saved!==v){status("الرقم لا يطابق رقم حسابك.",true);return}
 setBusy(true);status("جاري إرسال رمز التحقق…");
 try{
  if(!saved){
   const {error}=await client().rpc("save_my_libyana_phone",{p_phone:v});
   if(error)throw Error("تعذر حفظ الرقم؛ ربما مرتبط بحساب آخر.");
   saved=v;$(".pv-number").value="0"+v;$(".pv-number").readOnly=true;
  }
  const r=await invoke("send");
  if(r.verified){verified();return}
  if(!r.sent)throw Error("تعذر إرسال الرمز.");
  step("code");$(".pv-code-number").textContent="0"+saved;
  progress(Number(r.retry_after_seconds)||240);
  status("تم طلب إرسال SMS. اكتب الرمز المكوّن من 6 أرقام.");
  $(".pv-code-input").focus();
 }catch(e){
  status(e.message||"تعذر الإرسال.",true);
  if(e.code==="cooldown"){
   try{const d=await invoke("status");applyState(d);status(ERR.cooldown)}catch(_){progress(e.retryAfter||240)}
  }
 }finally{setBusy(false)}
}
async function verify(ev){
 ev.preventDefault();if(busy||locked)return;
 const code=String($(".pv-code-input").value||"").replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).trim();
 if(!/^[0-9]{6}$/.test(code)){status("الرمز يجب أن يكون 6 أرقام.",true);return}
 setBusy(true);status("جاري التحقق من الرمز…");
 try{const d=await invoke("verify",code);if(!d.verified)throw Error("تعذر التحقق.");verified();}
 catch(e){status(e.message||"رمز غير صحيح.",true)}
 finally{setBusy(false)}
}
function close(){
 opened++;stop();if(panel){panel.hidden=true;panel.classList.remove("visible")}
 document.body.classList.remove("phone-wizard-open");
 focusBefore?.focus?.({preventScroll:true});
}
function create(){
 if(panel)return;
 panel=document.createElement("section");panel.id="phoneVerifyWizard";panel.hidden=true;
 panel.dir="rtl";panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-labelledby","phoneWizardHeading");
 panel.innerHTML='<div class="pv-shell">'
 +'<header class="pv-header"><button type="button" class="pv-back" aria-label="رجوع">‹</button><span>توثيق حساب L1017n</span><span class="pv-header-lock" aria-hidden="true">✦</span></header>'
 +'<div class="pv-body"><div class="pv-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="35" height="35" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10.5 18h3"/></svg></div>'
 +'<p class="pv-phase">الخطوة الأولى • إدخال الهاتف</p><h1 class="pv-heading" id="phoneWizardHeading">توثيق رقم الهاتف</h1>'
 +'<p class="pv-lead">ثبّت ملكية رقمك برسالة SMS لحماية حسابك وطلبات الشراء.</p>'
 +'<div class="pv-phone"><label for="pvWizardNumber">اكتب رقم تلفونك</label><div class="pv-input-row"><span dir="ltr">+218</span><input class="pv-number" id="pvWizardNumber" type="tel" autocomplete="tel-national" inputmode="tel" dir="ltr" placeholder="09xxxxxxxx" maxlength="15"/></div><p class="pv-hint">اكتب رقم ليبيانا أو المدار الذي تملكه.</p><button type="button" class="pv-action pv-send">إرسال رمز التحقق</button></div>'
 +'<div class="pv-code" hidden><p class="pv-sent">تم طلب إرسال رمز إلى <b class="pv-code-number" dir="ltr"></b></p><form class="pv-verify"><label for="pvWizardCode">رمز التحقق من SMS</label><input id="pvWizardCode" class="pv-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required dir="ltr"/><button class="pv-action pv-check" type="submit">تأكيد الرمز</button></form><p class="pv-code-tip">الرمز صالح 5 دقائق. لا تشاركه مع أي شخص.</p><button type="button" class="pv-resend" disabled>إعادة إرسال الرمز بعد 04:00</button></div>'
 +'<div class="pv-done" hidden><span class="pv-done-icon" aria-hidden="true">✓</span><h3>تم توثيق رقمك</h3><p>الرقم <b class="pv-verified-number" dir="ltr"></b> موثّق بنجاح.</p><button type="button" class="pv-action pv-finish">العودة إلى حسابي</button></div>'
 +'<div class="pv-wait"><div class="pv-wait-row"><span>إعادة إرسال الرمز</span><strong class="pv-time" dir="ltr">04:00</strong></div><div class="pv-bar"><i class="pv-bar-fill"></i></div><small>إذا لم تصلك الرسالة، يمكنك طلب رمز آخر بعد انتهاء العدّاد.</small></div>'
 +'<p class="pv-status" role="status" aria-live="polite"></p><p class="pv-security">رمز التحقق خاص بك. لن نطلب كلمة المرور أو رمز SMS في المحادثة.</p>'
 +'</div></div>';
 document.body.appendChild(panel);
 $(".pv-back").addEventListener("click",close);
 $(".pv-finish").addEventListener("click",close);
 $(".pv-send").addEventListener("click",send);
 $(".pv-resend").addEventListener("click",send);
 $(".pv-verify").addEventListener("submit",verify);
 panel.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
}
function open(){
 focusBefore=document.activeElement;create();stop();until=0;saved="";locked=false;busy=false;
 const seq=++opened;panel.hidden=false;panel.classList.add("visible");document.body.classList.add("phone-wizard-open");
 step("phone");$(".pv-number").readOnly=false;$(".pv-number").value="";$(".pv-code-input").value="";
 progress(0);status("جاري فحص حالة الرقم…");$(".pv-back").focus({preventScroll:true});
 void load(seq);
}
window.openPhoneVerificationPage=open;
window.closePhoneVerificationPage=close;
})();