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
  let currentCategory = "codes";

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function reducedMotion() {
    return !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function allPubgProducts() {
    const catalog = typeof products === "undefined" ? [] : products;
    return (Array.isArray(catalog) ? catalog : []).filter((p) =>
      /pubg|ببجي|بوبجي/i.test([p.game, p.name, p.product_key].join(" "))
    );
  }
  function categoryFor(p) {
    const label = [p.name, p.product_key, p.description].join(" ").toLowerCase();
    if (/عرض|offer|promo|خصم|discount/.test(label)) return "offers";
    if (/كود|code|بطاق[ةه]|card|redeem|voucher/.test(label)) return "codes";
    return "charge";
  }
  function categoryProducts(key) {
    return allPubgProducts().filter((p) => categoryFor(p) === key);
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
  function paintOffers(panel, key) {
    const match = CATEGORIES.find((item) => item.key === key) || CATEGORIES[0];
    const list = categoryProducts(match.key);
    panel.innerHTML = '<div class="pubg-results-heading"><div>'
      + '<span class="pubg-eyebrow">L1017N / ' + safe(match.latin) + '</span>'
      + '<h2>' + safe(match.title) + '</h2>'
      + '<p>' + safe(match.subtitle) + '</p></div><span class="pubg-results-count">' + countLabel(list.length) + '</span></div>'
      + (list.length ? '<div class="pubg-packages">' + list.map(productCard).join("") + '</div>'
        : '<div class="pubg-empty-state"><div class="pubg-empty-icon" aria-hidden="true">UC</div>'
          + '<strong>ما فيش باقات متوفرة في القسم حاليًا</strong>'
          + '<p>أول ما نضيف باقات جديدة للمتجر، بتظهر هنا تلقائيًا.</p></div>')
      + '<p class="pubg-purchase-note">التسليم الفوري للأكواد المتاحة فقط، ويتم تأكيد المخزون والمبلغ قبل خصم رصيد المحفظة.</p>';

    panel.querySelectorAll("[data-pubg-buy]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = list.find((p) => String(p.id) === button.dataset.pubgBuy);
        if (!selected) return;
        if (typeof window.openInstantCodeCheckout === "function") {
          window.openInstantCodeCheckout(selected.id, selected.name, selected.price);
        } else {
          window.alert("خدمة الشراء غير جاهزة الآن. حدّث الصفحة وحاول مرة أخرى.");
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
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pubg-premium-open");
    if (lastFocused && lastFocused.isConnected) lastFocused.focus({ preventScroll: true });
  }

  function openPremiumPubg() {
    lastFocused = document.activeElement;
    const root = page();
    const list = allPubgProducts();
    const featured = list.filter((p) => categoryFor(p) === "codes").length;
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
      + '<p class="pubg-hero-description">تصفح بطاقات الشدات وأكواد الشحن، واختر الباقة المناسبة لك بتجربة بسيطة وسريعة.</p>'
      + '<div class="pubg-hero-actions"><button type="button" class="pubg-explore" data-pubg-explore>استكشف الباقات <span aria-hidden="true">↙</span></button>'
      + '<span class="pubg-hero-note"><span class="pubg-note-dot"></span> شراء من رصيد المحفظة</span></div>'
      + '</div><div class="pubg-hero-visual"><div class="pubg-hero-halo"></div>'
      + '<img src="game-covers/pubg.svg" alt="" loading="eager" decoding="async">'
      + '<span class="pubg-visual-sticker">LEVEL UP <b>UC STORE</b></span></div>'
      + '<div class="pubg-hero-caption">L1017N <b>×</b> PUBG MOBILE <span>•</span> DIGITAL ITEMS</div>'
      + '</section>'
      + '<div class="pubg-section-label"><div><span class="pubg-eyebrow">CHOOSE YOUR CATEGORY</span><h2>استكشف الأقسام</h2><p>كل قسم له باقاته الخاصة. اختَر اللي يناسبك.</p></div><span class="pubg-section-number">01 — 03</span></div>'
      + '<div class="pubg-choice-grid" role="group" aria-label="أقسام ببجي">'
      + CATEGORIES.map((item, i) => {
          const count = categoryProducts(item.key).length;
          return '<button type="button" class="pubg-choice ' + (item.key === currentCategory ? "selected" : "") + '" data-pubg-category="' + safe(item.key) + '" aria-pressed="' + String(item.key === currentCategory) + '">'
            + '<span class="pubg-choice-step">0' + (i + 1) + '<span aria-hidden="true">↗</span></span>'
            + '<span class="pubg-choice-art pubg-choice-art-' + safe(item.key) + '"><i>' + safe(item.visual) + '</i></span>'
            + '<span class="pubg-choice-info"><strong>' + safe(item.title) + '</strong><small>' + countLabel(count) + '</small></span>'
            + '</button>';
        }).join("")
      + '</div><div id="pubgCategoryResults" class="pubg-results" aria-live="polite"></div>'
      + '<footer class="pubg-footer"><span>L1017N STORE</span><span>تسوّق بسهولة، واستلم كودك بعد إتمام الشراء.</span></footer>'
      + '</div>';

    document.body.classList.add("pubg-premium-open");
    root.scrollTop = 0;
    root.querySelector("[data-pubg-close]").addEventListener("click", closePremiumPubg);
    root.querySelector("[data-pubg-explore]").addEventListener("click", () => {
      root.querySelector(".pubg-choice-grid").scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth", block: "center"
      });
    });
    root.querySelectorAll("[data-pubg-category]").forEach((button) => {
      button.addEventListener("click", () => setCategory(root, button.dataset.pubgCategory));
    });
    const selected = CATEGORIES.some((entry) => entry.key === currentCategory) ? currentCategory : "codes";
    setCategory(root, selected, false);
    root.querySelector("[data-pubg-close]").focus({ preventScroll: true });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePremiumPubg();
  });
  window.renderPremiumPubg = openPremiumPubg;
  window.closePremiumPubg = closePremiumPubg;
})();
