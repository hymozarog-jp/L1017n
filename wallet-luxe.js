/* L1017n wallet luxe visual interactions.
 * No money transfers, transaction records, SMS, or wallet mutations here.
 */
(function(){
"use strict";
const reduce=()=>window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let sheet=null,lastFocus=null,sendLocked=false,activated=false,scrollRaf=0;
const lastBalances=new WeakMap();
const requests=new WeakMap();
const plane='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>';
const caution='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
function close(){
 if(!sheet||sheet.hidden)return;
 sheet.hidden=true;
 document.body.classList.remove("wallet-send-sheet-open");
 lastFocus?.focus?.({preventScroll:true});
}
function cleanPhone(value){
 const d=String(value||"").replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))
  .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[^0-9]/g,"");
 if(/^002189[0-9]{8}$/.test(d))return d.slice(5);
 if(/^2189[0-9]{8}$/.test(d))return d.slice(3);
 if(/^09[0-9]{8}$/.test(d))return d.slice(1);
 return /^9[0-9]{8}$/.test(d)?d:"";
}
function transferError(error){
 const code=String(error?.message||"");
 const messages={
  login_required:"سجّل الدخول أولاً.",
  invalid_store_phone:"رقم الهاتف غير صحيح.",
  recipient_not_verified_or_missing:"ما لقيناش محفظة موثّقة بهذا الرقم. لازم المستلم يكون مسجل وموثّق هاتفه.",
  sender_phone_not_verified:"وثّق رقم هاتفك من الحساب قبل إرسال الرصيد.",
  cannot_send_to_self:"ما تقدرش ترسل الرصيد لمحفظتك نفسها.",
  wallet_not_found:"تعذر العثور على المحفظة.",
  insufficient_balance:"رصيدك غير كافٍ لهذه العملية.",
  invalid_transfer_amount:"المبلغ لازم يكون بين 0.001 و500 دينار، وبحد أقصى 3 أرقام عشرية.",
  daily_transfer_limit:"وصلت للحد اليومي: 1000 دينار خلال 24 ساعة.",
  request_key_conflict:"حصل تعارض في طلب التحويل. افتح النموذج من جديد."
 };
 for(const [key,message] of Object.entries(messages))if(code.includes(key))return message;
 return "تعذر التأكد من نتيجة الإرسال. لا تنشئ طلبًا جديدًا؛ حاول مجددًا بنفس البيانات للتحقق من العملية.";
}
async function loadTransferHistory(){
 const list=sheet?.querySelector("#walletSendHistory");
 if(!list)return;
 list.textContent="جاري عرض آخر التحويلات…";
 try{
  const user=await currentUser();
  if(!user){list.textContent="سجّل دخولك لعرض تحويلاتك.";return}
  const {data,error}=await supabaseClient.from("wallet_transfers")
   .select("id,sender_id,recipient_id,amount,created_at")
   .or("sender_id.eq."+user.id+",recipient_id.eq."+user.id)
   .order("created_at",{ascending:false}).limit(6);
  if(error)throw error;
  list.replaceChildren();
  if(!data?.length){list.textContent="ما عندكش تحويلات حتى الآن.";return}
  data.forEach(item=>{
   const row=document.createElement("div");row.className="wallet-transfer-history-row";
   const outgoing=item.sender_id===user.id;
   const label=document.createElement("span");label.textContent=outgoing?"إرسال رصيد":"استلام رصيد";
   const amount=document.createElement("strong");amount.dir="ltr";
   amount.textContent=(outgoing?"−":"+")+Number(item.amount).toFixed(3)+" د.ل";
   amount.className=outgoing?"wallet-transfer-out":"wallet-transfer-in";
   row.append(label,amount);list.append(row);
  });
 }catch(error){
  list.textContent="تعذر تحميل التحويلات. تقدر تحاول مرة ثانية.";
  console.warn("[wallet/transfer/history]",error);
 }
}
function ensureSheet(){
 if(sheet)return sheet;
 sheet=document.createElement("section");
 sheet.id="walletSendSheet";sheet.dir="rtl";sheet.hidden=true;
 sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");
 sheet.setAttribute("aria-labelledby","walletSendTitle");
 sheet.innerHTML='<div class="wallet-sheet">'
  +'<div class="wallet-sheet-handle" aria-hidden="true"></div>'
  +'<button type="button" class="wallet-sheet-close" aria-label="إغلاق نافذة الإرسال">×</button>'
  +'<div class="wallet-sheet-emblem" aria-hidden="true">'+plane+'</div>'
  +'<h2 id="walletSendTitle">إرسال رصيد لمحفظة ثانية</h2>'
  +'<p class="wallet-sheet-lead">تحويل فوري بين محافظ المستخدمين داخل GAMEBOXLY، مش تحويل لرصيد شريحة ليبيانا.</p>'
  +'<form id="walletSendPreviewForm" novalidate>'
    +'<div><label for="walletSendRecipient">رقم هاتف المستلم الموثّق في المتجر</label><input id="walletSendRecipient" name="recipient" type="tel" inputmode="tel" autocomplete="off" maxlength="18" placeholder="09xxxxxxxx" dir="ltr" required></div>'
    +'<div><label for="walletSendAmount">المبلغ بالدينار الليبي</label><div class="wallet-sheet-money"><input id="walletSendAmount" name="amount" type="text" inputmode="decimal" maxlength="14" placeholder="0.000" dir="ltr" required><span>د.ل</span></div></div>'
    +'<div class="wallet-transfer-confirm" id="walletTransferConfirm" hidden>'
      +'<strong>راجع التحويل قبل التأكيد</strong>'
      +'<p id="walletTransferConfirmationText"></p>'
      +'<small>التحويل نهائي ويصل لمحفظة المستلم فور نجاحه. تأكد من الرقم جيدًا.</small>'
    +'</div>'
    +'<button type="submit" class="wallet-sheet-submit">مراجعة التحويل</button>'
    +'<p class="wallet-sheet-result" id="walletSendPreviewResult" role="status" aria-live="polite"></p>'
  +'</form>'
  +'<p class="wallet-sheet-foot">بدون رسوم · الحد لكل تحويل 500 د.ل · الحد خلال 24 ساعة 1000 د.ل · يشترط توثيق رقم الطرفين.</p>'
  +'<div class="wallet-transfer-history"><h3>آخر التحويلات</h3><div id="walletSendHistory" aria-live="polite"></div></div>'
 +'</div>';
 document.body.appendChild(sheet);
 const form=sheet.querySelector("form"),recipient=sheet.querySelector("#walletSendRecipient");
 const inputAmount=sheet.querySelector("#walletSendAmount");
 const button=sheet.querySelector(".wallet-sheet-submit");
 const result=sheet.querySelector("#walletSendPreviewResult");
 const confirmBox=sheet.querySelector("#walletTransferConfirm");
 const confirmText=sheet.querySelector("#walletTransferConfirmationText");
 let pending=null,busy=false;
 function clearConfirmation(){
  if(busy)return;
  pending=null;confirmBox.hidden=true;button.textContent="مراجعة التحويل";
  result.textContent="";result.classList.remove("is-success");
 }
 [recipient,inputAmount].forEach(input=>input.addEventListener("input",clearConfirmation));
 sheet.querySelector(".wallet-sheet-close").addEventListener("click",close);
 sheet.addEventListener("click",event=>{if(event.target===sheet)close()});
 sheet.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!busy){event.preventDefault();close();return}
  if(event.key==="Tab"){
   const items=[...sheet.querySelectorAll("button:not(:disabled),input:not(:disabled)")];
   if(!items.length)return;
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
 });
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(busy)return;
  const phone=cleanPhone(recipient.value);
  const raw=String(inputAmount.value||"").trim().replace(",",".")
    .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))
    .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
  const amount=Number(raw);
  if(!phone){result.textContent="اكتب رقم هاتف ليبي صحيح: 09xxxxxxxx.";recipient.focus();return}
  if(!/^[0-9]+(?:\.[0-9]{1,3})?$/.test(raw)||!Number.isFinite(amount)||amount<0.001||amount>500){
   result.textContent="اكتب مبلغًا بين 0.001 و500 د.ل، وبحد أقصى 3 خانات عشرية.";
   inputAmount.focus();return;
  }
  if(!pending||pending.phone!==phone||pending.amount!==amount){
   pending={phone,amount,key:window.crypto?.randomUUID?.()};
   if(!pending.key){result.textContent="حدّث المتصفح ثم حاول مرة ثانية لتأمين عملية الإرسال.";pending=null;return}
   confirmText.textContent="إرسال "+amount.toFixed(3)+" د.ل إلى رقم 0"+phone+" داخل المتجر.";
   confirmBox.hidden=false;button.textContent="تأكيد إرسال الرصيد";
   result.textContent="اضغط تأكيد فقط إذا كنت متأكدًا من المستلم والمبلغ.";
   return;
  }
  busy=true;
  button.disabled=true;recipient.disabled=true;inputAmount.disabled=true;
  button.textContent="جاري تحويل الرصيد…";
  result.textContent="جاري التحقق من الحساب والرصيد وتنفيذ العملية…";
  result.classList.remove("is-success");
  try{
   const user=await currentUser();
   if(!user)throw new Error("login_required");
   const {data,error}=await supabaseClient.rpc("send_wallet_balance",{
    p_recipient_phone:"0"+pending.phone,p_amount:pending.amount,p_request_key:pending.key
   });
   if(error)throw error;
   const completed=Number(data?.amount??pending.amount);
   form.reset();pending=null;confirmBox.hidden=true;
   result.textContent=(data?.already_sent?"هذه العملية مسجلة من قبل. ":"تم إرسال الرصيد بنجاح! ")
     +completed.toFixed(3)+" د.ل. رقم العملية: "+String(data?.transfer_id||"");
   result.classList.add("is-success");button.textContent="إرسال تحويل جديد";
   await Promise.allSettled([
    typeof renderWallet==="function"?renderWallet():Promise.resolve(),
    typeof renderCustomerHeaderWallet==="function"?renderCustomerHeaderWallet(user):Promise.resolve(),
    loadTransferHistory()
   ]);
  }catch(error){
   result.textContent=transferError(error);
   button.textContent="إعادة محاولة تأكيد نفس التحويل";
   console.warn("[wallet/transfer/send]",error);
  }finally{
   busy=false;button.disabled=false;recipient.disabled=false;inputAmount.disabled=false;
  }
 });
 return sheet;
}
function openSend(){
 const btn=document.getElementById("walletActionSend");
 if(!btn||sendLocked)return;
 sendLocked=true;lastFocus=btn;
 const reduced=reduce();
 btn.classList.remove("wallet-sending");
 void btn.offsetWidth; // restart transition on repeated taps
 if(!reduced)btn.classList.add("wallet-sending");
 const delay=reduced?0:650;
 window.setTimeout(()=>{
  const el=ensureSheet();
  el.hidden=false;document.body.classList.add("wallet-send-sheet-open");
  void loadTransferHistory();
  const note=el.querySelector("#walletSendPreviewResult");
  if(note)note.textContent="";
  el.querySelector(".wallet-sheet-close")?.focus({preventScroll:true});
  btn.classList.remove("wallet-sending");
  sendLocked=false;
 },delay);
}
function addRipple(button){
 if(reduce())return;
 const icon=button.querySelector(".wallet-action-icon");
 if(!icon)return;
 const ripple=document.createElement("span");
 ripple.className="wallet-tap-ripple";
 icon.appendChild(ripple);
 window.setTimeout(()=>ripple.remove(),680);
}
function focusCard(){
 const root=document.getElementById("walletView");
 if(!root||root.classList.contains("hidden"))return;
 const track=root.querySelector(".wallet-carousel");
 if(!track)return;
 const cards=[...track.children].filter(el=>el.matches(".wallet-hero,.madar-wallet-card"));
 if(!cards.length)return;
 const frame=track.getBoundingClientRect();
 const center=frame.left+frame.width/2;
 let best=-1,score=Infinity;
 cards.forEach((c,i)=>{
  const box=c.getBoundingClientRect(),diff=Math.abs((box.left+box.width/2)-center);
  if(diff<score){score=diff;best=i}
 });
 cards.forEach((c,i)=>c.classList.toggle("is-wallet-visible",i===best));
}
const cardEffects=new WeakMap();
function candyFeedback(card,event,increase){
 if(!card||reduce()||!card.animate)return;
 const old=cardEffects.get(card);if(old)old.cancel();
 const effect=card.animate(increase?[
  {filter:'brightness(1)'},{filter:'brightness(1.18)',offset:.35},{filter:'brightness(1)'}
 ]:[{translate:'0 0',scale:'1'},{translate:'0 2px',scale:'.975',offset:.28},{translate:'0 0',scale:'1'}],{duration:increase?850:420,easing:'cubic-bezier(.2,.8,.2,1)'});
 cardEffects.set(card,effect);
 card.querySelector('.wallet-candy-ripple')?.remove();
 const box=card.getBoundingClientRect(),ripple=document.createElement('span');
 ripple.className='wallet-candy-ripple';ripple.setAttribute('aria-hidden','true');
 ripple.style.left=(event?.clientX?event.clientX-box.left:box.width/2)+'px';
 ripple.style.top=(event?.clientY?event.clientY-box.top:box.height/2)+'px';card.appendChild(ripple);
 const wave=ripple.animate([{transform:'scale(0)',opacity:.55},{transform:'scale(55)',opacity:0}],{duration:700,easing:'ease-out'});
 wave.onfinish=()=>ripple.remove();
}
function bindCandyCard(){
 const card=document.querySelector('#walletView .wallet-hero');
 if(!card||card.dataset.candyReady)return;
 card.dataset.candyReady='1';card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label','محفظة ليبيانا');
 const button=document.createElement('button');button.type='button';button.className='wallet-candy-topup';button.textContent='شحن +';
 button.addEventListener('click',()=>document.getElementById('walletActionTopup')?.click());card.appendChild(button);
 const gain=document.createElement('span');gain.className='wallet-candy-gain';gain.setAttribute('role','status');gain.setAttribute('aria-live','polite');card.appendChild(gain);
 card.addEventListener('click',event=>candyFeedback(card,event,false));
 card.addEventListener('keydown',event=>{if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();candyFeedback(card,null,false)}});
}
function bindMadarCard(){
 const card=document.querySelector('#walletView .madar-wallet-card');
 if(!card||card.dataset.candyReady)return;
 card.dataset.candyReady='1';
 card.tabIndex=0;
 card.setAttribute('role','group');
 card.setAttribute('aria-label','محفظة المدار الجديد');
 card.addEventListener('click',event=>candyFeedback(card,event,false));
 card.addEventListener('keydown',event=>{
  if(event.target===card&&(event.key==='Enter'||event.key===' ')){
   event.preventDefault();candyFeedback(card,null,false);
  }
 });
}
function activate(){
 bindCandyCard();
 bindMadarCard();
 if(!activated){
  const track=document.querySelector("#walletView .wallet-carousel");
  if(track)track.addEventListener("scroll",()=>{
   if(scrollRaf)return;
   scrollRaf=requestAnimationFrame(()=>{scrollRaf=0;focusCard()});
  },{passive:true});
  document.querySelectorAll("#walletView .wallet-actions .wallet-action").forEach(btn=>{
    btn.addEventListener("click",()=>addRipple(btn),{passive:true});
  });
  activated=true;
 }
 requestAnimationFrame(focusCard);
}
function resetBalance(el){
 if(!el)return;
 const previous=requests.get(el);
 if(previous)cancelAnimationFrame(previous);
 requests.delete(el);
 lastBalances.delete(el);
 const gain=el.closest(".wallet-hero,.madar-wallet-card")?.querySelector(".wallet-candy-gain");if(gain)gain.textContent="";
 el.textContent="0.000";
 el.classList.remove("wallet-luxe-tick");
}
function animateBalance(el,amount){
 if(!el)return;
 const end=Number(amount);
 if(!Number.isFinite(end))return;
 const previous=lastBalances.get(el);
 const displayed=Number(el.textContent);
 const current=Number.isFinite(displayed)?displayed:end;
 lastBalances.set(el,end);
 const old=requests.get(el);
 if(old)cancelAnimationFrame(old);
 const card=el.closest('.wallet-hero,.madar-wallet-card');
 if(previous!==undefined&&end>previous+0.0005){
  candyFeedback(card,null,true);
  const gain=card?.querySelector('.wallet-candy-gain');
  if(gain){clearTimeout(gain._hideTimer);gain.textContent='+'+(end-previous).toFixed(3)+' د.ل';gain._hideTimer=setTimeout(()=>{gain.textContent=''},2400)}
 }
 // Initial account load is a baseline, never a top-up celebration.
 if(previous===undefined||reduce()||Math.abs(end-current)<0.0005){
  el.textContent=end.toFixed(3);
  return;
 }
 const start=performance.now(),duration=780;
 el.classList.remove("wallet-luxe-tick");
 void el.offsetWidth;
 el.classList.add("wallet-luxe-tick");
 function tick(now){
  const ratio=Math.min(1,(now-start)/duration),eased=1-Math.pow(1-ratio,3);
  el.textContent=(current+(end-current)*eased).toFixed(3);
  if(ratio<1)requests.set(el,requestAnimationFrame(tick));
  else{el.textContent=end.toFixed(3);requests.delete(el)}
 }
 requests.set(el,requestAnimationFrame(tick));
}
function start(){
 activate();
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")focusCard()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
window.L1017nWalletLuxe=Object.freeze({openSend,animateBalance,resetBalance,activate,closeSend:close});
})();
