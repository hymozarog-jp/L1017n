/* Complete server-priced OMNEX catalog. Checkout always revalidates with the supplier. */
(function(){
'use strict';
let entries=[],root=null,category=null,limit=24,sequence=0,homeReady=false,bootAttempts=0,returnFocus=null,scrolls=new Map();
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>Number(v).toFixed(2)+' د.ل';
const itunes=p=>/itunes|apple|ايتونز|آيتونز|أيتونز/i.test(p.category_name||'');
const safeImage=value=>{try{const u=new URL(String(value));return u.protocol==='https:'&&u.hostname==='omnex.ly'?u.href:'';}catch{return '';}};
const gift='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><rect x="9" y="24" width="46" height="32" rx="6"/><path d="M7 17h50v12H7zM32 17v39M32 17C13 20 11 3 22 7c6 2 10 10 10 10Zm0 0C51 20 53 3 42 7c-6 2-10 10-10 10Z"/></svg>';
function art(product,categoryArt=false){
 const wrap=make('span','sc-art');
 const src=safeImage(categoryArt?(product.category_image||product.image_url):(product.image_url||product.category_image));
 wrap.innerHTML=gift;
 if(src){const photo=make('img');photo.src=src;photo.alt='';photo.loading='lazy';photo.decoding='async';photo.onerror=()=>photo.remove();wrap.append(photo);}
 if(itunes(product))wrap.classList.add('sc-art-apple');
 return wrap;
}
function categories(){
 const grouped=new Map();
 for(const p of entries){
  if(!p.available)continue;
  if(!grouped.has(p.category_id))grouped.set(p.category_id,{...p,count:0});
  grouped.get(p.category_id).count++;
 }
 return [...grouped.values()].sort((a,b)=>Number(itunes(b))-Number(itunes(a))||a.category_name.localeCompare(b.category_name,'ar'));
}
function homeCards(section,query='',chosen='all'){
 if(chosen!=='all')return '';
 const q=String(query).trim().toLocaleLowerCase();
 return categories().filter(p=>!['roblox','pubg','psn'].includes(p.game)).filter(p=>{
  const kind=p.section==='games'?'games':/card|gift/i.test(p.section)&&!/local/i.test(p.section)?'cards':'other';
  return kind===section&&(!q||[p.category_name,...entries.filter(x=>x.category_id===p.category_id).map(x=>x.name+' '+x.group)].join(' ').toLocaleLowerCase().includes(q));
 }).map(p=>{
  const src=safeImage(p.category_image||p.image_url);
  return '<article class="ll-game-section ll-reveal sc-home-card" dir="rtl"><button type="button" class="ll-game-section-link" data-supplier-category="'+escape(p.category_id)+'" aria-label="فتح '+escape(p.category_name)+'"><span class="ll-game-section-art sc-home-art">'+gift+(src?'<img src="'+escape(src)+'" alt="" loading="lazy" decoding="async">':'')+'</span><span class="ll-game-section-details"><strong>'+escape(p.category_name)+'</strong><small>'+p.count+' باقة متوفرة</small></span></button></article>';
 }).join('');
}
function mount(){
 if(root)return;
 root=make('section','sc-screen');root.id='completeSupplierCatalog';root.hidden=true;root.dir='rtl';
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','منتجات المتجر');
 root.innerHTML='<div class="sc-wrap"><header class="sc-head"><button type="button" class="sc-back">رجوع</button><div><p>L1017N STORE</p><h1>منتجات المتجر</h1></div></header><div class="sc-tools"><label class="sc-search-label">ابحث عن منتج<input class="sc-search" type="search" placeholder="اسم البطاقة، الدولة أو الفئة"></label><label>الدولة أو المجموعة<select class="sc-group"><option value="">جميع المجموعات</option></select></label><label class="sc-stock"><input class="sc-only" type="checkbox" checked> المتوفر فقط</label></div><p class="sc-note">تأكد من دولة الحساب ووصف المنتج قبل الشراء. السعر والتوفر يُراجعان عند التأكيد.</p><p class="sc-status" role="status" aria-live="polite"></p><div class="sc-grid"></div><button type="button" class="sc-more" hidden>عرض المزيد</button><button type="button" class="sc-retry" hidden>إعادة المحاولة</button></div>';
 document.body.append(root);
 root.querySelector('.sc-back').onclick=close;
 for(const selector of ['.sc-search','.sc-group','.sc-only'])root.querySelector(selector).addEventListener(selector==='.sc-search'?'input':'change',()=>{limit=24;draw();});
 root.querySelector('.sc-more').onclick=()=>{limit+=24;draw();};
 root.querySelector('.sc-retry').onclick=()=>void refresh();
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();close();}
  if(e.key==='Tab'&&!document.querySelector('#omnexCheckout[open]')){
   const buttons=[...root.querySelectorAll('button:not([hidden]):not([disabled]),input,select')].filter(x=>x.getClientRects().length);
   if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}
   else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}
  }
 });
}
function draw(){
 if(!root||root.hidden)return;
 const q=root.querySelector('.sc-search').value.trim().toLocaleLowerCase(),group=root.querySelector('.sc-group').value,only=root.querySelector('.sc-only').checked;
 const items=entries.filter(p=>(!category||p.category_id===category)&&(!only||p.available)&&(!group||p.group===group)&&(!q||[p.name,p.group,p.category_name].join(' ').toLocaleLowerCase().includes(q)));
 const grid=root.querySelector('.sc-grid');grid.replaceChildren();
 const seen=new Set();
 for(const p of items.slice(0,limit)){
  const card=make('article','sc-product');
  card.append(art(p));
  const info=make('div','sc-info');info.append(make('small','sc-region',p.group||p.category_name),make('h2','',p.name),make('span','sc-availability'+(p.available?' is-available':''),p.available?'متوفر':'غير متوفر'),make('strong','sc-price',cash(p.price)));
  const button=make('button','sc-buy',p.available?'شراء الآن':'غير متوفر');button.type='button';button.disabled=!p.available;
  button.onclick=()=>{if(typeof window.openOmnexProductCheckout==='function')window.openOmnexProductCheckout({...p,region:p.group||p.category_name});};
  info.append(button);card.append(info);grid.append(card);seen.add(p.id);
 }
 root.querySelector('.sc-status').textContent=!homeReady?'جاري تحميل المنتجات…':items.length?items.length+' منتج':'لا توجد منتجات مطابقة حاليًا.';
 root.querySelector('.sc-more').hidden=items.length<=limit;
}
function groups(){
 const select=root.querySelector('.sc-group'),before=select.value;
 select.replaceChildren(new Option('جميع المجموعات',''));
 const keys=[...new Set(entries.filter(p=>!category||p.category_id===category).map(p=>p.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 for(const key of keys)select.add(new Option(key,key));
 select.value=keys.includes(before)?before:'';
 select.parentElement.hidden=!keys.length;
}
function open(id=null){
 mount();category=id;limit=24;returnFocus=document.activeElement;
 const p=entries.find(x=>x.category_id===id);
 root.querySelector('h1').textContent=p?.category_name||'جميع منتجات المتجر';
 root.querySelector('.sc-search').value='';root.querySelector('.sc-group').value='';root.querySelector('.sc-only').checked=true;
 root.hidden=false;document.body.classList.add('sc-open');groups();draw();root.scrollTop=scrolls.get(id)||0;
 root.querySelector('.sc-back').focus({preventScroll:true});void refresh(true);
}
function close(){
 if(!root)return;scrolls.set(category,root.scrollTop);root.hidden=true;document.body.classList.remove('sc-open');
 returnFocus?.focus?.({preventScroll:true});
}
async function refresh(quiet=false){
 if(typeof supabaseClient==='undefined'){if(bootAttempts++<20)setTimeout(()=>void refresh(quiet),750);return;}
 bootAttempts=0;
 const seq=++sequence;
 try{
  const {data,error}=await supabaseClient.rpc('get_public_omnex_complete_catalog');
  if(seq!==sequence)return;
  if(error||!data?.enabled||!Array.isArray(data.products))throw Error('catalog_unavailable');
  entries=data.products.filter(p=>/^[a-f0-9]{32}$/.test(String(p.id))&&/^[a-f0-9]{32}$/.test(String(p.category_id))&&Number(p.price)>0&&typeof p.name==='string').map(p=>({...p,group:String(p.group||p.region||''),category_name:String(p.category_name||'منتجات'),available:p.available===true}));
  homeReady=true;window.dispatchEvent(new Event('l1017n:catalog-updated'));
  if(root&&!root.hidden){groups();draw();root.querySelector('.sc-retry').hidden=true;}
 }catch{
  if(seq!==sequence)return;
  if(root&&!root.hidden){root.querySelector('.sc-status').textContent='تعذر تحديث المنتجات. أعد المحاولة قبل الشراء.';root.querySelector('.sc-retry').hidden=false;}
 }
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-supplier-category]');if(button){open(button.dataset.supplierCategory);return;}
 if(e.target.closest('[data-supplier-all]'))open();
});
document.addEventListener('error',e=>{if(e.target.matches?.('.sc-home-art img'))e.target.remove();},true);
window.L1017nCompleteCatalog={homeCards,open,refresh,categories};
const boot=()=>{void refresh();setInterval(()=>{if(!document.hidden)void refresh(true);},60000);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();