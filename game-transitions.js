/* Shared-image transitions for game navigation (v2). Checkout logic is untouched. */
(function () {
  "use strict";
  var current = null;
  var settings = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(settings && settings.matches); }
  function sourceFor(button) {
    return button.querySelector("img") || button.querySelector(".game-tile-art") || button;
  }
  function destinationFor(button) {
    if (button.matches('[data-rgp-choice="robux"]')) return '#robuxModal:not(.hidden) .robux-reference-logo img';
    if (button.matches('[data-product="roblox"]')) return '#robloxGamePage .rgp-hero img';
    if (button.matches('[data-game-open="roblox"]')) return '#robloxGamePage .rgp-hero img';
    if (button.matches('[data-game-open="pubg"]')) return '#pubgCategoryPage.visible .pubg-hero img';
    return null;
  }
  function validTarget(selector) {
    var el = document.querySelector(selector);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return r.width >= 10 && r.height >= 10 ? el : null;
  }
  function go(button, selector) {
    if (current) current();
    var src = sourceFor(button);
    var r = src.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return;
    var clone = src.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("aria-hidden", "true");
    clone.classList.add("game-cover-flight");
    var computed = getComputedStyle(src);
    clone.style.cssText += ";left:" + r.left + "px;top:" + r.top +
      "px;width:" + r.width + "px;height:" + r.height + "px;" +
      "border-radius:" + (computed.borderRadius || "16px") + ";";
    document.body.appendChild(clone);

    var cleaned = false, observer = null, timer = null, anim = null;
    var dest = null, oldOpacity = "", reveal = null;
    function clear() {
      if (cleaned) return;
      cleaned = true;
      if (observer) observer.disconnect();
      if (timer) clearTimeout(timer);
      if (anim) anim.cancel();
      if (reveal) reveal.cancel();
      if (dest) dest.style.opacity = oldOpacity;
      clone.remove();
      if (current === clear) current = null;
    }
    current = clear;
    function check() {
      if (cleaned || dest) return;
      var next = validTarget(selector);
      if (!next) return;
      dest = next;
      if (observer) observer.disconnect();
      var t = next.getBoundingClientRect();
      oldOpacity = next.style.opacity;
      var endOpacity = Number(getComputedStyle(next).opacity) || 1;
      next.style.opacity = "0";
      if (!clone.animate) { clear(); return; }
      // Leave the cover briefly in the foreground before it flies to the detail image.
      anim = clone.animate([
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1, offset: 0 },
        { transform: "translate3d(0,0,0) scale(1.08)", opacity: 1, offset: .16 },
        { transform: "translate3d(" + (t.left-r.left)*.88 + "px," + (t.top-r.top)*.88 + "px,0) scale(" + (1+(t.width/r.width-1)*.88) + "," + (1+(t.height/r.height-1)*.88) + ")", opacity: .96, offset: .82 },
        { transform: "translate3d(" + (t.left-r.left) + "px," + (t.top-r.top) + "px,0) scale(" + (t.width/r.width) + "," + (t.height/r.height) + ")", opacity: 0, offset: 1 }
      ], { duration: 450, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      reveal = next.animate([
        { opacity: 0, transform: "scale(.92) translateX(12px)" },
        { opacity: endOpacity, transform: "scale(1) translateX(0)" }
      ], { duration: 270, delay: 90, easing: "ease-out", fill: "both" });
      anim.onfinish = clear;
    }
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:["class"] });
    timer = setTimeout(clear, 1400);
    requestAnimationFrame(check);
  }
  document.addEventListener("click", function(e) {
    if (reduced() || !(e.target instanceof Element)) return;
    var button = e.target.closest('[data-game-open],[data-rgp-choice],[data-product="roblox"]');
    if (!button || button.disabled) return;
    var target = destinationFor(button);
    if (target) go(button,target);
  }, true);
})();