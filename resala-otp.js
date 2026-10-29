/* Phone ownership verification through the L1017N Supabase Edge Function.
   Resala credentials and the OTP never appear in this frontend. */
(function () {
  "use strict";
  let lastSentFor = "";
  const messages = {
    unauthorized: "انتهت جلسة تسجيل الدخول. ادخل لحسابك من جديد.",
    phone_required: "أضف رقم هاتفك لحسابك أولاً.",
    cooldown: "تقدر تطلب رمزًا جديدًا بعد دقيقة.",
    hour_limit: "وصلت لحد الرسائل المسموح خلال الساعة. جرّب بعدين.",
    day_limit: "وصلت لحد الرسائل اليومي. جرّب بكرة.",
    invalid: "الرمز مش صحيح، تأكد منه وحاول ثانية.",
    expired: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
    locked: "محاولات كثيرة، اطلب رمزًا جديدًا بعد دقيقة.",
    not_requested: "اطلب رمز تحقق أولاً.",
    phone_mismatch: "رقم الهاتف تغير. حدّث الصفحة وحاول ثانية.",
    sms_gateway_unavailable: "تعذر إرسال SMS حاليًا. حاول بعد قليل.",
    database_unavailable: "تعذر الاتصال بالخدمة. حاول بعد قليل.",
    invalid_format: "الرمز لازم يكون 6 أرقام.",
    not_configured: "خدمة الرسائل لم تُفعّل من الإدارة بعد."
  };
  const css = document.createElement("style");
  css.textContent = [
    "#resalaVerifyBox{padding:18px;margin:14px 0;border:1px solid #7551aa88;border-radius:17px;background:linear-gradient(135deg,#231c38,#161d31);color:#f3ebff;text-align:right;direction:rtl}",
    "#resalaVerifyBox h3{margin:0 0 8px;font-size:17px;color:#edd7ff}",
    "#resalaVerifyBox p{margin:4px 0 12px;font-size:13px;line-height:1.8;color:#c5bad8}",
    "#resalaVerifyBox .resala-verified{color:#9df3bb}",
    "#resalaVerifyBox .resala-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
    "#resalaVerifyBox .resala-code{min-width:170px;flex:1;max-width:260px;letter-spacing:.25em;text-align:center;direction:ltr;font-size:21px;padding:12px;border:1px solid #7c6a9c;border-radius:10px;background:#110e22;color:white}",
    "#resalaVerifyBox button{border:0;border-radius:10px;background:#9e61ed;color:#fff;font:inherit;font-weight:700;padding:12px 16px;min-height:43px;cursor:pointer}",
    "#resalaVerifyBox button:disabled{opacity:.65;cursor:wait}",
    "#resalaVerifyBox .resala-status{min-height:21px;margin-top:10px;color:#f0d5a7}"
  ].join("");
  document.head.appendChild(css);

  async function invoke(action, code) {
    const body = code ? { action, code } : { action };
    const { data, error } = await supabaseClient.functions.invoke("l1017n-resala-otp", { body });
    if (!error) return data || {};
    let key = "database_unavailable";
    try { key = (await error.context.json()).error || key; } catch (_) { /* network error */ }
    throw new Error(messages[key] || "تعذر إكمال العملية. حاول ثانية.");
  }
  function clear() { document.getElementById("resalaVerifyBox")?.remove(); }

  window.renderResalaOtp = async function (user) {
    if (!user || !document.getElementById("accountPhoneGate")) { clear(); return; }
    let state;
    try { state = await invoke("status"); } catch (_) { clear(); return; }
    if (!state.configured) { clear(); return; }

    const gate = document.getElementById("accountPhoneGate");
    if (!gate || gate.classList.contains("hidden")) { clear(); return; }
    let box = document.getElementById("resalaVerifyBox");
    if (!box) {
      box = document.createElement("section");
      box.id = "resalaVerifyBox";
      box.setAttribute("aria-label", "التحقق من رقم الهاتف");
      gate.insertAdjacentElement("afterend", box);
    }
    const phone = state.phone || "رقمك المسجل";
    if (state.verified) {
      lastSentFor = "";
      box.innerHTML = '<h3 class="resala-verified">✓ رقم الهاتف موثّق</h3><p>تم تأكيد ملكية الرقم <b dir="ltr"></b> عبر رسالة SMS.</p>';
      box.querySelector("b").textContent = phone;
      return;
    }

    box.innerHTML = '<h3>📱 وثّق رقم هاتفك برسالة SMS</h3>' +
      '<p>بنرسل رمزًا مكوّنًا من 6 أرقام إلى <b dir="ltr"></b> على ليبيانا أو المدار. الرمز صالح 5 دقائق.</p>' +
      '<div class="resala-row"><button type="button" class="resala-send">إرسال رمز التحقق</button></div>' +
      '<form class="resala-code-form" hidden><div class="resala-row">' +
      '<input class="resala-code" type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" aria-label="رمز التحقق" placeholder="000000" required>' +
      '<button type="submit">تأكيد الرمز</button></div></form>' +
      '<p class="resala-status" role="status" aria-live="polite"></p>';
    box.querySelector("b").textContent = phone;
    const send = box.querySelector(".resala-send");
    const form = box.querySelector(".resala-code-form");
    const field = box.querySelector(".resala-code");
    const status = box.querySelector(".resala-status");
    const key = user.id + ":" + phone;
    if (lastSentFor === key) { form.hidden = false; send.textContent = "إعادة إرسال الرمز"; }

    send.addEventListener("click", async function () {
      send.disabled = true;
      status.textContent = "جاري إرسال الرمز…";
      try {
        const result = await invoke("send");
        if (result.verified) { await window.renderResalaOtp(user); return; }
        if (!result.sent) throw new Error("تعذر إرسال الرمز.");
        lastSentFor = key;
        status.textContent = "تم طلب الرسالة. أدخل الرمز اللي وصلك، ويمكن إعادة الإرسال بعد دقيقة.";
        form.hidden = false;
        send.textContent = "إعادة إرسال الرمز";
        field.focus();
      } catch (error) {
        status.textContent = error.message || "تعذر إرسال الرمز.";
      } finally { send.disabled = false; }
    });
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const code = field.value.trim();
      if (!/^[0-9]{6}$/.test(code)) { status.textContent = messages.invalid_format; return; }
      const confirm = form.querySelector('button[type="submit"]');
      confirm.disabled = true;
      status.textContent = "جاري التأكد من الرمز…";
      try {
        const result = await invoke("verify", code);
        if (!result.verified) throw new Error("تعذر تأكيد الرمز.");
        lastSentFor = "";
        await window.renderResalaOtp(user);
      } catch (error) {
        status.textContent = error.message || "تعذر تأكيد الرمز.";
      } finally { confirm.disabled = false; }
    });
  };
})();
