/* L1017n shared-image transition: visually flies a tapped game cover to the next screen. */
(function () {
  "use strict";
  const duration = 680;
  let active = null;

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function targetFor(button) {
    const game = button.getAttribute("data-game-open");
    if (game === "roblox") return "#robloxGamePage .rgp-hero img";
    if (game === "pubg") return "#pubgCategoryPage.visible .pubg-hero img";
    if (button.getAttribute("data-rgp-choice") === "robux")
      return "#robuxModal:not(.hidden) .robux-reference-logo img";
    return null;
  }
  function visibleTarget(selector) {
    const element = document.querySelector(selector);
    if (!element || element.closest(".hidden")) return null;
    const r = element.getBoundingClientRect();
    return r.width > 3 && r.height > 3 ? element : null;
  }
  function start(button, selector) {
    const image = button.querySelector("img");
    if (!image || !image.getAttribute("src")) return;
    const from = image.getBoundingClientRect();
    if (from.width < 4 || from.height < 4) return;

    if (active) active.cancel();

    const ghost = image.cloneNode(false);
    ghost.removeAttribute("id");
    ghost.removeAttribute("style");
    ghost.className = "game-cover-flight";
    ghost.alt = "";
    ghost.setAttribute("aria-hidden", "true");
    const computed = window.getComputedStyle(image);
    ghost.style.left = from.left + "px";
    ghost.style.top = from.top + "px";
    ghost.style.width = from.width + "px";
    ghost.style.height = from.height + "px";
    ghost.style.objectFit = computed.objectFit || "cover";
    ghost.style.borderRadius = computed.borderRadius || "18px";
    document.body.appendChild(ghost);

    let finished = false;
    let observer;
    let timeout;
    let target = null;
    let previousOpacity = "";
    let flightAnimation = null;
    let revealAnimation = null;
    function cancel() {
      if (finished) return;
      finished = true;
      if (observer) observer.disconnect();
      clearTimeout(timeout);
      if (flightAnimation) flightAnimation.cancel();
      if (revealAnimation) revealAnimation.cancel();
      if (target) target.style.opacity = previousOpacity;
      ghost.remove();
      if (active && active.cancel === cancel) active = null;
    }
    active = { cancel };

    function fly(destination) {
      observer.disconnect();
      clearTimeout(timeout);
      target = destination;
      previousOpacity = destination.style.opacity;
      const to = destination.getBoundingClientRect();
      const finalOpacity = parseFloat(window.getComputedStyle(destination).opacity) || 1;
      destination.style.opacity = "0";
      const dx = to.left - from.left;
      const dy = to.top - from.top;
      const sx = to.width / from.width;
      const sy = to.height / from.height;
      try {
        flightAnimation = ghost.animate([
          { transform: "translate3d(0,0,0) scale(1,1)", opacity: 1, offset: 0 },
          { transform: "translate3d(" + (dx * .78) + "px," + (dy * .78) + "px,0) scale(" + (1 + (sx - 1) * .78) + "," + (1 + (sy - 1) * .78) + ")", opacity: .94, offset: .76 },
          { transform: "translate3d(" + dx + "px," + dy + "px,0) scale(" + sx + "," + sy + ")", opacity: 0, offset: 1 }
        ], { duration, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
        revealAnimation = destination.animate([
          { opacity: 0, transform: "scale(.95)" },
          { opacity: finalOpacity, transform: "scale(1)" }
        ], { duration: 340, delay: 310, easing: "ease-out", fill: "both" });
        flightAnimation.onfinish = cancel;
      } catch (_) {
        cancel();
      }
    }
    function lookForDestination() {
      if (finished || target) return;
      const found = visibleTarget(selector);
      if (found) fly(found);
    }
    observer = new MutationObserver(lookForDestination);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    timeout = setTimeout(cancel, 9000);
    window.requestAnimationFrame(lookForDestination);
  }

  document.addEventListener("click", function (event) {
    if (reduceMotion()) return;
    const element = event.target;
    if (!(element instanceof Element)) return;
    const button = element.closest("[data-game-open], [data-rgp-choice]");
    if (!button || button.disabled) return;
    const selector = targetFor(button);
    if (selector) start(button, selector);
  }, true);
})();
