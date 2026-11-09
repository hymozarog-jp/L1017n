/* L1017N unified administration: existing secure operations, one tidy workspace. */
(function(){
 "use strict";
 const $=s=>document.querySelector(s);
 const symbols={
  overview:'<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
  orders:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  topups:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2M7 3h10"/>',
  stock:'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v11"/>',
  products:'<path d="M4 4h7l9 9-7 7-9-9V4Z"/><circle cx="8" cy="8" r="1"/>',
  finance:'<path d="M4 19h16M7 15V9M12 15V4M17 15v-5"/><path d="m4 8 5-4 5 3 6-5"/>',
  reviews:'<path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9Z"/>',
  wallets:'<circle cx="8" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M16 7a3 3 0 0 1 0 6M16 16a5 5 0 0 1 6 5"/>',
  reports:'<path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M15 2v6h5M9 16v-4m4 4v-6m4 6v-3"/>'
 };
 const icon=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+symbols[k]+'</svg>';
 const tabs=[
  ['overview','نظرة عامة','زوار المتجر'],
  ['orders','طلبات الشراء','القبول والتسليم'],
  ['topups','طلبات الشحن','التحويلات والمراجعة'],
  ['stock','مخزون الروبوكس','الكمية المتوفرة'],
  ['products','المنتجات','الأسعار والباقات'],
  ['finance','الأرباح','المبيعات والتكاليف'],
  ['reviews','التقييمات','آراء المشترين'],
  ['wallets','محافظ الزبائن','الأرصدة والمعاملات'],
  ['reports','تقارير متقدمة','الجداول والتحليلات']
 ];
 let active='overview',nav=null,header=null,panes={};
 function sectionOf(selector){return $(selector)?.closest('section')||null}
 function addFramePanel(id,url,name,description){
   const section=document.createElement('section');
   section.id=id;
   section.className='admin-hub-embed-panel';
   section.innerHTML='<p>'+description+'</p>'+
     '<a class="admin-hub-frame-open" href="'+url+'" target="_blank" rel="noopener noreferrer">فتح '+name+' بصفحة كاملة ↗</a>'+
     '<iframe class="admin-hub-embedded-frame" title="'+name+'" data-admin-frame="'+url+'" loading="lazy"></iframe>';
   $('#adminContent').appendChild(section);
   return section;
 }
 function addReviewPanel(){
   const section=document.createElement('section');
   section.id='adminHubReviews';
   section.className='admin-dashboard l1017-extra';
   const heading=document.createElement('div');
   heading.className='section-head';
   heading.innerHTML='<div><h3>تقييمات المشترين</h3><p>إخفاء أو إظهار تقييمات أصحاب الطلبات المكتملة.</p></div>'+
     '<button type="button" class="btn btn-soft" id="adminHubRefreshReviews">تحديث ↻</button>';
   section.appendChild(heading);
   const moderation=$('#businessReviews');
   const finance=$('#l1017BusinessPanel');
   if(moderation&&finance){
     const title=[...finance.querySelectorAll('h4')].find(el=>el.textContent.includes('إدارة تقييمات'));
     if(title){
       const before=title.previousElementSibling;
       if(before?.classList.contains('e-divider'))before.remove();
       title.remove();
     }
     section.appendChild(moderation); // Preserves the existing secure moderation click handler.
   }else{
     section.insertAdjacentHTML('beforeend','<p class="admin-hub-empty">ما قدرتش نحمّل التقييمات الآن؛ حدّث الصفحة للمحاولة مجددًا.</p>');
   }
   $('#adminContent').appendChild(section);
   heading.querySelector('button')?.addEventListener('click',()=>{
     $('#refreshBusiness')?.click();
   });
   return section;
 }
 function makeMenu(){
   const menu=document.createElement('section');
   menu.id='adminHubMenu';
   menu.setAttribute('aria-label','أقسام إدارة المتجر');
   menu.innerHTML='<div class="admin-hub-menu-caption"><strong>أقسام الإدارة</strong><small>اختار القسم اللي تبيه</small></div>'+
     '<div class="admin-hub-grid" role="tablist" aria-label="التنقل بين أقسام الإدارة">'+
     tabs.map(([id,label,desc])=>'<button class="admin-hub-tab" type="button" role="tab" data-admin-hub-tab="'+id+
       '" aria-selected="false" aria-controls="'+panes[id].id+'">'+icon(id)+'<b>'+label+'</b><small>'+desc+'</small></button>').join('')+
     '</div>';
   menu.addEventListener('click',e=>{
     const button=e.target.closest('[data-admin-hub-tab]');
     if(button){show(button.dataset.adminHubTab,true);}
   });
   menu.addEventListener('keydown',e=>{
     const button=e.target.closest('[data-admin-hub-tab]');
     if(!button)return;
     const controls=[...menu.querySelectorAll('[data-admin-hub-tab]')];
     const i=controls.indexOf(button);
     let next=-1;
     if(e.key==='ArrowLeft')next=(i+1)%controls.length;
     if(e.key==='ArrowRight')next=(i+controls.length-1)%controls.length;
     if(e.key==='Home')next=0;
     if(e.key==='End')next=controls.length-1;
     if(next>=0){
       e.preventDefault();
       controls[next].focus();
       show(controls[next].dataset.adminHubTab,false);
     }
   });
   $('#adminContent').prepend(menu);
   nav=menu;
   const current=document.createElement('div');
   current.className='admin-hub-current';
   current.innerHTML='<div><div class="admin-hub-current-name" id="adminHubCurrentName"></div>'+
     '<p class="admin-hub-current-sub" id="adminHubCurrentDesc"></p></div>'+
     '<button type="button" class="admin-hub-menu-shortcut">كل الأقسام ↑</button>';
   menu.after(current);
   current.querySelector('button').addEventListener('click',()=>nav.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}));
   header=current;
 }
 function show(key,scroll){
   if(!Object.prototype.hasOwnProperty.call(panes,key))key='overview';
   active=key;
   for(const [section,node] of Object.entries(panes)){
     if(!node)continue;
     const selected=section===key;
     node.classList.toggle('admin-hub-active',selected);
     node.setAttribute('aria-hidden',selected?'false':'true');
   }
   nav?.querySelectorAll('[data-admin-hub-tab]').forEach(button=>{
     const selected=button.dataset.adminHubTab===key;
     button.classList.toggle('is-active',selected);
     button.setAttribute('aria-selected',String(selected));
     button.tabIndex=selected?0:-1;
   });
   const item=tabs.find(x=>x[0]===key);
   if($('#adminHubCurrentName'))$('#adminHubCurrentName').textContent=item[1];
   if($('#adminHubCurrentDesc'))$('#adminHubCurrentDesc').textContent=item[2];
   if(key==='overview')$('#refreshTraffic')?.click();
   if(key==='orders'||key==='topups'||key==='stock'||key==='products'){
     // Reuse the existing authorized admin fetch; never mutate data on tab change.
     if(typeof loadAdminDashboard==='function')void loadAdminDashboard();
   }
   if(key==='finance'||key==='reviews')$('#refreshBusiness')?.click();
   if(key==='wallets'||key==='reports'){
     const iframe=panes[key]?.querySelector('iframe[data-admin-frame]');
     if(iframe&&!iframe.getAttribute('src')){
       iframe.setAttribute('src',iframe.dataset.adminFrame+'?embedded=1');
     }
   }
   if(scroll&&header){
     header.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
   }
 }
 function toggleAdminBody(){
   const visible=!!$('#adminView')&&!$('#adminView').classList.contains('hidden');
   document.body.classList.toggle('l1017-admin-open',visible);
 }
 function init(){
   const view=$('#adminView'),content=$('#adminContent');
   if(!view||!content||$('#adminHubMenu'))return;
   const staticTargets={
     overview:sectionOf('#adminTraffic'),
     orders:sectionOf('#adminPurchases'),
     topups:sectionOf('#adminTopups'),
     stock:sectionOf('#adminRobuxStock'),
     products:sectionOf('#adminProducts'),
     finance:$('#l1017BusinessPanel')
   };
   for(const key of ['overview','orders','topups','stock','products']){
     if(!staticTargets[key]){
       console.warn('[admin-hub] Missing existing panel',key);
       return; // Never hide old admin functionality if the page structure changed.
     }
   }
   panes={...staticTargets};
   if(!panes.finance){
     const fallback=document.createElement('section');
     fallback.id='adminHubFinanceFallback';fallback.className='admin-dashboard';
     fallback.innerHTML='<h3>الأرباح والمبيعات</h3><p>تعذر تحميل ملخص الأرباح. افتح التقارير المفصلة من القائمة.</p>';
     content.appendChild(fallback);
     panes.finance=fallback;
   }
   panes.reviews=addReviewPanel();
   panes.wallets=addFramePanel('adminHubWallets','./admin-wallets.html','محافظ الزبائن',
     'عرض المحافظ، البحث عن الزبائن ومراجعة المعاملات من نفس إدارة المتجر.');
   panes.reports=addFramePanel('adminHubReports','./admin-reports.html','التقارير المتقدمة',
     'رسوم المبيعات وتقارير أكثر تفصيلًا؛ لا تحتاج لوحة إدارة ثانية.');
   Object.entries(panes).forEach(([key,node])=>{
     if(!node.id)node.id='adminHubPane-'+key;
     node.classList.add('admin-hub-pane');
   });
   makeMenu();
   // A single canonical admin entry and a visible return to the storefront.
   const top=view.querySelector(':scope > .section-head');
   if(top&&!$('#adminHubBack')){
     top.classList.add('admin-hub-top');
     const back=document.createElement('button');
     back.id='adminHubBack';back.className='admin-hub-back';
     back.type='button';
     back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4-8 8 8 8"/></svg>الرجوع للمتجر';
     back.addEventListener('click',()=>{
       if(typeof switchView==='function')switchView('account');
       else location.href='./index.html';
     });
     top.appendChild(back);
   }
   const banner=document.createElement('div');banner.className='admin-hub-banner';
   banner.innerHTML='<small class="admin-hub-topline">L1017N · ADMIN CENTER</small>'+
     '<h2>إدارة واحدة لكل متجرك</h2><p>الطلبات والشحن والمخزون والأرباح والمحافظ، كل قسم في مكانه.</p>';
   content.insertBefore(banner,nav);
   nav.classList.add('admin-hub-nav');
   const obs=new MutationObserver(toggleAdminBody);
   obs.observe(view,{attributes:true,attributeFilter:['class']});
   toggleAdminBody();
   show('overview',false);
   window.L1017nAdminHub={show:(key)=>show(key,true)};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
