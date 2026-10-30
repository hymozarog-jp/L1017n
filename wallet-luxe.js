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
  +'<h2 id="walletSendTitle">إرسال رصيد</h2>'
  +'<p class="wallet-sheet-lead">واجهة إرسال بتصميم جديد وتجربة أبسط لعمليات المحفظة.</p>'
  +'<div class="wallet-feature-unavailable">'+caution+'<span><strong>خدمة الإرسال قريبًا</strong> — ما زالت غير مفعّلة. هذه الواجهة للمعاينة فقط ولن يتم إرسال أو خصم أي مبلغ.</span></div>'
  +'<form id="walletSendPreviewForm" novalidate>'
    +'<div><label for="walletSendRecipient">رقم هاتف المستلم</label><input id="walletSendRecipient" name="recipient" type="tel" inputmode="tel" autocomplete="off" maxlength="18" placeholder="09xxxxxxxx" dir="ltr" required></div>'
    +'<div><label for="walletSendAmount">المبلغ المطلوب (د.ل)</label><div class="wallet-sheet-money"><input id="walletSendAmount" name="amount" type="number" inputmode="decimal" min="0.001" step="0.001" max="10000" placeholder="0.000" dir="ltr" required><span>د.ل</span></div></div>'
    +'<button type="submit" class="wallet-sheet-submit">معاينة الإرسال</button>'
    +'<p class="wallet-sheet-result" id="walletSendPreviewResult" role="status" aria-live="polite"></p>'
  +'</form>'
  +'<p class="wallet-sheet-foot">ستتوفر عملية الإرسال الفعلية عند تفعيل نظام تحويل آمن. لا يوجد تحويل تلقائي حاليًا.</p>'
 +'</div>';
 document.body.appendChild(sheet);
 sheet.querySelector(".wallet-sheet-close").addEventListener("click",close);
 sheet.addEventListener("click",event=>{if(event.target===sheet)close()});
 sheet.addEventListener("keydown",event=>{
  if(event.key==="Escape"){event.preventDefault();close();return}
  if(event.key==="Tab"){
   const items=[...sheet.querySelectorAll("button:not(:disabled),input:not(:disabled)")];
   if(!items.length)return;
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
 });
 sheet.querySelector("form").addEventListener("submit",event=>{
  event.preventDefault();
  const target=sheet.querySelector("#walletSendPreviewResult");
  const digits=String(sheet.querySelector("#walletSendRecipient").value||"").replace(/\D/g,"");
  const amount=Number(sheet.querySelector("#walletSendAmount").value);
  const validPhone=/^(?:0?9[1-4]\d{7}|2189[1-4]\d{7})$/.test(digits);
  if(!validPhone){target.textContent="اكتب رقم هاتف ليبي صحيح: 09xxxxxxxx.";sheet.querySelector("#walletSendRecipient").focus();return}
  if(!Number.isFinite(amount)||amount<=0||amount>10000){target.textContent="اكتب مبلغًا صحيحًا أكبر من صفر.";sheet.querySelector("#walletSendAmount").focus();return}
  target.textContent="المعاينة جاهزة، لكن إرسال الرصيد غير متاح حاليًا. لن يتم خصم أي مبلغ من المحفظة.";
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
function activate(){
 bindCandyCard();
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
 const gain=el.closest(".wallet-hero")?.querySelector(".wallet-candy-gain");if(gain)gain.textContent="";
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
 const card=el.closest('.wallet-hero');
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
