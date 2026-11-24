(function () {
  'use strict';
  const receiver = '0910005566';
  const dialog = document.getElementById('madarTopupDialog');
  const form = dialog.querySelector('#madarTransferForm');
  const amount = form.elements.amount;
  const sender = form.elements.sender;
  const fields = form.querySelector('.madar-transfer-fields');
  const review = form.querySelector('.madar-transfer-review');
  const prepare = form.querySelector('[data-madar-prepare]');
  const submit = form.querySelector('[type="submit"]');
  const copy = form.querySelector('[data-madar-copy]');
  const code = form.querySelector('output');
  const status = dialog.querySelector('#madarTransferStatus');
  const manage = dialog.querySelector('[data-madar-manage]');
  let customer = null;
  let request = null;
  let loading = false;
  let submitted = false;
  let reviewing = false;
  let revision = 0;

  function render() {
    const value = amount.valueAsNumber;
    const valid = Number.isInteger(value) && value >= 1 && value <= 20;
    const ready = !loading && !submitted && Boolean(sender.value) && valid;
    fields.hidden = reviewing || submitted;
    review.hidden = !reviewing || submitted;
    prepare.disabled = !ready;
    code.textContent = reviewing && ready ? '*140*4*1*1*' + receiver + '*' + value + '#' : '';
    copy.disabled = !ready || !reviewing;
    submit.disabled = !ready || !reviewing;
    sender.disabled = loading || submitted;
    amount.disabled = loading || submitted;
    form.querySelectorAll('[data-madar-amount]').forEach(button => {
      button.disabled = loading || submitted;
      button.setAttribute('aria-pressed', String(Number(button.dataset.madarAmount) === value));
    });
  }

  function changeTransfer() {
    reviewing = false;
    status.textContent = '';
    render();
  }

  async function open() {
    if (document.getElementById('madarWalletTopup')?.disabled) {
      if (typeof toast === 'function') toast('شحن المدار غير متوفر حاليًا');
      return;
    }
    if (dialog.open) return;
    const token = ++revision;
    loading = true;
    submitted = false;
    reviewing = false;
    customer = null;
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
    if (event.target.closest('#madarWalletTopup, #madarTopupProvider, #customerWalletChip[data-wallet-carrier="madar"] #customerTopupShortcut')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void open();
    }
  }, true);
  dialog.querySelector('[data-madar-close]').addEventListener('click', () => dialog.close());
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
  prepare.addEventListener('click', () => {
    if (prepare.disabled) return;
    reviewing = true;
    render();
    copy.focus();
  });
  form.querySelector('[data-madar-edit]').addEventListener('click', () => {
    if (loading) return;
    changeTransfer();
    prepare.focus();
  });

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
    const key = customer + ':' + amount.valueAsNumber + ':' + sender.value;
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
        status.textContent = 'تم تسجيل الطلب وهو قيد المراجعة. تابع حالته من «طلباتي».';
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

  window.openMadarTopup = open;
})();
