/* L1017n Live Mobile Storefront · integrates the standalone demo with the existing Supabase storefront.
   No payment writes here: checkout stays exclusively in legacy-app.js/instant-code.js. */
(function () {
  "use strict";
  const ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    leaderboard: '<path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5m-4 3h8m-6-3h4"/>',
    orders: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
    subscriptions: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6V4m8 2V4M3 11h18m-14 5h4m-4 3h7"/>',
    chevron: '<path d="m14 6-6 6 6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  ICONS.gift = '<path d="M3 10h18v11H3zM2 6h20v4H2zM12 6v15M12 6c-2.4-4-6.5-5.2-7.5-2.2C3.6 6 7 7 12 6Zm0 0c2.4-4 6.5-5.2 7.5-2.2C20.4 6 17 7 12 6Z"/>';
  const SVG = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  const GAME_META = {
    roblox: {name:"Robux",tag:"روبوكس",color:"purple",art:"R"},
    mm2: {name:"MM2",tag:"Murder Mystery 2",color:"blue",art:"M"},
    "steal-a-brainrot": {name:"ماب السرقة",tag:"Steal a Brainrot",color:"teal",art:"01"}
  };
  const FILTERS = [["all","الكل"],["roblox","روبوكس"],["mm2","MM2"],["steal-a-brainrot","ماب السرقة"]];
  const HEROES = [
    {headline:"باقات الروبوكس",more:"بسهولة وأمان",desc:"اختار باقتك من روبوكس وتابع طلبك من حسابك.",label:"GAMEBOX LY · ROBUX",action:"roblox",button:"باقات روبوكس",theme:"violet",art:"R",image:"game-covers/roblox-mark.svg?v=logo-square1"},
    {headline:"أسلحة MM2",more:"داخل متجرك",desc:"تصفح أسلحة ومستلزمات Murder Mystery 2 المتوفرة.",label:"GAMEBOX LY · MM2",action:"mm2",button:"أسلحة MM2",theme:"gold",art:"M",image:"game-covers/official/mobile/mm2.webp?v=official-art-20261102"},
    {headline:"ماب السرقة",more:"شخصيات وأغراض",desc:"تصفح شخصيات Steal a Brainrot مع الأسعار والتوفر.",label:"GAMEBOX LY · BRAINROT",action:"steal-a-brainrot",button:"الشخصيات",theme:"aqua",art:"01",image:"game-covers/official/mobile/brainrot.webp?v=official-art-20261102"}
  ];
  const q = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const normalize = value => String(value ?? "").toLowerCase().normalize("NFKC").replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const price = value => Number(value || 0).toFixed(2) + " د.ل";
  let showAllProducts=false;
  let chosen = "all", query = "", lastCatalog = "", activeSlide = 0, observer = null, refreshTimer = null;

  function catalog() {
    try { return typeof products !== "undefined" && Array.isArray(products) ? products : []; }
    catch (_) { return []; }
  }
  function gameKey(product) {
    const key = String(product.game || "").toLowerCase().trim();
    if (/mm2|murder.*mystery/.test(key)) return "mm2";
    if (/steal.*brainrot|brainrot/.test(key)) return "steal-a-brainrot";
    if (/pubg/.test(key)) return "pubg";
    if (/free ?fire/.test(key)) return "freefire";
    if (/fortnite/.test(key)) return "fortnite";
    if (key === "roblox" || /robux|روبوكس/i.test(product.name || "")) return "roblox";
    return key || "other";
  }
  function itemMeta(product) { return GAME_META[gameKey(product)] || { name: product.game || "الألعاب", tag: "منتجات رقمية", color: "purple", art: "L" }; }
  // Three independent Roblox-only storefront sections; purchase stock is unchanged.
  const SHOP_SECTIONS = [
    {key:"roblox",title:"روبوكس",subtitle:"شحن روبوكس",image:"game-covers/roblox-mark.svg?v=logo-square1",tag:"ROBUX"},
    {key:"mm2",title:"MM2",subtitle:"أسلحة ومستلزمات الماب",image:"game-covers/official/mobile/mm2.webp?v=official-art-20261102",tag:"MURDER MYSTERY 2"},
    {key:"steal-a-brainrot",title:"ماب السرقة",subtitle:"شخصيات Steal a Brainrot",image:"game-covers/official/mobile/brainrot.webp?v=official-art-20261102",tag:"STEAL A BRAINROT"}
  ];
  function matchesSection(section) {
    if (chosen !== "all" && chosen !== section.key) return false;
    if (!query) return true;
    const aliases = {
      roblox:"روبوكس روبلوكس roblox robux شحن",
      mm2:"mm2 murder mystery 2 سكاكين أسلحة اسلحه",
      "steal-a-brainrot":"ماب السرقة سرقه brainrot steal a brainrot قرما لاسيكرت لاسبوكي"
    };
    const items = catalog().filter(p=>gameKey(p)===section.key);
    return normalize([section.title,section.subtitle,section.tag,aliases[section.key],
      ...items.map(p=>[p.name,p.game,p.product_key].join(" "))].join(" ")).includes(query);
  }
  function sectionCard(section) {
    return '<article class="ll-game-section ll-reveal ll-game-'+esc(section.key)+'">'
      +'<button type="button" class="ll-game-section-link" data-ll-game="'+esc(section.key)+'" aria-label="فتح '+esc(section.title)+'">'
      +'<span class="ll-game-section-art"><img src="'+esc(section.image)+'" alt="" loading="eager" decoding="async">'
      +'<span class="ll-game-section-tag">'+esc(section.tag)+'</span></span>'
      +'<span class="ll-game-section-details"><strong>'+esc(section.title)+'</strong>'
      +'<small>'+esc(section.key==='roblox'&&typeof robuxAvailable!=='undefined'&&typeof robuxUnlimited!=='undefined'&&!robuxUnlimited&&robuxAvailable<1?'غير متوفر':section.subtitle)+'</small></span></button></article>';
  }
  function notify(message) {
    let n = q("#l1017LiveToast");
    if (!n) return;
    n.textContent = message;
    n.classList.add("visible");
    clearTimeout(n._timer);
    n._timer = setTimeout(() => n.classList.remove("visible"), 3200);
  }
  function routeView(view) {
    if (typeof switchView !== "function") { notify("جاري تهيئة المتجر. حاول مرة ثانية."); return; }
    switchView(view);
    updateNavigation(view);
  }
  function openGame(key) {
    try {
      if(key==="roblox"){
        if(typeof window.openRobloxGameMenu==="function")window.openRobloxGameMenu();
        else if(typeof window.openRobuxPackages==="function")window.openRobuxPackages();
        else notify("قسم الروبوكس غير جاهز حاليًا.");
        return;
      }
      if(key==="mm2"){
        if(typeof window.openMm2StoreCategory==="function")window.openMm2StoreCategory();
        else notify("قسم MM2 غير جاهز حاليًا.");
        return;
      }
      if(key==="steal-a-brainrot"){
        if(typeof window.openBrainrotStoreCategory==="function")window.openBrainrotStoreCategory();
        else notify("قسم ماب السرقة غير جاهز حاليًا.");
        return;
      }
    }catch(error){
      console.error("[live-ui] Game navigation",error);
      notify("تعذر فتح القسم. جرّب تحديث الصفحة.");
    }
  }
  function openProduct(product) {
    const key = gameKey(product);
    if (key === "roblox") {
      if (typeof openRobuxPackages === "function") {
        openRobuxPackages();
        const button = q('#robuxModal [data-robux="' + CSS.escape(String(product.id)) + '"]');
        if (button && !button.disabled) button.click();
      } else openGame("roblox");
      return;
    }
    if (key === "pubg") {
      // 60 UC is an account top-up requiring the player's UID, not a voucher.
      openGame("pubg");
      return;
    }
    // MM2 and Steal A Brainrot are manual delivery; their official flows
    // request the Roblox username and charge through create_purchase_order.
    if (key === "mm2" || key === "steal-a-brainrot") {
      openGame(key);
      return;
    }
    if (typeof window.openInstantCodeCheckout === "function" && (key === "fortnite" || key === "freefire")) {
      window.openInstantCodeCheckout(product.id, product.name, product.price);
      return;
    }
    openGame(key);
  }
  function card(item, index) {
    const meta = itemMeta(item);
    const art = meta.art;
    const title = esc(item.name);
    return '<article class="ll-card ll-reveal ll-' + esc(meta.color) + '" style="--ll-delay:' + Math.min(7, index) + '">'
      + '<div class="ll-card-art">'
      + '<span class="ll-card-kicker">' + esc(meta.tag) + '</span>'
      + '<span class="ll-card-mark" aria-hidden="true">' + esc(art) + '</span>'
      + '<span class="ll-card-gleam" aria-hidden="true"></span></div>'
      + '<div class="ll-card-info"><span class="ll-card-category">' + esc(meta.name) + '</span>'
      + '<h3>' + title + '</h3>'
      + '<p>' + esc(meta.tag) + ' · ' + (gameKey(item) === "roblox" ? "شحن Roblox" : "متجر L1017n") + '</p>'
      + '<div class="ll-card-price"><strong>' + price(item.price) + '</strong><span>جاهز للطلب</span></div>'
      + '<button type="button" class="ll-quickbuy" data-ll-buy="' + esc(item.id) + '" aria-label="شراء ' + title + '"><span class="ll-buy-label">فتح القائمة</span>'
      + '<span class="ll-buy-loader" aria-hidden="true"></span><span aria-hidden="true">←</span></button></div></article>';
  }
  function reveal(elements) {
    if (!("IntersectionObserver" in window) || reduceMotion()) {
      elements.forEach(el => el.classList.add("ll-shown"));
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("ll-shown");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.10, rootMargin: "0px 0px 50px 0px" });
    }
    elements.forEach(el => observer.observe(el));
  }
  function productArtwork(item) {
    const custom=String(item.image_url||"");
    if(custom.startsWith("https://cmtxsjlehjworqypbxjz.supabase.co/storage/v1/object/public/l1017n-product-images/products/"))return custom;
    const key=gameKey(item);
    if(key==="roblox")return "game-covers/robux-100-tokens.svg";
    if(key==="mm2"){
      const known={"mm2-deathshard":"mm2-deathshard.png","mm2-elderwood-blade":"mm2-elderwood-blade.png","mm2-nightblade":"mm2-nightblade.svg","mm2-pixel-knife":"mm2-pixel-owner.svg","mm2-phantom":"mm2-phantom.svg"};
      return "game-covers/"+(known[item.product_key]||"official/mobile/mm2.webp");
    }
    return "game-covers/official/mobile/brainrot.webp";
  }
  function renderCatalog() {
    const root=q("#llCatalog");if(!root)return;
    const visibleSections=SHOP_SECTIONS.filter(matchesSection);
    const items=catalog().filter(item=>visibleSections.some(section=>section.key===gameKey(item)))
      .filter(item=>chosen==="all"||chosen===gameKey(item))
      .filter(item=>!query||normalize([item.name,item.game,item.amount,itemMeta(item).tag].join(" ")).includes(query));
    // Prioritize the real active Robux packages; no preview prices or fictional products.
    const ordered=chosen==="all"&&!query
      ? [...items.filter(item=>gameKey(item)==="roblox"),...items.filter(item=>gameKey(item)!=="roblox")]
      : items;
    const visible=ordered.slice(0,chosen==="all"&&!query&&!showAllProducts?4:12);
    const count=q("#llItemCount");if(count)count.textContent=items.length?items.length+" منتج":"";
    root.innerHTML=visible.length?visible.map(item=>{
      const key=gameKey(item),isRobux=key==="roblox";
      const available=!isRobux||(typeof robuxUnlimited!=="undefined"&&robuxUnlimited)||(typeof robuxAvailable!=="undefined"&&robuxAvailable>=Number(item.amount||0));
      const title=isRobux?Number(item.amount)+" روبوكس":item.name;
      return '<article class="sb-product sb-product-'+esc(key)+'"><button type="button" class="sb-product-open" data-ll-buy="'+esc(item.id)+'" aria-label="عرض '+esc(title)+'">'
        +'<span class="sb-product-art"><img src="'+esc(productArtwork(item))+'" alt="" loading="lazy" decoding="async">'
        +(isRobux?'<span class="sb-product-brand" dir="ltr">ROBLOX</span><span class="sb-product-amount" dir="ltr">'+Number(item.amount)+'</span>':'')+'</span>'
        +'<span class="sb-product-name">'+esc(title)+'</span></button>'
        +'<div class="sb-product-bottom"><strong><b dir="ltr">'+Number(item.price||0).toFixed(2)+'</b> <small>د.ل</small></strong>'
        +'<button type="button" class="sb-product-buy" data-ll-buy="'+esc(item.id)+'" aria-label="اختيار '+esc(title)+'" '+(!available?'disabled':'')+'>'
        +(available?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h2l2.5 12h11L21 6H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>':'غير متوفر')+'</button></div></article>';
    }).join(""):'<div class="sb-empty">'+(catalog().length?'لا توجد منتجات مطابقة. جرّب قسمًا آخر.':'جاري تحميل الباقات…')+'</div>';
  }
  function setCategory(key) {
    chosen = key;
    document.querySelectorAll("[data-ll-category]").forEach(button => {
      const selected = button.dataset.llCategory === key;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderCatalog();
  }
  // One translucent rounded rectangle glides between the white active icons. Measuring its position against
  // the real nav means it stays aligned in RTL, on all iPhones and on resize.
  function moveNavigationGlider(nav) {
    if (!nav) return;
    const glider = nav.querySelector(".ll-nav-glider");
    const icon = nav.querySelector('button[data-ll-nav].active .ll-nav-icon');
    if (!glider) return;
    if (!icon) { glider.classList.remove("is-ready"); return; }
    const rect = icon.getBoundingClientRect();
    const base = nav.getBoundingClientRect();
    if (!rect.width || !base.width) return;
    const x = Math.round(rect.left - base.left + (rect.width - glider.offsetWidth) / 2);
    const y = Math.round(rect.top - base.top + (rect.height - glider.offsetHeight) / 2);
    glider.style.transform = "translate3d(" + x + "px," + y + "px,0)";
    glider.classList.add("is-ready");
  }
  function updateNavigation(view) {
    const which = (view === "store" || view === "offers") ? "home" : view;
    const nav = q("#llBottomNav");
    nav?.querySelectorAll("[data-ll-nav]").forEach(button => {
      const active = button.dataset.llNav === which;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    moveNavigationGlider(nav);
  }
  function goSearch() {
    routeView("home");
    const search = q("#llSearch");
    if (!search) return;
    q("#llSearchWrap")?.classList.add("is-open");
    q("#llSearchWrap")?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    setTimeout(() => { if (q("#storeView") && !q("#storeView").classList.contains("hidden")) search.focus({ preventScroll: true }); }, 100);
    updateNavigation("home");
  }
  function makeHeroSlides() {
    const slides=[
      {title:"شحن سريع<br>وآمن",button:"تسوّق الآن",game:"roblox",art:'<div class="sb-gift sb-gift-back"><img src="game-covers/official/mobile/brainrot.webp" alt=""><b>Brainrot</b></div><div class="sb-gift sb-gift-middle"><img src="game-covers/official/mobile/mm2.webp" alt=""><b>MM2</b></div><div class="sb-gift sb-gift-front"><img src="game-covers/roblox-mark.svg" alt=""><b>ROBLOX</b></div>'},
      {title:"باقات روبوكس<br>على كيفك",button:"اختار باقتك",game:"roblox",art:'<img class="sb-hero-tokens" src="game-covers/robux-100-tokens.svg" alt="">'},
      {title:"طوّر مجموعتك<br>في MM2",button:"شوف الأسلحة",game:"mm2",art:'<img class="sb-hero-game" src="game-covers/official/mobile/mm2.webp" alt="">'}
    ];
    return slides.map((slide,index)=>'<article class="sb-hero-slide" data-ll-slide="'+index+'" aria-label="العرض '+(index+1)+'"><div class="sb-hero-copy"><h1>'+slide.title+'</h1><button type="button" data-ll-game="'+slide.game+'">'+slide.button+' '+SVG("chevron")+'</button></div><div class="sb-hero-art" aria-hidden="true">'+slide.art+'</div></article>').join("");
  }
  function build() {
    const store = q("#storeView");
    if (!store || q("#llLanding")) return;
    const container = document.createElement("div");
    container.id = "llLanding";
    container.className="sb-storefront";
    container.innerHTML = '<div class="sb-search" id="llSearchWrap">'+SVG("search")+'<label class="ll-sr-only" for="llSearch">البحث عن المنتجات</label><input id="llSearch" type="search" inputmode="search" autocomplete="off" placeholder="ابحث عن باقتك…"></div>'
      +'<section class="sb-hero" aria-label="عروض المتجر"><div id="llSlideTrack" class="sb-hero-track" tabindex="0">'+makeHeroSlides()+'</div>'
      +'<div class="sb-hero-dots" role="group" aria-label="اختيار العرض">'+HEROES.map((_,i)=>'<button type="button" class="sb-dot '+(i===0?'selected':'')+'" data-ll-dot="'+i+'" aria-label="العرض '+(i+1)+'" aria-current="'+(i===0)+'"></button>').join("")+'</div></section>'
      +'<div class="sb-categories" id="llCategories" role="group" aria-label="أقسام المتجر">'
      +[['roblox','روبوكس','<img src="game-covers/roblox-mark.svg" alt="">'],['mm2','MM2','<img src="game-covers/official/mobile/mm2.webp" alt="">'],['steal-a-brainrot','ماب السرقة','<img src="game-covers/official/mobile/brainrot.webp" alt="">'],['all','الكل','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>']].map(([key,label,icon])=>'<button type="button" data-ll-category="'+key+'" aria-pressed="'+(key==='all')+'" class="'+(key==='all'?'selected':'')+'"><span>'+icon+'</span><b>'+label+'</b></button>').join("")+'</div>'
      +'<div class="sb-section-head"><h2>اختيارات لك</h2><button type="button" data-ll-show-all>عرض الكل '+SVG("chevron")+'</button></div>'
      +'<div class="sb-products" id="llCatalog" aria-live="polite"></div><span id="llItemCount" class="ll-sr-only"></span>'
      +'<section class="sb-wallet-banner"><div><h2>رصيدك جاهز للّعب</h2><button type="button" data-ll-wallet>اشحن محفظتك '+SVG("chevron")+'</button></div><img src="game-covers/robux-100-tokens.svg" alt="" loading="lazy"></section>';

    // Insert before existing legacy store content. Existing screens, forms and modal handlers remain intact.
    store.insertBefore(container, store.firstChild);
    const nav = document.createElement("nav");
    nav.id = "llBottomNav";
    nav.setAttribute("aria-label", "التنقل الرئيسي");
    nav.innerHTML = '<span class="ll-nav-glider" aria-hidden="true"></span>' + [
      ["home", "الرئيسية", "home"],
      ["orders", "طلباتي", "orders"],
      ["leaderboard", "التصنيف", "leaderboard"],
      ["wallet", "محفظتي", "wallet"],
      ["account", "حسابي", "profile"]
    ].map(([key, label, icon], index) =>
      '<button type="button" data-ll-nav="' + key + '" class="' + (index === 0 ? "active" : "") + '" aria-label="' + label + '" aria-current="' + (index === 0 ? "page" : "false") + '">'
      + '<span class="ll-nav-icon">' + SVG(icon) + '</span><small>' + label + '</small></button>'
    ).join("");
    document.body.appendChild(nav);
    const toast = document.createElement("div");
    toast.id = "l1017LiveToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    // Prefer existing site's functional animated hamburger drawer.
    const bar = q(".topbar");
    if (bar && !q("#llHeaderSearch")) {
      const searchButton = document.createElement("button");
      searchButton.type = "button";
      searchButton.id = "llHeaderSearch";
      searchButton.setAttribute("aria-label", "البحث في المنتجات");
      searchButton.innerHTML = SVG("search");
      searchButton.addEventListener("click", goSearch);
      bar.appendChild(searchButton);
    }
    document.body.classList.add("l1017-live-ui");
    requestAnimationFrame(() => moveNavigationGlider(nav));
    window.addEventListener("resize", () => requestAnimationFrame(() => moveNavigationGlider(nav)), {passive:true});
    window.addEventListener("orientationchange", () => requestAnimationFrame(() => moveNavigationGlider(nav)));
    enableScrollMotion(nav);
    bindEvents(container, nav);
    renderCatalog();
    reveal([...container.querySelectorAll(".ll-reveal")]);

    const legacyGrid = q("#productGrid");
    if (legacyGrid) {
      // Catalog refresh happens when loadProducts() redraws the real game tiles.
      new MutationObserver(() => { clearTimeout(refreshTimer); refreshTimer = setTimeout(renderCatalog, 80); })
        .observe(legacyGrid, {childList:true,subtree:false});
    }
    // Works even if legacy app finishes loading after the new shell mounts.
    let attempts=0; const timer=setInterval(() => {
      renderCatalog();
      if (catalog().length || ++attempts >= 16) clearInterval(timer);
    }, 500);
  }
  // Scroll-aware visible mobile bar: down = tuck away, up = return.
  // This operates on the *actual* #llBottomNav, not the hidden legacy bar.
  function enableScrollMotion(nav){
    if(!nav||nav.dataset.scrollMotionReady==='1')return;
    nav.dataset.scrollMotionReady='1';
    const mobile=window.matchMedia('(max-width:680px)');
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastY=Math.max(0,window.scrollY||document.documentElement.scrollTop||0);
    let travel=0,lastDirection=0,queued=false;
    function reveal(){
      nav.classList.remove('ll-nav-scroll-away');
      nav.dataset.scrollMotion='visible';
    }
    function sync(){
      queued=false;
      const y=Math.max(0,window.scrollY||document.documentElement.scrollTop||0);
      const delta=y-lastY;
      lastY=y;
      const atBottom=y+window.innerHeight>=document.documentElement.scrollHeight-24;
      if(!mobile.matches||reduced.matches||y<64||atBottom){
        travel=0;lastDirection=0;reveal();return;
      }
      if(Math.abs(delta)<2)return; // iOS viewport bounce and tiny scroll jitter
      const direction=Math.sign(delta);
      if(direction!==lastDirection){travel=0;lastDirection=direction;}
      travel+=Math.abs(delta);
      if(direction>0&&y>115&&travel>20){
        nav.classList.add('ll-nav-scroll-away');
        nav.dataset.scrollMotion='hidden';
        travel=0;
      }else if(direction<0&&travel>12){
        reveal();travel=0;
      }
    }
    window.addEventListener('scroll',()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(sync);
    },{passive:true});
    window.addEventListener('resize',()=>{
      lastY=Math.max(0,window.scrollY||document.documentElement.scrollTop||0);
      travel=0;lastDirection=0;reveal();
    },{passive:true});
    nav.addEventListener('click',()=>{travel=0;lastDirection=0;reveal()});
    nav.addEventListener('focusin',reveal);
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden){lastY=Math.max(0,window.scrollY||document.documentElement.scrollTop||0);reveal();}
    });
    reveal();
  }
  function bindEvents(container, nav) {
    const search = q("#llSearch");
    search.addEventListener("input", () => {
      query = normalize(search.value.trim());
      renderCatalog();
      updateNavigation("home");
    });
    q("#llCategories").addEventListener("click", e => {
      const b = e.target.closest("[data-ll-category]");
      if (b) setCategory(b.dataset.llCategory);
    });
    const track = q("#llSlideTrack");
    const slides = [...track.querySelectorAll("[data-ll-slide]")];
    function updateDot(index) {
      activeSlide = index;
      q("#llLanding")?.querySelectorAll("[data-ll-dot]").forEach((b,i) => {
        b.classList.toggle("selected", i === index);
        b.setAttribute("aria-current", String(i === index));
      });
    }
    function scrollSlide(index) {
      const next = (index + slides.length) % slides.length;
      updateDot(next);
      slides[next].scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest", inline: "start" });
    }
    let raf = 0;
    track.addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const m = track.getBoundingClientRect();
        const cx = (m.left + m.right) / 2;
        let best=0, distance=Infinity;
        slides.forEach((s,i) => {
          const b=s.getBoundingClientRect();
          const diff=Math.abs((b.left+b.right)/2-cx);
          if (diff<distance) { distance=diff;best=i; }
        });
        updateDot(best);
      });
    }, {passive:true});
    container.addEventListener("click", async e => {
      if(e.target.closest("[data-ll-wallet]")){routeView("wallet");return;}
      if(e.target.closest("[data-ll-show-all]")){chosen="all";query="";showAllProducts=true;q("#llSearch").value="";setCategory("all");return;}
      const dot=e.target.closest("[data-ll-dot]");
      if (dot) { scrollSlide(Number(dot.dataset.llDot)); return; }
      const direction=e.target.closest("[data-ll-slide-step]");
      if (direction) { scrollSlide(activeSlide+Number(direction.dataset.llSlideStep)); return; }
      const game=e.target.closest("[data-ll-game]");
      if (game) { openGame(game.dataset.llGame); return; }
      if (e.target.closest("[data-ll-show-orders]")) { routeView("orders"); return; }
      const buy=e.target.closest("[data-ll-buy]");
      if (!buy || buy.disabled) return;
      const item=catalog().find(p => String(p.id)===String(buy.dataset.llBuy));
      if (!item) { notify("الباقة غير موجودة حاليًا. حدّث الصفحة."); return; }
      buy.disabled=true; buy.classList.add("loading");
      try {
        await new Promise(done => setTimeout(done, reduceMotion() ? 0 : 260));
        openProduct(item);
        // Deliberately never show "purchased" here — only the server checkout can confirm an order.
      } catch(err) {
        console.error("[live-ui] Checkout navigation", err);
        notify("تعذر فتح الشراء. حاول مجددًا.");
      } finally {
        setTimeout(() => { if (buy.isConnected) { buy.disabled=false;buy.classList.remove("loading"); } }, 400);
      }
    });
    nav.addEventListener("click", e => {
      const btn=e.target.closest("[data-ll-nav]");
      if (!btn) return;
      routeView(btn.dataset.llNav);
    });
    // Keep custom nav highlighting consistent with existing account/wallet/drawer navigation.
    document.addEventListener("click", e => {
      const existing=e.target.closest('[data-view]:not([data-ll-nav])');
      if (!existing) return;
      const view=existing.dataset.view;
      setTimeout(() => updateNavigation(view), 0);
    }, false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build, {once:true});
  else build();
})();
