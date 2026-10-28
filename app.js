(function(){
  function load(src){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
  load('legacy-app.js?v=20261028').then(function(){return load('wallet-flow.js?v=20261028')}).catch(function(e){console.error('L1017n loader error',e)})
})();
