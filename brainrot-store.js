/* L1017n — Steal a Brainrot Roblox inner category.
 * Prices, stock, and wallet charges are validated by Supabase.
 * Original game: https://www.roblox.com/games/109983668079237/Steal-a-Brainrot
 */
(function(){
  "use strict";
  const GAME_ID = "7709344486";
  const API = "https://thumbnails.roblox.com/v1/games/icons?universeIds="+GAME_ID+"&size=512x512&format=Png&isCircular=false";
  // A previously published image on Roblox's official thumbnail CDN.
  const OFFICIAL_FALLBACK = "game-covers/official/mobile/brainrot.webp?v=official-art-20261102";
  const ART_FALLBACK = "game-covers/roblox.svg";
  const ITEMS = [
    { key:"steal-garama", name:"قرما", latin:"GARAMA", number:"01", image:"game-covers/garama.webp" },
    { key:"steal-dragon", name:"دراقون", latin:"DRAGON", number:"02", image:"game-covers/dragon-card.webp?v=uploaded-dragon-20261105-1" }
  ];
  // Variant products use the base product key followed by -- and the mutation slug.
  // Multipliers order the choices; availability and price come only from the catalog.
  const MUTATIONS = [
    ["normal","عادي","#ced7e8",1], ["gold","قولد","#ffd44f",1.25],
    ["diamond","دايموند","#63e5ff",1.5], ["bloodrot","بلود روت","#ff5360",2],
    ["candy","كاندي","#ff8cd9",4], ["lava","لافا","#ff892c",6],
    ["galaxy","جالاكسي","#b995ff",7], ["yinyang","ين يانغ","#f3f4f6",7.5],
    ["radioactive","مشع","#adff58",8.5], ["cursed","كيرسد","#f27798",9],
    ["divine","ديفاين","#fff0a7",10], ["rainbow","رينبو","#89e8d0",10],
    ["cyber","سايبر","#51f3c5",11], ["phantom","فانتوم","#c5adff",12],
    ["crystal","كريستال","#a8ecff",13]
  ];
  const mutationRank = new Map(MUTATIONS.map(([key], index)=>[key,index]));
  const baseIncome = {"steal-garama":50};
  function quantityLimit(product){
    if(!product?.active || !(Number(product.price)>0)) return 0;
    return product.stock_quantity==null ? 1 : Math.max(0,Number(product.stock_quantity)||0);
  }
  let officialIcon = OFFICIAL_FALLBACK;
  let iconFetchStarted = false;
  let checkoutBusy = false;

  function escapeHtml(value){
    return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
function getClient(){
    if(typeof supabaseClient!=="undefined") return supabaseClient;
    return null;
  }
  function syncImage(img){
    if(!img) return;
    img.onerror=function(){
      if(this.dataset.fallback==="0"){
        this.dataset.fallback="1";
        this.src=ART_FALLBACK;
      }
    };
    img.dataset.fallback="0";
    img.src=officialIcon;
  }
  function loadOfficialIcon(){
    if(iconFetchStarted) return;
    iconFetchStarted=true;
    // Use Roblox's live icon when its API permits cross-site reads.
    fetch(API,{mode:"cors",cache:"force-cache"})
      .then(r=>r.ok?r.json():null)
      .then(j=>{
        const entry=j&&j.data&&j.data[0];
        if(!entry||entry.state!=="Completed"||!/^https:\/\/tr\.rbxcdn\.com\//.test(entry.imageUrl))return;
        officialIcon=entry.imageUrl;
        document.querySelectorAll("[data-steal-official-icon]").forEach(syncImage);
      })
      .catch(()=>{/* Browser CORS/offline: official CDN fallback remains. */});
  }
  function applyOfficialImages(root){
    root.querySelectorAll("[data-steal-official-icon]").forEach(syncImage);
    loadOfficialIcon();
  }
  function priceText(product){
    const amount=Number(product?.price);
    return Number.isFinite(amount)&&amount>0?amount.toFixed(2)+" د.ل":"السعر قريبًا";
  }
  function productImageSrc(value){
    const image=String(value||'');
    const prefix='https://cmtxsjlehjworqypbxjz.supabase.co/storage/v1/object/public/l1017n-product-images/products/';
    return image.startsWith(prefix)&&/^[a-z0-9_/-]+\.(?:png|jpe?g|webp)$/i.test(image.slice(prefix.length))?image:'';
  }
  function productCard(item,product,hasVariants){
    const customImage=productImageSrc(product?.image_url);
    const productPicture=customImage||item.image||'game-covers/official/mobile/brainrot.webp';
    const limitedStock=product?.stock_quantity!=null || ["steal-garama","steal-dragon"].includes(item.key);
    const remaining=Number(product?.stock_quantity);
    const available=quantityLimit(product)>0;
    return '<article class="sab-item-card '+(available?'sab-available':'sab-pending')+'">'
      +'<div class="sab-card-top"><small>STEAL A BRAINROT</small><span>'+item.number+'</span></div>'
      +'<div class="sab-card-art">'+(item.emoji&&!customImage
        ?'<span class="sab-character-emoji" role="img" aria-label="'+escapeHtml(item.name)+'">'+escapeHtml(item.emoji)+'</span>'
        :'<img class="sab-character-image l1017n-catalog-image" src="'+escapeHtml(productPicture)+'" alt="'+escapeHtml(item.name)+'" loading="lazy" decoding="async">')+'<span class="sab-glow" aria-hidden="true"></span></div>'
      +'<span class="sab-card-label">'+escapeHtml(item.latin)+'</span>'
      +'<h3>'+escapeHtml(item.name)+'</h3>'
      +(limitedStock?'<span class="sab-stock-badge '+(available?'in-stock':'out-of-stock')+'">'+(available?'المتوفر: '+remaining:'نفدت الكمية')+'</span>':'')
      +'<div class="sab-card-footer"><strong>'+priceText(product)+'</strong>'
      +'<button type="button" class="sab-buy" data-steal-buy="'+escapeHtml(item.key)+'">'+(available||hasVariants?'فتح القائمة':'عرض الألوان')+'</button>'
      +'</div></article>';
  }
  function renderItems(section, catalog){
    const groups=new Map();
    for(const product of catalog||[]){
      const key=String(product.product_key);
      const [base,mutation]=key.split("--");
      const groupKey=mutationRank.has(mutation)?base:key;
      if(!groups.has(groupKey))groups.set(groupKey,new Map());
      groups.get(groupKey).set(groupKey===key?"normal":mutation,product);
    }
    const target=section.querySelector("#sabCatalog");
    if(!target)return;
    const extra=[...groups].filter(([key])=>!ITEMS.some(item=>item.key===key))
      .map(([key,variants],index)=>{
        const product=variants.get("normal")||variants.values().next().value;
        return {key,name:product.name,latin:"STEAL A BRAINROT",number:String(ITEMS.length+index+1),image:OFFICIAL_FALLBACK};
      });
    const items=[...ITEMS,...extra];
    target.innerHTML='<div class="sab-products-grid">'+items.map(item=>{
      const variants=groups.get(item.key);
      return productCard(item,variants?.get("normal")||variants?.values().next().value,variants?.size>1);
    }).join("")+'</div><p class="sab-info">اختر الشخصية لعرض الألوان والوزن والكمية المتوفرة.</p>';
    target.querySelectorAll("[data-steal-buy]").forEach(button=>{
      button.addEventListener("click",()=>{
        const item=items.find(entry=>entry.key===button.dataset.stealBuy);
        if(item)openCheckout(item,groups.get(item.key)||new Map());
      });
    });
  }
  async function loadItems(section){
    const target=section.querySelector("#sabCatalog");
    if(!target)return;
    const client=getClient();
    if(!client){
      renderItems(section,[]);
      return;
    }
    const result=await client.from("products").select("id,product_key,name,game,price,active,stock_quantity,image_url").eq("game","steal-a-brainrot").order("sort_order");
    if(!section.isConnected)return;
    if(result.error){
      renderItems(section,[]);
      const msg=document.createElement("p");msg.className="sab-info sab-fetch-error";
      msg.textContent="تعذر تحديث الأسعار حاليًا. حاول فتح القسم مرة ثانية.";
      target.appendChild(msg);
      return;
    }
    renderItems(section,result.data||[]);
  }
  function closeCheckout(){
    const x=document.getElementById("sabCheckout");
    if(x)x.remove();
  }
  function openCheckout(item,variants){
    const defaultProduct=variants.get("normal")||variants.values().next().value;
    const picture=productImageSrc(defaultProduct?.image_url)||item.image;
    const initial=MUTATIONS.find(([key])=>quantityLimit(variants.get(key))>0)?.[0]||"normal";
    closeCheckout();
    const box=document.createElement("div");
    box.id="sabCheckout";
    box.setAttribute("role","dialog");
    box.setAttribute("aria-modal","true");
    box.setAttribute("aria-label","تأكيد شراء عنصر من ماب السرقة");
    box.innerHTML='<div class="sab-dialog">'
      +'<button type="button" class="sab-dialog-close" data-sab-cancel aria-label="إغلاق">×</button>'
      +'<span class="sab-dialog-kicker">STEAL A BRAINROT • L1017N</span>'
      +'<img class="l1017n-catalog-image sab-checkout-product-image" src="'+escapeHtml(picture)+'" alt="'+escapeHtml(item.name)+'" loading="eager">'
      +'<h2>'+escapeHtml(item.name)+'</h2>'
      +'<fieldset class="sab-mutations"><legend>اللون · ترتيب قوة الطفرة</legend><div class="sab-mutation-grid">'
      +MUTATIONS.map(([key,label,color])=>{
        const available=quantityLimit(variants.get(key))>0;
        return '<button type="button" data-sab-mutation="'+key+'" style="--mutation-color:'+color+'" aria-pressed="false"><span>'+label+'</span><small>'+(available?'متوفر':'غير متوفر')+'</small></button>';
      }).join("")+'</div></fieldset>'
      +'<div class="sab-details"><span data-sab-weight></span><span data-sab-stock></span></div>'
      +'<div class="sab-quantity"><span>الكمية</span><div><button type="button" data-sab-step="-1" aria-label="نقص الكمية">−</button><output data-sab-quantity>1</output><button type="button" data-sab-step="1" aria-label="زِد الكمية">+</button></div></div>'
      +'<strong class="sab-dialog-price" aria-live="polite"></strong>'
      +'<p>بعد الشراء لازم تتواصل مع المتجر عبر واتساب أو تيليجرام وتبعث رقم طلبك لاستلام الغرض داخل اللعبة. لا يتم تسليم كود فوري.</p>'
      +'<form id="sabCheckoutForm"><label for="sabRobloxUsername">اسم مستخدم Roblox</label>'
      +'<input id="sabRobloxUsername" autocomplete="off" minlength="3" maxlength="20" required pattern="[A-Za-z0-9_]{3,20}" placeholder="Roblox username" dir="ltr">'
      +'<div class="sab-dialog-actions"><button type="button" data-sab-cancel>إلغاء</button><button type="submit">تأكيد الشراء</button></div>'
      +'<p class="sab-dialog-status" role="status" aria-live="polite"></p></form></div>';
    document.body.appendChild(box);
    box.querySelectorAll("[data-sab-cancel]").forEach(b=>b.addEventListener("click",closeCheckout));
    box.addEventListener("click",e=>{if(e.target===box)closeCheckout()});
    const form=box.querySelector("form");
    const send=form.querySelector('[type="submit"]');
    const status=box.querySelector(".sab-dialog-status");
    let selected=initial;
    let quantity=1;
    const mutationButtons=[...box.querySelectorAll("[data-sab-mutation]")];
    const stepButtons=[...box.querySelectorAll("[data-sab-step]")];
    function update(){
      const product=variants.get(selected);
      const max=quantityLimit(product);
      const multiplier=MUTATIONS[mutationRank.get(selected)][3];
      const income=baseIncome[item.key];
      mutationButtons.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.sabMutation===selected)));
      box.querySelector("[data-sab-weight]").textContent=income?"الوزن الأساسي: "+(income*multiplier)+"M/s":"مضاعف الدخل: ×"+multiplier;
      box.querySelector("[data-sab-stock]").textContent=!max?"غير متوفر":product.stock_quantity==null?"متوفر":"المتوفر: "+max;
      box.querySelector("[data-sab-quantity]").textContent=max?quantity:0;
      box.querySelector(".sab-dialog-price").textContent=max?"الإجمالي: "+(Number(product.price)*quantity).toFixed(2)+" د.ل":"غير متوفر للشراء";
      stepButtons[0].disabled=checkoutBusy||!max||quantity<=1;
      stepButtons[1].disabled=checkoutBusy||quantity>=max;
      send.disabled=checkoutBusy||!max;
    }
    mutationButtons.forEach(button=>button.addEventListener("click",()=>{
      if(checkoutBusy)return;
      selected=button.dataset.sabMutation;
      quantity=1;
      status.textContent="";
      update();
    }));
    stepButtons.forEach(button=>button.addEventListener("click",()=>{
      const next=quantity+Number(button.dataset.sabStep);
      if(checkoutBusy||next<1||next>quantityLimit(variants.get(selected)))return;
      quantity=next;
      update();
    }));
    update();
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const product=variants.get(selected);
      if(checkoutBusy||quantity>quantityLimit(product))return;
      const username=form.querySelector("input").value.trim();
      if(!/^[A-Za-z0-9_]{3,20}$/.test(username)){
        status.textContent="أدخل اسم Roblox صحيحًا من 3 إلى 20 حرفًا.";return;
      }
      const client=getClient();
      if(!client){status.textContent="تعذر الاتصال بالمتجر.";return;}
      checkoutBusy=true;update();
      status.textContent="جارٍ مراجعة الحساب والرصيد…";
      try{
        const auth=await client.auth.getUser();
        if(auth.error||!auth.data?.user) {
          status.textContent="سجّل دخولك أولًا، ثم أعد المحاولة.";return;
        }
        if(typeof window.ensurePurchasePhone!=="function"){
          status.textContent="خدمة التحقق من الهاتف غير جاهزة. حدّث الصفحة.";return;
        }
        if(!await window.ensurePurchasePhone())return;
        const r=await client.rpc("create_brainrot_purchase",{p_product_id:product.id,p_roblox_username:username,p_quantity:quantity,p_unit_price:Number(product.price)});
        if(r.error)throw r.error;
        if(r.data?.id)void client.functions.invoke('l1017n-purchase-notify',{body:{order_id:r.data.id}})
          .then(({error})=>{if(error)console.warn('[purchase] Telegram notification pending')})
          .catch(()=>console.warn('[purchase] Telegram notification unavailable'));
        closeCheckout();
        const main=document.getElementById("robloxGamePage");if(main)main.remove();
        if(typeof renderWallet==="function")Promise.resolve(renderWallet()).catch(()=>{});
        if(typeof renderOrders==="function")Promise.resolve(renderOrders()).catch(()=>{});
        const order=r.data;
        const opened=order?.id && window.L1017nManualHandover?.open({
          id:order.id,product_name:order.product_name||product.name,
          total_amount:order.total_amount??Number(product.price)*quantity,
          roblox_username:order.roblox_username||username,
          game:"steal-a-brainrot",product_key:product.product_key
        });
        if(!opened)alert("تم شراء "+product.name+" بنجاح. افتح «طلباتي» وتواصل مع المتجر عبر واتساب أو تيليجرام لاستلام الغرض.");
      }catch(error){
        const msg=String(error?.message||"");
        if(/insufficient_balance/i.test(msg))window.showInsufficientBalance?.();
        status.textContent=/insufficient_balance/i.test(msg)?"رصيدك غير كافٍ، اشحن المحفظة أولًا."
          :/phone_verification_required_before_purchase/i.test(msg)?"يجب توثيق رقم الهاتف قبل الشراء."
          :/product_not_available/i.test(msg)?"المنتج غير متاح حاليًا."
          :/price_changed/i.test(msg)?"تغيّر السعر. ارجع وافتح الشخصية من جديد."
          :"تعذر إكمال الشراء. تحقق من طلباتك قبل المحاولة مجددًا.";
      }finally{checkoutBusy=false;if(send.isConnected)update();}
    });
    box.querySelector("[data-sab-cancel]").focus({preventScroll:true});
  }

  function openInsideRoblox(){
    const root=document.getElementById("robloxGamePage");
    if(!root)return;
    const grid=root.querySelector(".rgp-grid");
    if(!grid)return;
    const section=document.createElement("section");
    section.className="sab-inner";
    // Open directly to the items for sale: omit the original-game link and oversized hero.
    section.innerHTML='<div class="sab-section-title"><div><span>STEAL A BRAINROT</span><h2>شخصيات ماب السرقة</h2></div><small>'+String(ITEMS.length).padStart(2,"0")+' عناصر</small></div>'
      +'<div id="sabCatalog" aria-live="polite"></div>';
    grid.replaceWith(section);
    if(typeof window.setRobloxInnerHeader==="function"){
      window.setRobloxInnerHeader(root,"ماب السرقة","brainrot");
    }
    renderItems(section,[]);
    loadItems(section).catch(()=>{
      if(section.isConnected)renderItems(section,[]);
    });
  }

  window.openStealBrainrotCategory=openInsideRoblox;
  window.refreshRobloxStealCover=applyOfficialImages;
})();
