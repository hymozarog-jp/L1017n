(function(){
  var s=document.createElement('script');
  s.src='legacy-app.js?v=20261126-boot2';
  s.onerror=function(){console.error('تعذر تحميل وظائف المتجر')};
  s.onload=function(){
    var auto=document.createElement('script');
    auto.src='auto-topup.js?v=restore-transfer-code-20261118&saved-sender-20261118&inline-real-credit-20261108-2&dial-code-telegram-20261105-1&sms-auto-amount-20261109=1&native-dialer-auto-20261109=1&three-dots-20261109=2-horizontal&no-telegram-approval=20261109-1&direct-transfer-label-20261109-1';
    auto.onerror=function(){console.error('تعذر تحميل الشحن الآلي');var b=document.getElementById('transferInstructions');if(b)b.textContent='تعذر تحميل خدمة الشحن الآلي؛ لا تحوّل حتى يتم إصلاحها.'};
    document.body.appendChild(auto);
    var ranking=document.createElement('script');
    ranking.src='google-leaderboard.js?v=public-friends-tabs-20261106-1';
    ranking.onerror=function(){console.error('تعذر تحميل عرض التصنيف')};
    document.body.appendChild(ranking);
    // Record first-party anonymous browser sessions only after the store API loads.
    var visitorCounter=document.createElement('script');
    visitorCounter.src='traffic-counter.js?v=anonymous-dashboard-20261109-1';
    visitorCounter.onerror=function(){console.warn('[traffic] Counter unavailable')};
    document.body.appendChild(visitorCounter);
    var loadUnifiedAdminHub=function(){
      var hub=document.createElement('script');
      hub.src='admin-hub.js?v=admin-code-deliveries-20261124-2&omnex-roblox-catalog-20261111-1&wallet-fullscreen-20261110-1&unified-finance-20261110-1&robux-profit-sync-20261109-1&visitors-accounts-20261111-1';
      hub.onerror=function(){console.warn('[admin] Unified administration interface unavailable')};
      document.body.appendChild(hub);
    };
    var extras=document.createElement('script');
    extras.src='store-business-extras.js?v=one-review-per-customer-20261110-1&latest-order-review-once-20261110-1&reviewer-names-20261110-1&reference-customer-reviews-20261110-1&points-progress-20261110-1&unified-finance-20261110-1&completion-rating-20261110-1&robux-cost-calculator-20261109-1&public-review-form=1';
    extras.onload=loadUnifiedAdminHub;
    extras.onerror=function(){
      console.warn('[store] Rewards and reviews unavailable');
      loadUnifiedAdminHub();
    };
    document.body.appendChild(extras);
    // Independent admin-only Robux sales counter; does not touch wallet/inventory.
    var soldTracker=document.createElement('script');
    soldTracker.src='admin-robux-sales.js?v=sold-counter-20261109-2-direct-total';
    soldTracker.onerror=function(){console.warn('[admin] Robux sales tracker unavailable')};
    document.body.appendChild(soldTracker);
  };
  document.body.appendChild(s);
})();
