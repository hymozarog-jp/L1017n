(function(){
  var s=document.createElement('script');
  s.src='legacy-app.js?v=public-leaderboard1';
  s.onerror=function(){console.error('تعذر تحميل وظائف المتجر')};
  s.onload=function(){
    var ranking=document.createElement('script');
    ranking.src='google-leaderboard.js?v=google-ranking1';
    ranking.onerror=function(){console.error('تعذر تحميل عرض Google في التصنيف')};
    document.body.appendChild(ranking);
  };
  document.body.appendChild(s);
})();
