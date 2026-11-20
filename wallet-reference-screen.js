/* L1017n wallet screenshot-inspired page. Display only: all real balances
   and existing carrier/payment handlers remain untouched. */
(function(){
 'use strict';
 const q=(s,root=document)=>root.querySelector(s);
 function mount(){
   const wallet=q('#walletView');
   const showcase=q('.wallet-showcase',wallet||document);
   const carousel=q('.wallet-carousel',showcase||document);
   const actions=q('.wallet-actions',showcase||document);
   if(!wallet||!showcase||!carousel||!actions)return false;
   if(q('#tlWalletReference',wallet))return true;
   if(!q('.wallet-hero',carousel)||!q('.madar-wallet-card',carousel))return false;
   wallet.dataset.l1017WalletStyle='reference';
   const header=q(':scope > .section-head',wallet);
   if(header){
     const title=q('h2',header);
     if(title)title.textContent='محفظتي';
     if(!q('#tlWalletBack',header)){
       const back=document.createElement('button');
       back.id='tlWalletBack';back.type='button';back.className='tl-wallet-back';back.textContent='رجوع ←';
       back.addEventListener('click',()=>{
         if(typeof switchView==='function')switchView('home');
         else q('[data-ll-nav="home"]')?.click();
       });
       header.append(back);
     }
   }
   const chooser=document.createElement('section');
   chooser.id='tlWalletReference';chooser.className='tl-wallet-reference';chooser.dir='rtl';
   chooser.innerHTML=
     '<div class="tl-wallet-title"><strong>محافظك <span aria-hidden="true">▣</span></strong><small>دوس على المحفظة لعرض رصيدها</small></div>'+
     '<div class="tl-wallet-selector" role="group" aria-label="اختيار المحفظة المعروضة">'+
     '<button type="button" data-tl-preview="libyana" aria-pressed="false"><span class="tl-selector-mark tl-libyana-mark" aria-hidden="true">Li</span><span class="tl-selector-label"><b>ليبيانا Pay</b><small>رصيد ليبيانا</small></span><span class="tl-selector-check" aria-hidden="true">✓</span></button>'+
     '<button type="button" data-tl-preview="madar" aria-pressed="false"><span class="tl-selector-mark tl-madar-mark" aria-hidden="true">M</span><span class="tl-selector-label"><b>مدار Pay</b><small>رصيد المدار</small></span><span class="tl-selector-check" aria-hidden="true">✓</span></button></div>';
   carousel.before(chooser);
   const primary=document.createElement('p');
   primary.className='tl-wallet-primary-note';primary.id='tlWalletPrimaryNote';primary.setAttribute('role','status');
   carousel.after(primary);
   const tiles=document.createElement('section');
   tiles.id='tlWalletActionsReference';tiles.className='tl-wallet-tiles';tiles.dir='rtl';
   tiles.setAttribute('aria-label','طرق شحن المحفظة');
   tiles.innerHTML=
     '<button type="button" class="tl-wallet-tile tl-wallet-direct" data-tl-wallet-action="direct"><span class="tl-tile-icon" aria-hidden="true">＋</span><span class="tl-tile-content"><strong>تحويل مباشر</strong><small id="tlDirectCaption">تحويل من رصيد خطك إلى رقم المتجر</small></span><span class="tl-tile-arrow" aria-hidden="true">‹</span></button>'+
     '<button type="button" class="tl-wallet-tile tl-wallet-cards" data-tl-wallet-action="card"><span class="tl-tile-icon" aria-hidden="true">＋</span><span class="tl-tile-content"><strong>تعبئة كروت ليبيانا</strong><small>أدخل كروت ليبيانا لطلب تعبئة محفظتك</small></span><span class="tl-tile-arrow" aria-hidden="true">‹</span></button>';
   actions.before(tiles);
   const extra=document.createElement('h3');
   extra.className='tl-wallet-extra-heading';extra.textContent='ميزات إضافية';actions.before(extra);
   const notice=document.createElement('p');
   notice.id='tlWalletNotice';notice.className='tl-wallet-notice';tiles.after(notice);
   let selected=document.body.dataset.checkoutWallet==='almadar'?'madar':'libyana';
   let interacted=false;
   function update(){
     wallet.dataset.tlPreview=selected;
     chooser.querySelectorAll('[data-tl-preview]').forEach(button=>{
       const active=button.dataset.tlPreview===selected;
       button.setAttribute('aria-pressed',String(active));
       button.classList.toggle('is-active',active);
     });
     const card=q(selected==='madar'?'.madar-wallet-card':'.wallet-hero',carousel);
     const isPrimary=card?.dataset.primarySelected==='true';
     primary.textContent=isPrimary?'★ هذه محفظتك الأساسية — مشترياتك منها':'هذه محفظة مستقلة. تقدر تجعلها أساسية للشراء منها.';
     primary.dataset.isPrimary=String(isPrimary);
     q('[data-tl-wallet-action="card"]',tiles).hidden=selected!=='libyana';
     q('#tlDirectCaption',tiles).textContent=selected==='madar'
       ?'حوّل من خط المدار ثم سجّل التحويل للمراجعة'
       :'حوّل من رقم ليبيانا المحفوظ وتابع التحقق';
     notice.textContent=selected==='madar'
       ?'شحن المدار يُعتمد بعد مراجعة التحويل. لا تكرر التحويل إذا سجلت طلبًا.'
       :'يُضاف رصيد ليبيانا بعد التحقق من التحويل. لا تكرره إذا كان قيد التحقق.';
   }
   chooser.addEventListener('click',event=>{
     const button=event.target.closest('[data-tl-preview]');
     if(!button)return;
     interacted=true;selected=button.dataset.tlPreview;update();
   });
   tiles.addEventListener('click',event=>{
     const button=event.target.closest('[data-tl-wallet-action]');
     if(!button)return;
     if(button.dataset.tlWalletAction==='card'){
       if(selected!=='libyana')return;
       if(typeof window.openCardTopupPage==='function')window.openCardTopupPage();
       else q('#walletActionCard')?.click();
       return;
     }
     if(selected==='madar'){
       if(typeof window.openMadarTopup==='function')void window.openMadarTopup();
       else q('#madarWalletTopup')?.click();
     }else q('#walletActionTopup')?.click();
   });
   window.addEventListener('l1017n:checkout-wallet-changed',()=>{
     if(!interacted)selected=document.body.dataset.checkoutWallet==='almadar'?'madar':'libyana';
     update();
   });
   for(const card of carousel.children){
     if(card.matches('.wallet-hero,.madar-wallet-card'))
       new MutationObserver(update).observe(card,{attributes:true,attributeFilter:['data-primary-selected']});
   }
   update();
   return true;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
})();
