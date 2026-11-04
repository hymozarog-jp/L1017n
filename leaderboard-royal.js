/* L1017n Royale • decorative leaderboard layer only.
   Uses the existing real server-rendered ranking; never changes money, rank or privacy. */
(function(){
 'use strict';
 function boot(){
  const page=document.getElementById('leaderboardView');
  const host=document.getElementById('leaderboardList');
  if(!page||!host||page.dataset.royalMounted==='1')return;
  page.dataset.royalMounted='1';
  page.classList.add('royal-leaderboard');
  const intro=document.createElement('section');
  intro.className='royal-intro';
  intro.setAttribute('aria-label','لوحة المتصدرين');
  intro.innerHTML=
   '<div class="royal-crown" aria-hidden="true">'+
   '<svg viewBox="0 0 64 60" fill="none" xmlns="http://www.w3.org/2000/svg">'+
   '<path d="M6 20 21 31 32 10 43 31 58 20 53 46H11L6 20Z" fill="#F8BE4B" stroke="#FFF0A0" stroke-width="2.6" stroke-linejoin="round"/>'+
   '<path d="M11 47H53V53H11V47Z" fill="#C77C24" stroke="#FFF1AC" stroke-width="2.6"/>'+
   '<circle cx="32" cy="8" r="4" fill="#FFF5BD"/><circle cx="6" cy="19" r="3.6" fill="#FFF5BD"/><circle cx="58" cy="19" r="3.6" fill="#FFF5BD"/>'+
   '<path d="M32 31 37 36 32 41 27 36Z" fill="#C36BFF" stroke="#FCDAFF" stroke-width="1.4"/>'+
   '</svg></div>'+
   '<div class="royal-leaves"><h1>المتصدرين الثلاثة</h1></div>'+
   '<p>أكثر المتسوقين شحنًا في متجر L1017n</p>';
  const toolbar=page.querySelector('.l1017-rank-toolbar');
  if(toolbar)toolbar.insertAdjacentElement('afterend',intro);
  else page.prepend(intro);
  const stats=document.createElement('section');
  stats.className='royal-stats';
  stats.setAttribute('aria-label','إحصائيات التصنيف');
  const values=[
   {icon:'trophy',title:'المراكز المشغولة',id:'ranked'},
   {icon:'coins',title:'مجموع شحن الثلاثة',id:'total'},
   {icon:'user',title:'مشارك في التصنيف',id:'members'}
  ];
  for(const item of values){
   const card=document.createElement('div');
   card.className='royal-stat';
   const mark=document.createElement('span');mark.className='royal-stat-icon';mark.innerHTML='<svg class="l1017-icon" aria-hidden="true"><use href="#l1017-icon-'+item.icon+'"></use></svg>';mark.setAttribute('aria-hidden','true');
   const number=document.createElement('strong');number.dataset.royalStat=item.id;number.textContent='—';
   const description=document.createElement('small');description.textContent=item.title;
   card.append(mark,number,description);stats.appendChild(card);
  }
  const prize=page.querySelector('.lb-prize');
  if(prize)prize.insertAdjacentElement('beforebegin',stats);
  else page.appendChild(stats);
  const set=(id,text)=>{const n=stats.querySelector('[data-royal-stat="'+id+'"]');if(n&&n.textContent!==text)n.textContent=text};
  // Compact "your rank" summary beneath the top three. Reuse the personal
  // rank already fetched from get_my_store_leaderboard_rank; never guess a place.
  const ownRank=document.getElementById('lbMyRank');
  function showCompactRank(podium){
   let mini=host.querySelector('#royalMiniMyRank');
   const number=ownRank?.querySelector('.lb-self-position strong')?.textContent?.trim();
   if(!ownRank||ownRank.classList.contains('hidden')||!number){
    mini?.remove();
    return;
   }
   if(!mini){
    mini=document.createElement('aside');
    mini.id='royalMiniMyRank';
    mini.className='royal-mini-my-rank';
    mini.dir='rtl';
    mini.setAttribute('role','status');
    mini.setAttribute('aria-live','polite');
    mini.innerHTML='<span class="royal-mini-rank-icon" aria-hidden="true">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="M8 4h8v4a4 4 0 0 1-8 0Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5m-4 3h8m-6-3h4"/></svg></span>'+
      '<span class="royal-mini-rank-copy"><strong>ترتيبك الحالي</strong>'+
      '<small>بين متسوقي المتجر</small></span>'+
      '<strong class="royal-mini-rank-number"></strong>';
    podium.insertAdjacentElement('afterend',mini);
   }
   // A dash is preserved if the real personal-rank endpoint has no rank.
   const value=mini.querySelector('.royal-mini-rank-number');
   if(value&&value.textContent!==number)value.textContent=number;
   const info=mini.querySelector('.royal-mini-rank-copy small');
   const caption=number==='—'?'لم يتحدد ترتيبك بعد':'بين متسوقي المتجر';
   if(info&&info.textContent!==caption)info.textContent=caption;
  }
  function decorate(){
   const podium=host.querySelector('.lb-podium');
   if(!podium){
    set('ranked','—');set('total','—');set('members','—');
    return;
   }
   showCompactRank(podium);
   const cards=[...podium.querySelectorAll('.lb-podium-card:not(.lb-empty)')];
   let sum=0;
   for(const card of cards){
    const amount=card.querySelector('.lb-podium-amount')?.textContent||'';
    const match=amount.match(/[0-9][0-9,]*(?:\.[0-9]+)?/);
    if(match){const value=Number(match[0].replace(/,/g,''));if(Number.isFinite(value))sum+=value}
   }
   const countText=host.querySelector('.lb-results>.lb-section-label small')?.textContent||'';
   const countMatch=countText.match(/[0-9]+/);
   const count=countMatch?Number(countMatch[0]):(cards.length+host.querySelectorAll('.lb-other-row').length);
   set('ranked',String(cards.length));
   set('total',sum.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' د.ل');
   set('members',String(count));
   podium.querySelectorAll('.lb-podium-card').forEach(card=>{
     card.classList.add('royal-ranked-card');
   });
   host.querySelectorAll('.lb-other-row').forEach((row,index)=>{
     row.style.setProperty('--royal-index',String(Math.min(index,12)));
   });
  }
  let scheduled=false;
  function schedule(){
   if(scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{scheduled=false;decorate()});
  }
  const observer=new MutationObserver(schedule);
  observer.observe(host,{childList:true});
  // The personal rank loads asynchronously; reflect later login, logout,
  // rank recalculation and visibility changes in the mini summary.
  if(ownRank)observer.observe(ownRank,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  schedule();
  document.getElementById('l1017RankRefresh')?.addEventListener('click',schedule);
  document.getElementById('refreshLeaderboard')?.addEventListener('click',schedule);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})();