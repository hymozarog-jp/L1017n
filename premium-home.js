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
 const hero=document.createElement('section');
 hero.id='phHero';hero.className='ph-slider';
 hero.setAttribute('aria-label','شريط عروض وشحن الألعاب');
 hero.setAttribute('aria-roledescription','carousel');
 hero.innerHTML=[
  '<div class="ph-slider-track" id="phSliderTrack" tabindex="0" aria-label="اسحب لليمين أو لليسار لاستعراض العروض" aria-live="off">',
  '<article class="ph-slide ph-slide-roblox" data-ph-slide="0" aria-label="روبلوكس، الشريحة 1 من 5">',
  '<div class="ph-slide-content"><span class="ph-slide-eyebrow">GAMEBOX LY / ROBUX</span><h1>شحن روبوكس <span>بسهولة</span></h1>',
  '<p>اختار باقة الروبوكس المناسبة لك، وتابع طلبك من حسابك.</p>',
  '<button type="button" class="ph-slide-button" data-ph-action="roblox">عرض باقات روبلوكس <span aria-hidden="true">‹</span></button></div>',
  '<div class="ph-slide-art ph-slide-art-roblox" aria-hidden="true"><img src="game-covers/roblox-mark.svg?v=logo-square1" alt="" loading="eager"><span class="ph-slide-orbit"></span></div></article>',
  '<article class="ph-slide ph-slide-brainrot" data-ph-slide="1" aria-label="ماب السرقة، الشريحة 2 من 5">',
  '<div class="ph-slide-content"><span class="ph-slide-eyebrow">GAMEBOX LY / STEAL A BRAINROT</span><h2>شخصيات <span>ماب السرقة</span></h2>',
  '<p>تصفح شخصيات Steal a Brainrot والأسعار والتوفر.</p>',
  '<button type="button" class="ph-slide-button" data-ph-action="steal-a-brainrot">عرض ماب السرقة <span aria-hidden="true">‹</span></button></div>',
  '<div class="ph-slide-art ph-slide-art-brainrot" aria-hidden="true"><img src="game-covers/steal-a-brainrot-original.png" alt="" loading="lazy"></div></article>',
  '<article class="ph-slide ph-slide-mm2" data-ph-slide="2" aria-label="MM2 Minty، الشريحة 3 من 5">',
  '<div class="ph-slide-content"><span class="ph-slide-eyebrow">ROBLOX / MM2</span><h2>سلاح Minty <span>في MM2</span></h2>',
  '<p>تصفح أسلحة MM2 المتوفرة، والتسليم داخل اللعبة بعد إتمام الطلب.</p>',
  '<button type="button" class="ph-slide-button" data-ph-action="mm2">عرض باقة MM2 <span aria-hidden="true">‹</span></button></div>',
  '<div class="ph-slide-art ph-slide-art-mm2" aria-hidden="true"><span class="ph-slide-mm2-label">MM2</span><span class="ph-slide-mm2-weapon">MINTY</span></div></article>',
  '<article class="ph-slide ph-slide-wallet" data-ph-slide="3" aria-label="شحن المحفظة، الشريحة 4 من 5">',
  '<div class="ph-slide-content"><span class="ph-slide-eyebrow">GAMEBOX LY / WALLET</span><h2>اشحن <span>محفظتك</span></h2>',
  '<p>اختار المبلغ، واعرض كود تحويل ليبيانا بعد توثيق رقمك.</p>',
  '<button type="button" class="ph-slide-button" data-ph-action="wallet">فتح المحفظة <span aria-hidden="true">‹</span></button></div>',
  '<div class="ph-slide-art ph-slide-art-wallet" aria-hidden="true"><span class="ph-wallet-card"><b>GAMEBOX LY</b><strong>LYD</strong><small>WALLET</small></span></div></article>',
  '<article class="ph-slide ph-slide-news" data-ph-slide="4" aria-label="إعلانات المتجر، الشريحة 5 من 5">',
  '<div class="ph-slide-content"><span class="ph-slide-eyebrow">GAMEBOX LY / ANNOUNCEMENTS</span><h2>إعلانات <span>المتجر</span></h2>',
  '<p>تعرف على أقسام الألعاب والمنتجات اللي أضفناها للمتجر.</p>',
  '<button type="button" class="ph-slide-button" data-ph-action="browse">استكشف الأقسام <span aria-hidden="true">‹</span></button></div>',
  '<div class="ph-slide-art ph-slide-art-news" aria-hidden="true"><span class="ph-news-card"><small>STORE</small><strong>L1017N</strong><span>UPDATES</span></span></div></article>',
  '</div>',
  '<div class="ph-slider-toolbar" aria-label="التحكم في شريط العروض">',
  '<div class="ph-slider-dots" role="group" aria-label="اختيار الشريحة">',
  '<button type="button" class="ph-slider-dot is-active" data-ph-slide-to="0" aria-label="عرض روبلوكس" aria-current="true"></button>',
  '<button type="button" class="ph-slider-dot" data-ph-slide-to="1" aria-label="عرض ماب السرقة" aria-current="false"></button>',
  '<button type="button" class="ph-slider-dot" data-ph-slide-to="2" aria-label="عرض MM2" aria-current="false"></button>',
  '<button type="button" class="ph-slider-dot" data-ph-slide-to="3" aria-label="عرض شحن المحفظة" aria-current="false"></button>',
  '<button type="button" class="ph-slider-dot" data-ph-slide-to="4" aria-label="عرض إعلانات المتجر" aria-current="false"></button>',
  '</div>',
  '<div class="ph-slider-arrow-group">',
  '<button type="button" class="ph-slider-arrow" data-ph-step="-1" aria-label="الشريحة السابقة">›</button>',
  '<button type="button" class="ph-slider-arrow" data-ph-step="1" aria-label="الشريحة التالية">‹</button>',
  '</div></div>'
 ].join('');
 store.insertBefore(hero,heading);
 const track=hero.querySelector('#phSliderTrack');
 const slides=[...track.querySelectorAll('[data-ph-slide]')];
 const dots=[...hero.querySelectorAll('[data-ph-slide-to]')];
 let selected=0;
 let scrollAnimationPending=false;
 function selectDot(index){
  selected=index;
  dots.forEach(function(dot,i){
   dot.classList.toggle('is-active',i===index);
   dot.setAttribute('aria-current',String(i===index));
  });
 }
 function gotoSlide(index){
  if(!slides.length)return;
  const target=(index+slides.length)%slides.length;
  selectDot(target);
  slides[target].scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',inline:'start',block:'nearest'});
 }
 hero.addEventListener('click',function(event){
  const dot=event.target.closest('[data-ph-slide-to]');
  if(dot){gotoSlide(Number(dot.dataset.phSlideTo));return}
  const direction=event.target.closest('[data-ph-step]');
  if(direction){gotoSlide(selected+Number(direction.dataset.phStep));return}
  const action=event.target.closest('[data-ph-action]')?.dataset.phAction;
  if(!action)return;
  if(action==='browse'){heading.scrollIntoView({behavior:'smooth',block:'start'});return}
  if(action==='wallet'){
   const link=document.querySelector('.mobile-nav [data-view="wallet"],.desktop-nav [data-view="wallet"]');
   if(link)link.click();
   else if(typeof switchView==='function')switchView('wallet');
   return;
  }
  if(action==='mm2'||action==='steal-a-brainrot'){
   const opener=action==='mm2'?window.openMm2StoreCategory:window.openBrainrotStoreCategory;
   if(typeof opener==='function')opener();
   return;
  }
  document.querySelector('#productGrid [data-game-open="'+action+'"]')?.click();
 });
 track.addEventListener('scroll',function(){
  if(scrollAnimationPending)return;
  scrollAnimationPending=true;
  requestAnimationFrame(function(){
   scrollAnimationPending=false;
   const bounds=track.getBoundingClientRect();
   const midpoint=(bounds.left+bounds.right)/2;
   let nearest=0,distance=Infinity;
   slides.forEach(function(slide,index){
    const b=slide.getBoundingClientRect();
    const gap=Math.abs((b.left+b.right)/2-midpoint);
    if(gap<distance){distance=gap;nearest=index}
   });
   if(nearest!==selected)selectDot(nearest);
  });
 },{passive:true});

 const search=document.createElement('div');search.className='ph-search-wrap';
 search.innerHTML='<label for="phGameSearch" style="position:absolute;width:1px;height:1px;clip:rect(0,0,0,0);overflow:hidden">البحث عن قسم</label><span class="ph-search-icon" aria-hidden="true">⌕</span><input type="search" id="phGameSearch" dir="rtl" autocomplete="off" enterkeyhint="search" placeholder="ابحث عن روبوكس أو MM2 أو ماب السرقة...">';
 store.insertBefore(search,heading);
 const input=search.querySelector('input');
 const filters=document.createElement('div');filters.className='ph-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','تصفية الأقسام');
 const options=[['all','الكل'],['roblox','روبوكس'],['mm2','MM2'],['steal-a-brainrot','ماب السرقة']];
 options.forEach(function(item){
  const b=document.createElement('button');b.type='button';b.className='ph-filter';b.dataset.phFilter=item[0];b.textContent=item[1];b.setAttribute('aria-pressed',String(item[0]==='all'));filters.appendChild(b);
 });
 store.insertBefore(filters,heading);
 const count=document.createElement('small');count.className='ph-section-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');heading.appendChild(count);
 const empty=document.createElement('p');empty.className='ph-empty';empty.id='phNoResults';empty.hidden=true;empty.textContent='ما فيش أقسام مطابقة للبحث. جرّب كلمة ثانية أو اختار «الكل».';
 grid.insertAdjacentElement('afterend',empty);

 const drawer=document.createElement('div');drawer.id='phDrawer';drawer.className='ph-drawer';drawer.hidden=true;drawer.setAttribute('aria-hidden','true');
 drawer.innerHTML='<div class="ph-drawer-sheet" role="dialog" aria-modal="true" aria-label="قائمة المتجر">'+
  '<div class="ph-drawer-top"><strong>L1017N</strong><button type="button" class="ph-drawer-close" aria-label="إغلاق القائمة">×</button></div>'+
  '<button type="button" class="ph-drawer-link" data-view="home">الرئيسية</button>'+
  '<button type="button" class="ph-drawer-link" data-view="store">الألعاب</button>'+
  '<button type="button" class="ph-drawer-link" data-view="wallet">المحفظة</button>'+
  '<button type="button" class="ph-drawer-link" data-view="orders">طلباتي</button>'+
  '<button type="button" class="ph-drawer-link" data-view="leaderboard">التصنيف</button>'+
  '<button type="button" class="ph-drawer-link" data-view="account">حسابي</button>'+
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
 const aliases={roblox:'روبوكس روبلوكس roblox robux شحن',mm2:'mm2 murder mystery أسلحة سلاح سكاكين', 'steal-a-brainrot':'ماب السرقة سرقه steal brainrot قرما لاسيكرت لاسبوكي'};
 function belongs(key){
  return filter==='all'||String(key||'').toLowerCase()===filter;
 }
 function apply(){
  pending=false;const q=normalize(input.value.trim());const tiles=[...grid.querySelectorAll('.game-tile')];let visible=0;
  for(const tile of tiles){
   const key=tile.querySelector('[data-game-open]')?.dataset.gameOpen||'';
   const matches=belongs(key)&&(!q||normalize([key,aliases[key],tile.textContent].join(' ')).includes(q));
   tile.hidden=!matches;if(matches)visible++;
  }
  count.textContent=visible?visible+' أقسام':'';
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


 // Legacy Supabase product renderer replaces grid children. Observe childList only:
 // never observe class/style attributes to avoid an observer feedback recursion.
 new MutationObserver(queue).observe(grid,{childList:true,subtree:false});
 queue();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
else mount();
})();