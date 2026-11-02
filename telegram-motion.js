/* Tactile feedback only. Navigation state remains managed by legacy-app.js. */
(function () {
  'use strict';
  // Direction comes from the user's navigation choice, not page-load timing.
  document.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;
    var link=event.target.closest('[data-view]');
    if (!link) return;
    var view=link.getAttribute('data-view');
    document.documentElement.dataset.tgDirection=
      (view==='home'||view==='store') ? 'back' : 'forward';
  }, true);
  if (!window.PointerEvent) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var targets = 'button[data-view],.game-tile-btn,.rgp-card,.wallet-action,.gbqa-action,#robuxModal .robux-package,.btn';
  document.addEventListener('pointerdown', function (event) {
    if (reduced && reduced.matches) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!(event.target instanceof Element)) return;
    var target = event.target.closest(targets);
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    var rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    var wave = document.createElement('span');
    wave.className = 'tg-tap-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.left = (event.clientX - rect.left) + 'px';
    wave.style.top = (event.clientY - rect.top) + 'px';
    wave.style.setProperty('--tg-wave-scale', String(Math.max(rect.width, rect.height) / 6 + 3));
    target.appendChild(wave);
    wave.addEventListener('animationend', function () { wave.remove(); }, {once:true});
    setTimeout(function () { wave.remove(); }, 650);
  }, {capture:true, passive:true});
})();
