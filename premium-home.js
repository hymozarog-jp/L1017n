/* Premium store home: only changes presentation; payment/auth stay with legacy-app.js */
(function(){
'use strict';
function mount(){
 const store=document.getElementById('storeView'),grid=document.getElementById('productGrid'),bar=document.querySelector('.topbar');
 if(!store||!grid||!bar||document.getElementById('phHero'))return;
 const heading=store.querySelector('.section-head');if(!heading)return;
 const menu=document.createElement('button');
 menu.type='button';menu.id='phMenuButton';menu.className='ph-header-menu';menu.setAttribute('aria-label','فتح القائمة');menu.setAttribute('aria-controls','phDrawer');menu.setAttribute('aria-expanded','false');
 menu.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';bar.appendChild(menu);
 const hero=document.createElement('section');hero.id='phHero';hero.className='ph-hero';hero.setAttribute('aria-label','تسوق أفضل باقات الألعاب');
 hero.innerHTML=[
 '<div class="ph-hero-copy"><span class="ph-hero-eyebrow">L1017N • GAMING STORE</span>',
 '<h1>اشحن ألعابك <span>المفضلة الآن</span></h1>',
 '<p>اختار باقتك بكل سهولة وادفع بأمان من محفظتك داخل المتجر.</p>',
 '<button type="button" class="ph-shop-button" id="phShopNow">تسوق الآن <span aria-hidden="true">←</span></button></div>',
 '<div class="ph-hero-art" aria-hidden="true"><div class="ph-orb"></div>',
 '<div class="ph-stars a">✦</div><div class="ph-stars b">✧</div>',
 '<div class="ph-game-card roblox"><img src="game-covers/roblox-mark.svg?v=logo-square1" alt=""></div>',
 '<div class="ph-game-card uc"><strong>UC</strong></div><div class="ph-game-card coin"><strong>V</strong></div>',
 '<div class="ph-controller">🎮</div><div class="ph-gem g1">💎</div><div class="ph-gem g2">✦</div></div>'
 ].join('');
 store.insertBefore(hero,heading);
 const search=document.createElement('div');search.className='ph-search-wrap';
 search.innerHTML='<label for="phGameSearch" style="position:absolute;width:1px;height:1px;clip:rect(0,0,0,0);overflow:hidden">البحث عن لعبة</label><span class="ph-search-icon" aria-hidden="true">⌕</span><input type="search" id="phGameSearch" dir="rtl" autocomplete="off" enterkeyhint="search" placeholder="ابحث عن لعبة أو منتج...">';
 store.insertBefore(search,heading);
 const input=search.querySelector('input');
 const filters=document.createElement('div');filters.className='ph-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','تصفية الألعاب');
 const options=[['all','🎮 الكل'],['mobile','📱 ألعاب الموبايل'],['pc','🖥️ ألعاب الكمبيوتر'],['cards','💳 بطاقات الدفع']];
 options.forEach(function(item){
  const b=document.createElement('button');b.type='button';b.className='ph-filter';b.dataset.phFilter=item[0];b.textContent=item[1];b.setAttribute('aria-pressed',String(item[0]==='all'));filters.appendChild(b);
 });
 store.insertBefore(filters,heading);
 const count=document.createElement('small');count.className='ph-section-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');heading.appendChild(count);
 const empty=document.createElement('p');empty.className='ph-empty';empty.id='phNoResults';empty.hidden=true;empty.textContent='ما فيش ألعاب مطابقة للبحث. جرّب كلمة ثانية أو اختار «الكل».';
 grid.insertAdjacentElement('afterend',empty);
 const promo=document.createElement('section');promo.className='ph-promo';
 promo.innerHTML='<div><span class="ph-offers-eyebrow">✨ اكتشف باقاتنا</span><h3>باقات مميزة</h3><p>روبوكس، فورت نايت، فري فاير وببجي — اختار اللي يناسبك.</p><button type="button" class="ph-promo-cta" id="phPromoAction">عرض الألعاب <span aria-hidden="true">←</span></button></div><div class="ph-promo-art" aria-hidden="true">🎁 💠</div>';
 store.appendChild(promo);
 const drawer=document.createElement('div');drawer.id='phDrawer';drawer.className='ph-drawer';drawer.hidden=true;drawer.setAttribute('aria-hidden','true');
 drawer.innerHTML='<div class="ph-drawer-sheet" role="dialog" aria-modal="true" aria-label="قائمة المتجر">'+
  '<div class="ph-drawer-top"><strong>L1017N ✦</strong><button type="button" class="ph-drawer-close" aria-label="إغلاق القائمة">×</button></div>'+
  '<button type="button" class="ph-drawer-link" data-view="home">⌂ &nbsp; الرئيسية</button>'+
  '<button type="button" class="ph-drawer-link" data-view="store">🎮 &nbsp; الألعاب</button>'+
  '<button type="button" class="ph-drawer-link" data-view="wallet">▣ &nbsp; المحفظة</button>'+
  '<button type="button" class="ph-drawer-link" data-view="orders">▤ &nbsp; طلباتي</button>'+
  '<button type="button" class="ph-drawer-link" data-view="leaderboard">🏆 &nbsp; التصنيف</button>'+
  '<button type="button" class="ph-drawer-link" data-view="account">♙ &nbsp; حسابي</button>'+
  '<p class="ph-drawer-note">L1017N — تسوق بأمان وتابع طلباتك من حسابك.</p></div>';
 document.body.appendChild(drawer);
 let lastFocus=null;
 function close(){
  if(drawer.hidden)return;
  drawer.hidden=true;drawer.setAttribute('aria-hidden','true');menu.setAttribute('aria-expanded','false');document.body.style.removeProperty('overflow');
  if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus({preventScroll:true});
 }
 function open(){
  lastFocus=document.activeElement;drawer.hidden=false;drawer.setAttribute('aria-hidden','false');menu.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';drawer.querySelector('.ph-drawer-close').focus();
 }
 menu.addEventListener('click',()=>drawer.hidden?open():close());
 drawer.addEventListener('click',e=>{if(e.target===drawer||e.target.closest('.ph-drawer-close')||e.target.closest('[data-view]'))close()});
 document.addEventListener('keydown',e=>{
  if(drawer.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close()}
  if(e.key==='Tab'){
   const b=[...drawer.querySelectorAll('button:not([disabled])')];
   if(e.shiftKey&&document.activeElement===b[0]){e.preventDefault();b[b.length-1].focus()}
   else if(!e.shiftKey&&document.activeElement===b[b.length-1]){e.preventDefault();b[0].focus()}
  }
 });
 let filter='all',pending=false;
 const normalize=v=>String(v||'').toLowerCase().normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
 const aliases={roblox:'روبلوكس روبوكس roblox robux minty mm2 murder mystery سلاح',fortnite:'فورت نايت فورتنايت fortnite vbucks فيبوكس',freefire:'فري فاير فريفاير free fire diamonds جواهر',pubg:'ببجي بوبجي pubg uc شدات موبايل'};
 function belongs(key){
  const k=String(key||'').toLowerCase();
  if(filter==='all')return true;
  if(filter==='cards')return /card|gift|voucher|بطاق|قسيم/.test(k);
  if(filter==='mobile')return /pubg|freefire|mobile|fortnite/.test(k);
  return /roblox|fortnite|steam|pc|computer/.test(k);
 }
 function apply(){
  pending=false;const q=normalize(input.value.trim());const tiles=[...grid.querySelectorAll('.game-tile')];let visible=0;
  for(const tile of tiles){
   const key=tile.querySelector('[data-game-open]')?.dataset.gameOpen||'';
   const matches=belongs(key)&&(!q||normalize([key,aliases[key],tile.textContent].join(' ')).includes(q));
   tile.hidden=!matches;if(matches)visible++;
  }
  count.textContent=visible?visible+' ألعاب متاحة':'';
  empty.hidden=visible!==0||tiles.length===0;
 }
 function queue(){if(!pending){pending=true;requestAnimationFrame(apply)}}
 filters.addEventListener('click',e=>{
  const choice=e.target.closest('[data-ph-filter]');if(!choice)return;
  filter=choice.dataset.phFilter;filters.querySelectorAll('[data-ph-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===choice)));queue();
 });
 input.addEventListener('input',queue);
 input.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();grid.querySelector('.game-tile:not([hidden]) [data-game-open]')?.click()}
 });
 function browse(){
  filter='all';input.value='';filters.querySelectorAll('[data-ph-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phFilter==='all')));
  apply();heading.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 }
 hero.querySelector('#phShopNow').addEventListener('click',browse);
 promo.querySelector('#phPromoAction').addEventListener('click',browse);
 // Legacy Supabase product renderer replaces grid children. Observe childList only:
 // never observe class/style attributes to avoid an observer feedback recursion.
 new MutationObserver(queue).observe(grid,{childList:true,subtree:false});
 queue();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();