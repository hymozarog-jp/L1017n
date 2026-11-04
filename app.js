(function(){
  var s=document.createElement('script');
  s.src='legacy-app.js?v=wallet-long-pill-20261103-1&order-tracker=20261103-tap-card-2&libyana-art=drawn-phone-20261103&approval-colors=blue-green-20261103&telegram-stages=checkout-20261103-1&order-popup=screen-modal-20261103-2&graphic-art=faq-illustrations-20261103-1&invite-login=auto-credit-link-20261103-1&return-login=black-session-20261104-1&offers-on-home=20261104-1&nav-view-fix=20261104-2&header-notice=20261104-1&fast-auth=20261104-1&unread-bell=20261104-1&robux-packs-500-1000-removed=20261104-1';
  s.onerror=function(){console.error('تعذر تحميل وظائف المتجر')};
  s.onload=function(){
    var auto=document.createElement('script');
    auto.src='auto-topup.js?v=dial-code-telegram-20261105-1';
    auto.onerror=function(){console.error('تعذر تحميل الشحن الآلي');var b=document.getElementById('transferInstructions');if(b)b.textContent='تعذر تحميل خدمة الشحن الآلي؛ لا تحوّل حتى يتم إصلاحها.'};
    document.body.appendChild(auto);
    var ranking=document.createElement('script');
    ranking.src='google-leaderboard.js?v=unified-ui-icons-20261103-1';
    ranking.onerror=function(){console.error('تعذر تحميل عرض التصنيف')};
    document.body.appendChild(ranking);
  };
  document.body.appendChild(s);
})();
