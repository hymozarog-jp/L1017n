/* L1017n: Telegram-like slide-in and right-edge swipe-back for product screens.
 * No payment, inventory, account or checkout functions are changed here. */
(function () {
  'use strict';
  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var backSelector = '#robloxGamePage [data-rgp-back],#robuxModal .package-close,#pubgCategoryPage [data-pubg-close]';
  var blockers = '#robuxPurchaseScreen,#rgpMm2Checkout,#sabCheckout,#pubgAccountCheckoutOverlay,#gbCodePurchaseConfirm';
  var activeGesture = null;
  var busy = false;
  var bypass = null;

  function reduced() { return !!(mq && mq.matches); }
  function visible(el) {
    if (!el || !el.isConnected) return false;
    var css = window.getComputedStyle(el);
    return css.display !== 'none' && css.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
  }
  function productPage() {
    if (document.querySelector(blockers)) return null;
    var pages = Array.from(document.querySelectorAll('#robloxGamePage,#robuxModal,#pubgCategoryPage')).filter(visible);
    pages.sort(function (a,b) {
      return (parseInt(getComputedStyle(a).zIndex,10)||0) - (parseInt(getComputedStyle(b).zIndex,10)||0);
    });
    return pages[pages.length-1] || null;
  }
  function backButton(page) {
    if (!page) return null;
    if (page.id === 'robloxGamePage') return page.querySelector('[data-rgp-back]');
    if (page.id === 'robuxModal') return page.querySelector('.package-close');
    if (page.id === 'pubgCategoryPage') return page.querySelector('[data-pubg-close]');
    return null;
  }
  function closesPage(page) {
    if (page.id === 'pubgCategoryPage' && page.classList.contains('pubg-inner-page')) return false;
    if (page.id === 'robloxGamePage' && page.classList.contains('rgp-inner-page') && !page.dataset.directCategory) return false;
    return true;
  }
  function clean(page) {
    if (!page) return;
    page.style.removeProperty('transform');
    page.classList.remove('tg-swipe-active','tg-swipe-leaving');
  }
  function tween(page, from, to, duration, done) {
    if (reduced() || !page.animate) { done(); return; }
    var animation;
    try {
      animation = page.animate([
        {transform:'translate3d(-'+from+'px,0,0)'},
        {transform:'translate3d(-'+to+'px,0,0)'}
      ], {duration:duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
      animation.finished.then(function(){animation.cancel();done();},function(){animation.cancel();done();});
    } catch (error) { if(animation)animation.cancel();done(); }
  }
  function finishBack(page, button) {
    clean(page);
    if (!button.isConnected) { busy=false;return; }
    // The existing back handler decides whether to hide a page or show its parent.
    bypass=button;
    try { button.click(); } finally { bypass=null;busy=false; }
  }
  function exit(page, button, start) {
    if (busy) return;
    busy=true;
    page.classList.remove('tg-swipe-active');
    page.classList.add('tg-swipe-leaving');
    page.style.removeProperty('transform');
    var width=Math.max(page.getBoundingClientRect().width,window.innerWidth);
    tween(page,start||0,width+16,Math.max(150,Math.min(300,240*(1-(start||0)/width))),function(){
      finishBack(page,button);
    });
  }
  function snapBack(page, start) {
    busy=true;
    page.classList.add('tg-swipe-active');
    page.style.removeProperty('transform');
    tween(page,start,0,200,function(){clean(page);busy=false;});
  }
  // Animate ordinary 'رجوع' taps too, without modifying their original behavior.
  document.addEventListener('click',function(event){
    var button=event.target instanceof Element && event.target.closest(backSelector);
    if (!button || button===bypass) return;
    if (busy) { event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();return; }
    var page=button.closest('#robloxGamePage,#robuxModal,#pubgCategoryPage');
    if (!page || !visible(page) || !closesPage(page) || reduced()) return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    exit(page,button,0);
  },true);

  function clearGesture() { activeGesture=null; }
  document.addEventListener('touchstart',function(event) {
    if (busy || activeGesture || event.touches.length!==1) return;
    if (document.activeElement && document.activeElement.matches('input,textarea,select,[contenteditable="true"]')) return;
    var page=productPage();
    if (!page) return;
    var touch=event.touches[0];
    // Arabic RTL: swipe left from the RIGHT edge to go back, not the browser's left edge.
    if (window.innerWidth-touch.clientX>38 || touch.clientY<8) return;
    var top=document.elementFromPoint(touch.clientX,touch.clientY);
    if (!top || !page.contains(top)) return;
    var button=backButton(page);
    if (!button) return;
    activeGesture={page:page,button:button,id:touch.identifier,x:touch.clientX,y:touch.clientY,
      started:Date.now(),distance:0,dragging:false};
  },{passive:true});

  document.addEventListener('touchmove',function(event){
    var state=activeGesture;
    if (!state) return;
    if (event.touches.length!==1 || !visible(state.page)) {clearGesture();clean(state.page);return;}
    var touch=event.touches[0];
    if (touch.identifier!==state.id) return;
    var deltaX=state.x-touch.clientX,deltaY=touch.clientY-state.y;
    if (!state.dragging) {
      if (Math.abs(deltaY)>14 && Math.abs(deltaY)>Math.abs(deltaX)) {clearGesture();return;}
      if (deltaX<12 || Math.abs(deltaY)>deltaX*.75) {
        if (Math.abs(deltaX)>20 || Math.abs(deltaY)>20) clearGesture();
        return;
      }
      state.dragging=true;
      state.page.classList.add('tg-swipe-active');
    }
    if (event.cancelable) event.preventDefault();
    state.distance=Math.min(Math.max(deltaX,0),window.innerWidth);
    state.page.style.transform='translate3d(-'+state.distance+'px,0,0)';
  },{passive:false});

  document.addEventListener('touchend',function(event){
    var state=activeGesture;
    if (!state) return;
    var end=Array.from(event.changedTouches).some(function(t){return t.identifier===state.id;});
    if (!end) return;
    clearGesture();
    if (!state.dragging) return;
    var distance=state.distance;
    var speed=distance/Math.max(1,Date.now()-state.started);
    if (distance>Math.max(85,window.innerWidth*.25) || (distance>65 && speed>.55)) {
      // In an inner category the real back button changes the category instead of closing.
      if (!closesPage(state.page)) {
        clean(state.page);
        if (state.button.isConnected) state.button.click();
      } else {
        exit(state.page,state.button,distance);
      }
    } else {
      snapBack(state.page,distance);
    }
  },{passive:true});
  document.addEventListener('touchcancel',function(){
    var state=activeGesture;
    clearGesture();
    if (state && state.dragging) snapBack(state.page,state.distance);
  },{passive:true});
})();
