(function(){
  var menuId='robloxSubmenuModal';
  var originalOpenRobuxPackages=window.openRobuxPackages;
  var originalSelectPackage=window.selectPackage;

  function closeMenu(){var m=document.getElementById(menuId);if(m)m.remove()}
  function showMenu(){
    closeMenu();
    var m=document.createElement('div');
    m.id=menuId;
    m.className='package-modal';
    m.innerHTML='<div class="package-box" style="max-width:520px"><button class="package-close" type="button" data-close-roblox-menu>×</button><span class="eyebrow">ROBLOX</span><h2>اختار القسم</h2><p class="form-note">اختار اللي تبيه من أقسام روبلوكس.</p><div style="display:grid;gap:12px;margin-top:18px"><button class="btn btn-primary full-width" type="button" data-roblox-choice="robux">💎 روبوكس</button><button class="btn btn-soft full-width" type="button" data-roblox-choice="mm2">🔪 ماب MM2</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',function(e){
      if(e.target===m||e.target.closest('[data-close-roblox-menu]')){closeMenu();return}
      var choice=e.target.closest('[data-roblox-choice]');
      if(!choice)return;
      if(choice.dataset.robloxChoice==='robux'){
        closeMenu();
        if(typeof originalOpenRobuxPackages==='function') originalOpenRobuxPackages();
        return;
      }
      showMm2();
    });
  }

  async function showMm2(){
    var m=document.getElementById(menuId);if(!m)return;
    var box=m.querySelector('.package-box');
    box.innerHTML='<button class="package-close" type="button" data-close-roblox-menu>×</button><span class="eyebrow">ROBLOX</span><h2>ماب MM2</h2><p class="form-note">اختار الباقة اللي تبيها.</p><div id="mm2Packages" class="product-grid" style="margin-top:18px"></div>';
    try{
      var client=window.supabase.createClient('https://cmtxsjlehjworqypbxjz.supabase.co','sb_publishable_NrahtO5qp8p4OgjODMbxdQ_XqbUWSAk');
      var r=await client.from('products').select('*').eq('active',true).order('sort_order');
      var list=(r.data||[]).filter(function(p){
        var game=String(p.game||'').toLowerCase();
        var name=String(p.name||'').toLowerCase();
        var key=String(p.product_key||'').toLowerCase();
        return /mm2|murder mystery|murdermystery|ماب/.test(game+' '+name+' '+key);
      });
      var grid=box.querySelector('#mm2Packages');
      if(!list.length){grid.innerHTML='<p class="muted">ما فيش باقات MM2 مضافة حالياً.</p>';return}
      grid.innerHTML=list.map(function(p){
        return '<article class="product-card"><button class="game-category-button" type="button" data-mm2-product="'+String(p.id).replace(/"/g,'&quot;')+'"><div class="game-category-info"><h3>'+escapeHtmlSafe(p.name)+'</h3><span>'+Number(p.amount||0)+' · '+Number(p.price||0).toFixed(2)+' د.ل</span></div></button></article>';
      }).join('');
      grid.addEventListener('click',function(e){
        var b=e.target.closest('[data-mm2-product]');if(!b)return;
        closeMenu();
        if(typeof originalSelectPackage==='function') originalSelectPackage(b.dataset.mm2Product);
      });
    }catch(err){
      var target=box.querySelector('#mm2Packages');
      if(target)target.innerHTML='<p class="muted">تعذر تحميل باقات MM2. جرّب تحديث الصفحة.</p>';
    }
  }

  function escapeHtmlSafe(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  // Capture the Roblox card before app.js handles data-product="roblox".
  document.addEventListener('click',function(e){
    var roblox=e.target.closest('[data-product="roblox"]');
    if(!roblox)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showMenu();
  },true);
})();
