/* L1017n favorites: star exactly beside package Buy / Out of Stock actions.
   Local to this browser; no order creation, balance changes or product mutation. */
(function(){
  "use strict";
  if(window.L1017nPackageFavoritesLoaded)return;
  window.L1017nPackageFavoritesLoaded=true;
  const STORE_KEY="l1017n.package-favorites.v1";
  const DETAILS_KEY=STORE_KEY+".details";
  const rules=[
    {selector:"#robuxModal .package-grid .robux-package",kind:"robux",mode:"shell"},
    {selector:"#psnStoreScreen .psn-products .psn-product",kind:"psn",mode:"shell"},
    {selector:"#robloxGamePage .ox-catalog-grid .ox-product",kind:"roblox-codes",mode:"shell"},
    {selector:"#robloxGamePage .rgp-package",kind:"mm2",mode:"shell"},
    {selector:"#pubgCategoryPage .pubg-pack-detailed",kind:"pubg",mode:"row",action:".pubg-buy"},
    {selector:"#robloxGamePage .sab-item-card",kind:"brainrot",mode:"row",action:".sab-buy"},
    {selector:"#completeSupplierCatalog .sc-product",kind:"supplier",mode:"row",action:".sc-buy"},
    {selector:"#llAvailablePackages .ll-available-card",mode:"row",action:".ll-available-buy"}
  ];
  const star='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 2.8 2.85 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.62l-5.75 3.05 1.1-6.47-4.69-4.58 6.49-.94L12 2.8Z" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  const nameSelector=".pubg-pack-name,.ox-product-info strong,.psn-product-detail strong,.sc-info h2,.sab-item-card h3,.robux-pack-copy strong,.rgp-package strong,.ll-available-copy h3";
  let favorites=new Set(),details=new Map(),dialog=null;
  try{
    const value=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");
    if(Array.isArray(value))favorites=new Set(value.filter(v=>typeof v==="string").slice(0,1500));
  }catch(error){/* Private-browsing storage may be unavailable. */}
  try{details=new Map(JSON.parse(localStorage.getItem(DETAILS_KEY)||"[]"));}catch(error){}
  function save(){
    try{
      const ids=[...favorites].slice(0,1500);
      localStorage.setItem(STORE_KEY,JSON.stringify(ids));
      localStorage.setItem(DETAILS_KEY,JSON.stringify(ids.filter(id=>details.has(id)).map(id=>[id,details.get(id)])));
    }catch(error){}
  }
  function identity(card,kind){
    const explicit=card.dataset.favId||card.dataset.robux||card.dataset.mm2Id||card.querySelector("[data-pubg-buy]")?.dataset.pubgBuy;
    if(explicit)return kind+":"+String(explicit);
    const title=card.querySelector(nameSelector)?.textContent||card.getAttribute("aria-label")||"";
    const region=card.closest("#psnStoreScreen")?.querySelector(".psn-region-title")?.textContent||
      card.closest("#completeSupplierCatalog")?.querySelector(".sc-group-title,.sc-head h1")?.textContent||"";
    const stable=(region+" "+title).normalize("NFKC").trim().replace(/\s+/g," ").slice(0,220);
    return stable?kind+":"+stable:null;
  }
  const sources={
    robux:["باقة روبوكس","game-covers/roblox-mark.svg","openRobuxPackages"],
    "roblox-codes":["كود روبلوكس","game-covers/packages/roblox-code-card-20261118.webp","openRobloxGiftCards"],
    psn:["بطاقة بلايستيشن","game-covers/mobile/psn-user-card.webp","openPsnStore"],
    pubg:["باقة ببجي","game-covers/mobile/pubg-battlefront.webp","renderPremiumPubg"],
    mm2:["باقة MM2","game-covers/official/mobile/mm2.webp","openMm2StoreCategory"],
    brainrot:["باقة ماب السرقة","game-covers/official/mobile/brainrot.webp","openBrainrotStoreCategory"],
    supplier:["باقة رقمية","game-covers/l1017n-loading-logo-20261119.jpeg"]
  };
  function artUrl(value){
    try{
      const url=new URL(value,location.href);
      const local=url.origin===location.origin&&/\/game-covers\//.test(url.pathname);
      const upload=url.origin==="https://cmtxsjlehjworqypbxjz.supabase.co"&&url.pathname.startsWith("/storage/v1/object/public/l1017n-product-images/");
      return local||upload?url.href:"";
    }catch(error){return "";}
  }
  function rememberCard(id,card){
    const title=card.querySelector(nameSelector)?.textContent?.trim()||"";
    const image=artUrl(card.querySelector("img")?.getAttribute("src")||"");
    if(title||image)details.set(id,{title:title.slice(0,220),image});
  }
  function showSavedPackages(){
    const grid=dialog.querySelector(".account-favorites-grid");
    grid.replaceChildren();
    dialog.querySelector(".account-favorites-empty").hidden=!!favorites.size;
    for(const id of favorites){
      const colon=id.indexOf(":");
      const kind=id.slice(0,colon);
      const key=id.slice(colon+1);
      const source=Object.hasOwn(sources,kind)?sources[kind]:sources.supplier;
      const supplier=window.L1017nCompleteCatalog;
      const item=["supplier","psn","pubg","roblox-codes"].includes(kind)?supplier?.productFor?.(key):null;
      const local=typeof products!=="undefined"?products.find(p=>String(p.id)===key||p.product_key===key):null;
      const saved=details.get(id);
      const name=item?.name||local?.name||saved?.title||(/^[\w-]{24,}$/.test(key)?source[0]:key)||source[0];
      const card=document.createElement("article");
      card.className="account-favorite-card";
      const image=document.createElement("img");
      image.src=artUrl(item?supplier.imageFor(item):saved?.image)||source[1];
      image.alt="";
      image.loading="lazy";
      image.addEventListener("error",()=>{image.src=source[1];},{once:true});
      const title=document.createElement("strong");
      title.textContent=name;
      const actions=document.createElement("div");
      actions.className="account-favorite-actions";
      const open=document.createElement("button");
      open.type="button";
      open.textContent=item?.available&&document.body.dataset.checkoutWallet!=="almadar"?"عرض الباقة":"فتح القسم";
      open.addEventListener("click",()=>{
        const madar=document.body.dataset.checkoutWallet==="almadar";
        const current=supplier?.productFor?.(key);
        dialog.close();
        if(current?.available&&!madar&&typeof window.openOmnexProductCheckout==="function"){
          window.openOmnexProductCheckout({...current,region:current.group||current.category_name});
        }else if(kind==="supplier"&&!madar&&supplier){
          supplier.open(current?.category_id||null);
        }else if(source[2]&&typeof window[source[2]]==="function"){
          window[source[2]]();
        }else if(typeof switchView==="function"){
          switchView("home");
        }
      });
      const remove=makeStar(id);
      actions.append(open,remove);
      card.append(image,title,actions);
      grid.append(card);
    }
    refresh();
  }
  function openFavorites(){
    if(!dialog){
      dialog=document.createElement("dialog");
      dialog.className="account-favorites-dialog";
      dialog.dir="rtl";
      dialog.setAttribute("aria-labelledby","accountFavoritesTitle");
      dialog.innerHTML='<header><h2 id="accountFavoritesTitle">المفضلة</h2><button type="button" aria-label="إغلاق المفضلة">×</button></header>'
        +'<p class="account-favorites-empty">اضغط النجمة جنب أي باقة عشان تلقاها هنا.</p><div class="account-favorites-grid"></div>';
      dialog.querySelector("header button").onclick=()=>dialog.close();
      dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
      document.body.append(dialog);
    }
    showSavedPackages();
    if(!dialog.open)dialog.showModal();
  }
  function refresh(){
    document.querySelectorAll(".l1017-fav-toggle[data-fav-key]").forEach(button=>{
      const selected=favorites.has(button.dataset.favKey);
      button.classList.toggle("is-favorite",selected);
      button.setAttribute("aria-pressed",String(selected));
      button.setAttribute("aria-label",selected?"إزالة الباقة من المفضلة":"إضافة الباقة إلى المفضلة");
      button.title=selected?"إزالة من المفضلة":"إضافة إلى المفضلة";
    });
  }
  function makeStar(id,card){
    const button=document.createElement("button");
    button.type="button";
    button.className="l1017-fav-toggle";
    button.dataset.favKey=id;
    button.innerHTML=star;
    button.setAttribute("aria-pressed","false");
    button.setAttribute("aria-label","إضافة الباقة إلى المفضلة");
    button.addEventListener("pointerdown",e=>e.stopPropagation());
    button.addEventListener("touchstart",e=>e.stopPropagation(),{passive:true});
    button.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if(favorites.has(id)){favorites.delete(id);details.delete(id);}
      else{favorites.add(id);if(card)rememberCard(id,card);}
      save();
      if(dialog?.open)showSavedPackages();
      else refresh();
    });
    return button;
  }
  function mount(card,rule){
    if(!card.isConnected||card.dataset.l1017FavMounted==="1")return;
    const kind=rule.kind||card.dataset.favKind;
    const id=identity(card,kind);
    if(!id)return;
    const button=makeStar(id,card);
    if(favorites.has(id)&&!details.has(id)){rememberCard(id,card);save();}
    if(rule.mode==="shell"){
      const parent=card.parentElement;
      if(!parent||card.closest(".l1017-fav-shell"))return;
      const frame=document.createElement("div");
      frame.className="l1017-fav-shell";
      frame.dataset.favCard=kind;
      parent.insertBefore(frame,card);
      frame.append(card,button);
    }else{
      const action=card.querySelector(rule.action);
      if(!action||!action.parentElement)return;
      const row=document.createElement("div");
      row.className="l1017-fav-row";
      action.parentElement.insertBefore(row,action);
      row.append(action,button);
    }
    card.dataset.l1017FavMounted="1";
    button.classList.toggle("is-favorite",favorites.has(id));
    button.setAttribute("aria-pressed",String(favorites.has(id)));
    button.setAttribute("aria-label",favorites.has(id)?"إزالة الباقة من المفضلة":"إضافة الباقة إلى المفضلة");
  }
  function scan(){
    for(const rule of rules){
      document.querySelectorAll(rule.selector).forEach(card=>mount(card,rule));
    }
  }
  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    // One frame per DOM update, avoids re-scanning repeatedly during catalog re-render.
    requestAnimationFrame(()=>{queued=false;scan();});
  }
  function start(){
    document.querySelector("#accountPackageFavorites")?.addEventListener("click",openFavorites);
    window.addEventListener("l1017n:catalog-updated",()=>{if(dialog?.open)showSavedPackages();});
    scan();
    const observer=new MutationObserver(records=>{
      if(records.some(record=>record.addedNodes.length))schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("storage",event=>{
      if(event.key===DETAILS_KEY){
        try{details=new Map(JSON.parse(event.newValue||"[]"));}catch(error){details=new Map();}
        if(dialog?.open)showSavedPackages();
        return;
      }
      if(event.key!==STORE_KEY)return;
      try{
        const data=JSON.parse(event.newValue||"[]");
        favorites=new Set(Array.isArray(data)?data.filter(x=>typeof x==="string") : []);
      }catch(error){favorites=new Set();}
      if(dialog?.open)showSavedPackages();
      else refresh();
    });
    window.L1017nPackageFavorites={count:()=>favorites.size,has:key=>favorites.has(key)};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
