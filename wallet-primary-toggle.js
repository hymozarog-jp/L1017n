/* The selected carrier controls the catalog and the server-side checkout. */
(function(){
 "use strict";
 const choices=["libyana","madar"];
 const names={libyana:"ليبيانا",madar:"المدار"};
 let identity=null;
 let selected={libyana:false,madar:false};
 let updateCounter=0;
 let saving=false;
 let loadRetryCount=0;
 let authListening=false;
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
  document.body.dataset.checkoutWallet=getSelected()==="madar"?"almadar":"libyana";
  choices.forEach(name=>{
   const button=document.querySelector('[data-wallet-primary="'+name+'"]');
   if(button){
    button.disabled=saving;
    const active=selected[name]===true;
    button.setAttribute("aria-pressed",String(active));
    button.innerHTML=active?'<svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-check"></use></svg> الأساسية':'اجعلها أساسية';
    button.setAttribute("aria-label",(active?"إلغاء الأساسية عن ":"تعيين ")+"محفظة "+names[name]+(active?"":" كأساسية"));
    button.title=active?"محفظة "+names[name]+" هي الأساسية حاليًا — اضغط لإلغاء الاختيار":"اجعل محفظة "+names[name]+" أساسية بدل المحفظة الأخرى";
   }
   const card=cardByName(name);
   if(card)card.dataset.primarySelected=String(selected[name]===true);
  });
  const action=document.getElementById("walletActionPrimary");
  if(action){
   action.disabled=saving;
   const wallet=getActive(),active=selected[wallet]===true;
   action.setAttribute("aria-pressed",String(active));
   action.setAttribute("aria-label",(active?"إلغاء الأساسية عن ":"تعيين الأساسية في ")+names[wallet]);
   action.title=(active?"إلغاء":"تفعيل")+" الأساسية لمحفظة "+names[wallet];
   const caption=action.querySelector("b");
   if(caption)caption.innerHTML=active?'<svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-check"></use></svg> الأساسية':'اجعلها أساسية';
  }
 }
 function applySelection(wallet,user){
  const previous=getSelected();
  identity=user?.id||null;
  selected={libyana:wallet==="libyana",madar:wallet==="almadar"};
  if(user){
   try{window.localStorage.setItem(storageKey(),JSON.stringify(selected))}
   catch(error){console.warn("[wallet/primary/storage]",error)}
  }
  update();
  refreshTopWallet(user);
  if(previous!==getSelected())window.dispatchEvent(new Event("l1017n:checkout-wallet-changed"));
 }
 async function load(){
  if(saving)return;
  const sequence=++updateCounter;
  try{
   if(typeof currentUser!=="function"){
    // The store's legacy script is dynamically loaded after the page opens.
    if(loadRetryCount++<12)window.setTimeout(()=>void load(),350);
    return;
   }
   loadRetryCount=0;
   if(!authListening){
    supabaseClient.auth.onAuthStateChange(event=>{
     if(event==="SIGNED_IN"||event==="SIGNED_OUT")window.setTimeout(()=>void load(),0);
    });
    authListening=true;
   }
   const user=await currentUser();
   if(sequence!==updateCounter)return;
   if(!user){applySelection(null,null);return;}
   if(identity&&identity!==user.id)applySelection(null,null);
   const cached=safeRead("l1017n-primary-wallets-v1:"+user.id);
   let {data:wallet,error}=await supabaseClient.rpc("get_checkout_wallet");
   if(sequence!==updateCounter)return;
   if(error)throw error;
   if(!wallet&&(cached.madar||cached.libyana)){
    ({data:wallet,error}=await supabaseClient.rpc("set_checkout_wallet",{p_wallet:cached.madar?"almadar":"libyana",p_initialize:true}));
    if(sequence!==updateCounter)return;
    if(error)throw error;
   }
   applySelection(wallet||"libyana",user);
  }catch(error){console.warn("[wallet/primary/load]",error)}
 }
 async function toggle(name){
  if(!choices.includes(name)||saving)return;
  saving=true;
  ++updateCounter;
  update();
  try{
   if(typeof currentUser!=="function")throw new Error("not_ready");
   const user=await currentUser();
   if(!user){
    flash("سجّل دخولك باش تختار المحفظة الأساسية.");
    if(typeof switchView==="function")switchView("account");
    return;
   }
   const {data:wallet,error}=await supabaseClient.rpc("set_checkout_wallet",{p_wallet:name==="madar"?"almadar":"libyana"});
   if(error)throw error;
   applySelection(wallet,user);
   flash("الشراء الآن بمحفظة "+names[getSelected()]);
  }catch(error){
   flash("تعذر تحديث اختيار المحفظة. جرّب تحديث الصفحة.");
   console.warn("[wallet/primary/toggle]",error);
  }finally{saving=false;update();}
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
