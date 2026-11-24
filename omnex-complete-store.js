/* Complete server-priced OMNEX catalog. Checkout always revalidates with the supplier. */
(function(){
'use strict';
let entries=[],root=null,category=null,limit=24,sequence=0,homeReady=false,initialLoadSettled=false,bootAttempts=0,renderKey='',returnFocus=null,scrolls=new Map(),selectedGroup=null,entryCategory=null,groupScroll=0,allScroll=0,lastGroupButton=null;
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=v=>Number(v).toFixed(2)+' د.ل';
const itunes=p=>/itunes|apple|ايتونز|آيتونز|أيتونز/i.test(p.category_name||'');
const CATEGORY_ART={"b9e29d6496af8299dc86e41d179f9395":"game-covers/catalog/b9e29d6496af8299dc86e41d179f9395.webp","1713f08159bb6683b28678dcb2160a44":"game-covers/catalog/1713f08159bb6683b28678dcb2160a44.webp","9ffaad7ac191118664aa550383122b6a":"game-covers/catalog/9ffaad7ac191118664aa550383122b6a.webp","be7ff3b01194111fa19ca3b0b38697eb":"game-covers/catalog/be7ff3b01194111fa19ca3b0b38697eb.webp","a4c6d8cd106b3eabee24a8d29cfcc0a3":"game-covers/catalog/a4c6d8cd106b3eabee24a8d29cfcc0a3.webp","818c64e7547e23ee93bf628dad4a1e40":"game-covers/catalog/818c64e7547e23ee93bf628dad4a1e40.webp","7c237c9bb01a7d47ee98c2cc736004a2":"game-covers/catalog/7c237c9bb01a7d47ee98c2cc736004a2.webp","b0ac0c8312d6cfbacc30b9fc1c03261d":"game-covers/catalog/b0ac0c8312d6cfbacc30b9fc1c03261d.webp","514201b46c42178318ad961ecddb668a":"game-covers/catalog/514201b46c42178318ad961ecddb668a.webp","92995cfbf61a2457f4eeb1eb4ae86290":"game-covers/catalog/92995cfbf61a2457f4eeb1eb4ae86290.webp","d649e23b716dc06e469bd0dd20b7541e":"game-covers/catalog/d649e23b716dc06e469bd0dd20b7541e.webp","ac446d523919ad57e36ac50419d8d454":"game-covers/catalog/ac446d523919ad57e36ac50419d8d454.webp","833881d47d78e968f5b15eb52f45498c":"game-covers/catalog/833881d47d78e968f5b15eb52f45498c.webp","4a2010ddbfa9d0b3d54dad2c6146110a":"game-covers/catalog/4a2010ddbfa9d0b3d54dad2c6146110a.webp","8a3f599daa48e226feac0fbd55e87718":"game-covers/catalog/8a3f599daa48e226feac0fbd55e87718.webp","688b1e309494d734480faaf5f399bfe2":"game-covers/catalog/688b1e309494d734480faaf5f399bfe2.webp","79a2e59b5b5c754a6eca23ee1e1bf410":"game-covers/catalog/79a2e59b5b5c754a6eca23ee1e1bf410.webp","fa35e396432e4a094d50e878b29d918f":"game-covers/catalog/fa35e396432e4a094d50e878b29d918f.webp","f5d15f7108603f215cb4bfa28ff79de3":"game-covers/catalog/f5d15f7108603f215cb4bfa28ff79de3.webp","c7775f2bd26e458e63235ef4d56b1f29":"game-covers/catalog/c7775f2bd26e458e63235ef4d56b1f29.webp","d45a2307393ae16e33d5624a1b7dfbd4":"game-covers/catalog/d45a2307393ae16e33d5624a1b7dfbd4.webp","77c1b88099fa7776fc66d63a56c855ac":"game-covers/catalog/77c1b88099fa7776fc66d63a56c855ac.webp","03fd80f4c2579784b6b1e6f032fa2358":"game-covers/catalog/03fd80f4c2579784b6b1e6f032fa2358.webp","552219acf1c0bff5a8da5425e0e050de":"game-covers/catalog/552219acf1c0bff5a8da5425e0e050de.webp","30faee6b9893e3f424961c15a785efc3":"game-covers/catalog/30faee6b9893e3f424961c15a785efc3.webp","9428818e23b14775be114a9ce69ef189":"game-covers/catalog/9428818e23b14775be114a9ce69ef189.webp","0226b09bddb509fff256ed7eedd3c0d4":"game-covers/catalog/0226b09bddb509fff256ed7eedd3c0d4.webp","64e666112e6645e2dfc1f82d0f836384":"game-covers/catalog/64e666112e6645e2dfc1f82d0f836384.webp","554b8e6d49a025e003021cc915a0e986":"game-covers/catalog/554b8e6d49a025e003021cc915a0e986.webp","79cd951847c1447bf453849f449f6f7a":"game-covers/catalog/79cd951847c1447bf453849f449f6f7a.webp","798c7f548105dd44e0eba98cd96dd876":"game-covers/catalog/798c7f548105dd44e0eba98cd96dd876.webp","89f2272f8f21863e27d58ba81206971a":"game-covers/catalog/89f2272f8f21863e27d58ba81206971a.webp","8ea21c57fba8dd88a1de67fe2e947572":"game-covers/catalog/8ea21c57fba8dd88a1de67fe2e947572.webp","b4f8366c92dfd1eb48e22416718d0c41":"game-covers/catalog/b4f8366c92dfd1eb48e22416718d0c41.webp","e48a88c3dafd76a384bd12ae6d4efb00":"game-covers/catalog/e48a88c3dafd76a384bd12ae6d4efb00.webp","68c71d5cb5285155423b1f64681d2e3a":"game-covers/catalog/68c71d5cb5285155423b1f64681d2e3a.webp","fc04abdbbe3dbd162b2c5451d9edf5a6":"game-covers/catalog/fc04abdbbe3dbd162b2c5451d9edf5a6.webp","aab111d38212884938919b7b4f7624cb":"game-covers/catalog/aab111d38212884938919b7b4f7624cb.webp","a5aec2b69f8e1dcb5219832ae7e394c9":"game-covers/catalog/a5aec2b69f8e1dcb5219832ae7e394c9.webp","9fc817c04cfb6cc83a6320ca6d16944b":"game-covers/catalog/9fc817c04cfb6cc83a6320ca6d16944b.webp","06ef783fb9e0d69f4313e1c7af9542ad":"game-covers/catalog/06ef783fb9e0d69f4313e1c7af9542ad.webp","04cda2227b9aa8831fb94f0177723909":"game-covers/catalog/04cda2227b9aa8831fb94f0177723909.webp","9120d7f61a67e0cc449a8ce3b0a0be01":"game-covers/catalog/9120d7f61a67e0cc449a8ce3b0a0be01.webp","2df388d5f05e06ba6e4c8ad17fc205f7":"game-covers/catalog/2df388d5f05e06ba6e4c8ad17fc205f7.webp","d26e7ac291c45b061c7b7e461ed4f8db":"game-covers/catalog/d26e7ac291c45b061c7b7e461ed4f8db.webp","11206b38d6322288e559876f753fba39":"game-covers/catalog/11206b38d6322288e559876f753fba39.webp","eca5e6fa4ab1a0c0253a79de97503e79":"game-covers/catalog/eca5e6fa4ab1a0c0253a79de97503e79.webp","211103c17fcb3b79c39ad39789264494":"game-covers/catalog/211103c17fcb3b79c39ad39789264494.webp","9b840512cc47fc5f01af71b86a6efa17":"game-covers/catalog/9b840512cc47fc5f01af71b86a6efa17.webp","cd40561b622c4fa9ed9984c31f0c697f":"game-covers/catalog/cd40561b622c4fa9ed9984c31f0c697f.webp","6d35bd6d089b6e5b1a4d874808921be1":"game-covers/catalog/6d35bd6d089b6e5b1a4d874808921be1.webp","e4d374502fae74130ca31e000d819e0a":"game-covers/catalog/e4d374502fae74130ca31e000d819e0a.webp","364ba2ddb76eb7cbc6f0930b0e7f3c98":"game-covers/catalog/364ba2ddb76eb7cbc6f0930b0e7f3c98.webp","23d5a7fce07475c26861881f9e434889":"game-covers/catalog/23d5a7fce07475c26861881f9e434889.webp","240a84bde1fb7233d09368a4c34aa2de":"game-covers/catalog/240a84bde1fb7233d09368a4c34aa2de.webp","9a9b0a0e5cd05cd0abc58e4be905368c":"game-covers/catalog/9a9b0a0e5cd05cd0abc58e4be905368c.webp","d77d2994b59fd2528a2841e5332147ac":"game-covers/catalog/d77d2994b59fd2528a2841e5332147ac.webp","dad5c758fc98fd5b4d6e91c6ee064090":"game-covers/catalog/dad5c758fc98fd5b4d6e91c6ee064090.webp","1d0f5bdb1ccf6881367a364b670b1f7a":"game-covers/catalog/1d0f5bdb1ccf6881367a364b670b1f7a.webp","711b2a2de84de6a70ec0efa0b909cad3":"game-covers/catalog/711b2a2de84de6a70ec0efa0b909cad3.webp","b3fe18eb2d0f57fa7dcf9f38af2d7764":"game-covers/catalog/b3fe18eb2d0f57fa7dcf9f38af2d7764.webp","a740fd81eee2ab7dd66535c36662f651":"game-covers/catalog/a740fd81eee2ab7dd66535c36662f651.webp"};
const FALLBACK_ART='game-covers/l1017n-loading-logo-20261119.jpeg';
function localImage(product){return CATEGORY_ART[product.category_id]||FALLBACK_ART;}
function fallbackImage(photo){if(photo.dataset.localFallback==='1'){photo.hidden=true;return;}photo.dataset.localFallback='1';photo.src=FALLBACK_ART;}
function art(product,categoryArt=false){
 const wrap=make('span','sc-art');
 const src=localImage(product);
 if(src){const photo=make('img');photo.src=src;photo.alt=product.category_name||product.name||'صورة المنتج';photo.loading='eager';photo.decoding='auto';photo.fetchPriority='high';photo.width=640;photo.height=640;wrap.append(photo);}
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
function homeSection(product){
 const section=String(product.section||'').toLowerCase();
 if(section==='games')return 'games';
 if(section.startsWith('local'))return 'local';
 if(/card|gift/.test(section))return 'cards';
 if(/voice|audio/.test(section)||/hello\s*yo|yalla\s*(?:voice|chat)|غرف\s+صوتية/i.test(product.category_name))return 'voice';
 return 'other';
}
const searchText=value=>String(value).toLowerCase().normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
function homeCards(section,query='',chosen='all'){
 if(chosen!=='all'&&chosen!==section)return '';
 const q=searchText(query.trim());
 const popular=window.L1017nFeaturedCatalog;
 const ranked=[];
 for(const p of categories()){
  if(['roblox','pubg','psn'].includes(p.game))continue; // Existing direct game/card entries remain the originals.
  if(homeSection(p)!==section)continue;
  if(q&&!searchText([p.category_name,...entries.filter(x=>x.category_id===p.category_id).map(x=>x.name+' '+x.group)].join(' ')).includes(q))continue;
  const rank=popular?.rankFor(section,p.category_name)??-1;
  // Avoid inventing any of the worldwide Top 10 categories. Keep older products in the supplier database.
  if((section==='games'||section==='cards')&&rank<0)continue;
  ranked.push({...p,popularityRank:rank});
 }
 if(section==='games'||section==='cards'){
  ranked.sort((a,b)=>a.popularityRank-b.popularityRank||b.count-a.count);
  const seen=new Set();
  const limit=section==='games'?8:9; // Roblox and PUBG occupy 2 game slots, PlayStation occupies 1 card slot.
  const selected=[];
  for(const p of ranked){
   if(seen.has(p.popularityRank))continue;
   seen.add(p.popularityRank);selected.push(p);
   if(selected.length>=limit)break;
  }
  ranked.length=0;ranked.push(...selected);
 }
 return ranked.map(p=>{
  const src=localImage(p);
  return '<article class="ll-game-section ll-reveal sc-home-card" dir="rtl"><button type="button" class="ll-game-section-link" data-supplier-category="'+escape(p.category_id)+'" aria-label="فتح '+escape(p.category_name)+'"><span class="ll-game-section-art sc-home-art">'+(src?'<img src="'+escape(src)+'" alt="" loading="lazy" decoding="auto" width="480" height="480">':'')+'</span><span class="ll-game-section-details"><strong>'+escape(p.category_name)+'</strong><small class="ll-stock-count">'+p.count+' باقة متوفرة</small></span></button></article>';
 }).join('');
}
function groupChoices(products){
 const groups=new Map();
 for(const p of products){
  const key=p.group||'الباقات';
  if(!groups.has(key))groups.set(key,{key,product:p,count:0,available:0});
  const row=groups.get(key);row.count++;if(p.available)row.available++;
 }
 const preferred=['أمريكا','أمريكي','US','USA','السعودية','الإمارات','بريطانيا','تركيا'];
 const rank=s=>{const index=preferred.indexOf(s);return index<0?99:index;};
 return [...groups.values()].sort((a,b)=>rank(a.key)-rank(b.key)||a.key.localeCompare(b.key,'ar'));
}
function groupLabel(name){
 const labels={'أمريكا':'أمريكي','أمريكي':'أمريكي','US':'أمريكي','USA':'أمريكي','United States':'أمريكي','السعودية':'سعودي','الإمارات':'إماراتي','بريطانيا':'بريطاني','تركيا':'تركي'};
 const suffix=String(name).match(/\((US|USA|UK|GB|SA|AE|TR)\)\s*$/i)?.[1]?.toUpperCase();
 const suffixLabels={US:'أمريكي',USA:'أمريكي',UK:'بريطاني',GB:'بريطاني',SA:'سعودي',AE:'إماراتي',TR:'تركي'};
 return labels[name]||suffixLabels[suffix]||name;
}
function mount(){
 if(root)return;
 root=make('section','sc-screen');root.id='completeSupplierCatalog';root.hidden=true;root.dir='rtl';
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','منتجات المتجر');
 root.innerHTML='<div class="sc-wrap"><header class="sc-head"><button type="button" class="sc-back">رجوع</button><div><h1>منتجات المتجر</h1></div></header><div class="sc-tools" hidden aria-hidden="true"><input class="sc-search" type="hidden" value=""><input class="sc-only" type="checkbox" hidden></div><p class="sc-status" role="status" aria-live="polite"></p><div class="sc-groups"></div><div class="sc-grid" hidden></div><button type="button" class="sc-more" hidden>عرض المزيد</button><button type="button" class="sc-retry" hidden>إعادة المحاولة</button></div>';
 document.body.append(root);
 root.querySelector('.sc-back').onclick=goBack;
 for(const selector of ['.sc-search','.sc-only'])root.querySelector(selector).addEventListener(selector==='.sc-search'?'input':'change',()=>{limit=24;draw();});
 root.querySelector('.sc-more').onclick=()=>{limit+=24;draw();};
 root.querySelector('.sc-retry').onclick=()=>void refresh();
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();goBack();}
  if(e.key==='Tab'&&!document.querySelector('#omnexCheckout[open]')){
   const buttons=[...root.querySelectorAll('button:not([hidden]):not([disabled]),input')].filter(x=>x.getClientRects().length);
   if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}
   else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus();}
  }
 });
}
function drawGroups(){
 const panel=root.querySelector('.sc-groups');
 const products=entries.filter(p=>!category||p.category_id===category);
 const choices=category?groupChoices(products):categories().map(p=>({key:p.category_id,product:p,count:entries.filter(x=>x.category_id===p.category_id).length,available:p.count}));
 const key=JSON.stringify({category,choices:choices.map(x=>[x.key,x.count,x.available])});
 root.querySelector('.sc-status').textContent=!homeReady?'جاري تحميل الأقسام…':choices.length?'':'لا توجد أقسام متاحة حاليًا.';
 if(panel.dataset.renderKey===key)return;
 panel.dataset.renderKey=key;panel.replaceChildren();
 for(const row of choices){
  const button=make('button','sc-group-card');button.type='button';
  button.dataset.groupKey=row.key;
  button.append(art(row.product,true));
  const copy=make('span','sc-group-copy');
  copy.append(make('strong','',category?groupLabel(row.key):row.product.category_name),make('small','ll-stock-count',row.available+' باقة متوفرة'));
  button.append(copy);
  button.onclick=()=>{
   if(!category){allScroll=root.scrollTop;category=row.key;groupScroll=0;panel.dataset.renderKey='';draw();root.scrollTop=0;return;}
   groupScroll=root.scrollTop;lastGroupButton=row.key;selectedGroup=row.key;limit=24;renderKey='';
   root.querySelector('.sc-search').value='';root.querySelector('.sc-only').checked=false;
   draw();root.scrollTop=0;root.querySelector('.sc-back').focus({preventScroll:true});
  };
  panel.append(button);
 }
 root.querySelector('.sc-status').textContent=!homeReady?'جاري تحميل الأقسام…':choices.length?'':'لا توجد أقسام متاحة حاليًا.';
}
function draw(){
 if(!root||root.hidden)return;
 const grouped=selectedGroup===null;
 const categoryName=entries.find(p=>p.category_id===category)?.category_name||'جميع منتجات المتجر';
 root.querySelector('h1').textContent=grouped?categoryName:groupLabel(selectedGroup);
 root.querySelector('.sc-tools').hidden=true;
 root.querySelector('.sc-groups').hidden=!grouped;
 root.querySelector('.sc-grid').hidden=grouped;
 root.querySelector('.sc-more').hidden=grouped;
 root.querySelector('.sc-back').setAttribute('aria-label',!grouped?'العودة إلى اختيار الدولة':!entryCategory&&category?'العودة إلى الأقسام':'العودة إلى المتجر');
 if(grouped){drawGroups();return;}
 const q=root.querySelector('.sc-search').value.trim().toLocaleLowerCase(),only=root.querySelector('.sc-only').checked;
 const items=entries.filter(p=>p.category_id===category&&(p.group||'الباقات')===selectedGroup&&(!only||p.available)&&(!q||p.name.toLocaleLowerCase().includes(q)));
 const grid=root.querySelector('.sc-grid');
 const nextKey=JSON.stringify({category,q,selectedGroup,only,limit,items:items.slice(0,limit)});
 root.querySelector('.sc-status').textContent=items.length?items.length+' باقة':'لا توجد باقات مطابقة حاليًا.';
 root.querySelector('.sc-more').hidden=items.length<=limit;
 if(nextKey===renderKey)return;
 renderKey=nextKey;grid.replaceChildren();
 for(const p of items.slice(0,limit)){
  const card=make('article','sc-product');card.dataset.favId=String(p.id||p.name||"");card.append(art(p));
  const stock=make('span','sc-availability ll-stock-state'+(p.available?' is-available':''),p.available?'متوفر':'غير متوفر');
  stock.dataset.available=String(p.available);
  const info=make('div','sc-info');info.append(make('small','sc-region',groupLabel(selectedGroup)),make('h2','',p.name),stock,make('strong','sc-price',cash(p.price)));
  const button=make('button','sc-buy',p.available?'شراء الآن':'غير متوفر');button.type='button';button.disabled=!p.available;
  button.onclick=()=>{if(typeof window.openOmnexProductCheckout==='function')window.openOmnexProductCheckout({...p,region:p.group||p.category_name});};
  info.append(button);card.append(info);grid.append(card);
 }
}
function goBack(){
 if(selectedGroup!==null){
  selectedGroup=null;renderKey='';draw();root.scrollTop=groupScroll;
  [...root.querySelectorAll('.sc-group-card')].find(button=>button.dataset.groupKey===lastGroupButton)?.focus({preventScroll:true});return;
 }
 if(!entryCategory&&category){category=null;root.querySelector('.sc-groups').dataset.renderKey='';draw();root.scrollTop=allScroll;return;}
 close();
}
function open(id=null){
 mount();entryCategory=id;category=id;selectedGroup=null;limit=24;returnFocus=document.activeElement;groupScroll=0;
 root.querySelector('.sc-search').value='';root.querySelector('.sc-only').checked=false;
 root.querySelector('.sc-groups').dataset.renderKey='';
 root.hidden=false;document.body.classList.add('sc-open');renderKey='';draw();root.scrollTop=scrolls.get(id)||0;
 root.querySelector('.sc-back').focus({preventScroll:true});void refresh(true);
}
function close(){
 if(!root)return;
 scrolls.set(entryCategory,selectedGroup===null?root.scrollTop:groupScroll);
 root.hidden=true;document.body.classList.remove('sc-open');
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
  const nextEntries=data.products.filter(p=>/^[a-f0-9]{32}$/.test(String(p.id))&&/^[a-f0-9]{32}$/.test(String(p.category_id))&&Number(p.price)>0&&typeof p.name==='string').map(p=>({...p,group:String(p.group||p.region||''),category_name:String(p.category_name||'منتجات'),available:p.available===true}));
  const changed=!homeReady||JSON.stringify(nextEntries)!==JSON.stringify(entries);
  entries=nextEntries;homeReady=true;
  if(changed)window.dispatchEvent(new Event('l1017n:catalog-updated'));
  if(root&&!root.hidden){draw();root.querySelector('.sc-retry').hidden=true;}
 }catch{
  if(seq!==sequence)return;
  if(root&&!root.hidden){root.querySelector('.sc-status').textContent='تعذر تحديث المنتجات. أعد المحاولة قبل الشراء.';root.querySelector('.sc-retry').hidden=false;}
 }finally{
  if(seq===sequence&&!initialLoadSettled){
   initialLoadSettled=true;
   window.dispatchEvent(new Event('l1017n:supplier-catalog-settled'));
  }
 }
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-supplier-category]');if(button){open(button.dataset.supplierCategory);return;}
 if(e.target.closest('[data-supplier-all]'))open();
});
document.addEventListener('error',e=>{if(e.target.matches?.('.sc-home-art img,.sc-art img,#omnexCheckout .ox-summary img'))fallbackImage(e.target);},true);
window.L1017nCompleteCatalog={homeCards,open,refresh,categories,imageFor:localImage,groupChoices,groupLabel,productFor:id=>entries.find(p=>p.id===id)};
const boot=()=>{void refresh();setInterval(()=>{if(!document.hidden)void refresh(true);},60000);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
