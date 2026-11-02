(function(){
  var s=document.createElement('script');
  s.src='legacy-app.js?v=official-game-art-20261102-v2';
  s.onerror=function(){console.error('تعذر تحميل وظائف المتجر')};
  s.onload=function(){
    var auto=document.createElement('script');
    auto.src='auto-topup.js?v=notify-every-order4&credit-drop=2';
    auto.onerror=function(){console.error('تعذر تحميل الشحن الآلي');var b=document.getElementById('transferInstructions');if(b)b.textContent='تعذر تحميل خدمة الشحن الآلي؛ لا تحوّل حتى يتم إصلاحها.'};
    document.body.appendChild(auto);
    var ranking=document.createElement('script');
    ranking.src='google-leaderboard.js?v=email-profile1&topup-only=1&rank-identity-settings=1&full-screen-privacy=1';
    ranking.onerror=function(){console.error('تعذر تحميل عرض التصنيف')};
    document.body.appendChild(ranking);
  };
  document.body.appendChild(s);
})();
