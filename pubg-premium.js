/* L1017n · Premium PUBG Mobile page. Presentation only; purchases use the existing secured RPC. */
(function () {
  "use strict";

  const PAGE_ID = "pubgCategoryPage";
  const PUBG_ART = "game-covers/pubg-battlefront.webp";
  const CATEGORIES = [
    { key: "codes", title: "أكواد الشحن", latin: "REDEEM CODES", visual: "UC", subtitle: "استلم الكود بعد الشراء" },
    { key: "charge", title: "شحن عن طريق ID", latin: "DIRECT TOP-UP", visual: "+", subtitle: "اشحن الشدات إلى UID" },
    { key: "offers", title: "عروض ببجي", latin: "PUBG OFFERS", visual: "UC", subtitle: "عروض المورد المتاحة" }
  ];

  let lastFocused = null;
  let currentCategory = "codes";
  let pubgCatalog = [];
  let catalogReady = false;
  let catalogError = "";
  let catalogRequest = 0;
  let omnexLive = false;
  // Previously listed prices are informational when the live catalog is unavailable.
  const SUPPLIER_REFERENCE = {
    codes: [[60,12.468],[325,62.522],[660,125.045],[1800,312.977],[3850,622.881],[8100,1248.624],[16200,2496.915],[24300,3703.757],[32400,4905.841],[40500,6242.285]],
    charge: [[60,12.597],[325,62.646],[660,124.162],[1800,312.844],[3850,625.225],[8100,1235.947]],
    offers: [["Prime · شهر",12.209],["Prime · 3 أشهر",36.622],["Prime · 6 أشهر",73.244],["Prime · 12 شهرًا",146.486],
      ["Prime Plus · شهر",122.072],["Prime Plus · 3 أشهر",366.215],["Prime Plus · 6 أشهر",721.332],["Prime Plus · 12 شهرًا",1456.534]]
  };

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function reducedMotion() {
    return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function allPubgProducts() {
    // Source of truth: the live products API. Do not depend on the separate
    // legacy global products array, which can still be empty when PUBG opens.
    return pubgCatalog;
  }
  async function fetchPubgProducts(root, quiet = false) {
    const requestId=++catalogRequest;
    if(!quiet)catalogReady=false;
    catalogError="";
    const refresh=()=> {
      if(!root.isConnected||!root.classList.contains("visible")||requestId!==catalogRequest)return;
      if (root.classList.contains("pubg-inner-page")) setCategory(root,currentCategory,false);
    };
    try {
      if(typeof supabaseClient==="undefined")throw new Error("خدمة المنتجات غير جاهزة");
      // Supplier catalog comes from the server-backed read-only RPC, not direct browser calls
      // to Omnex. No API keys, supplier purchase requests or financial writes in the browser.
      const supplier=await supabaseClient.rpc("get_public_omnex_pubg_catalog");
      if(requestId!==catalogRequest)return;
      if(!supplier.error && supplier.data?.enabled && Array.isArray(supplier.data.products) && supplier.data.products.length){
        omnexLive=true;
        pubgCatalog=supplier.data.products.map(p=>{
          const match=String(p.name||"").match(/(\d[\d,.]*)\s*(?:UC|شد[ةات])/i);
          const amount=match?Number(match[1].replace(/[,]/g,"")):0;
          return {...p, source:"omnex", game:"pubg", amount,
            group_name:String(p.group||p.region||""),
            description:String(p.group||p.region||""),
            available:p.available===true};
        }).filter(p=>/^[a-f0-9]{32}$/i.test(String(p.id)) && Number(p.price)>0);
        catalogReady=true;
        refresh();return;
      }
      omnexLive=false;
      // Existing manually fulfilled products remain visible until the supplier is synced.
      const {data,error}=await supabaseClient.from("products")
        .select("id,product_key,name,description,game,amount,price,active,sort_order,image_url")
        .eq("game","pubg").eq("active",true).order("sort_order");
      if(error)throw error;
      if(requestId!==catalogRequest)return;
      pubgCatalog=(data||[]).filter(p=>String(p.game).toLowerCase()==="pubg"&&p.active===true&&String(p.product_key)!=="pubg-60");
      catalogReady=true;
      refresh();
    } catch(error) {
      if(requestId!==catalogRequest)return;
      pubgCatalog=[];
      omnexLive=false;
      catalogReady=true;
      catalogError="تعذر تحميل باقات ببجي. تأكد من اتصال الإنترنت وأعد المحاولة.";
      console.warn("[pubg] Live catalog loading failed",error);
      refresh();
    }
  }
  function categoryFor(p) {
    // Display existing 60 UC under codes, but do not imply it is in stock.
    // The backend still blocks instant redemption of this manual product.
    if (String(p.product_key || "").toLowerCase() === "pubg-60") return "codes";
    const label = [p.group_name,p.region,p.name, p.product_key, p.description].join(" ").toLowerCase();
    if (/عروض|offer|bundle|خصم/.test(label)) return "offers";
    if (/أ?كواد|اكواد|كود|code|بطاق[ةه]|card|redeem|voucher/.test(label)) return "codes";
    return "charge";
  }
  function categoryProducts(key) {
    return allPubgProducts().filter((p) => categoryFor(p) === key);
  }
  function productImageSrc(value){
    const image=String(value||'');
    const prefix='https://cmtxsjlehjworqypbxjz.supabase.co/storage/v1/object/public/l1017n-product-images/products/';
    return image.startsWith(prefix)&&/^[a-z0-9_/-]+\.(?:png|jpe?g|webp)$/i.test(image.slice(prefix.length))?image:'';
  }
  function countLabel(count) {
    return count ? count + " باقة" : "باقات قيد التجهيز";
  }
  function tierFor(amount) {
    if(amount >= 8100) return { key:"legend", title:"باقة ضخمة", coins:3, flair:"تشكيلة UC كبيرة" };
    if(amount >= 3850) return { key:"elite", title:"باقة كبيرة جدًا", coins:3, flair:"كمية كبيرة من الشدات" };
    if(amount >= 1800) return { key:"pro", title:"باقة كبيرة", coins:3, flair:"1800 شدة أو أكثر" };
    if(amount >= 660) return { key:"plus", title:"باقة متوسطة", coins:2, flair:"كمية متوسطة من الشدات" };
    if(amount >= 325) return { key:"medium", title:"باقة صغيرة", coins:2, flair:"مناسبة للشحنات الصغيرة" };
    return { key:"starter", title:"باقة أساسية", coins:1, flair:"شحن UC أساسي" };
  }
  function deliveryFor(key) {
    return key === "codes"
      ? {kind:"كود شحن", detail:"استلام كود رقمي", icon:"ticket", note:"يظهر الكود بعد تنفيذ الطلب إذا كان متوفرًا"}
      : key === "offers"
      ? {kind:"عرض ببجي", detail:"حسب العرض", icon:"spark", note:"التفاصيل تعتمد على العرض المتوفر"}
      : {kind:"شحن عبر ID", detail:"يتطلب معرف اللاعب UID", icon:"id", note:"راجع معرف اللاعب قبل تأكيد أي طلب"};
  }
  // A single real product image, as in the Roblox catalog. Keep the original
  // PUBG cover when no product-specific image has been uploaded.
  function artForPack(amount, customUrl) {
    const src=PUBG_ART;
    return '<div class="pubg-pack-cover">'
      + '<img class="pubg-pack-cover-image" src="' + safe(src) + '" alt="صورة باقة شدات ببجي" loading="lazy" decoding="async">'
      + '</div>';
  }
  function infoForPack(mode, availability, description) {
    const delivery=deliveryFor(mode);
    return '<div class="pubg-pack-facts">'
      + '<div><span>المنتج</span><strong>شدات PUBG Mobile</strong></div>'
      + '<div><span>طريقة الشحن</span><strong>' + safe(delivery.kind) + '</strong></div>'
      + '<div><span>الاستلام</span><strong>' + safe(delivery.detail) + '</strong></div>'
      + '</div>'
      + '<p class="pubg-pack-explainer">' + safe(description||delivery.note) + '</p>'
      + '<span class="pubg-pack-availability">' + safe(availability) + '</span>';
  }
  function page() {
    let element = document.getElementById(PAGE_ID);
    if (!element) {
      element = document.createElement("section");
      element.id = PAGE_ID;
      document.body.appendChild(element);
    }
    return element;
  }
  function productCard(product, index) {
    const amount = Number(product.amount);
    const hasAmount = Number.isFinite(amount) && amount > 0;
    const amountText = hasAmount ? Math.trunc(amount).toLocaleString("en-US") : "UC";
    const tier = tierFor(hasAmount ? amount : 60);
    const name = safe(product.name || "شدات PUBG Mobile");
    const price = Number(product.price);
    const mode = categoryFor(product);
    const isVoucher = mode === "codes";
    const noCodeAvailable = String(product.product_key || "").toLowerCase() === "pubg-60";
    const supplierUnavailable = product.source === "omnex" && product.available !== true;
    const isDisabled = noCodeAvailable || supplierUnavailable;
    const currentStatus = noCodeAvailable || supplierUnavailable ? "غير متوفر" : "متوفر للطلب";
    return '<article class="pubg-pack pubg-pack-detailed pubg-tier-' + tier.key + '" style="--pubg-index:' + Math.min(index, 8) + '">'
      + '<div class="pubg-pack-top"><span class="pubg-pack-kind">' + safe(deliveryFor(mode).kind) + '</span>'
      + '<span class="pubg-pack-tier">' + safe(tier.title) + '</span></div>'
      + artForPack(amount, product.image_url)
      + '<div class="pubg-pack-headline"><div class="pubg-pack-quantity">' + amountText + (hasAmount ? '<small> UC</small>' : '') + '</div>'
      + '<h3 class="pubg-pack-name">' + name + '</h3></div>'
      + infoForPack(mode, currentStatus)
      + '<div class="pubg-pack-bottom"><div class="pubg-price"><small>سعر البيع</small><strong>'
      + (Number.isFinite(price) && price > 0 ? price.toFixed(2) + ' <span>د.ل</span>' : 'عند التوفر')
      + '</strong></div>'
      + (isDisabled
        ? '<button type="button" class="pubg-buy" disabled>غير متوفر</button>'
        : '<button type="button" class="pubg-buy" data-pubg-buy="' + safe(product.id) + '" aria-label="شراء ' + name + '">شراء الآن</button>')
      + '</div></article>';
  }
  function referenceCard([packageName, cost], key, index) {
    const amount=typeof packageName==="number"?packageName:0;
    const tier=tierFor(amount),delivery=deliveryFor(key);
    const title=amount?amount.toLocaleString("en-US")+" UC":packageName;
    // A five-percent margin leaves 95% of the sale price to cover the listed cost.
    const salePrice=(cost/0.95).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
    return '<article class="pubg-pack pubg-pack-detailed pubg-pack-preview pubg-tier-' + tier.key + '" style="--pubg-index:' + Math.min(index,8) + '">'
      + '<div class="pubg-pack-top"><span class="pubg-pack-kind">' + safe(delivery.kind) + '</span>'
      + '<span class="pubg-pack-tier">' + safe(tier.title) + '</span></div>'
      + artForPack(amount, "")
      + '<div class="pubg-pack-headline"><h3 class="pubg-pack-name">' + safe(title) + '</h3></div>'
      + '<div class="pubg-pack-bottom"><div class="pubg-price"><strong dir="ltr">' + salePrice + ' <span>د.ل</span></strong></div>'
      + '<button type="button" class="pubg-buy" disabled>غير متوفر</button></div>'
      + '</article>';
  }
  // PUBG UC is manually fulfilled to the player's ID; never deliver a test code.
  // The existing secured purchase RPC authorizes and debits the wallet atomically.
  function openPubgAccountCheckout(product) {
    const old = document.getElementById("pubgAccountCheckoutOverlay");
    if (old) old.remove();
    const overlay = document.createElement("section");
    overlay.id = "pubgAccountCheckoutOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pubgCheckoutTitle");
    overlay.dir = "rtl";
    const amount = Number(product.amount) || 60;
    const price = Number(product.price) || 0;
    overlay.innerHTML = '<div class="pubg-account-checkout">' +
      '<button type="button" class="pubg-account-close" aria-label="إغلاق طلب الشحن">×</button>' +
      '<img class="pubg-checkout-product-image l1017n-catalog-image" src="'+safe(PUBG_ART)+'" alt="'+safe(product.name)+'" loading="eager">' +
      '<span class="pubg-eyebrow">PUBG MOBILE / ACCOUNT TOP-UP</span>' +
      '<h2 id="pubgCheckoutTitle">شحن ' + Math.trunc(amount) + ' شدة</h2>' +
      '<p class="pubg-account-explainer">اكتب معرف اللاعب (UID) في ببجي بدقة. بعد الدفع من رصيد محفظتك يوصل الطلب للإدارة، ويتم شحن حسابك بعد تنفيذ الطلب.</p>' +
      '<div class="pubg-account-summary"><span>السعر</span><strong>' + price.toFixed(2) + ' د.ل</strong></div>' +
      '<form id="pubgAccountPurchaseForm" novalidate>' +
        '<label for="pubgAccountUid">معرف لاعب ببجي (UID)</label>' +
        '<input id="pubgAccountUid" name="pubg_uid" inputmode="numeric" pattern="[0-9]{5,20}" maxlength="20" autocomplete="off" dir="ltr" placeholder="مثلاً: 5123456789" required aria-describedby="pubgUidHint">' +
        '<small id="pubgUidHint">معرف اللاعب فقط، مش اسمك في اللعبة.</small>' +
        '<button type="submit" class="pubg-account-confirm">تأكيد طلب الشحن بالمحفظة</button>' +
        '<p id="pubgAccountStatus" role="status" aria-live="polite"></p>' +
      '</form>' +
      '<button type="button" class="pubg-account-orders" hidden>عرض طلباتي</button>' +
      '<p class="pubg-account-disclaimer">لا يتم تسليم الشدات تلقائيًا، ولا يتم خصم أي رصيد قبل تأكيد الطلب بنجاح.</p>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add("pubg-account-checkout-open");
    const close = () => {
      overlay.remove();
      document.body.classList.remove("pubg-account-checkout-open");
    };
    const closeButton=overlay.querySelector(".pubg-account-close");
    const ordersButton=overlay.querySelector(".pubg-account-orders");
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", event => { if(event.target === overlay)close(); });
    overlay.addEventListener("keydown", event => {
      if(event.key === "Escape"){event.preventDefault();close();}
      if(event.key === "Tab"){
        const focusable=[...overlay.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled])')].filter(el=>el.getClientRects().length>0);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    ordersButton.addEventListener("click",()=>{
      close();closePremiumPubg();
      if(typeof switchView === "function")switchView("orders");
    });
    const form=overlay.querySelector("#pubgAccountPurchaseForm");
    const submit=form.querySelector('button[type="submit"]');
    const status=overlay.querySelector("#pubgAccountStatus");
    const input=form.querySelector("#pubgAccountUid");
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(submit.disabled)return;
      const uid=input.value.trim();
      if(!/^[0-9]{5,20}$/.test(uid)){
        status.textContent="اكتب معرف اللاعب UID بالأرقام (من 5 إلى 20 رقم).";
        input.focus();return;
      }
      submit.disabled=true;
      status.textContent="جاري التحقق من حسابك ورصيد المحفظة…";
      try{
        if(typeof supabaseClient === "undefined")throw new Error("تعذر الاتصال بقاعدة البيانات.");
        const {data:auth,error:authError}=await supabaseClient.auth.getUser();
        if(authError||!auth?.user)throw new Error("سجّل دخولك أولاً لإكمال الشراء.");
        if(typeof window.ensurePurchasePhone !== "function")
          throw new Error("خدمة توثيق الهاتف غير جاهزة. حدّث الصفحة وحاول مجددًا.");
        if(!await window.ensurePurchasePhone()){
          throw new Error("لازم توثّق رقم هاتفك من «حسابي» قبل الدفع.");
        }
        const {data:order,error}=await supabaseClient.rpc("create_purchase_order",{
          p_product_id:product.id,p_roblox_username:uid
        });
        if(error)throw error;
        if(!order?.id)throw new Error("لم نستلم رقم الطلب من المتجر.");
        status.innerHTML='<svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-check-circle"></use></svg> تم دفع الطلب بنجاح. شحن الشدات بانتظار تنفيذ الإدارة. تابع الحالة من طلباتي.';
        form.querySelectorAll("input").forEach(el=>el.disabled=true);
        ordersButton.hidden=false;
        submit.textContent="تم إنشاء الطلب";
        // Manual order, not a digital-code delivery. Existing Telegram admin
        // notification is best-effort and not required to record the order.
        void supabaseClient.functions.invoke("l1017n-purchase-notify",{body:{order_id:order.id}})
          .catch(err=>console.warn("[pubg/order] Telegram notification unavailable",err));
        if(typeof loadProducts==="function")void loadProducts();
        if(typeof renderWallet==="function")void renderWallet();
        if(typeof renderOrders==="function")void renderOrders();
      }catch(error){
        console.warn("[pubg/order]",error);
        const message=String(error?.message||"تعذر إنشاء الطلب");
        if(/insufficient_balance/i.test(message))window.showInsufficientBalance?.();
        status.textContent=/insufficient_balance/i.test(message)
          ?"رصيد المحفظة غير كافٍ. اشحن المحفظة وحاول مرة أخرى."
          :/product_not_available/i.test(message)?"الباقة غير متوفرة حاليًا."
          :/invalid_roblox_username/i.test(message)?"معرف اللاعب غير صحيح. تأكد من UID."
          :message;
        submit.disabled=false;
      }
    });
    input.focus({preventScroll:true});
  }

  function supplierReference(key){
    const rows=SUPPLIER_REFERENCE[key];
    if(!rows?.length)return "";
    return '<div class="pubg-supplier-note"><strong>أسعار متجر L1017n لباقات Omnex</strong>'
      + '<span>الأسعار للعرض إلى أن يتأكد التوفر من المورد.</span></div>'
      + '<div class="pubg-packages pubg-reference-packages">' + rows.map((row,index)=>referenceCard(row,key,index)).join("") + '</div>';
  }
  function paintOffers(panel, key) {
    const list = categoryProducts(key);
    const codes = key === "codes";
    panel.innerHTML = '<div class="pubg-results-heading"><div>'
      + '<span class="pubg-eyebrow">L1017N / PUBG MOBILE / ' + (codes ? 'REDEEM CODES' : key==='offers'?'OFFERS':'DIRECT TOP-UP') + '</span>'
      + '<h2>' + (codes ? 'أكواد الشحن' : key==='offers'?'عروض ببجي':'شحن عن طريق ID') + '</h2>'
      + '<p>' + (codes ? 'اختار الكود اللي تبيه واستلمه من طلباتك بعد الشراء.' : key==='offers'?'العروض الظاهرة من المورد عند توفرها.':'اختار الباقة وأدخل معرف اللاعب UID للشحن.') + '</p></div>'
      + '<span class="pubg-results-count">' + countLabel(list.length + (!omnexLive ? (SUPPLIER_REFERENCE[key]?.length || 0) : 0)) + '</span></div>'
      + (!catalogReady
        ? '<div class="pubg-empty-state" role="status"><div class="pubg-empty-icon" aria-hidden="true">UC</div><strong>جاري تحميل باقات ببجي…</strong></div>'
        : catalogError
        ? '<div class="pubg-empty-state" role="alert"><strong>' + safe(catalogError) + '</strong><button type="button" class="pubg-retry-catalog">إعادة المحاولة</button></div>'
        : list.length
        ? '<div class="pubg-packages">' + list.map(productCard).join("") + '</div>'
        : "")
      + (catalogReady && !omnexLive ? supplierReference(key) : "")
      + (catalogReady && omnexLive && !list.length
        ? '<p class="pubg-empty-state">لا توجد باقات متوفرة في هذه الفئة حاليًا.</p>' : "");

    panel.querySelector(".pubg-retry-catalog")?.addEventListener("click",()=>{
      void fetchPubgProducts(document.getElementById(PAGE_ID));
    });
    panel.querySelectorAll("[data-pubg-buy]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = list.find((p) => String(p.id) === button.dataset.pubgBuy);
        if (!selected || String(selected.product_key || "").toLowerCase() === "pubg-60") return;
        if (selected.source === "omnex") {
          if (selected.available !== true) return;
          if(typeof window.openOmnexProductCheckout === "function") void window.openOmnexProductCheckout(selected);
          else window.alert("خدمة المورد غير جاهزة للشراء حاليًا.");
        } else if (categoryFor(selected) === "charge") {
          openPubgAccountCheckout(selected);
        } else if (typeof window.openInstantCodeCheckout === "function") {
          window.openInstantCodeCheckout(selected.id, selected.name, selected.price);
        } else {
          window.alert("خدمة شراء الأكواد غير جاهزة حاليًا. حدّث الصفحة وحاول مرة أخرى.");
        }
      });
    });
  }
  // Same two-screen experience as Roblox: categories first, packages on a separate inner screen.
  function showPubgCategories(root, scroll = 0) {
    root.classList.remove("pubg-inner-page", "pubg-codes-page", "pubg-charge-page", "pubg-offers-page");
    root.querySelectorAll("[data-pubg-category]").forEach(button => {
      button.classList.remove("selected");
      button.setAttribute("aria-pressed","false");
    });
    const heading=root.querySelector("[data-pubg-title]");
    if(heading)heading.textContent="ببجي موبايل";
    const back=root.querySelector("[data-pubg-close]");
    if(back){
      back.setAttribute("aria-label","العودة إلى المتجر");
      const label=back.querySelector("[data-pubg-back-label]");
      if(label)label.textContent="رجوع";
    }
    root.querySelector("#pubgCategoryResults")?.setAttribute("aria-hidden","true");
    root.scrollTop=scroll;
  }
  function setCategory(root, key, shouldScroll = true) {
    if(!CATEGORIES.some(item => item.key === key)) return;
    currentCategory = key;
    root.classList.add("pubg-inner-page");
    root.classList.toggle("pubg-codes-page",key==="codes");
    root.classList.toggle("pubg-charge-page",key==="charge");
    root.classList.toggle("pubg-offers-page",key==="offers");
    root.querySelectorAll("[data-pubg-category]").forEach(button => {
      const active=button.dataset.pubgCategory === key;
      button.classList.toggle("selected",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const heading=root.querySelector("[data-pubg-title]");
    if(heading)heading.textContent=key==="codes"?"أكواد الشحن":key==="offers"?"عروض ببجي":"شحن عن طريق ID";
    const back=root.querySelector("[data-pubg-close]");
    if(back){
      back.setAttribute("aria-label","رجوع إلى أقسام ببجي");
      const label=back.querySelector("[data-pubg-back-label]");
      if(label)label.textContent="رجوع";
    }
    const panel=root.querySelector("#pubgCategoryResults");
    if(!panel) return;
    panel.removeAttribute("aria-hidden");
    paintOffers(panel,key);
    panel.classList.remove("pubg-results-enter");
    void panel.offsetWidth;
    panel.classList.add("pubg-results-enter");
    if(shouldScroll)root.scrollTop=0;
  }
  function closePremiumPubg() {
    const root = document.getElementById(PAGE_ID);
    if (!root || !root.classList.contains("visible")) return;
    root.classList.remove("visible");
    ++catalogRequest; // Ignore any late response after closing.
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pubg-premium-open");
    if (lastFocused && lastFocused.isConnected) lastFocused.focus({ preventScroll: true });
  }

  function openPremiumPubg() {
    lastFocused = document.activeElement;
    const root = page();
    currentCategory="codes";
    catalogReady=false;
    catalogError="";
    omnexLive=false;
    pubgCatalog=[];
    root.className = "pubg-premium visible";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "متجر ببجي موبايل");
    root.removeAttribute("aria-hidden");
    root.innerHTML = '<div class="pubg-shell">'
      + '<header class="pubg-topbar"><div class="pubg-brand" data-pubg-title>ببجي موبايل</div>'
      + '<button class="pubg-close" type="button" data-pubg-close aria-label="العودة إلى المتجر"><span aria-hidden="true">←</span> <span data-pubg-back-label>رجوع</span></button></header>'
      + '<section class="pubg-hero" aria-labelledby="pubgHeroTitle">'
      + '<div class="pubg-hero-copy"><span class="pubg-kicker"><i></i> L1017N / PUBG MOBILE</span>'
      + '<h1 id="pubgHeroTitle">PUBG <span>MOBILE</span></h1>'
      + '<p class="pubg-hero-title-ar">عالم الشدات في مكان واحد.</p>'
      + '<p class="pubg-hero-description">اختار أكواد الشحن، أو الشحن على معرف اللاعب UID.</p>'
      + '</div><div class="pubg-hero-visual"><div class="pubg-hero-halo"></div>'
      + '<img src="game-covers/pubg-battlefront.webp" alt="صورة ببجي موبايل" loading="eager" decoding="async"></div>'
      + '</section>'
      + '<div class="pubg-reference-features" aria-label="خطوات الطلب">'
      + '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5zM9 8v2m0 4v2"/></svg><small>اختار الباقة</small></span>'
      + '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h17v14H3zM3 6V4h14v2M15 11h6v5h-6z"/></svg><small>دفع بالمحفظة</small></span>'
      + '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v4H8zM8 5H5v16h14V5h-3M8 14l3 3 5-6"/></svg><small>تابع طلبك</small></span>'
      + '</div>'
      + '<section class="pubg-category-section" aria-label="طرق شحن ببجي">'
      + '<div class="pubg-section-label"><div><h2>اختر الفئة</h2></div></div>'
      + '<div class="pubg-choice-grid" role="group" aria-label="خيارات شحن ببجي">'
      + CATEGORIES.map(item =>
        '<button type="button" class="pubg-choice pubg-choice-' + item.key + '" data-pubg-category="' + item.key + '" aria-pressed="false">'
        + '<span class="pubg-choice-art pubg-choice-art-' + item.key + '" aria-hidden="true">'
        + '<img class="pubg-choice-battle" src="'+safe(PUBG_ART)+'" alt="" loading="lazy" decoding="async">'
        + '</span>'
        + '<span class="pubg-choice-info"><strong>' + item.title + '</strong>'
        + '<small>' + (item.key==="codes"?"أكواد شدات PUBG المتوفرة في المخزون":item.key==="offers"?"باقات وعروض خاصة":"نجهز الشحن باستخدام معرف UID") + '</small>'
        + '<span class="pubg-choice-action">' + (item.key==="codes"?"عرض أكواد الشحن":item.key==="offers"?"عرض العروض":"عرض باقات الشحن") + '<span aria-hidden="true">←</span></span></span>'
        + '</button>').join("")
      + '</div></section>'
      + '<div id="pubgCategoryResults" class="pubg-results" aria-live="polite" aria-hidden="true"></div>'
      + '<footer class="pubg-footer"><span>L1017N STORE</span><span>اختر طريقة الشحن المناسبة لحسابك.</span></footer>'
      + '</div>';

    document.body.classList.add("pubg-premium-open");
    root.scrollTop = 0;
    let categoryButton, categoryScroll = 0;
    const back = root.querySelector("[data-pubg-close]");
    back.addEventListener("click", () => {
      if(root.classList.contains("pubg-inner-page")){
        showPubgCategories(root, categoryScroll);
        categoryButton?.focus({preventScroll:true});
      } else closePremiumPubg();
    });
    root.querySelectorAll("[data-pubg-category]").forEach(button => {
      button.addEventListener("click", () => {
        categoryButton = button;
        categoryScroll = root.scrollTop;
        setCategory(root, button.dataset.pubgCategory);
        back.focus({preventScroll:true});
      });
    });
    root.onkeydown = event => {
      if(event.key === "Escape" && !event.defaultPrevented){
        event.preventDefault();
        back.click();
      }
    };
    setCategory(root,"codes",false);
    showPubgCategories(root);
    void fetchPubgProducts(root);
    root.querySelector("[data-pubg-close]").focus({ preventScroll: true });
  }

  setInterval(() => {
    const root=document.getElementById(PAGE_ID);
    if(root?.classList.contains("visible")&&!document.hidden)void fetchPubgProducts(root,true);
  },60000);
  window.renderPremiumPubg = openPremiumPubg;
  window.closePremiumPubg = closePremiumPubg;
})();
