/* Responsive image delivery: sharp 4K WebP masters on large displays,
 * lightweight 960px variants on small tiles. Fallback is the original src.
 * Source image details cannot be restored merely by scaling.
 */
(function(){
  'use strict';
  const variants = {
    'garama': [960,3840],
    'la-secret': [960,3840],
    'mm2-deathshard': [960,3840],
    'mm2-elderwood-blade': [960,3840],
    'mm2-game-icon': [960,3840],
    'order-libyana-premium': [960,3840],
    'order-robux-premium': [960,3840],
    'pubg-battlefront': [640,2560],
    'spooky-and-pumpky': [960,3840],
    'steal-a-brainrot-original': [960,3840],
    'topup-neon-wallet': [960,3840]
  };
  const registered=new WeakSet();
  let pending=false;
  const watcher=typeof ResizeObserver!=='undefined'
    ? new ResizeObserver(entries=>entries.forEach(e=>apply(e.target)))
    : null;
  function assetName(img){
    const src=img.getAttribute('src');
    if(!src)return null;
    try{
      const url=new URL(src,document.baseURI);
      if(url.origin!==location.origin)return null;
      const match=url.pathname.match(/\/game-covers\/([^/]+)\.(?:webp|png|jpg|jpeg)$/i);
      const name=match&&match[1];
      return name&&Object.prototype.hasOwnProperty.call(variants,name)?name:null;
    }catch(_){return null}
  }
  function apply(img){
    if(!img||!img.isConnected)return;
    const name=assetName(img);
    if(!name)return;
    const width=Math.ceil(img.getBoundingClientRect().width);
    if(width<10)return;
    if(img.dataset.gbImageVariant!==name){
      const sizes=variants[name];
      const prefix=new URL('game-covers/',document.baseURI).href;
      img.srcset=prefix+'mobile/'+name+'.webp '+sizes[0]+'w, '+prefix+'4k/'+name+'.webp '+sizes[1]+'w';
      img.dataset.gbImageVariant=name;
      img.decoding='async';
    }
    const idealSize=Math.max(40,width)+'px';
    if(img.sizes!==idealSize)img.sizes=idealSize;
  }
  function scan(){
    pending=false;
    document.querySelectorAll('img').forEach(img=>{
      if(!assetName(img))return;
      if(!registered.has(img)){
        registered.add(img);
        if(watcher)watcher.observe(img);
      }
      apply(img);
    });
  }
  function schedule(){
    if(pending)return;
    pending=true;
    requestAnimationFrame(scan);
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{
    childList:true,subtree:true,attributes:true,attributeFilter:['src','class','style']
  });
  window.addEventListener('resize',schedule,{passive:true});
})();