/* L1017n Live Mobile Storefront · integrates the standalone demo with the existing Supabase storefront.
   No payment writes here: checkout stays exclusively in legacy-app.js/instant-code.js. */
(function () {
  "use strict";
  const ICONS = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    orders: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
    chevron: '<path d="m14 6-6 6 6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  const SVG = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  const GAME_META = {
    roblox: { name: "Roblox", tag: "روبوكس", color: "purple", art: "R" },
    pubg: { name: "PUBG Mobile", tag: "ببجي موبايل", color: "amber", art: "UC" },
    mm2: { name: "MM2", tag: "مستلزمات MM2", color: "blue", art: "M" },
    "steal-a-brainrot": { name: "ماب السرقة", tag: "Steal a Brainrot", color: "teal", art: "01" },
    fortnite: { name: "Fortnite", tag: "فورت نايت", color: "indigo", art: "FN" },
    freefire: { name: "Free Fire", tag: "فري فاير", color: "orange", art: "FF" }
  };
  const FILTERS = [["all", "الكل"], ["roblox", "Roblox"], ["pubg", "PUBG"], ["mm2", "MM2"], ["steal-a-brainrot", "ماب السرقة"], ["fortnite", "Fortnite"], ["freefire", "Free Fire"]];
  const HEROES = [
    { headline: "عالم روبلوكس", more: "صار أقرب لك", desc: "باقات Robux ومستلزمات المابات في مكان واحد.", label: "ROBLOX · L1017N", action: "roblox", button: "استكشف روبلوكس", theme: "violet", art: "R" },
    { headline: "شدات ببجي", more: "بكل سهولة", desc: "شوف بطاقات PUBG المتوفرة وأسعارها الحقيقية.", label: "PUBG MOBILE · UC", action: "pubg", button: "تصفح ببجي", theme: "gold", art: "UC" },
    { headline: "ماب السرقة", more: "شخصياتك هنا", desc: "قرما ولاسيكرت ولاسبوكي في قسم واحد.", label: "STEAL A BRAINROT", action: "steal-a-brainrot", button: "تصفح الماب", theme: "aqua", art: "01" }
  ];
  const q = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const normalize = value => String(value ?? "").toLowerCase().normalize("NFKC").replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const price = value => Number(value || 0).toFixed(2) + " د.ل";
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
  function displayList() {
    const available = catalog().filter(item => item && item.active !== false && Number(item.price) > 0);
    let filtered = available.filter(item => {
      const category = gameKey(item);
      if (chosen !== "all" && category !== chosen) return false;
      if (!query) return true;
      const meta = itemMeta(item);
      const text = normalize([item.name, item.game, item.product_key, meta.name, meta.tag].join(" "));
      return text.includes(query);
    });
    // Present an editorial cross-game mix on the home page, then all remaining inventory.
    if (chosen === "all" && !query) {
      const priorities = ["robux-100", "pubg-60", "mm2-minty-gun", "steal-garama", "steal-los-secret", "steal-los-spooky"];
      filtered = filtered.slice().sort((a, b) => {
        const ai = priorities.indexOf(a.product_key), bi = priorities.indexOf(b.product_key);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        return String(a.game).localeCompare(String(b.game));
      });
    }
    return filtered;
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
      if (key === "roblox" || key === "mm2" || key === "steal-a-brainrot") {
        if (typeof window.openRobloxGameMenu !== "function") { notify("القسم مازال يتحمّل. جرّب تحديث الصفحة."); return; }
        window.openRobloxGameMenu();
        if (key !== "roblox") {
          const choice = key === "mm2" ? "mm2" : "brainrot";
          requestAnimationFrame(() => q('#robloxGamePage [data-rgp-choice="' + choice + '"]')?.click());
        }
        return;
      }
      if (key === "pubg") {
        if (typeof window.renderPremiumPubg === "function") window.renderPremiumPubg();
        else if (typeof openPubgCategories === "function") openPubgCategories();
        else notify("قائمة ببجي غير جاهزة حاليًا.");
        return;
      }
      if (typeof showGameProductPreview === "function") {
        showGameProductPreview(key);
        return;
      }
      notify("القسم مازال يتحمّل. حاول مجددًا.");
    } catch (e) {
      console.error("[live-ui] Game navigation", e);
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
    if (key === "pubg" && typeof window.openInstantCodeCheckout === "function") {
      window.openInstantCodeCheckout(product.id, product.name, product.price);
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
      + '<button type="button" class="ll-quickbuy" data-ll-buy="' + esc(item.id) + '" aria-label="شراء ' + title + '"><span class="ll-buy-label">شراء سريع</span>'
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
  function renderCatalog() {
    const root = q("#llCatalog");
    if (!root) return;
    const productsToShow = displayList();
    const all = catalog().filter(p => p && p.active !== false);
    q("#llItemCount").textContent = all.length ? productsToShow.length + " من " + all.length + " منتج" : "جاري تحميل المنتجات";
    if (!all.length) {
      root.innerHTML = '<div class="ll-empty">جاري تحميل باقات المتجر الحقيقية…</div>';
      return;
    }
    if (!productsToShow.length) {
      root.innerHTML = '<div class="ll-empty">ما فيش منتجات تطابق بحثك. جرّب كلمة ثانية أو اختَر «الكل».</div>';
      return;
    }
    root.innerHTML = productsToShow.map(card).join("");
    reveal([...root.querySelectorAll(".ll-reveal")]);
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
  function updateNavigation(view) {
    const which = view === "store" ? "home" : view;
    q("#llBottomNav")?.querySelectorAll("[data-ll-nav]").forEach(button => {
      const active = button.dataset.llNav === which;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }
  function goSearch() {
    routeView("home");
    const search = q("#llSearch");
    if (!search) return;
    q("#llSearchWrap")?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    setTimeout(() => { if (q("#storeView") && !q("#storeView").classList.contains("hidden")) search.focus({ preventScroll: true }); }, 100);
    updateNavigation("search");
  }
  function makeHeroSlides() {
    return HEROES.map((slide, index) => '<article class="ll-slide ll-hero-' + slide.theme + '" data-ll-slide="' + index + '" aria-label="' + esc(slide.label) + '">'
      + '<div class="ll-slide-copy"><span class="ll-slide-eyebrow">' + esc(slide.label) + '</span>'
      + '<h2>' + esc(slide.headline) + '<br><span>' + esc(slide.more) + '</span></h2>'
      + '<p>' + esc(slide.desc) + '</p>'
      + '<button type="button" data-ll-game="' + esc(slide.action) + '" class="ll-slide-cta">' + esc(slide.button) + ' <span aria-hidden="true">←</span></button></div>'
      + '<span class="ll-slide-letter" aria-hidden="true">' + esc(slide.art) + '</span></article>').join("");
  }
  function build() {
    const store = q("#storeView");
    if (!store || q("#llLanding")) return;
    const container = document.createElement("div");
    container.id = "llLanding";
    container.innerHTML = '<div class="ll-intro ll-reveal">'
      + '<div class="ll-intro-text"><span class="ll-overline">أهلًا بيك في متجرك</span>'
      + '<h1>اللعبة تبدأ <span>من هنا.</span></h1><p>باقات الألعاب الرقمية، بتجربة سهلة وسريعة.</p></div>'
      + '<div class="ll-intro-star" aria-hidden="true">✦</div></div>'
      + '<div class="ll-search-wrap" id="llSearchWrap">' + SVG("search")
      + '<label class="ll-sr-only" for="llSearch">البحث عن الألعاب والمنتجات</label>'
      + '<input id="llSearch" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="ابحث عن روبوكس، شدات، ماب السرقة…"></div>'
      + '<div class="ll-title-row ll-title-offers"><div><small>اسحب للتصفح ←</small><h2>اكتشف العروض</h2></div></div>'
      + '<section class="ll-carousel ll-reveal" aria-label="العروض المميزة" aria-roledescription="carousel">'
      + '<div id="llSlideTrack" class="ll-carousel-track" tabindex="0">' + makeHeroSlides() + '</div>'
      + '<div class="ll-carousel-controls"><button type="button" class="ll-slider-arrow" data-ll-slide-step="-1" aria-label="العرض السابق">' + SVG("chevron") + '</button>'
      + '<div class="ll-dots" role="group" aria-label="اختيار العرض">' + HEROES.map((s,i) => '<button type="button" class="ll-dot ' + (i===0?'selected':'') + '" data-ll-dot="' + i + '" aria-label="العرض ' + (i+1) + '" aria-current="' + (i===0) + '"></button>').join("") + '</div>'
      + '<button type="button" class="ll-slider-arrow" data-ll-slide-step="1" aria-label="العرض التالي">' + SVG("chevron") + '</button></div></section>'
      + '<div class="ll-title-row ll-products-title"><div><small>EXPLORE THE STORE</small><h2>الألعاب والباقات</h2></div><span id="llItemCount">جاري التحميل</span></div>'
      + '<div class="ll-categories" id="llCategories" role="group" aria-label="تصفية الباقات">'
      + FILTERS.map(([key, label]) => '<button type="button" data-ll-category="' + esc(key) + '" aria-pressed="' + (key==='all') + '" class="' + (key==='all'?'selected':'') + '">' + esc(label) + '</button>').join("") + '</div>'
      + '<div class="ll-catalog" id="llCatalog" aria-live="polite"></div>'
      + '<p class="ll-safety-note">الأسعار من مخزون المتجر الفعلي. يتم تأكيد الرصيد والتوفر عند إتمام الطلب.</p>'
      + '<section class="ll-help ll-reveal"><div><h2>تحتاج مساعدة؟</h2><p>تابع الطلبات من حسابك، أو افتح القائمة للوصول إلى المحفظة والدعم.</p></div>'
      + '<button type="button" data-ll-show-orders>طلباتي ←</button></section>';

    // Insert before existing legacy store content. Existing screens, forms and modal handlers remain intact.
    store.insertBefore(container, store.firstChild);
    const nav = document.createElement("nav");
    nav.id = "llBottomNav";
    nav.setAttribute("aria-label", "التنقل الرئيسي");
    nav.innerHTML = [
      ["home", "الرئيسية", "home"],
      ["search", "البحث", "search"],
      ["orders", "طلباتي", "orders"],
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
  function bindEvents(container, nav) {
    const search = q("#llSearch");
    search.addEventListener("input", () => {
      query = normalize(search.value.trim());
      renderCatalog();
      if (query) updateNavigation("search");
      else updateNavigation("home");
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
      if (btn.dataset.llNav === "search") goSearch();
      else routeView(btn.dataset.llNav);
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
