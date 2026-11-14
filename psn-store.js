/* L1017n PlayStation cards from the server-verified OMNEX catalog. */
(function () {
  'use strict';
  const db = () => typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  let root, entries = [], selectedRegion = null, requestSeq = 0, launched = false;
  const el = (tag, cls, label) => { const n = document.createElement(tag); if (cls) n.className = cls; if (label !== undefined) n.textContent = label; return n; };
  const cardArt = 'game-covers/psn-user-card.webp?v=supplied-original-20261114';
  const money = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v).toFixed(2) + ' د.ل' : 'السعر غير متاح';
  const flags = [['أمريك','🇺🇸'],['USA','🇺🇸'],['US','🇺🇸'],['سعود','🇸🇦'],['SA','🇸🇦'],['إمارات','🇦🇪'],['AE','🇦🇪'],['تركي','🇹🇷'],['TR','🇹🇷'],['بريطان','🇬🇧'],['UK','🇬🇧'],['GB','🇬🇧'],['كويت','🇰🇼'],['قطر','🇶🇦'],['بحرين','🇧🇭'],['كند','🇨🇦'],['ألمان','🇩🇪'],['فرنس','🇫🇷'],['أسترال','🇦🇺'],['يابان','🇯🇵']];
  function countryFlag(label) { const s = String(label || '').trim(); return flags.find(([key]) => (key.length < 3 ? s.toUpperCase() === key : s.toLowerCase().includes(key.toLowerCase())))?.[1] || '🎮'; }
  function mount() {
    if (root) return;
    root = el('section', 'psn-screen');
    root.id = 'psnStoreScreen';
    root.dir = 'rtl'; root.hidden = true;
    root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','بطاقات بلايستيشن');
    root.innerHTML = '<div class="psn-wrap"><header class="psn-head"><button type="button" class="psn-back" aria-label="رجوع">→</button><div><p class="psn-eyebrow">PLAYSTATION STORE</p><h1 class="psn-title">بطاقات بلايستيشن</h1><p class="psn-sub">أكواد أصلية · اختر دولة حسابك قبل الشراء</p></div><span class="psn-mark"><img src="game-covers/psn-user-card.webp?v=supplied-original-20261114" alt="" aria-hidden="true"></span></header><p class="psn-region-warning">مهم: البطاقة تعمل فقط مع دولة حساب PlayStation المطابقة. تأكد من الريجن قبل تأكيد الطلب.</p><div class="psn-tools"><input class="psn-search" type="search" placeholder="ابحث عن بطاقة أو فئة..." aria-label="البحث في بطاقات بلايستيشن"><label><input class="psn-only" type="checkbox"> المتوفر فقط</label></div><p class="psn-status" role="status" aria-live="polite">جاري تحميل بطاقات المورد…</p><div class="psn-regions"></div><div class="psn-list" hidden><button type="button" class="psn-to-regions">→ جميع الدول</button><h2 class="psn-region-title"></h2><div class="psn-products"></div></div><p class="psn-foot">الأسعار بالدينار الليبي. يُراجع السعر والمخزون مباشرة عند الشراء. الكود يظهر في طلباتي بعد تسليم المورد.</p></div>';
    document.body.append(root);
    root.querySelector('.psn-back').onclick = close;
    root.querySelector('.psn-to-regions').onclick = () => { selectedRegion = null; draw(); };
    root.querySelector('.psn-search').oninput = draw;
    root.querySelector('.psn-only').onchange = draw;
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && root && !root.hidden) { event.preventDefault(); close(); } });
  }
  function open() {
    mount();
    launched = true; root.hidden = false;
    document.body.classList.add('psn-open');
    selectedRegion = null;
    root.querySelector('.psn-search').value = '';
    root.querySelector('.psn-only').checked = false;
    root.scrollTop = 0; root.querySelector('.psn-back').focus({ preventScroll:true });
    void reload();
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
    const filtered = entries.filter(p => (!only || p.available) && (p.name+' '+p.region).toLocaleLowerCase().includes(query));
    const keys = [...new Set(filtered.map(p => p.region))].sort((a,b)=>a.localeCompare(b,'ar'));
    if (!selectedRegion) {
      list.hidden = true;
      regions.hidden = false;
      for (const region of keys) {
        const b = el('button','psn-region');
        b.type = 'button'; const flag = el('span','psn-flag',countryFlag(region));
        const thumb = el('img','psn-region-thumb'); thumb.src=cardArt; thumb.alt=''; thumb.decoding='async'; thumb.loading='lazy';
        const meta = el('span','psn-region-meta');
        const available = filtered.filter(p=>p.region===region&&p.available).length;
        meta.append(el('strong','',region),el('small','',available ? available+' باقة متوفرة' : 'غير متوفر حاليًا'));
        b.append(thumb, flag, meta, el('span','psn-arr','←'));
        b.onclick = () => { selectedRegion = region; draw(); root.scrollTo({top:0,behavior:'smooth'}); };
        regions.append(b);
      }
    } else {
      list.hidden = false;
      regions.hidden = true;
      root.querySelector('.psn-region-title').textContent = countryFlag(selectedRegion)+' بلايستيشن '+selectedRegion;
      for (const product of filtered.filter(p=>p.region===selectedRegion)) {
        const b = el('button','psn-product');
        b.type = 'button'; b.disabled = !product.available;
        const art = el('span','psn-product-art');
        const photo=el('img','psn-package-image'); photo.src=cardArt; photo.alt='بطاقة بلايستيشن'; photo.loading='lazy'; photo.decoding='async';
        art.append(photo,el('span','psn-product-country',countryFlag(selectedRegion)));
        const detail=el('span','psn-product-detail');
        detail.append(el('strong','',product.name),el('span','psn-price',money(product.price)));
        b.append(art,detail,el('span','psn-buy',product.available?'شراء':'نفدت'));
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
  async function reload() {
    const seq = ++requestSeq; const api = db();
    if (!api) { root.querySelector('.psn-status').textContent = 'تعذر الاتصال بخدمة البطاقات.'; return; }
    root.querySelector('.psn-status').textContent = 'جاري تحديث قائمة بطاقات البلايستيشن…';
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
  window.openPsnStore = open;
  window.L1017nPsnStore = {open,refresh:reload};
})();