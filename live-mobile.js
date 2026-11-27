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
  ICONS.grid = '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>';
  ICONS.games = '<path d="M8 7h8a4 4 0 0 1 4 3l1 5a2 2 0 0 1-3 2l-2-2H8l-2 2a2 2 0 0 1-3-2l1-5a4 4 0 0 1 4-3Z"/><path d="M8 10v4m-2-2h4m6-1h.01m2 2h.01"/>';
  ICONS.local = '<path d="M3 9 5 4h14l2 5v2a3 3 0 0 1-3 3h-1a3 3 0 0 1-2.5-1.4A3 3 0 0 1 12 14a3 3 0 0 1-2.5-1.4A3 3 0 0 1 7 14H6a3 3 0 0 1-3-3V9Zm2 5v6h14v-6M3 9h18"/>';
  ICONS.voice = '<path d="M3 11v2m4-5v8m5-12v16m5-12v8m4-5v2"/>';
  ICONS.chat = '<path d="M8 10h8m-8 4h5M5 19l-2 2v-5a4 4 0 0 1-1-3V8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H8Z"/>';
  ICONS.telegram = '<path d="m22 3-7 18-4-8-9-4 20-6ZM22 3 11 13"/>';
  const SVG = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  const GAME_META = {
    roblox: {name:"Roblox",tag:"روبلوكس",color:"purple",art:"R"},
    mm2: {name:"MM2",tag:"Murder Mystery 2",color:"blue",art:"M"},
    "steal-a-brainrot": {name:"ماب السرقة",tag:"Steal a Brainrot",color:"teal",art:"01"},
    pubg: {name:"PUBG Mobile",tag:"ببجي موبايل",color:"gold",art:"UC"},
    psn: {name:"PlayStation Store",tag:"بطاقات بلايستيشن",color:"blue",art:"PS"}
  };
  const FILTERS = [["all","الجميع","grid"],["games","الألعاب","games"],["cards","بطاقات الهدايا","gift"]];
  const HEROES = [
    {
      eyebrow:"ROBLOX • GAME TOP-UP",headline:"عالم روبلوكس",highlight:"باقات شحن لكل لاعب",
      description:"روبوكس وألعاب روبلوكس في مكان واحد.",
      action:"roblox",button:"استكشف روبلوكس",theme:"violet",
      image:"game-covers/packages/roblox-code-card-20261118.webp"
    },
    {
      eyebrow:"PUBG MOBILE • UC",headline:"شدّات ببجي",highlight:"جهّز حسابك للمعركة",
      description:"تصفح باقات شدات ببجي المتاحة.",
      action:"pubg",button:"شوف الشدّات",theme:"gold",
      image:"game-covers/mobile/pubg-battlefront.webp",
      imageHigh:"game-covers/4k/pubg-battlefront.webp",imageMobileWidth:640,imageHighWidth:2560
    },
    {
      eyebrow:"PLAYSTATION • GIFT CARDS",headline:"بطاقات بلايستيشن",highlight:"كل الألعاب أقرب لك",
      description:"اختار البطاقة المناسبة لدولة حسابك.",
      action:"psn",button:"تصفّح البطاقات",theme:"aqua",
      image:"game-covers/mobile/psn-user-card.webp",
      imageHigh:"game-covers/4k/psn-user-card.webp",imageMobileWidth:700,imageHighWidth:2799
    }
  ];
  const q = selector => document.querySelector(selector);
  const includesFilter = section => chosen === "all" || chosen === section;
  const sectionHeading = (id, icon, title) =>
    '<div class="ll-title-row ll-products-title ll-section-heading" data-ll-tone="' + icon + '"><span class="ll-category-icon">' + SVG(icon) + '</span><h2 id="' + id + '">' + title + '</h2></div>';
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const normalize = value => String(value ?? "").toLowerCase().normalize("NFKC").replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const price = value => Number(value || 0).toFixed(2) + " د.ل";
  let moreGamesExpanded = false;
  let chosen = "all", query = "", lastCatalog = null, activeSlide = 0;
  let observer = null, refreshTimer = null;

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
  // One Roblox parent with three subcategories; checkout and stock stay unchanged.
  const SHOP_SECTIONS = [
    {key:"roblox",title:"روبلوكس",subtitle:"شحن روبوكس وMM2 وماب السرقة",image:"game-covers/roblox-mark.svg?v=logo-square1",tag:"ROBLOX"},
    {key:"mm2",title:"MM2",subtitle:"أسلحة ومستلزمات الماب",image:"game-covers/official/mobile/mm2.webp?v=official-art-20261102",tag:"MURDER MYSTERY 2"},
    {key:"steal-a-brainrot",title:"ماب السرقة",subtitle:"شخصيات Steal a Brainrot",image:"game-covers/official/mobile/brainrot.webp?v=official-art-20261102",tag:"STEAL A BRAINROT"}
  ];
  function matchesSection(section) {
    if (!includesFilter("games")) return false;
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
  function matchesPubg(){
    if(!includesFilter("games"))return false;
    if(!query)return true;
    const aliases="ببجي ببجي موبايل شدات شدة شحن معرف حساب uid uc pubg mobile";
    return normalize(aliases).includes(query);
  }
  function matchesPsn(){
    if(!includesFilter("cards"))return false;
    return !query || normalize("بلايستيشن بلاستيشن بلاي ستيشن بطاقات الهدايا شحن اكواد psn playstation store PS4 PS5 امريكا السعودية تركيا الامارات").includes(query);
  }
  function matchesRobloxCodes(){
    if(!includesFilter("cards"))return false;
    return !query || normalize("بطاقات الهدايا أكواد روبلوكس بطاقات روبلوكس روبوكس roblox robux gift cards").includes(query);
  }
  function packageAvailability(count){
    return count == null ? '' : '<small class="ll-stock-count">'+count+' باقة متوفرة</small>';
  }
  function robloxPackageCount(madar,supplierCount){
    const robux=typeof robuxPackagesForWallet==="function"?robuxPackagesForWallet(madar?"almadar":"libyana"):[];
    const robuxCount=robux.filter(p=>Number(p.price)>0&&Number(p.amount)>0&&
      (robuxUnlimited||robuxAvailable>=Number(p.amount))).length;
    if(madar)return robuxCount;
    const gameItems=catalog().filter(p=>{
      const game=gameKey(p);
      return p.active===true&&Number(p.price)>0&&(
        game==="mm2"||(game==="steal-a-brainrot"&&(p.stock_quantity==null||Number(p.stock_quantity)>0))
      );
    }).length;
    return robuxCount+gameItems+supplierCount;
  }
  function robloxCodesCard(){
    return '<article class="ll-game-section ll-game-roblox ll-reveal" dir="rtl">'
      +'<button type="button" class="ll-game-section-link" data-ll-game="roblox-codes" aria-label="فتح أكواد روبلوكس">'
      +'<span class="ll-game-section-art"><img src="game-covers/packages/roblox-code-card-20261118.webp" alt="" loading="lazy" decoding="async"></span>'
      +'<span class="ll-game-section-details"><strong>أكواد روبلوكس</strong></span>'
      +'</button></article>';
  }
  function psnParentCard(count){
    return '<article class="ll-game-section ll-game-psn ll-reveal" dir="rtl">'
      +'<button type="button" class="ll-game-section-link" data-ll-game="psn" aria-label="فتح بطاقات بلايستيشن">'
      +'<span class="ll-game-section-art"><img src="game-covers/packages/psn.webp" alt="PlayStation Store" loading="eager" decoding="async"></span>'
      +'<span class="ll-game-section-details"><strong>بلايستيشن</strong>' + packageAvailability(count) + '</span>'
      +'</button></article>';
  }
  function pubgParentCard(count){
    return '<article class="ll-game-section ll-game-pubg ll-reveal" dir="rtl">'
      +'<button type="button" class="ll-game-section-link" data-ll-game="pubg" aria-label="فتح ببجي موبايل">'
      +'<span class="ll-game-section-art"><img src="game-covers/pubg-battlefront.webp" alt="" loading="eager" decoding="async"></span>'
      +'<span class="ll-game-section-details"><strong>ببجي موبايل</strong>' + packageAvailability(count) + '</span>'
      +'</button></article>';
  }
  function robloxParentCard(count){
    // The original Robux game-tile layout, with only its visible name changed
    // to Roblox. Checkout options remain inside the Roblox section.
    return '<article class="ll-game-section ll-game-roblox ll-reveal" dir="rtl">'
      +'<button type="button" class="ll-game-section-link" data-ll-game="roblox" aria-label="فتح روبلوكس">'
      +'<span class="ll-game-section-art"><img src="game-covers/roblox-mark.svg?v=logo-square1" alt="" loading="eager" decoding="async"></span>'
      +'<span class="ll-game-section-details"><strong>روبلوكس</strong>' + packageAvailability(count) + '</span>'
      +'</button></article>';
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
        if(document.body.dataset.checkoutWallet!=="almadar"&&typeof window.openRobloxGameMenu==="function")window.openRobloxGameMenu();
        else if(typeof window.openRobuxPackages==="function")window.openRobuxPackages();
        else notify("قسم روبلوكس غير جاهز حاليًا.");
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
      if(key==="roblox-codes"){
        if(typeof window.openRobloxGiftCards==="function")window.openRobloxGiftCards();
        else notify("قسم أكواد روبلوكس غير جاهز حاليًا.");
        return;
      }
      if(key==="psn"){
        if(typeof window.openPsnStore==="function")window.openPsnStore();
        else notify("قسم البلايستيشن قيد التحديث، حدّث الصفحة وحاول مجددًا.");
        return;
      }
      if(key==="pubg"){
        if(typeof window.renderPremiumPubg==="function")window.renderPremiumPubg();
        else if(typeof openPubgCategories==="function")openPubgCategories();
        else notify("قسم ببجي مازال يتحمّل، جرّب تحديث الصفحة.");
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
      + '<button type="button" class="ll-quickbuy" data-ll-buy="' + esc(item.id) + '" aria-label="شراء ' + title + '"><span class="ll-buy-label">شراء الآن</span>'
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
  // Color each category border by its actual game name (not grid position).
  // Pure presentation: does not change catalog, prices, stock or checkout.
  function applyCatalogEdgeColors(panel) {
    if (!panel) return;
    const colors = [
      [/روبلوكس|روبوكس|roblox|robux/i,"roblox"],
      [/ببجي|pubg/i,"pubg"],
      [/فري\s*فاير|free\s*fire/i,"freefire"],
      [/جينشن|genshin/i,"genshin"],
      [/موبايل\s*ليجند|mobile\s*legends/i,"mlbb"],
      [/يلا\s*لودو|yalla\s*ludo/i,"ludo"],
      [/بلود\s*سترايك|blood\s*strike/i,"bloodstrike"],
      [/فورت\s*نايت|fortnite/i,"fortnite"],
      [/كول\s*اوف\s*ديوتي|call\s*of\s*duty|cod\s*mobile/i,"cod"],
      [/فالورانت|valorant/i,"valorant"],
      [/بلايستيشن|playstation|psn/i,"psn"],
      [/ستيم|steam/i,"steam"],
      [/ايتونز|آيتونز|itunes|apple/i,"apple"],
      [/اكس\s*بوكس|إكس\s*بوكس|xbox/i,"xbox"],
      [/أمازون|امازون|amazon/i,"amazon"],
      [/نينتندو|nintendo/i,"nintendo"],
      [/نتفلكس|نيتفليكس|netflix/i,"netflix"]
    ];
    panel.querySelectorAll(".ll-game-section").forEach((card,index) => {
      const title=card.querySelector(".ll-game-section-details strong")?.textContent || "";
      const matched=colors.find(([pattern]) => pattern.test(title));
      card.dataset.llAccent=matched ? matched[1] : "other"+(index%6);
    });
  }
  function renderCatalog() {
    const root=q("#llCatalog");
    if(!root)return;
    const madar=document.body.dataset.checkoutWallet==="almadar";
    const gamesSection=q("#llGamesSection");
    const giftSection=q("#llGiftSection");
    const gifts=q("#llGiftCatalog");
    const extra=madar?null:window.L1017nCompleteCatalog;
    const catalogStatus=madar?"ready":extra?.status?.()||"loading";
    const waitingForCatalog=catalogStatus!=="ready";
    const showDirectLinks=waitingForCatalog&&!query;
    const available=extra?.categories?.()||[];
    const supplierCount=game=>available.reduce((total,p)=>p.game===game?total+(Number(p.count)||0):total,0);
    const pubgCount=supplierCount("pubg");
    const psnCount=supplierCount("psn");
    const robloxSupplierCount=supplierCount("roblox");
    const visibleRoblox=(madar||matchesSection(SHOP_SECTIONS[0]))&&(madar||showDirectLinks||catalog().some(p=>gameKey(p)==="roblox")||robloxSupplierCount>0);
    const visiblePubg=!madar&&matchesPubg()&&(showDirectLinks||pubgCount>0);
    const visiblePsn=!madar&&matchesPsn()&&(showDirectLinks||psnCount>0);
    const games=(visibleRoblox?robloxParentCard(waitingForCatalog?null:robloxPackageCount(madar,robloxSupplierCount)):"")+(visiblePubg?pubgParentCard(waitingForCatalog?null:pubgCount):"")+(extra?.homeCards("games",query,chosen)||"");
    // No active Roblox gift-card code products in the verified store inventory.
    // Keep the old code page and data intact; do not promote an unavailable gift card.
    const giftCards=madar?"":(visiblePsn?psnParentCard(waitingForCatalog?null:psnCount):"")+(extra?.homeCards("cards",query,chosen)||"");
    // Lower-demand catalogs remain at the supplier/admin level instead of crowding the homepage.
    const moreSections=["local","voice","other"].map(section=>[section,""]);
    const compact=!madar&&chosen==="all"&&!query;
    const hasResults=Boolean(games||giftCards||moreSections.some(([,cards])=>Boolean(cards)));
    const status=q("#llCatalogStatus");
    status.hidden=!waitingForCatalog;
    status.querySelector("p").textContent=catalogStatus==="error"
      ?"تعذّر تحميل قائمة الباقات. جرّب إعادة المحاولة."
      :"جاري تحميل الباقات…";
    q("#llCatalogRetry").hidden=catalogStatus!=="error";
    q("#llCatalogEmpty").hidden=waitingForCatalog||hasResults;
    const nextCatalog=JSON.stringify([compact,games,giftCards,moreSections]);
    if(nextCatalog===lastCatalog)return;
    lastCatalog=nextCatalog;
    for(const [section,cards] of moreSections){
      const panel=q('[data-ll-section="' + section + '"]');
      panel.hidden=!cards;
      panel.querySelector(".ll-catalog").innerHTML=cards;
    }
    const showGames=Boolean(games);
    const showGifts=Boolean(giftCards);
    gamesSection.hidden=!showGames;
    giftSection.hidden=!showGifts;
    q("#llAllSupplierProducts").hidden=!compact||!moreSections.some(([,cards])=>Boolean(cards));
    root.innerHTML=games;
    window.L1017nSortGamesBySales?.(root);
    applyCatalogEdgeColors(root);
    // Keep six prominent games up front; reveal the remaining categories on request.
    let more=q("#llMoreGames");
    if(!more){
      root.insertAdjacentHTML("afterend",'<div id="llMoreGames"><button type="button" class="sc-all-link" id="llMoreGamesButton" aria-expanded="false" aria-controls="llMoreGamesGrid">المزيد من الألعاب</button><div class="ll-catalog" id="llMoreGamesGrid" hidden></div></div>');
      more=q("#llMoreGames");
      q("#llMoreGamesButton").addEventListener("click",()=>{
        moreGamesExpanded=!moreGamesExpanded;
        const grid=q("#llMoreGamesGrid"), button=q("#llMoreGamesButton");
        grid.hidden=!moreGamesExpanded;
        button.setAttribute("aria-expanded",String(moreGamesExpanded));
        button.textContent=moreGamesExpanded?"عرض ألعاب أقل":"المزيد من الألعاب";
      });
    }
    const moreGrid=q("#llMoreGamesGrid"), moreButton=q("#llMoreGamesButton");
    moreGrid.replaceChildren();
    const remaining=[]; // All selected popular game categories fit on the homepage.
    if(remaining.length)moreGrid.append(...remaining);
    more.hidden=!remaining.length;
    moreGrid.hidden=!moreGamesExpanded;
    moreButton.textContent=moreGamesExpanded?"عرض ألعاب أقل":"المزيد من الألعاب";
    moreButton.setAttribute("aria-expanded",String(moreGamesExpanded));
    const heading=q("#llGamesHeading");
    if(heading)heading.textContent="أشهر 10 ألعاب للشحن";
    gifts.innerHTML=giftCards;
    window.L1017nSortGiftCardsByPopularity?.(gifts);
    applyCatalogEdgeColors(gifts);
    const giftHeading=q("#llGiftHeading");
    if(giftHeading)giftHeading.textContent="أشهر 10 بطاقات هدايا";
    q("#llLanding").querySelectorAll(".ll-catalog .ll-reveal").forEach(card=>card.classList.add("ll-shown"));
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
    q("#llCatalogRetry").addEventListener("click",()=>window.L1017nCompleteCatalog?.refresh());
    const search = q("#llSearch");
    if (!search) return;
    q("#llSearchWrap")?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    setTimeout(() => { if (q("#storeView") && !q("#storeView").classList.contains("hidden")) search.focus({ preventScroll: true }); }, 100);
    updateNavigation("home");
  }
  function makeHeroSlides() {
    return HEROES.map((slide, index) => '<article class="ll-slide ll-hero-' + esc(slide.theme) + '" data-ll-slide="' + index + '" aria-label="' + esc(slide.headline) + '">'
      + '<span class="ll-hero-light-lines" aria-hidden="true"></span><span class="ll-hero-top-edge" aria-hidden="true"></span>'
      + '<span class="ll-hero-lightning" aria-hidden="true"></span>'
      + '<div class="ll-hero-art-stage" aria-hidden="true"><span class="ll-hero-orbit ll-hero-orbit-one"></span><span class="ll-hero-orbit ll-hero-orbit-two"></span>'
      + '<span class="ll-hero-light-spark"></span>'
      + '<img class="ll-compact-art" src="' + esc(slide.image) + '"'
      + (slide.imageHigh ? ' srcset="' + esc(slide.image) + ' ' + slide.imageMobileWidth + 'w, ' + esc(slide.imageHigh) + ' ' + slide.imageHighWidth + 'w" sizes="(max-width: 520px) 178px, (max-width: 1024px) 340px, 490px"' : '')
      + ' alt="" loading="eager" fetchpriority="' + (index===0?"high":"low") + '" decoding="async"></div>'
      + '<div class="ll-slide-copy"><span class="ll-hero-eyebrow"><span class="ll-hero-eyebrow-dot"></span>' + esc(slide.eyebrow) + '</span>'
      + '<h2>' + esc(slide.headline) + '<span class="ll-hero-highlight">' + esc(slide.highlight) + '</span></h2>'
      + '<p>' + esc(slide.description) + '</p>'
      + '<button type="button" data-ll-game="' + esc(slide.action) + '" class="ll-slide-cta"><span>' + esc(slide.button) + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.5 5-7 7 7 7M7 12h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'
      + '<span class="ll-hero-index" aria-hidden="true">L1017N • ' + String(index+1).padStart(2,"0") + '</span></article>').join("");
  }
  function build() {
    const store = q("#storeView");
    if (!store || q("#llLanding")) return;
    const container = document.createElement("div");
    container.id = "llLanding";
    container.innerHTML = '<section class="ll-carousel" aria-label="مختارات المتجر">'
      + '<div id="llSlideTrack" class="ll-carousel-track" tabindex="0">' + makeHeroSlides() + '</div>'
      + '<div class="ll-carousel-controls"><span class="ll-hero-progress-count" id="llHeroProgressCount" aria-hidden="true">01 <i>/</i> ' + String(HEROES.length).padStart(2,"0") + '</span>'
      + '<div class="ll-dots" role="group" aria-label="اختيار العرض">' + HEROES.map((slide,i) => '<button type="button" class="ll-dot ' + (i===0?'selected':'') + '" data-ll-dot="' + i + '" aria-label="العرض ' + (i+1) + ' من ' + HEROES.length + '" aria-current="' + (i===0) + '"></button>').join("") + '</div>'
      + '<button type="button" class="ll-slider-arrow" data-ll-slide-step="-1" aria-label="العرض السابق">' + SVG("chevron") + '</button>'
      + '<button type="button" class="ll-slider-arrow" data-ll-slide-step="1" aria-label="العرض التالي">' + SVG("chevron") + '</button></div></section>'
      + '<a class="ll-telegram-channel" href="https://t.me/+peZu58SqdSQ1YjY0" target="_blank" rel="noopener noreferrer">'
      + '<span class="ll-telegram-icon">' + SVG("telegram") + '</span>'
      + '<strong>تيليجرام المتجر</strong><span class="ll-telegram-info">انضم الآن</span>'
      + SVG("chevron") + '</a>'
      + '<div class="ll-search-wrap" id="llSearchWrap">' + SVG("search")
      + '<label class="ll-sr-only" for="llSearch">ابحث عن منتج أو خدمة</label>'
      + '<input id="llSearch" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="ابحث عن منتج أو خدمة…"></div>'
      + '<div class="ll-categories" id="llCategories" role="group" aria-label="تصفية الباقات">'
      + FILTERS.map(([key,label,icon]) => '<button type="button" data-ll-category="' + key + '" data-ll-tone="' + icon + '" aria-pressed="' + (key==="all") + '" class="' + (key==="all"?"selected":"") + '"><span class="ll-category-icon">' + SVG(icon) + '</span><span class="ll-category-indicator" aria-hidden="true"></span><span>' + label + '</span></button>').join("") + '</div>'
      + '<div id="llCatalogStatus" class="ll-empty" hidden><p role="status"></p><button type="button" class="btn btn-soft" id="llCatalogRetry" hidden>إعادة المحاولة</button></div>'
      + '<section id="llGamesSection" aria-labelledby="llGamesHeading">' + sectionHeading("llGamesHeading","games","شحن الألعاب")
      + '<div class="ll-catalog" id="llCatalog" aria-live="polite"></div></section>'
      + '<section id="llGiftSection" aria-labelledby="llGiftHeading">' + sectionHeading("llGiftHeading","gift","بطاقات الهدايا")
      + '<div class="ll-catalog" id="llGiftCatalog" aria-live="polite"></div></section>'
      + [["local","local","البطاقات المحلية"],["voice","voice","الخدمات الصوتية"],["other","grid","خدمات أخرى"]].map(([key,icon,title]) =>
        '<section data-ll-section="' + key + '" aria-labelledby="ll-section-' + key + '">' + sectionHeading("ll-section-" + key,icon,title) + '<div class="ll-catalog" aria-live="polite"></div></section>').join("")
      + '<button type="button" class="sc-all-link" id="llAllSupplierProducts" data-supplier-all hidden>جميع منتجات المتجر</button>'
      + '<div id="llCatalogEmpty" hidden><p class="ll-empty">ما فيش نتائج هنا. جرّب كلمة ثانية أو اختَر «الجميع».</p></div>'
      + '<p class="ll-safety-note">الأسعار والتوفر يُعرضان داخل كل قسم، ويتأكد الطلب عند الدفع.</p>'
      + '<section class="ll-help ll-reveal"><div><h2>تحتاج مساعدة؟</h2><p>تابع الطلبات من حسابك، أو افتح القائمة للوصول إلى المحفظة والدعم.</p></div>'
      + '<button type="button" data-ll-show-orders>طلباتي ←</button></section>';

    // Insert before existing legacy store content. Existing screens, forms and modal handlers remain intact.
    store.insertBefore(container, store.firstChild);
    const nav = document.createElement("nav");
    nav.id = "llBottomNav";
    nav.setAttribute("aria-label", "التنقل الرئيسي");
    nav.innerHTML = [
      ["home", "الرئيسية", "home"],
      ["orders", "طلباتي", "orders"],
      ["leaderboard", "التصنيف", "leaderboard"],
      ["wallet", "المحفظة", "wallet"],
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
    // Screen-level navigation feedback: never render loading/decoration beneath the dock.
    const navScreenLoader = document.createElement("div");
    navScreenLoader.id = "l1017nScreenNavLoader";
    navScreenLoader.hidden = true;
    navScreenLoader.setAttribute("role", "status");
    navScreenLoader.setAttribute("aria-live", "polite");
    navScreenLoader.setAttribute("aria-label", "فتح القسم");
    navScreenLoader.innerHTML = '<div class="ll-screen-load-card"><span class="ll-screen-load-ring" aria-hidden="true"></span><span class="ll-screen-load-label">جاري فتح القسم…</span></div>';
    document.body.appendChild(navScreenLoader);
    let navScreenTimer = 0, navScreenHideTimer = 0;
    function showNavScreenLoading(label) {
      if (reduceMotion()) return;
      const loader = navScreenLoader;
      const text = loader.querySelector(".ll-screen-load-label");
      if (text) text.textContent = "جاري فتح " + (label || "القسم") + "…";
      clearTimeout(navScreenTimer);
      clearTimeout(navScreenHideTimer);
      loader.hidden = false;
      requestAnimationFrame(() => loader.classList.add("is-visible"));
      // Navigation uses the existing synchronous switchView; this brief in-screen
      // transition must not pretend an async payment or request has completed.
      navScreenTimer = setTimeout(() => {
        loader.classList.remove("is-visible");
        navScreenHideTimer = setTimeout(() => { if (!loader.classList.contains("is-visible")) loader.hidden = true; }, 190);
      }, 330);
    }
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
    // Keep the five-tab mobile dock visible at all scroll positions.
    // Only authentication and full-screen overlays may hide the navigation.
    nav.classList.remove('ll-nav-scroll-away');
    nav.dataset.scrollMotion='visible';
    bindEvents(container, nav, showNavScreenLoading, navScreenLoader);
    renderCatalog();
    q("#storeStartupFallback")?.remove();
    window.dispatchEvent(new Event("l1017n:catalog-shell-ready"));
    reveal([...container.querySelectorAll(".ll-reveal:not(.ll-shown)")]);

    const legacyGrid = q("#productGrid");
    if (legacyGrid) {
      // Catalog refresh happens when loadProducts() redraws the real game tiles.
      new MutationObserver(() => {
        if(!query)return;
        clearTimeout(refreshTimer);
        refreshTimer=setTimeout(renderCatalog,80);
      })
        .observe(legacyGrid, {childList:true,subtree:false});
    }
  }
  // Scroll events intentionally do not change #llBottomNav visibility.
  // Its fixed layout stays visible while scrolling up or down.
  function bindEvents(container, nav, showNavScreenLoading, navScreenLoader) {
    q("#llCatalogRetry").addEventListener("click",()=>window.L1017nCompleteCatalog?.refresh());
    const search = q("#llSearch");
    search.addEventListener("input", () => {
      query = normalize(search.value.trim());
      renderCatalog();
      updateNavigation("home");
    });
    const categoryTapAnimations = new WeakMap();
    function animateCategoryTap(element, frames, timing) {
      if (typeof element?.animate !== "function") return;
      categoryTapAnimations.get(element)?.cancel();
      categoryTapAnimations.set(element, element.animate(frames, timing));
    }
    q("#llCategories").addEventListener("click", e => {
      const b = e.target.closest("[data-ll-category]");
      if (!b) return;
      setCategory(b.dataset.llCategory);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      animateCategoryTap(b.querySelector(".ll-category-icon"), [
        {transform:"translateX(0)"},
        {transform:"translateX(-2px) rotate(-3deg)"},
        {transform:"translateX(2px) rotate(3deg)"},
        {transform:"translateX(0)"}
      ], {duration:220,easing:"ease-out"});
      animateCategoryTap(b.querySelector(".ll-category-indicator"), [
        {transform:"translateX(-50%) scaleX(.55)"},
        {transform:"translateX(-50%) scaleX(1.28)",offset:.58},
        {transform:"translateX(-50%) scaleX(1)"}
      ], {duration:280,easing:"ease-out"});
    });
    const track = q("#llSlideTrack");
    const slides = [...track.querySelectorAll("[data-ll-slide]")];
    function updateDot(index) {
      activeSlide = index;
      const progressCount=q("#llHeroProgressCount");
      if(progressCount)progressCount.innerHTML=String(index+1).padStart(2,"0")+' <i>/</i> '+String(slides.length).padStart(2,"0");
      q("#llLanding")?.querySelectorAll("[data-ll-dot]").forEach((b,i) => {
        b.classList.toggle("selected", i === index);
        b.setAttribute("aria-current", String(i === index));
      });
    }
    let lastManualSlideAt=0;
    function scrollSlide(index,manual=true) {
      if(!slides.length)return;
      const next = (index + slides.length) % slides.length;
      if(manual)lastManualSlideAt=Date.now();
      updateDot(next);
      slides[next].scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest", inline: "center" });
    }
    // Advance only while this banner is visible. Manual swipes/taps pause autoplay.
    let carouselVisible=false;
    const carousel=track.closest(".ll-carousel");
    if("IntersectionObserver" in window && carousel){
      const carouselObserver=new IntersectionObserver(entries=>{
        carouselVisible=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.45);
      },{threshold:[0,0.45,0.8]});
      carouselObserver.observe(carousel);
    }else{
      carouselVisible=true;
    }
    const pauseAutoplay=()=>{lastManualSlideAt=Date.now();};
    track.addEventListener("pointerdown",pauseAutoplay,{passive:true});
    track.addEventListener("touchstart",pauseAutoplay,{passive:true});
    track.addEventListener("focusin",pauseAutoplay);
    if(!reduceMotion()){
      window.setInterval(()=>{
        if(!carouselVisible || document.hidden || !track.isConnected || slides.length<2)return;
        if(Date.now()-lastManualSlideAt<14000)return;
        if(track.matches(":hover")||track.contains(document.activeElement))return;
        if(!q("#storeView")||q("#storeView").classList.contains("hidden"))return;
        scrollSlide(activeSlide+1,false);
      },6500);
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
    let navFeedback;
    nav.addEventListener("click", e => {
      const btn=e.target.closest("[data-ll-nav]");
      if (!btn) return;
      if (e.isTrusted && typeof navigator.vibrate === "function") navigator.vibrate(12);
      const wasActive=btn.classList.contains("active");
      if(!wasActive)showNavScreenLoading(btn.getAttribute("aria-label") || btn.dataset.llNav);
      try { routeView(btn.dataset.llNav); }
      catch (error) {
        navScreenLoader.classList.remove("is-visible");
        navScreenLoader.hidden=true;
        console.error("[live-ui] Navigation",error);
        notify("تعذّر فتح القسم. حاول مرة أخرى.");
        return;
      }
      if(wasActive||!btn.classList.contains("active")||reduceMotion())return;
      navFeedback?.cancel();
      navFeedback=btn.querySelector(".ll-nav-icon svg")?.animate?.([
        {transform:"translateX(0) rotate(0)"},
        {transform:"translateX(-1px) rotate(-6deg)"},
        {transform:"translateX(1px) rotate(4deg)"},
        {transform:"translateX(0) rotate(0)"}
      ],{duration:240,easing:"ease-out"});
    });
    // Keep custom nav highlighting consistent with existing account/wallet/drawer navigation.
    document.addEventListener("click", e => {
      const existing=e.target.closest('[data-view]:not([data-ll-nav])');
      if (!existing) return;
      const view=existing.dataset.view;
      setTimeout(() => updateNavigation(view), 0);
    }, false);
  }
  window.addEventListener("l1017n:catalog-updated",renderCatalog);
  window.addEventListener("l1017n:catalog-status",renderCatalog);
  window.addEventListener("l1017n:storefront-ready",renderCatalog);
  window.addEventListener("l1017n:checkout-wallet-changed",renderCatalog);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build, {once:true});
  else build();
})();
