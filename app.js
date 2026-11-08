(function(){
  var s=document.createElement('script');
  s.src='legacy-app.js?v=credit-arrival-20261108&wallet-long-pill-20261103-1&order-tracker=20261103-tap-card-2&libyana-art=drawn-phone-20261103&approval-colors=blue-green-20261103&telegram-stages=checkout-20261103-1&order-popup=screen-modal-20261103-2&graphic-art=faq-illustrations-20261103-1&invite-login=auto-credit-link-20261103-1&return-login=black-session-20261104-1&offers-on-home=20261104-1&nav-view-fix=20261104-2&header-notice=20261104-1&fast-auth=20261104-1&unread-bell=20261104-1&robux-packs-500-1000-removed=20261104-1&orders-live-sync=20261105-1&phone-change-wizard=20261105-1&remove-unverified-phone=20261105-1&wallet-cards-history=20261105-1&encrypted-card-admin=20261105-1&inline-phone-profile=20261105-1&hide-home-offers=20261105-1&full-header-balance=20261105-1&large-pretty-balance=20261105-1&larger-wallet-amount=20261105-2&accurate-balance-fit=20261105-1&balanced-wallet-font=20261105-1&wallet-compact-balanced-20261106=1&fix-leaderboard-recursion-20261107=1&robux-sold-out-20261107=1&account-admin-shortcut=20261108-1&animated-order-cards=20261108-1&wallet-number-original-restored-20261108-4&custom-robux-quantity=20261108-1&verified-ussd-orders=20261108-1';
  s.onerror=function(){console.error('تعذر تحميل وظائف المتجر')};
  s.onload=function(){
    var auto=document.createElement('script');
    auto.src='auto-topup.js?v=inline-real-credit-20261108-1&dial-code-telegram-20261105-1';
    auto.onerror=function(){console.error('تعذر تحميل الشحن الآلي');var b=document.getElementById('transferInstructions');if(b)b.textContent='تعذر تحميل خدمة الشحن الآلي؛ لا تحوّل حتى يتم إصلاحها.'};
    document.body.appendChild(auto);
    var ranking=document.createElement('script');
    ranking.src='google-leaderboard.js?v=public-friends-tabs-20261106-1';
    ranking.onerror=function(){console.error('تعذر تحميل عرض التصنيف')};
    document.body.appendChild(ranking);
  };
  document.body.appendChild(s);
})();
