/* L1017n favorites: star exactly beside package Buy / Out of Stock actions.
   Local to this browser; no order creation, balance changes or product mutation. */
(function(){
  "use strict";
  if(window.L1017nPackageFavoritesLoaded)return;
  window.L1017nPackageFavoritesLoaded=true;
  const STORE_KEY="l1017n.package-favorites.v1";
  const rules=[
    {selector:"#robuxModal .package-grid .robux-package",kind:"robux",mode:"shell"},
    {selector:"#psnStoreScreen .psn-products .psn-product",kind:"psn",mode:"shell"},
    {selector:"#robloxGamePage .ox-catalog-grid .ox-product",kind:"roblox-codes",mode:"shell"},
    {selector:"#robloxGamePage .rgp-package",kind:"mm2",mode:"shell"},
    {selector:"#pubgCategoryPage .pubg-pack-detailed",kind:"pubg",mode:"row",action:".pubg-buy"},
    {selector:"#robloxGamePage .sab-item-card",kind:"brainrot",mode:"row",action:".sab-buy"},
    {selector:"#completeSupplierCatalog .sc-product",kind:"supplier",mode:"row",action:".sc-buy"}
  ];
  const star='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 2.8 2.85 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.62l-5.75 3.05 1.1-6.47-4.69-4.58 6.49-.94L12 2.8Z" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  let favorites=new Set();
  try{
    const value=JSON.parse(localStorage.getItem(STORE_KEY)||"[]");
    if(Array.isArray(value))favorites=new Set(value.filter(v=>typeof v==="string").slice(0,1500));
  }catch(error){/* Private-browsing storage may be unavailable. */}
  function save(){
    try{localStorage.setItem(STORE_KEY,JSON.stringify([...favorites].slice(0,1500)));}catch(error){}
  }
  function identity(card,kind){
    const explicit=card.dataset.favId||card.dataset.robux||card.dataset.mm2Id||card.querySelector("[data-pubg-buy]")?.dataset.pubgBuy;
    if(explicit)return kind+":"+String(explicit);
    const title=card.querySelector(".pubg-pack-name,.ox-product-info strong,.psn-product-detail strong,.sc-info h2,.sab-item-card h3,.robux-pack-copy strong,.rgp-package strong")?.textContent||card.getAttribute("aria-label")||"";
    const region=card.closest("#psnStoreScreen")?.querySelector(".psn-region-title")?.textContent||
      card.closest("#completeSupplierCatalog")?.querySelector(".sc-group-title,.sc-head h1")?.textContent||"";
    const stable=(region+" "+title).normalize("NFKC").trim().replace(/\s+/g," ").slice(0,220);
    return stable?kind+":"+stable:null;
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
  function makeStar(id){
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
      if(favorites.has(id))favorites.delete(id);
      else favorites.add(id);
      save();
      refresh();
    });
    return button;
  }
  function mount(card,rule){
    if(!card.isConnected||card.dataset.l1017FavMounted==="1")return;
    const id=identity(card,rule.kind);
    if(!id)return;
    const button=makeStar(id);
    if(rule.mode==="shell"){
      const parent=card.parentElement;
      if(!parent||card.closest(".l1017-fav-shell"))return;
      const frame=document.createElement("div");
      frame.className="l1017-fav-shell";
      frame.dataset.favCard=rule.kind;
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
    scan();
    const observer=new MutationObserver(records=>{
      if(records.some(record=>record.addedNodes.length))schedule();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("storage",event=>{
      if(event.key!==STORE_KEY)return;
      try{
        const data=JSON.parse(event.newValue||"[]");
        favorites=new Set(Array.isArray(data)?data.filter(x=>typeof x==="string") : []);
      }catch(error){favorites=new Set();}
      refresh();
    });
    window.L1017nPackageFavorites={count:()=>favorites.size,has:key=>favorites.has(key)};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
