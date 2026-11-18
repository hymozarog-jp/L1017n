/* Contact phone registration for account and wallet. */
(function(){
"use strict";
let panel=null,opened=0,focusBefore=null,primaryPhone="";
const $=q=>panel?.querySelector(q);
function normalize(v){let s=String(v||"").replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/\D/g,"");if(s.startsWith("00218"))s=s.slice(5);else if(s.startsWith("218"))s=s.slice(3);if(s.startsWith("0"))s=s.slice(1);return /^9[1-4][0-9]{7}$/.test(s)?s:""}
function status(s,error=false){const x=$(".pv-status");if(x){x.textContent=s;x.dataset.error=String(error)}}
function client(){return typeof supabaseClient==="undefined"?null:supabaseClient}
async function loadRegistration(seq){
 const form=$(".pv-registration");
 const input=form.querySelector("input");
 const submit=form.querySelector("button");
 input.value="";input.disabled=submit.disabled=true;
 primaryPhone="";$(".pv-saved-phones").replaceChildren();
 status("جاري تحميل الرقم…");
 try {
  const c=client();if(!c)throw Error("الصفحة غير جاهزة. حاول تحديثها.");
  const {data:{session}}=await c.auth.getSession();
  if(seq!==opened)return;
  if(!session)throw Error("سجّل دخولك من «حسابي» أولًا.");
  const {data,error}=await c.from("wallet_accounts").select("libyana_phone").eq("user_id",session.user.id).maybeSingle();
  if(seq!==opened)return;
  if(error)throw Error("تعذر تحميل الرقم. حاول مرة ثانية.");
  primaryPhone=normalize(data?.libyana_phone);
  $(".pv-registration label").textContent=primaryPhone?"إضافة رقم آخر":"إضافة رقم الهاتف";
  const saved=await c.rpc("get_my_saved_sender_phones");
  if(seq!==opened)return;
  if(saved.error)throw Error("تعذر تحميل الأرقام المحفوظة.");
  const list=$(".pv-saved-phones");
  const phones=Array.isArray(saved.data)?saved.data:[];
  for(const item of phones){
   const row=document.createElement("li");
   const number=document.createElement("bdi");number.dir="ltr";number.textContent=item.phone;
   const remove=document.createElement("button");remove.type="button";
   remove.textContent="حذف";remove.setAttribute("aria-label","حذف الرقم "+item.phone);
   remove.addEventListener("click",()=>deletePhone(item.phone,remove));
   const details=document.createElement("div");details.className="pv-number-details";
   const label=document.createElement("span");label.className="pv-number-label";
   label.textContent=item.primary?"الرقم الأساسي":"رقم إضافي";
   if(item.primary)row.classList.add("pv-primary-number");
   remove.className="pv-remove";
   details.append(label,number);
   row.append(details,remove);
   list.appendChild(row);
  }
  const full=!!primaryPhone&&phones.length>=3;
  input.disabled=submit.disabled=full;
  status(full?"حفظت الحد الأقصى من الأرقام لهذا الحساب.":"");
 }catch(e){if(seq===opened)status(e.message,true)}
}
async function registerPhone(event){
 event.preventDefault();
 const form=event.currentTarget,input=form.querySelector("input"),submit=form.querySelector("button");
 if(submit.disabled)return;
 const phone=normalize(input.value);
 if(!phone){status("اكتب رقمًا ليبيًا صحيحًا يبدأ بـ09 (10 أرقام).",true);input.focus();return}
 const seq=opened;
 input.disabled=submit.disabled=true;
 status("جاري حفظ الرقم…");
 try {
  const rpc=primaryPhone?"save_my_additional_contact_phone":"save_my_libyana_phone";
  const {data,error}=await client().rpc(rpc,{p_phone:phone});
  if(seq!==opened)return;
  if(error?.code==="23505")throw Error("هذا الرقم مستخدم في الموقع. أدخل رقمًا ثانيًا.");
  if(error||data!==phone)throw Error("تعذر حفظ الرقم. حاول مرة ثانية.");
  await loadRegistration(seq);
  if(seq!==opened)return;
  if(!$(".pv-status").dataset.error || $(".pv-status").dataset.error==="false")status("تم حفظ الرقم بنجاح.");
  window.dispatchEvent(new Event("l1017n:account-phones-updated"));
  if(typeof renderAccount==="function")void Promise.resolve(renderAccount()).catch(()=>{});
 }catch(e){if(seq===opened){input.disabled=submit.disabled=false;status(e.message,true)}}
}

async function deletePhone(phone,button){
 if(!window.confirm("تحب تحذف الرقم من حسابك؟"))return;
 const seq=opened;button.disabled=true;
 try {
  const {data,error}=await client().rpc("delete_my_saved_contact_phone",{p_phone:phone});
  if(seq!==opened)return;
  if(error?.message?.includes("contact_phone_pending_topup"))throw Error("فيه طلب شحن قيد المتابعة من هذا الرقم. حاول بعد انتهاء الطلب.");
  if(error||data!==true)throw Error("تعذر حذف الرقم. حاول مرة ثانية.");
  await loadRegistration(seq);
  if(seq!==opened)return;
  if($(".pv-status").dataset.error==="false")status("تم حذف الرقم.");
  window.dispatchEvent(new Event("l1017n:account-phones-updated"));
  if(typeof renderAccount==="function")void Promise.resolve(renderAccount()).catch(()=>{});
 }catch(e){if(seq===opened){button.disabled=false;status(e.message,true)}}
}
function close(){
 if(!panel?.classList.contains("visible"))return;
 opened++;
 panel.hidden=true;panel.classList.remove("visible");
 document.body.classList.remove("phone-wizard-open");
 focusBefore?.focus?.({preventScroll:true});
}
function create(){
 if(panel)return;
 panel=document.createElement("section");
 panel.id="phoneVerifyWizard";panel.hidden=true;panel.dir="rtl";
 panel.setAttribute("role","dialog");
 panel.setAttribute("aria-modal","true");
 panel.setAttribute("aria-labelledby","phoneWizardHeading");
 panel.innerHTML='<div class="pv-shell"><header class="pv-header"><button type="button" class="pv-back" aria-label="رجوع"><span aria-hidden="true">→</span></button><span>حساب L1017n</span></header><div class="pv-body"><h1 class="pv-heading" id="phoneWizardHeading">أرقام الهاتف</h1><ul class="pv-saved-phones" aria-label="الأرقام المحفوظة"></ul><form class="pv-registration"><label for="pvRegisterNumber">إضافة رقم الهاتف</label><div class="pv-input-row"><span dir="ltr">+218</span><input id="pvRegisterNumber" type="tel" autocomplete="tel-national" inputmode="tel" dir="ltr" placeholder="09xxxxxxxx" maxlength="15" required></div><button type="submit" class="pv-action">حفظ الرقم</button></form><p class="pv-status" role="status" aria-live="polite"></p></div></div>';
 document.body.appendChild(panel);
 $(".pv-registration").addEventListener("submit",registerPhone);
 $(".pv-back").addEventListener("click",close);
 panel.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
}
function open(){
 focusBefore=document.activeElement;create();
 const seq=++opened;panel.hidden=false;panel.classList.add("visible");
 document.body.classList.add("phone-wizard-open");
 $(".pv-back").focus({preventScroll:true});void loadRegistration(seq);
}
window.openPhoneRegistrationPage=open;
window.openPhoneVerificationPage=open;
window.openAccountPhonesPage=open;
window.openPhoneChangePage=open;
window.closePhoneVerificationPage=close;
window.closePhoneChangePage=close;
})();