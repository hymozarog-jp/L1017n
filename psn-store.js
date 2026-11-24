/* L1017n PlayStation cards from the server-verified OMNEX catalog. */
(function () {
  'use strict';
  const db = () => typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  let root, entries = [], selectedRegion = null, regionScroll = 0, requestSeq = 0;
  const el = (tag, cls, label) => { const n = document.createElement(tag); if (cls) n.className = cls; if (label !== undefined) n.textContent = label; return n; };
  const cardArt = 'game-covers/packages/psn.webp';
  const money = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v).toFixed(2) + ' د.ل' : 'السعر غير متاح';
  const flags = [['أمريك','🇺🇸'],['USA','🇺🇸'],['US','🇺🇸'],['سعود','🇸🇦'],['SA','🇸🇦'],['إمارات','🇦🇪'],['AE','🇦🇪'],['تركي','🇹🇷'],['TR','🇹🇷'],['بريطان','🇬🇧'],['UK','🇬🇧'],['GB','🇬🇧'],['كويت','🇰🇼'],['قطر','🇶🇦'],['بحرين','🇧🇭'],['كند','🇨🇦'],['ألمان','🇩🇪'],['فرنس','🇫🇷'],['أسترال','🇦🇺'],['يابان','🇯🇵']];
  function countryFlag(label) { const s = String(label || '').trim(); return flags.find(([key]) => (key.length < 3 ? s.toUpperCase() === key : s.toLowerCase().includes(key.toLowerCase())))?.[1] || '🎮'; }
  function mount() {
    if (root) return;
    root = el('section', 'psn-screen');
    root.id = 'psnStoreScreen';
    root.dir = 'rtl'; root.hidden = true;
    root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','بطاقات بلايستيشن');
    root.innerHTML = '<div class="psn-wrap"><header class="psn-head"><button type="button" class="psn-back" aria-label="رجوع">→</button><div><p class="psn-eyebrow">PLAYSTATION STORE</p><h1 class="psn-title">بطاقات بلايستيشن</h1><p class="psn-sub">أكواد أصلية · اختر دولة حسابك قبل الشراء</p></div><span class="psn-mark"><img src="game-covers/packages/psn.webp" alt="" aria-hidden="true"></span></header><p class="psn-region-warning">مهم: البطاقة تعمل فقط مع دولة حساب PlayStation المطابقة. تأكد من الريجن قبل تأكيد الطلب.</p><div class="psn-tools" hidden aria-hidden="true"><input class="psn-search" type="hidden" value=""><input class="psn-only" type="checkbox" hidden></div><p class="psn-status" role="status" aria-live="polite">جاري تحميل بطاقات المورد…</p><div class="psn-regions"></div><div class="psn-list" hidden><h2 class="psn-region-title"></h2><div class="psn-products"></div></div><p class="psn-foot">الأسعار بالدينار الليبي. يُراجع السعر والمخزون مباشرة عند الشراء. الكود يظهر في طلباتي بعد تسليم المورد.</p></div>';
    document.body.append(root);
    root.querySelector('.psn-back').onclick = goBack;
    root.querySelector('.psn-search').oninput = draw;
    root.querySelector('.psn-only').onchange = draw;
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        goBack();
      }
    });
  }
  function open() {
    mount();
    root.hidden = false;
    document.body.classList.add('psn-open');
    selectedRegion = null;
    root.querySelector('.psn-search').value = '';
    root.querySelector('.psn-only').checked = false;
    root.scrollTop = 0; root.querySelector('.psn-back').focus({ preventScroll:true });
    draw();
    void reload();
  }
  function goBack() {
    if (!selectedRegion) {
      close();
      return;
    }
    const previousRegion = selectedRegion;
    selectedRegion = null;
    draw();
    root.scrollTop = regionScroll;
    [...root.querySelectorAll('.psn-region')].find(button => button.dataset.region === previousRegion)
      ?.focus({preventScroll:true});
  }
  function close() {
    if (!root) return;
    root.hidden = true;
    document.body.classList.remove('psn-open');
    requestSeq++;
    document.querySelector('[data-game-open="psn"]')?.focus({preventScroll:true});
  }
  function draw() {
    if (!root || root.hidden) return;
    const regions = root.querySelector('.psn-regions');
    const list = root.querySelector('.psn-list');
    const items = root.querySelector('.psn-products');
    const query = root.querySelector('.psn-search').value.trim().toLocaleLowerCase();
    const only = root.querySelector('.psn-only').checked;
    regions.replaceChildren(); items.replaceChildren();
    root.querySelector('.psn-back').setAttribute('aria-label', selectedRegion ? 'العودة إلى دول بلايستيشن' : 'العودة إلى المتجر');
    const filtered = entries.filter(p => (!only || p.available) && (p.name+' '+p.region).toLocaleLowerCase().includes(query));
    const preferredRegions = ['أمريكا','السعودية','الإمارات'];
    const keys = [...new Set(filtered.map(p => p.region))].sort((a,b)=>{const rank=x=>preferredRegions.includes(x)?preferredRegions.indexOf(x):99;return rank(a)-rank(b)||a.localeCompare(b,'ar');});
    if (!selectedRegion) {
      list.hidden = true;
      regions.hidden = false;
      for (const region of keys) {
        const b = el('button','psn-region');
        b.type = 'button'; const flag = el('span','psn-flag',countryFlag(region));
        const thumb = el('img','psn-region-thumb'); thumb.src=cardArt; thumb.alt=''; thumb.decoding='async'; thumb.loading='lazy';
        const cover = el('span','psn-region-art'); cover.append(thumb, flag);
        const meta = el('span','psn-region-meta');
        const available = filtered.filter(p=>p.region===region&&p.available).length;
        meta.append(el('strong','','بلايستيشن '+region),el('small','ll-stock-count',available+' باقة متوفرة'));
        const footer=el('span','psn-region-footer'); footer.append(meta,el('span','psn-arr','←'));
        b.append(cover, footer);
        b.dataset.region = region;
        b.onclick = () => {
          regionScroll = root.scrollTop;
          selectedRegion = region;
          draw();
          root.scrollTop = 0;
          root.querySelector('.psn-back').focus({preventScroll:true});
        };
        regions.append(b);
      }
    } else {
      list.hidden = false;
      regions.hidden = true;
      root.querySelector('.psn-region-title').textContent = countryFlag(selectedRegion)+' بلايستيشن '+selectedRegion;
      for (const product of filtered.filter(p=>p.region===selectedRegion)) {
        const b = el('button','psn-product');
        b.type = 'button'; b.disabled = !product.available; b.dataset.favId = String(product.id || product.name || "");
        const art = el('span','psn-product-art');
        const photo=el('img','psn-package-image'); photo.src=cardArt; photo.alt='بطاقة بلايستيشن'; photo.loading='lazy'; photo.decoding='async';
        art.append(photo,el('span','psn-product-country',countryFlag(selectedRegion)));
        if (!product.available) art.append(el('span','psn-sold-out','غير متوفر'));
        const detail=el('span','psn-product-detail');
        detail.append(el('strong','',product.name),el('span','psn-price',money(product.price)));
        const stock=el('small','ll-stock-state',product.available?'متوفر':'غير متوفر');
        stock.dataset.available=String(product.available);
        detail.append(stock,el('span','psn-buy',product.available?'شراء الآن':'غير متوفر'));
        b.append(art,detail);
        if (product.available) b.onclick = () => {
          if (typeof window.openOmnexProductCheckout !== 'function') return;
          window.openOmnexProductCheckout({...product,game:'psn'});
        };
        items.append(b);
      }
    }
    const status = root.querySelector('.psn-status');
    if (!entries.length) status.textContent = 'بطاقات PlayStation قيد التحديث لدى المورد. لا يمكن الشراء قبل تأكيد السعر والتوفر.';
    else if (!filtered.length || (selectedRegion && !filtered.some(p=>p.region===selectedRegion))) status.textContent = 'لا توجد باقات مطابقة للبحث حاليًا.';
    else status.textContent = '';
  }
  async function reload(quiet = false) {
    const seq = ++requestSeq; const api = db();
    if (!api) { root.querySelector('.psn-status').textContent = 'تعذر الاتصال بخدمة البطاقات.'; return; }
    if (!quiet) root.querySelector('.psn-status').textContent = 'جاري تحديث قائمة بطاقات البلايستيشن…';
    try {
      const {data,error} = await api.rpc('get_public_omnex_psn_catalog');
      if (seq!==requestSeq || root.hidden) return;
      if (error) throw error;
      entries = (data?.products || []).filter(p =>
        /^[a-f0-9]{32}$/.test(String(p.id || '')) && typeof p.name === 'string'
      ).map(p=>({id:p.id,name:p.name,region:String(p.region||'دول أخرى').trim()||'دول أخرى',
        price:p.price,available:p.available===true}));
      draw();
      if (!data?.enabled) root.querySelector('.psn-status').textContent = 'شراء البطاقات متوقف مؤقتًا.';
    } catch (_) {
      if (seq===requestSeq) root.querySelector('.psn-status').textContent = 'تعذر تحميل بطاقات PlayStation. أعد فتح القسم لاحقًا.';
    }
  }
  setInterval(() => { if (root && !root.hidden && !document.hidden) void reload(true); }, 60000);
  window.openPsnStore = open;
  window.L1017nPsnStore = {open,refresh:reload};
})();