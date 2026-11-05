/* L1017n protected voucher review. This UI never grants privileges;
   server validates the authenticated user against both admin registries.
   Full codes are requested only after an explicit click and never cached. */
(function(){
"use strict";
let page=null,adminUserId="",statusSeq=0,busy=false,revealTimer=null,revealed=null;
const $=s=>page?.querySelector(s);
const details=s=>{const p=document.createElement("p");p.textContent=s;return p};
const API="l1017n-card-admin";
const states={pending:"قيد المراجعة",approved:"مقبول",rejected:"مرفوض"};
const errors={
  forbidden:"هذه الصفحة خاصة بمسؤول المتجر المعتمد فقط.",
  unauthorized:"انتهت جلسة الدخول. أعد تسجيل الدخول.",
  decryption_unavailable:"تعذر فك تشفير الكروت حاليًا. راجع مفاتيح الخدمة.",
  reveal_rate_limit:"عدد عمليات إظهار الكروت كبير. حاول لاحقًا.",
  audit_unavailable:"تعذر حفظ سجل الاطلاع؛ لن تظهر الأرقام.",
  database_unavailable:"تعذر قراءة طلبات الكروت. حاول تحديث الصفحة."
};
function message(text,isError=false){const node=$(".ca-message");if(node){node.textContent=text;node.dataset.error=String(isError)}}
async function invoke(action,extra={}){
 const db=typeof supabaseClient!=="undefined"?supabaseClient:null;
 if(!db)throw Error("المتجر غير جاهز.");
 const {data,error}=await db.functions.invoke(API,{body:{action,...extra}});
 if(error){
   let response={};try{response=await error.context?.json()||{}}catch(_){}
   const reason=String(response.error||"database_unavailable");
   throw Error(errors[reason]||"تعذّر إكمال الطلب.");
 }
 return data||{};
}
function setVisible(allowed){
 const button=document.getElementById("accountCardAdminButton");
 if(button)button.hidden=!allowed;
 if(!allowed&&page?.classList.contains("visible"))close();
}
async function sync(user){
 const seq=++statusSeq;
 if(!user?.id){adminUserId="";setVisible(false);return}
 if(adminUserId===user.id){setVisible(true);return}
 setVisible(false);
 try{
   const result=await invoke("status");
   if(seq!==statusSeq)return;
   adminUserId=result.is_admin===true?user.id:"";
   setVisible(result.is_admin===true);
 }catch{if(seq===statusSeq){adminUserId="";setVisible(false)}}
}
function hideCodes(){
 if(revealTimer){clearTimeout(revealTimer);revealTimer=null}
 if(revealed){
   const slot=revealed.querySelector(".ca-revealed");
   if(slot){slot.replaceChildren();slot.hidden=true}
   const show=revealed.querySelector(".ca-reveal");
   if(show)show.textContent="عرض أرقام الكروت";
 }
 revealed=null;
}
function close(){
 hideCodes();
 if(page){page.classList.remove("visible");page.hidden=true;page.querySelector(".ca-list")?.replaceChildren()}
 document.body.classList.remove("card-admin-open");
}
function buildRequest(item){
 const card=document.createElement("article");card.className="ca-request";
 const head=document.createElement("div");head.className="ca-request-head";
 const name=document.createElement("strong");name.textContent="طلب #"+String(item.id).slice(0,8).toUpperCase();
 const status=document.createElement("span");status.className="ca-status "+String(item.status||"");
 status.textContent=states[item.status]||item.status||"غير معروف";
 head.append(name,status);
 const details=document.createElement("p");details.className="ca-meta";
 const time=new Date(item.created_at);
 details.textContent=Number(item.amount).toFixed(2)+" د.ل · "+(Number.isNaN(time.getTime())?"":time.toLocaleString("ar-LY",{timeZone:"Africa/Tripoli"}));
 const list=document.createElement("div");list.className="ca-masked";
 for(const c of item.cards||[]){
   const row=document.createElement("div");
   row.textContent="الكرت "+c.position+" — "+Number(c.amount).toFixed(2)+" د.ل — ••••"+c.last4+
     (c.recoverable?"":" (قديم: الرقم الكامل غير محفوظ)");
   list.appendChild(row);
 }
 const button=document.createElement("button");button.type="button";button.className="ca-reveal";
 button.textContent="عرض أرقام الكروت";
 const secret=document.createElement("div");secret.className="ca-revealed";secret.hidden=true;
 button.addEventListener("click",async()=>{
   if(busy)return;
   if(!secret.hidden){hideCodes();return}
   hideCodes();busy=true;button.disabled=true;button.textContent="التحقق من الصلاحيات…";
   try{
     const data=await invoke("reveal",{request_id:item.id});
     if(!page?.classList.contains("visible"))return;
     secret.replaceChildren();
     for(const c of data.cards||[]){
       const row=document.createElement("div");row.className="ca-secret-line";
       const label=document.createElement("small");label.textContent="كرت "+c.position+" — "+Number(c.amount).toFixed(2)+" د.ل";
       const code=document.createElement("b");code.dir="ltr";code.textContent=c.code||"لم يُحفظ الرقم الكامل لهذا الكرت القديم";
       row.append(label,code);secret.appendChild(row);
     }
     secret.hidden=false;revealed=card;button.textContent="إخفاء الأرقام";
     message("هذه الأرقام سرية. لا تشاركها ولا تترك الصفحة مفتوحة.");
     revealTimer=setTimeout(hideCodes,45000);
   }catch(e){message(e.message||"تعذّر إظهار الأرقام.",true)}
   finally{busy=false;button.disabled=false;if(secret.hidden)button.textContent="عرض أرقام الكروت"}
 });
 card.append(head,details,list,button,secret);
 return card;
}
async function refresh(){
 if(busy)return;
 hideCodes();busy=true;message("جاري تحميل طلبات الكروت…");
 const list=$(".ca-list");list.replaceChildren();
 try{
   const data=await invoke("list");
   if(!page?.classList.contains("visible"))return;
   for(const item of data.requests||[])list.appendChild(buildRequest(item));
   if(!(data.requests||[]).length)list.append(details("ما فيش طلبات شحن بالكروت حتى الآن."));
   message("طلبات الكروت للمراجعة فقط. اعتماد الرصيد يتم من تيليجرام بعد التأكد من الكروت.");
 }catch(e){message(e.message||"تعذر فتح لوحة الكروت.",true)}
 finally{busy=false}
}
function create(){
 if(page)return;
 page=document.createElement("section");page.id="cardTopupAdminPage";page.hidden=true;page.dir="rtl";
 page.setAttribute("role","dialog");page.setAttribute("aria-modal","true");page.setAttribute("aria-labelledby","cardAdminHeading");
 page.innerHTML='<div class="ca-shell"><header class="ca-head"><button type="button" class="ca-back">رجوع</button><span>إدارة الكروت · L1017n</span><span class="ca-lock">خاص بالإدارة</span></header>'+
 '<h1 id="cardAdminHeading">طلبات شحن الكروت</h1><p class="ca-intro">شاهد الكروت المقدّمة من الزبائن بعد تسجيل الدخول بحساب الإدارة المعتمد. يُسجّل كل طلب لعرض الأرقام ويُخفيها تلقائيًا.</p>'+
 '<button type="button" class="ca-refresh">تحديث الطلبات</button><div class="ca-list"></div><p class="ca-message" role="status" aria-live="polite"></p></div>';
 document.body.appendChild(page);
 $(".ca-back").addEventListener("click",close);
 $(".ca-refresh").addEventListener("click",refresh);
 page.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
}
async function open(){
 if(!adminUserId)return;
 create();page.hidden=false;page.classList.add("visible");document.body.classList.add("card-admin-open");
 await refresh();
}
document.addEventListener("visibilitychange",()=>{if(document.hidden)hideCodes()});
document.addEventListener("click",e=>{
 if(!e.target.closest("#accountCardAdminButton"))return;
 e.preventDefault();void open();
});
window.L1017nCardTopupAdmin={sync,open};
})();