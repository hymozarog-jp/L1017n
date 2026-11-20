(function () {
  'use strict';

  function createDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'insufficientBalanceDialog';
    dialog.dir = 'rtl';
    dialog.setAttribute('aria-labelledby', 'insufficientBalanceTitle');
    dialog.innerHTML = `
      <svg class="balance-wallet-art" viewBox="0 0 112 112" width="112" height="112" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="balanceWalletFill" x1="0" y1="0" x2="1" y2="1">
            <stop stop-color="#aa7df3"/>
            <stop offset="1" stop-color="#6539ad"/>
          </linearGradient>
        </defs>
        <circle cx="56" cy="56" r="51" fill="#a877f5" opacity=".12"/>
        <path d="M25 45V37a8 8 0 0 1 6-8l37-10a7 7 0 0 1 9 5l4 14" fill="#624395" stroke="#cdaefb" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="20" y="36" width="69" height="49" rx="12" fill="url(#balanceWalletFill)" stroke="#e0c9ff" stroke-width="2.5"/>
        <path d="M75 50h14a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H75a10 10 0 0 1 0-20z" fill="#4f2889" stroke="#d8baff" stroke-width="2"/>
        <circle cx="76" cy="60" r="2.6" fill="#f2e5ff"/>
        <path d="M30 73h14" stroke="#e0c9ff" stroke-width="2.5" stroke-linecap="round" opacity=".75"/>
        <circle cx="83" cy="82" r="13" fill="#f5ce87" stroke="#34224e" stroke-width="3"/>
        <path d="M83 76v6m0 5h.01" stroke="#64401d" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <h2 id="insufficientBalanceTitle">رصيد غير كافي</h2>
      <button type="button" class="balance-topup">شحن المحفظة</button>
      <form method="dialog">
        <button type="submit" class="balance-cancel" autofocus>إلغاء</button>
      </form>`;
    document.body.append(dialog);
    return dialog;
  }

  window.showInsufficientBalance = function (beforeTopup, wallet) {
    const dialog = document.getElementById('insufficientBalanceDialog') || createDialog();
    if (dialog.open) return;
    dialog.querySelector('.balance-topup').onclick = () => {
      if(wallet==='almadar'){
        dialog.close();
        beforeTopup?.();
        void window.openMadarTopup?.();
        return;
      }
      window.openDedicatedTopup?.();
      const page = document.getElementById('topupDedicatedPage');
      if (!page) return;
      page.classList.add('balance-topup-page');
      const back = page.querySelector('.topup-dedicated-back');
      if (back) back.textContent = 'رجوع';
      beforeTopup?.();
      dialog.close();
      back?.focus({preventScroll: true});
    };
    dialog.showModal();
  };
})();
