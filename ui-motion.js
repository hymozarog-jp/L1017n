/* Shared lightweight click animation for interactive store surfaces.
   Visual-only: never intercepts clicks, inputs, payment flows or navigation. */
(function(){
 'use strict';
 if(window.L1017nTapMotionLoaded)return;
 window.L1017nTapMotionLoaded=true;
 const query=[
   'button','a[href]','summary','[role="button"]',
   '[data-ll-game]','[data-ll-buy]','[data-ll-nav]',
   '[data-view]','[data-account-action]','[data-order-filter]',
   '[data-np-filter]','[data-amount]','[data-package-id]',
   '.orders-modern-card','input[type="checkbox"]','input[type="radio"]'
 ].join(',');
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const allowMotion=()=>!reduced?.matches;
 function targetOf(e){
  if(!(e.target instanceof Element))return null;
  const target=e.target.closest(query);
  if(!target||target.matches(':disabled,[disabled],[aria-disabled="true"]')||
     target.closest('[inert],fieldset:disabled'))return null;
  return target;
 }
 function glow(target,x,y){
  if(!allowMotion()||document.visibilityState==='hidden')return;
  const rect=target.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const host=target.closest('dialog[open]')||document.body;
  const dot=document.createElement('span');
  dot.className='l1017-tap-glow';
  dot.setAttribute('aria-hidden','true');
  const px=Number.isFinite(x)?x:(rect.left+rect.width/2);
  const py=Number.isFinite(y)?y:(rect.top+rect.height/2);
  dot.style.left=px+'px';
  dot.style.top=py+'px';
  host.appendChild(dot);
  dot.addEventListener('animationend',()=>dot.remove(),{once:true});
  setTimeout(()=>dot.remove(),620);
 }
 function bounce(target){
  if(!allowMotion()||document.visibilityState==='hidden')return;
  // The independent 'scale' property preserves transforms already used for
  // card layouts, accordion toggles, carousel movement and modal transitions.
  if(typeof target.animate==='function'){
   target.animate([
     {scale:'1'},
     {scale:'.955',offset:.32},
     {scale:'1.022',offset:.7},
     {scale:'1'}
   ],{duration:270,easing:'cubic-bezier(.22,.68,.29,1)'});
  }else{
   target.classList.remove('l1017-tap-bounce-fallback');
   void target.offsetWidth;
   target.classList.add('l1017-tap-bounce-fallback');
   setTimeout(()=>target.classList.remove('l1017-tap-bounce-fallback'),310);
  }
 }
 document.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false)return;
  const target=targetOf(event);
  if(target)glow(target,event.clientX,event.clientY);
 },{capture:true,passive:true});
 document.addEventListener('click',event=>{
  const target=targetOf(event);
  if(!target)return;
  if(event.detail===0)glow(target);
  bounce(target);
 },{capture:true,passive:true});
})();
