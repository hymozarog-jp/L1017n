(function () {
  'use strict';
  var account = document.getElementById('accountView');
  var form = document.getElementById('authForm');
  var login = document.getElementById('authModeLogin');
  var signup = document.getElementById('authModeSignup');
  var password = document.getElementById('authPassword');
  var toggle = document.getElementById('authPasswordToggle');
  if (!account || !form || !login || !signup || !password || !toggle) return;

  function setClass(element, name, enabled) {
    if (element.classList.contains(name) !== enabled) element.classList.toggle(name, enabled);
  }
  function syncPresentation() {
    var guest = !form.classList.contains('hidden');
    var signingUp = signup.classList.contains('active');
    setClass(account, 'auth-guest', guest);
    setClass(document.body, 'auth-screen', guest && !account.classList.contains('hidden'));
    login.setAttribute('aria-pressed', String(!signingUp));
    signup.setAttribute('aria-pressed', String(signingUp));
    document.getElementById('authHeading').textContent = signingUp ? 'إنشاء حساب' : 'تسجيل الدخول';
    document.getElementById('authIntro').textContent = signingUp ? 'أنشئ حسابك' : 'أهلاً بيك في المتجر';
    document.getElementById('authAlternateText').textContent = signingUp ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟';
    document.getElementById('authAlternate').textContent = signingUp ? 'تسجيل الدخول' : 'إنشاء حساب';
  }
  // Observe existing auth UI state, without changing sessions or API calls.
  var observer = new MutationObserver(syncPresentation);
  [account, form, login, signup].forEach(function (element) {
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
  });
  document.getElementById('authAlternate').addEventListener('click', function () {
    (signup.classList.contains('active') ? login : signup).click();
  });
  toggle.addEventListener('click', function () {
    var visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  });
  syncPresentation();
})();
