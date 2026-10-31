/* Primary badges for each swipeable carrier wallet.
   Display preference only. Never modifies wallet_accounts, ledger or checkout. */
(function(){
 "use strict";
 const choices=["libyana","madar"];
 const names={libyana:"ليبيانا",madar:"المدار"};
 let identity=null;
 let selected={libyana:false,madar:false};
 let updateCounter=0;
 const cardByName=name=>document.querySelector(name==="libyana"?"#walletView .wallet-carousel>.wallet-hero":"#walletView .wallet-carousel>.madar-wallet-card");
 const track=()=>document.querySelector("#walletView .wallet-carousel");
 function getActive(){
  const list=choices.map(name=>({name,el:cardByName(name)})).filter(item=>item.el);
  if(!list.length)return "libyana";
  if(!track())return "libyana";
  const frame=track().getBoundingClientRect();
  const middle=frame.left+frame.width/2;
  list.sort((a,b)=>{
   const ra=a.el.getBoundingClientRect(),rb=b.el.getBoundingClientRect();
   const da=Math.abs((ra.left+ra.right)/2-middle);
   const db=Math.abs((rb.left+rb.right)/2-middle);
   return da-db;
  });
  return list[0].name;
 }
 function safeRead(key){
  try {
   const value=JSON.parse(window.localStorage.getItem(key)||"{}");
   return {libyana:value?.libyana===true,madar:value?.madar===true};
  }catch(_){return {libyana:false,madar:false}}
 }
 function storageKey(){return identity?"l1017n-primary-wallets-v1:"+identity:null}
 function flash(message){
  try{if(typeof toast==="function")toast(message)}catch(_){}
 }
 function update(){
  choices.forEach(name=>{
   const button=document.querySelector('[data-wallet-primary="'+name+'"]');
   if(button){
    const active=selected[name]===true;
    button.setAttribute("aria-pressed",String(active));
    button.textContent=active?"الأساسية ✓":"الأساسية";
    button.title=(active?"إلغاء اختيار":"تعيين")+" محفظة "+names[name]+" كأساسية في العرض";
   }
   const card=cardByName(name);
   if(card)card.dataset.primarySelected=String(selected[name]===true);
  });
  const action=document.getElementById("walletActionPrimary");
  if(action){
   const wallet=getActive(),active=selected[wallet]===true;
   action.setAttribute("aria-pressed",String(active));
   action.setAttribute("aria-label",(active?"إلغاء الأساسية عن ":"تعيين الأساسية في ")+names[wallet]);
   action.title=(active?"إلغاء":"تفعيل")+" الأساسية لمحفظة "+names[wallet];
  }
 }
 async function load(){
  const sequence=++updateCounter;
  try{
   if(typeof currentUser!=="function")return;
   const user=await currentUser();
   if(sequence!==updateCounter)return;
   identity=user?.id||null;
   selected=identity?safeRead(storageKey()):{libyana:false,madar:false};
   update();
  }catch(error){console.warn("[wallet/primary/load]",error)}
 }
 async function toggle(name){
  if(!choices.includes(name))return;
  try{
   if(typeof currentUser!=="function")throw new Error("not_ready");
   const user=await currentUser();
   if(!user){
    flash("سجّل دخولك باش تختار المحفظة الأساسية.");
    if(typeof switchView==="function")switchView("account");
    return;
   }
   if(identity!==user.id){
    identity=user.id;
    selected=safeRead(storageKey());
   }
   selected[name]=!selected[name];
   try{window.localStorage.setItem(storageKey(),JSON.stringify(selected))}
   catch(error){console.warn("[wallet/primary/storage]",error)}
   update();
   flash(selected[name]?"تم تعيين محفظة "+names[name]+" كأساسية في العرض":"تم إلغاء الأساسية عن محفظة "+names[name]);
  }catch(error){
   flash("تعذر تحديث اختيار المحفظة. جرّب تحديث الصفحة.");
   console.warn("[wallet/primary/toggle]",error);
  }
 }
 function bind(){
  const carousel=track();
  if(carousel){
   carousel.addEventListener("scroll",update,{passive:true});
  }
  document.addEventListener("click",event=>{
   const walletButton=event.target.closest("[data-wallet-primary]");
   if(walletButton){
    event.preventDefault();
    event.stopPropagation();
    void toggle(walletButton.dataset.walletPrimary);
    return;
   }
   if(event.target.closest("#walletActionPrimary")){
    event.preventDefault();
    void toggle(getActive());
    return;
   }
   if(event.target.closest('[data-view="wallet"],[data-ll-nav="wallet"]')){
    window.setTimeout(()=>void load(),0);
   }
  });
  document.addEventListener("visibilitychange",()=>{
   if(!document.hidden)void load();
  });
  window.addEventListener("pageshow",()=>void load());
  update();
  void load();
 }
 if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",bind,{once:true});
 }else bind();
 window.L1017nPrimaryWallets=Object.freeze({refresh:load});
})();
