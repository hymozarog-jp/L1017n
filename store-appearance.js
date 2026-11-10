/* Browser-local appearance only; no auth, balance, stock or payment writes. */
(function () {
  "use strict";
  var key = "l1017-store-appearance";
  function apply(value, persist) {
    var theme = value === "dark" ? "dark" : "light";
    document.documentElement.dataset.storeTheme = theme;
    var color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === "dark" ? "#0d1118" : "#f7f9fd";
    document.querySelectorAll("[data-store-appearance]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.storeAppearance === theme));
    });
    if (persist) {
      try { localStorage.setItem(key, theme); } catch (_) { /* Private storage can be unavailable. */ }
    }
  }
  document.addEventListener("click", function (event) {
    var button = event.target.closest("#storeAppearance [data-store-appearance]");
    if (button) apply(button.dataset.storeAppearance, true);
  });
  window.addEventListener("storage", function (event) {
    if (event.key === key) apply(event.newValue, false);
  });
  function init() { apply(document.documentElement.dataset.storeTheme, false); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
