/* Primary badges for each swipeable carrier wallet.
   Display preference only. Never modifies wallet_accounts, ledger or checkout. */
(function(){
 "use strict";
 const choices=["libyana","madar"];
 const names={libyana:"ليبيانا",madar:"المدار"};
 let identity=null;
 let selected={libyana:false,madar:false};
 let updateCounter=0;
 let toggleCounter=0;
 let loadRetryCount=0;
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
   // Migrate the older setting where both cards could be primary at once.
   // Choose Libyana deterministically if both were previously activated.
   const libyana=value?.libyana===true;
   const madar=value?.madar===true&&!libyana;
   return {libyana,madar};
  }catch(_){return {libyana:false,madar:false}}
 }
 function storageKey(){return identity?"l1017n-primary-wallets-v1:"+identity:null}
 function getSelected(){return selected.madar?"madar":selected.libyana?"libyana":null}
 function getSelectedFor(userId){
  if(!userId)return null;
  const preference=identity===userId?selected:safeRead("l1017n-primary-wallets-v1:"+userId);
  return preference.madar?"madar":preference.libyana?"libyana":null;
 }
 function refreshTopWallet(user){
  // The main header must match the selected logo and its actual carrier balance.
  if(typeof renderCustomerHeaderWallet==="function"){
   void renderCustomerHeaderWallet(user);
  }
 }
 function flash(message){
  try{if(typeof toast==="function")toast(message)}catch(_){}
 }
 function update(){
  choices.forEach(name=>{
   const button=document.querySelector('[data-wallet-primary="'+name+'"]');
   if(button){
    const active=selected[name]===true;
    button.setAttribute("aria-pressed",String(active));
    button.textContent=active?"✓ الأساسية":"اجعلها أساسية";
    button.setAttribute("aria-label",(active?"إلغاء الأساسية عن ":"تعيين ")+"محفظة "+names[name]+(active?"":" كأساسية"));
    button.title=active?"محفظة "+names[name]+" هي الأساسية حاليًا — اضغط لإلغاء الاختيار":"اجعل محفظة "+names[name]+" أساسية بدل المحفظة الأخرى";
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
   const caption=action.querySelector("b");
   if(caption)caption.textContent=active?"✓ الأساسية":"اجعلها أساسية";
  }
 }
 async function load(){
  const sequence=++updateCounter;
  try{
   if(typeof currentUser!=="function"){
    // The store's legacy script is dynamically loaded after the page opens.
    if(loadRetryCount++<12)window.setTimeout(()=>void load(),350);
    return;
   }
   loadRetryCount=0;
   const user=await currentUser();
   if(sequence!==updateCounter)return;
   identity=user?.id||null;
   selected=identity?safeRead(storageKey()):{libyana:false,madar:false};
   // Repair preferences saved by the prior version that allowed both selected.
   if(identity){
    try{window.localStorage.setItem(storageKey(),JSON.stringify(selected))}
    catch(error){console.warn("[wallet/primary/storage]",error)}
   }
   update();
   refreshTopWallet(user);
  }catch(error){console.warn("[wallet/primary/load]",error)}
 }
 async function toggle(name){
  if(!choices.includes(name))return;
  const sequence=++toggleCounter;
  try{
   if(typeof currentUser!=="function")throw new Error("not_ready");
   const user=await currentUser();
   if(sequence!==toggleCounter)return;
   if(!user){
    flash("سجّل دخولك باش تختار المحفظة الأساسية.");
    if(typeof switchView==="function")switchView("account");
    return;
   }
   if(identity!==user.id){
    identity=user.id;
    selected=safeRead(storageKey());
   }
   // Exactly one active wallet, or none if the active one is tapped again.
   // Switching wallets never affects their money or payment functions.
   const activate=!selected[name];
   selected={libyana:activate&&name==="libyana",madar:activate&&name==="madar"};
   ++updateCounter; // Reject a previously started load that could restore stale state.
   try{window.localStorage.setItem(storageKey(),JSON.stringify(selected))}
   catch(error){console.warn("[wallet/primary/storage]",error)}
   update();
   refreshTopWallet(user);
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
 window.L1017nPrimaryWallets=Object.freeze({refresh:load,getSelected,getSelectedFor});
})();
