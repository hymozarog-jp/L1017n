/* L1017n ranking room: works with the existing rankings and privacy data. */
(function(){
  'use strict';
  function setup(){
    var page=document.getElementById('leaderboardView');
    if(!page||page.classList.contains('l1017-rank-ready'))return;
    page.classList.add('l1017-rank-ready');
    var toolbar=document.createElement('div');
    toolbar.className='l1017-rank-toolbar';
    toolbar.innerHTML=

      '<button type="button" class="l1017-rank-refresh" id="l1017RankRefresh" aria-label="تحديث التصنيف">'+
      '<svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 13-3l2 6M4 12l2 6a8 8 0 0 0 13-3"/></svg></button>';
    var personalTitle=document.createElement('div');
    personalTitle.className='l1017-rank-mini-heading';
    personalTitle.innerHTML='<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3.6-8 8-8s8 3 8 8"/></svg> بطاقة ترتيبك';
    var privacyActions=page.querySelector('#leaderboardPrivacyActions');
    if(privacyActions)toolbar.prepend(privacyActions);
    page.prepend(toolbar);
    var own=document.getElementById('lbMyRank');
    if(own)page.insertBefore(personalTitle,own);
    var previous='home';
    function selectedView(){
      var mobile=document.querySelector('#llBottomNav [data-ll-nav].active');
      if(mobile&&mobile.dataset.llNav)return mobile.dataset.llNav;
      var classic=document.querySelector('.mobile-nav [data-view].active');
      if(classic&&classic.dataset.view)return classic.dataset.view;
      return 'home';
    }
    document.addEventListener('click',function(e){
      var nav=e.target.closest('[data-ll-nav="leaderboard"],[data-view="leaderboard"]');
      if(nav&&!page.classList.contains('l1017-rank-ready'))return;
      if(nav&&page.classList.contains('hidden')){var v=selectedView();if(v!=='leaderboard')previous=v;}
    },true);
    function navigateBack(){
      var target=previous&&previous!=='leaderboard'?previous:'home';
      var control=document.querySelector('#llBottomNav [data-ll-nav="'+target+'"]')||
        document.querySelector('.mobile-nav [data-view="'+target+'"]')||
        document.querySelector('.desktop-nav [data-view="'+target+'"]');
      if(control)control.click();
      else if(typeof window.switchView==='function')window.switchView(target);
      else page.classList.add('hidden');
    }
    toolbar.querySelector('#l1017RankRefresh').addEventListener('click',function(){
      var original=document.getElementById('refreshLeaderboard');
      if(original)original.click();
      else if(typeof window.loadLeaderboard==='function')void window.loadLeaderboard();
    });
    function sync(){
      var visible=!page.classList.contains('hidden');
      document.body.classList.toggle('l1017-rank-open',visible);
      page.setAttribute('aria-hidden',visible?'false':'true');
      if(visible){
        // Keep a full-page experience: scroll the ranking room itself.
        page.scrollTop=0;
      }
    }
    var observer=new MutationObserver(function(mutations){
      if(mutations.some(m=>m.attributeName==='class'))sync();
    });
    observer.observe(page,{attributes:true,attributeFilter:['class']});
    sync();
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!page.classList.contains('hidden')&&!document.body.classList.contains('l1017-rank-privacy-open')){
        e.preventDefault();navigateBack();
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
