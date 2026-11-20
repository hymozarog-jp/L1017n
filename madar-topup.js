(function () {
  'use strict';
  const receiver = '0910005566';
  const dialog = document.getElementById('madarTopupDialog');
  const form = dialog.querySelector('#madarTransferForm');
  const amount = form.elements.amount;
  const sender = form.elements.sender;
  const confirmTransfer = form.elements.confirmTransfer;
  const submit = form.querySelector('[type="submit"]');
  const copy = form.querySelector('[data-madar-copy]');
  const code = form.querySelector('output');
  const status = dialog.querySelector('#madarTransferStatus');
  const manage = dialog.querySelector('[data-madar-manage]');
  const purchaseForm = dialog.querySelector('#madarPurchaseForm');
  const username = purchaseForm.elements.username;
  const buy = purchaseForm.querySelector('[type="submit"]');
  const purchaseStatus = purchaseForm.querySelector('[role="status"]');
  let customer = null;
  let sale = null;
  let salePending = false;
  let request = null;
  let loading = false;
  let submitted = false;
  let revision = 0;

  function renderPurchase() {
    const madarSelected = window.L1017nPrimaryWallets?.getSelectedFor(customer) === 'madar';
    buy.disabled = !customer || !madarSelected || salePending;
    if (customer && !madarSelected) {
      purchaseStatus.textContent = 'اختار المدار كمحفظة أساسية من صفحة المحفظة باش تشتري الباقة.';
    }
  }

  function render() {
    const value = amount.valueAsNumber;
    const valid = Number.isInteger(value) && value >= 1 && value <= 20;
    const ready = !loading && !submitted && Boolean(sender.value) && valid;
    code.textContent = ready ? '*140*4*1*1*' + receiver + '*' + value + '#' : '';
    copy.disabled = !ready;
    submit.disabled = !ready || !confirmTransfer.checked;
    sender.disabled = loading || submitted;
    amount.disabled = loading || submitted;
    confirmTransfer.disabled = !ready;
    form.querySelectorAll('[data-madar-amount]').forEach(button => {
      button.disabled = loading || submitted;
      button.setAttribute('aria-pressed', String(Number(button.dataset.madarAmount) === value));
    });
  }

  function changeTransfer() {
    confirmTransfer.checked = false;
    status.textContent = '';
    render();
  }

  async function open() {
    if (dialog.open) return;
    const token = ++revision;
    loading = true;
    submitted = false;
    customer = null;
    purchaseForm.reset();
    purchaseStatus.textContent = '';
    buy.disabled = true;
    form.reset();
    sender.replaceChildren(new Option('جاري تحميل أرقامك…', ''));
    manage.hidden = true;
    status.textContent = '';
    render();
    dialog.showModal();

    try {
      const user = await currentUser();
      if (token !== revision) return;
      customer = user?.id ?? null;
      renderPurchase();
      if (!user) {
        status.textContent = 'سجّل دخولك أولاً لشحن محفظة المدار.';
        manage.textContent = 'اذهب إلى حسابي';
        manage.hidden = false;
        return;
      }
      const {data, error} = await supabaseClient.rpc('get_my_saved_sender_phones');
      if (token !== revision) return;
      if (error) throw error;
      const phones = (data || []).filter(item => /^09[13][0-9]{7}$/.test(item.phone) && item.phone !== receiver);
      sender.replaceChildren(new Option('اختر رقم المدار المحوّل', ''));
      for (const item of phones) sender.add(new Option(item.phone, item.phone));
      if (phones.length === 1) sender.value = phones[0].phone;
      if (!phones.length) {
        status.textContent = 'أضف رقم خط المدار اللي بتحوّل منه في حسابك.';
        manage.textContent = 'إدارة أرقام الهاتف';
        manage.hidden = false;
      }
    } catch {
      if (token === revision) status.textContent = 'تعذر تحميل أرقامك. اقفل النافذة وافتحها مرة ثانية.';
    } finally {
      if (token === revision) {
        loading = false;
        if (!sender.value && sender.options.length === 1) sender.options[0].text = 'رقم المدار المحوّل';
        render();
      }
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#madarCatalogPurchase, #madarWalletTopup, #madarTopupProvider, #customerWalletChip[data-wallet-carrier="madar"] #customerTopupShortcut')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void open();
    }
  }, true);
  dialog.querySelector('[data-madar-close]').addEventListener('click', () => dialog.close());
  window.addEventListener('l1017n:checkout-wallet-changed', () => {
    if (!dialog.open) return;
    purchaseStatus.textContent = '';
    renderPurchase();
  });
  dialog.addEventListener('close', () => { revision++; });
  manage.addEventListener('click', () => {
    dialog.close();
    document.querySelector('#topupDedicatedPage .topup-dedicated-back')?.click();
    if (typeof switchView === 'function') switchView('account');
  });
  form.querySelectorAll('[data-madar-amount]').forEach(button => {
    button.addEventListener('click', () => {
      amount.value = button.dataset.madarAmount;
      changeTransfer();
    });
  });
  amount.addEventListener('input', changeTransfer);
  sender.addEventListener('change', changeTransfer);
  confirmTransfer.addEventListener('change', render);

  copy.addEventListener('click', async () => {
    if (!code.textContent) return;
    const token = revision;
    const value = code.textContent;
    try {
      await navigator.clipboard.writeText(value);
      if (token === revision && code.textContent === value) status.textContent = 'تم نسخ الكود. الصقه في لوحة الاتصال واختر شريحة المدار.';
    } catch {
      if (token === revision && code.textContent === value) status.textContent = 'اضغط مطولًا على الكود لنسخه والصقه في لوحة الاتصال.';
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const key = amount.valueAsNumber + ':' + sender.value;
    const token = revision;
    if (request?.key !== key) request = {key, id: crypto.randomUUID()};
    const pending = request;
    loading = true;
    render();
    try {
      const {error} = await supabaseClient.rpc('submit_madar_topup', {
        p_request_id: pending.id, p_amount: amount.valueAsNumber, p_sender_phone: sender.value
      });
      if (error) throw error;
      if (request === pending) request = null;
      if (token === revision) {
        submitted = true;
        status.textContent = 'تم تسجيل الطلب وهو قيد المراجعة. تقدر تتابعه من طلباتي.';
      }
      if (typeof renderWallet === 'function') void renderWallet().catch(() => {});
    } catch (error) {
      if (token !== revision) return;
      status.textContent = error?.message === 'madar_sender_not_saved'
        ? 'أضف رقم المحوّل في حسابك أولاً.'
        : 'تعذر تأكيد تسجيل الطلب. أعد الضغط على إرسال، بدون إعادة التحويل.';
    } finally {
      if (token === revision) {
        loading = false;
        render();
      }
    }
  });

  purchaseForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!customer || salePending || buy.disabled) return;
    const name = username.value.trim();
    const key = customer + ':' + name;
    const token = revision;
    if (sale?.key !== key) sale = {key, id: crypto.randomUUID()};
    salePending = true;
    buy.disabled = true;
    purchaseStatus.textContent = 'جاري تسجيل طلب الروبوكس…';
    try {
      const {data: orderId, error} = await supabaseClient.rpc('purchase_madar_robux', {
        p_request_id: sale.id, p_roblox_username: name
      });
      if (error) throw error;
      sale = null;
      if (token === revision) {
        purchaseStatus.textContent = 'تم الطلب وخصم 20 د.ل من محفظة المدار. تابع الشحن من طلباتي.';
        purchaseForm.reset();
      }
      void supabaseClient.functions.invoke('l1017n-purchase-notify', {body: {order_id: orderId}}).catch(() => {});
      if (typeof renderWallet === 'function') void renderWallet().catch(() => {});
    } catch (error) {
      if (token !== revision) return;
      const message = error?.message;
      if (message === 'insufficient_madar_balance') purchaseStatus.textContent = 'رصيد المدار أقل من 20 د.ل. عبّي المحفظة أولاً.';
      else if (message === 'robux_out_of_stock' || message === 'product_not_available') purchaseStatus.textContent = '100 روبوكس غير متوفرة حاليًا.';
      else if (message === 'phone_required_before_purchase') purchaseStatus.textContent = 'أضف رقم هاتف أساسي في حسابك أولاً.';
      else if (message === 'checkout_wallet_mismatch') {
        purchaseStatus.textContent = 'المدار مش المحفظة الأساسية حاليًا. راجع اختيارك في المحفظة.';
        void window.L1017nPrimaryWallets?.refresh();
      }
      else purchaseStatus.textContent = 'تعذر تأكيد الطلب. اضغط شراء مرة ثانية بنفس اسم المستخدم للتحقق.';
    } finally {
      salePending = false;
      renderPurchase();
    }
  });
})();
