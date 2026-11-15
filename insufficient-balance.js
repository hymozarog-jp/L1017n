(function () {
  'use strict';

  function createDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'insufficientBalanceDialog';
    dialog.dir = 'rtl';
    dialog.setAttribute('aria-labelledby', 'insufficientBalanceTitle');
    dialog.innerHTML = `
      <img src="game-covers/mobile/topup-neon-wallet.webp" alt="" width="108" height="108">
      <h2 id="insufficientBalanceTitle">رصيد غير كافي</h2>
      <button type="button" class="balance-topup">شحن المحفظة</button>
      <form method="dialog">
        <button type="submit" class="balance-cancel" autofocus>إلغاء</button>
      </form>`;
    document.body.append(dialog);
    return dialog;
  }

  window.showInsufficientBalance = function (beforeTopup) {
    const dialog = document.getElementById('insufficientBalanceDialog') || createDialog();
    if (dialog.open) return;
    dialog.querySelector('.balance-topup').onclick = () => {
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
