/* L1017n responsive store images.
 * Real official Roblox game icons are used for MM2 and Brainrot.
 * Each raster asset has 4K and light mobile options; preserve SVG logos.
 * Browser picks the best file for image width and display density.
 */
(function(){
  'use strict';
  const regular = {
    'garama':[960,3840],
    'la-secret':[960,3840],
    'mm2-deathshard':[960,3840],
    'mm2-elderwood-blade':[960,3840],
    'mm2-game-icon':[960,3840],
    'order-libyana-premium':[960,3840],
    'order-robux-premium':[960,3840],
    'pubg-battlefront':[640,2560],
    'spooky-and-pumpky':[960,3840],
    'steal-a-brainrot-original':[960,3840],
    'topup-neon-wallet':[960,3840]
  };
  const official={'mm2':[960,3840],'brainrot':[960,3840]};
  const registered=new WeakSet();
  const watcher=typeof ResizeObserver==='function'
    ? new ResizeObserver(entries=>{
        entries.forEach(entry=>apply(entry.target));
      }) : null;
  function getInfo(img){
    const src=img.getAttribute('src');
    if(!src)return null;
    let url;
    try{url=new URL(src,document.baseURI)}catch(_){return null}
    if(url.origin!==location.origin)return null;
    const officialMatch=url.pathname.match(/\/game-covers\/official\/(?:mobile|4k)\/(mm2|brainrot)\.webp$/i);
    if(officialMatch){
      const name=officialMatch[1].toLowerCase();
      return {name:'official-'+name,sizes:official[name],prefix:new URL('game-covers/official/',document.baseURI).href,asset:name};
    }
    const regularMatch=url.pathname.match(/\/game-covers\/([^/]+)\.(?:webp|png|jpg|jpeg)$/i);
    if(!regularMatch)return null;
    const name=regularMatch[1].toLowerCase();
    if(!Object.prototype.hasOwnProperty.call(regular,name))return null;
    return {name,sizes:regular[name],prefix:new URL('game-covers/',document.baseURI).href,asset:name};
  }
  function apply(img){
    if(!img||!img.isConnected)return;
    const info=getInfo(img);
    if(!info)return;
    const width=Math.ceil(img.getBoundingClientRect().width);
    if(width<10)return;
    if(img.dataset.gbImageVariant!==info.name){
      const v='?v=official-and-4k-20261102';
      img.setAttribute('srcset',
        info.prefix+'mobile/'+info.asset+'.webp'+v+' '+info.sizes[0]+'w, '+
        info.prefix+'4k/'+info.asset+'.webp'+v+' '+info.sizes[1]+'w');
      img.dataset.gbImageVariant=info.name;
      img.decoding='async';
    }
    const size=Math.max(40,width)+'px';
    if(img.sizes!==size)img.sizes=size;
  }
  let scheduled=false;
  function scan(){
    scheduled=false;
    document.querySelectorAll('img').forEach(img=>{
      if(!getInfo(img))return;
      if(!registered.has(img)){
        registered.add(img);
        if(watcher)watcher.observe(img);
      }
      apply(img);
    });
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(scan);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{
    childList:true,subtree:true,attributes:true,attributeFilter:['src','class','style']
  });
  window.addEventListener('resize',schedule,{passive:true});
})();