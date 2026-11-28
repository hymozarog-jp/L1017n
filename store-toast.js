/* Shared feedback for storefront actions and startup failures. */
(function(){
 "use strict";
 let node,timer,hideTimer,frame;
 const marks={
  success:"<path d='m5 12 4 4 10-10'/>",
  error:"<path d='m7 7 10 10M17 7 7 17'/>",
  info:"<path d='M12 11v5m0-8h.01'/>"
 };
 function guessTone(message){
  const match=message.replace(/[\u064b-\u065f\u0670]/g,"");
  if(/تعذر|فشل|خطأ|غير (?:صحيح|صحيحة|متاح|جاهز|متوفر|كاف)|ما يكفي|انتهت مهلة/.test(match))return "error";
  if(/^(?:تم |تمت |نسخ )|بنجاح/.test(match))return "success";
  return "info";
 }
 function show(message,tone){
  const text=String(message||"").trim();
  if(!text||!document.body)return;
  if(!Object.hasOwn(marks,tone))tone=guessTone(text);
  if(!node){
   node=document.createElement("div");
   node.id="l1017StoreNotice";
   node.hidden=true;
   if(typeof node.showPopover==='function')node.setAttribute('popover','manual');
   node.innerHTML='<span class="store-notice-mark" aria-hidden="true"></span><span class="store-notice-text"></span>';
  }
  clearTimeout(timer);
  clearTimeout(hideTimer);
  cancelAnimationFrame(frame);
  const dialogs=document.querySelectorAll("dialog[open]");
  const host=dialogs[dialogs.length-1]||document.body;
  if(node.parentNode!==host)host.append(node);
  node.classList.remove("is-visible");
  node.dataset.tone=tone;
  node.setAttribute("role",tone==="error"?"alert":"status");
  node.querySelector(".store-notice-mark").innerHTML='<svg viewBox="0 0 24 24">'+marks[tone]+'</svg>';
  node.querySelector(".store-notice-text").textContent=text;
  node.hidden=false;
  if(node.hasAttribute("popover")&&!node.matches(":popover-open")){
   try{node.showPopover();}catch(_){node.removeAttribute("popover");}
  }
  frame=requestAnimationFrame(()=>node.classList.add("is-visible"));
  timer=setTimeout(()=>{
   node.classList.remove("is-visible");
   hideTimer=setTimeout(()=>{
    if(node.hasAttribute("popover")&&node.matches(":popover-open"))node.hidePopover();
    node.hidden=true;
   },220);
  },tone==="error"?4300:3100);
 }
 window.L1017nToast=Object.freeze({show});
})();
