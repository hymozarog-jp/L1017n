/* Customer-initiated quote requests. The store does not charge on this form. */
(function(){
 "use strict";
 const dialog=document.getElementById("tiktokQuote");
 const form=document.getElementById("tiktokQuoteForm");
 if(!dialog||!form)return;
 const service=form.elements.namedItem("service");
 const link=form.elements.namedItem("link");
 const quantity=form.elements.namedItem("quantity");
 const label=document.getElementById("tiktokQuoteLinkLabel");
 const notice=form.querySelector(".tiktok-quote-error");
 const target=document.querySelector(".account-support-link.support-whatsapp");
 let opener;
 function getTikTokLink(raw,profile){
   let url;
   try{url=new URL(raw);}catch(_){return null;}
   if(url.protocol!=="https:"||url.username||url.password||url.port)return null;
   if(!["tiktok.com","www.tiktok.com","m.tiktok.com","vm.tiktok.com","vt.tiktok.com"].includes(url.hostname))return null;
   const path=url.pathname;
   const shortLink=/^(vm|vt)\.tiktok\.com$/.test(url.hostname)&&/^\/[A-Za-z0-9]+\/?$/.test(path);
   const video=/^\/@[\w.]+\/(video|photo)\/\d+\/?$/.test(path)||/^\/t\/[A-Za-z0-9]+\/?$/.test(path);
   const account=/^\/@[\w.]+\/?$/.test(path);
   if(!shortLink&&!(profile?account:video))return null;
   url.search="";
   url.hash="";
   return url.href;
 }
 document.addEventListener("click",event=>{
   const button=event.target.closest("[data-open-tiktok-quote]");
   if(!button)return;
   opener=button;
   notice.textContent="";
   if(!dialog.open)dialog.showModal();
 });
 dialog.querySelector("[data-close-tiktok-quote]").addEventListener("click",()=>dialog.close());
 dialog.addEventListener("close",()=>opener?.focus());
 service.addEventListener("change",()=>{
   label.textContent=service.value==="متابعين"?"رابط الحساب":"رابط الفيديو";
   notice.textContent="";
 });
 link.addEventListener("input",()=>{notice.textContent="";});
 form.addEventListener("submit",event=>{
   event.preventDefault();
   const profile=service.value==="متابعين";
   const url=getTikTokLink(link.value.trim(),profile);
   if(!url){
     notice.textContent=profile?"حط رابط حساب تيك توك الصحيح.":"حط رابط فيديو تيك توك الصحيح.";
     link.focus();
     return;
   }
   if(!target?.href){notice.textContent="واتساب الدعم غير متاح حاليًا.";return;}
   const chat=new URL(target.href);
   chat.searchParams.set("text",[
     "السلام عليكم، نبي تسعيرة رشق تيك توك من متجر L1017n.",
     "الخدمة: "+service.value,
     "الكمية: "+quantity.valueAsNumber,
     "الرابط: "+url
   ].join("\n"));
   window.location.assign(chat.href);
 });
})();
