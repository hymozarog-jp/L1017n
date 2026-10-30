/* L1017n · Premium PUBG Mobile page. Presentation only; purchases use the existing secured RPC. */
(function () {
  "use strict";

  const PAGE_ID = "pubgCategoryPage";
  const CATEGORIES = [
    { key: "codes", title: "أكواد الشحن", latin: "REDEEM CODES", visual: "UC", subtitle: "بطاقات رقمية جاهزة للاستخدام" },
    { key: "charge", title: "شحن على الحساب", latin: "ACCOUNT TOP-UP", visual: "+", subtitle: "باقات الشدات وشحن الحساب" },
    { key: "offers", title: "العروض", latin: "SPECIAL OFFERS", visual: "%", subtitle: "تابع الباقات والعروض الجديدة" }
  ];

  let lastFocused = null;
  let currentCategory = "all";
  let pubgCatalog = [];
  let catalogReady = false;
  let catalogError = "";
  let catalogRequest = 0;

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
  async function fetchPubgProducts(root) {
    const requestId=++catalogRequest;
    catalogReady=false;
    catalogError="";
    const refresh=()=> {
      if(!root.isConnected||!root.classList.contains("visible")||requestId!==catalogRequest)return;
      setCategory(root,"all",false);
    };
    try {
      if(typeof supabaseClient==="undefined")throw new Error("خدمة المنتجات غير جاهزة");
      const {data,error}=await supabaseClient.from("products")
        .select("id,product_key,name,description,game,amount,price,active,sort_order")
        .eq("game","pubg").eq("active",true).order("sort_order");
      if(error)throw error;
      if(requestId!==catalogRequest)return;
      pubgCatalog=(data||[]).filter(p=>String(p.game).toLowerCase()==="pubg"&&p.active===true);
      catalogReady=true;
      refresh();
    } catch(error) {
      if(requestId!==catalogRequest)return;
      pubgCatalog=[];
      catalogReady=true;
      catalogError="تعذر تحميل باقات ببجي. تأكد من اتصال الإنترنت وأعد المحاولة.";
      console.warn("[pubg] Live catalog loading failed",error);
      refresh();
    }
  }
  function categoryFor(p) {
    const label = [p.name, p.product_key, p.description].join(" ").toLowerCase();
    if (/عرض|offer|promo|خصم|discount/.test(label)) return "offers";
    if (/كود|code|بطاق[ةه]|card|redeem|voucher/.test(label)) return "codes";
    return "charge";
  }
  function categoryProducts(key) {
    return key==="all" ? allPubgProducts() : allPubgProducts().filter((p) => categoryFor(p) === key);
  }
  function countLabel(count) {
    return count ? count + " باقة" : "قريبًا";
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
    const name = safe(product.name);
    const amount = Number(product.amount);
    const amountText = Number.isFinite(amount) && amount > 0 ? Math.trunc(amount).toLocaleString("en-US") : "UC";
    const price = Number(product.price);
    const priceText = (Number.isFinite(price) ? price : 0).toFixed(2);
    const isVoucher = categoryFor(product) === "codes";
    return '<article class="pubg-pack" style="--pubg-index:' + Math.min(index, 8) + '">'
      + '<div class="pubg-pack-top"><span class="pubg-pack-kind">' + (isVoucher ? 'بطاقة رقمية' : 'PUBG MOBILE') + '</span>'
      + '<span class="pubg-pack-arrow" aria-hidden="true">↗</span></div>'
      + '<div class="pubg-coin-wrap"><span class="pubg-coin" aria-hidden="true"><b>UC</b></span></div>'
      + '<div class="pubg-pack-quantity">' + amountText + '<small> UC</small></div>'
      + '<h3 class="pubg-pack-name">' + name + '</h3>'
      + '<div class="pubg-pack-bottom"><div class="pubg-price"><small>السعر</small><strong>' + priceText + ' <span>د.ل</span></strong></div>'
      + '<button type="button" class="pubg-buy" data-pubg-buy="' + safe(product.id) + '" aria-label="شراء ' + name + '">شراء الآن <span aria-hidden="true">←</span></button></div>'
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
      '<div class="pubg-account-icon" aria-hidden="true">UC</div>' +
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
        status.textContent="✅ تم دفع الطلب بنجاح. شحن الشدات بانتظار تنفيذ الإدارة. تابع الحالة من طلباتي.";
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

  function paintOffers(panel, key) {
    const list = categoryProducts("all");
    panel.innerHTML = '<div class="pubg-results-heading"><div>'
      + '<span class="pubg-eyebrow">L1017N / PUBG MOBILE / UC</span>'
      + '<h2>باقات ببجي</h2>'
      + '<p>اختار باقة الشدات اللي تبيها، وكمّل الطلب بمعرّف اللاعب UID.</p></div><span class="pubg-results-count">' + countLabel(list.length) + '</span></div>'
      + (!catalogReady
        ? '<div class="pubg-empty-state" role="status"><div class="pubg-empty-icon" aria-hidden="true">UC</div><strong>جاري تحميل باقات ببجي…</strong></div>'
        : catalogError
        ? '<div class="pubg-empty-state" role="alert"><strong>' + safe(catalogError) + '</strong><button type="button" class="pubg-retry-catalog">إعادة المحاولة</button></div>'
        : list.length
        ? '<div class="pubg-packages">' + list.map(productCard).join("") + '</div>'
        : '<div class="pubg-empty-state"><div class="pubg-empty-icon" aria-hidden="true">UC</div>'
          + '<strong>ما فيش باقات متوفرة في القسم حاليًا</strong>'
          + '<p>أول ما نضيف باقات جديدة للمتجر، بتظهر هنا تلقائيًا.</p></div>')
      + '<p class="pubg-purchase-note">شحن الشدات يتم على معرّف اللاعب UID بعد تنفيذ الطلب من الإدارة. الرصيد يُخصم فقط عند نجاح الدفع.</p>';

    panel.querySelector(".pubg-retry-catalog")?.addEventListener("click",()=>{
      void fetchPubgProducts(document.getElementById(PAGE_ID));
    });
    panel.querySelectorAll("[data-pubg-buy]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = list.find((p) => String(p.id) === button.dataset.pubgBuy);
        if (!selected) return;
        if (categoryFor(selected) !== "codes") {
          openPubgAccountCheckout(selected);
        } else if (typeof window.openInstantCodeCheckout === "function") {
          window.openInstantCodeCheckout(selected.id, selected.name, selected.price);
        } else {
          window.alert("خدمة شراء الأكواد غير جاهزة حاليًا. حدّث الصفحة وحاول مرة أخرى.");
        }
      });
    });
  }
  function setCategory(root, key, shouldScroll = true) {
    currentCategory = key;
    root.querySelectorAll("[data-pubg-category]").forEach((button) => {
      const active = button.dataset.pubgCategory === key;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const panel = root.querySelector("#pubgCategoryResults");
    if (!panel) return;
    paintOffers(panel, key);
    panel.classList.remove("pubg-results-enter");
    void panel.offsetWidth;
    panel.classList.add("pubg-results-enter");
    if (shouldScroll) {
      panel.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }
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
    currentCategory="all";
    catalogReady=false;
    catalogError="";
    pubgCatalog=[];
    root.className = "pubg-premium visible";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "متجر ببجي موبايل");
    root.removeAttribute("aria-hidden");
    root.innerHTML = '<div class="pubg-shell">'
      + '<header class="pubg-topbar"><div class="pubg-brand"><span class="pubg-brand-emblem">L</span><span>L1017N <small>GAME STORE</small></span></div>'
      + '<button class="pubg-close" type="button" data-pubg-close aria-label="العودة إلى المتجر"><span aria-hidden="true">←</span> رجوع للمتجر</button></header>'
      + '<section class="pubg-hero" aria-labelledby="pubgHeroTitle">'
      + '<div class="pubg-hero-copy"><span class="pubg-kicker"><i></i> BATTLE-READY DIGITAL STORE</span>'
      + '<h1 id="pubgHeroTitle">PUBG <span>MOBILE</span></h1>'
      + '<p class="pubg-hero-title-ar">كل ما تحتاجه للمعركة، بمكان واحد.</p>'
      + '<p class="pubg-hero-description">باقات شدات ببجي مباشرة، اختار باقتك واشحن عن طريق المحفظة.</p>'
      + '<div class="pubg-hero-actions"><span class="pubg-hero-note"><span class="pubg-note-dot"></span> شحن على حساب PUBG • دفع من المحفظة</span></div>'
      + '</div><div class="pubg-hero-visual"><div class="pubg-hero-halo"></div>'
      + '<img src="game-covers/pubg-battlefront.webp" alt="PUBG Mobile" loading="eager" decoding="async">'
      + '<span class="pubg-visual-sticker">LEVEL UP <b>UC STORE</b></span></div>'
      + '<div class="pubg-hero-caption">L1017N <b>×</b> PUBG MOBILE <span>•</span> UC</div>'
      + '</section>'
      + '<div id="pubgCategoryResults" class="pubg-results" aria-live="polite"></div>'
      + '<footer class="pubg-footer"><span>L1017N STORE</span><span>شحن شدات ببجي على معرّف اللاعب UID.</span></footer>'
      + '</div>';

    document.body.classList.add("pubg-premium-open");
    root.scrollTop = 0;
    root.querySelector("[data-pubg-close]").addEventListener("click", closePremiumPubg);
    setCategory(root,"all",false);
    void fetchPubgProducts(root);
    root.querySelector("[data-pubg-close]").focus({ preventScroll: true });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePremiumPubg();
  });
  window.renderPremiumPubg = openPremiumPubg;
  window.closePremiumPubg = closePremiumPubg;
})();
