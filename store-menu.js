(function(){
  var pageId='robloxGamePage';
  var supabaseUrl='https://cmtxsjlehjworqypbxjz.supabase.co';
  var supabaseKey='sb_publishable_NrahtO5qp8p4OgjODMbxdQ_XqbUWSAk';
  var robloxImage='https://tr.rbxcdn.com/180DAY-be965de4138292ae27a6ef20e0321690/768/432/Image/Webp/noFilter';
  var mm2Image='https://www.thespike.gg/_next/image?q=75&url=https%3A%2F%2Fthespike-strapi-cms.s3.us-east-1.amazonaws.com%2Fimage11_74d86f53e8.jpg&w=3840';
  var styleId='robloxGamePageStyles';

  function addStyles(){
    if(document.getElementById(styleId))return;
    var s=document.createElement('style');s.id=styleId;
    s.textContent=`
      #${pageId}{position:fixed;inset:0;z-index:99990;overflow:auto;background:radial-gradient(ellipse at 70% 0%,#192c58 0%,#080d1e 45%,#050913 100%);color:#fff;padding:22px 18px 44px;font-family:'IBM Plex Sans Arabic',sans-serif;direction:rtl}
      #${pageId} .rgp-shell{max-width:860px;margin:auto}
      #${pageId} .rgp-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}
      #${pageId} .rgp-brand{font-weight:800;font-size:20px;letter-spacing:.5px}
      #${pageId} .rgp-back{border:1px solid #23415f;background:#091727;color:#fff;border-radius:999px;padding:10px 18px;cursor:pointer;font:inherit}
      #${pageId} .rgp-hero{position:relative;min-height:245px;border-radius:28px;overflow:hidden;border:1px solid #1268c9;box-shadow:0 25px 80px rgba(0,93,255,.18);background:#071526}
      #${pageId} .rgp-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.68}
      #${pageId} .rgp-hero:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,8,18,.96),rgba(2,8,18,.48),rgba(2,8,18,.12))}
      #${pageId} .rgp-hero-content{position:relative;z-index:2;min-height:245px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:30px;max-width:650px}
      #${pageId} .rgp-kicker{color:#55b5ff;font-weight:700;letter-spacing:2px;font-size:13px}
      #${pageId} .rgp-hero h1{font-size:clamp(42px,7vw,78px);margin:8px 0 6px;line-height:1;font-weight:900}
      #${pageId} .rgp-hero p{font-size:19px;color:#d8e8fa;margin:0;line-height:1.8}
      #${pageId} .rgp-title{margin:32px 0 16px;font-size:28px}
      #${pageId} .rgp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #${pageId} .rgp-card{position:relative;min-height:235px;border-radius:24px;overflow:hidden;border:1px solid #185c9c;background:#071322;cursor:pointer;text-align:right;color:#fff;padding:0;box-shadow:0 16px 50px rgba(0,0,0,.28);transition:.2s transform,.2s border-color}
      #${pageId} .rgp-card:hover{transform:translateY(-4px);border-color:#38a8ff}
      #${pageId} .rgp-card.mm2{border-color:#7b2630}
      #${pageId} .rgp-card.mm2:hover{border-color:#ff4454}
      #${pageId} .rgp-card img{width:100%;height:155px;object-fit:cover;display:block;filter:saturate(1.08)}
      #${pageId} .rgp-card-body{padding:18px 20px 20px;background:linear-gradient(180deg,#091827,#06101d)}
      #${pageId} .rgp-card.mm2 .rgp-card-body{background:linear-gradient(180deg,#1a0b10,#0c070a)}
      #${pageId} .rgp-card h3{font-size:24px;margin:0 0 4px}
      #${pageId} .rgp-card p{margin:0 0 14px;color:#a9bfd4}
      #${pageId} .rgp-action{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:10px 16px;background:linear-gradient(110deg,#7553e6,#436be6);font-weight:700}
      #${pageId} .mm2 .rgp-action{background:linear-gradient(110deg,#b84c9c,#7446cb)}
      #${pageId} .rgp-packages{margin-top:22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
      #${pageId} .rgp-package{border:1px solid #214968;background:#091a2b;border-radius:18px;padding:18px;text-align:right;color:#fff;cursor:pointer;font:inherit}
      #${pageId} .rgp-package:hover{border-color:#35a9ff}
      #${pageId} .rgp-package strong{display:block;font-size:18px}
      #${pageId} .rgp-package span{display:block;color:#62b9ff;margin-top:5px}
      #${pageId} .rgp-empty{padding:30px;text-align:center;border:1px dashed #28455e;border-radius:18px;color:#9bb0c5}
      @media(max-width:720px){#${pageId}{padding:16px 12px 35px}#${pageId} .rgp-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#${pageId} .rgp-hero{min-height:210px}#${pageId} .rgp-hero-content{min-height:210px;padding:22px}#${pageId} .rgp-hero h1{font-size:40px}#${pageId} .rgp-hero p{font-size:13px}#${pageId} .rgp-card{min-height:0;border-radius:18px}#${pageId} .rgp-card img{height:130px}#${pageId} .rgp-card-body{padding:12px 10px 15px}#${pageId} .rgp-card h3{font-size:17px}#${pageId} .rgp-card p{font-size:12px;line-height:1.6}#${pageId} .rgp-action{font-size:11px;padding:8px 9px}#${pageId} .rgp-title{font-size:21px}}
    `;
    document.head.appendChild(s);
  }

  window.openRobloxGameMenu=showRobloxPage;
  function closePage(){var p=document.getElementById(pageId);if(p)p.remove()}
  function showRobloxPage(){
    addStyles();closePage();
    var p=document.createElement('div');p.id=pageId;
    p.innerHTML=`<div class="rgp-shell">
      <div class="rgp-top"><div class="rgp-brand">L1017N · ROBLOX</div><button class="rgp-back" type="button" data-rgp-back>← رجوع للمتجر</button></div>
      <section class="rgp-hero"><img src="${robloxImage}" alt="Roblox"><div class="rgp-hero-content"><span class="rgp-kicker">L1017N • ROBLOX</span><h1>ROBLOX</h1><p>اختار القسم، وتصفح الباقات والأسعار بكل سهولة.</p></div></section>
      <h2 class="rgp-title">شن تبي تشحن اليوم؟</h2>
      <div class="rgp-grid">
        <button class="rgp-card" type="button" data-rgp-choice="robux"><img src="${robloxImage}" alt="روبوكس"><div class="rgp-card-body"><h3>💎 روبوكس</h3><p>اشترِ باقات Robux واختر الكمية المناسبة ليك.</p><span class="rgp-action">عرض باقات الروبوكس →</span></div></button>
        <button class="rgp-card mm2" type="button" data-rgp-choice="mm2"><img src="${mm2Image}" alt="ماب MM2"><div class="rgp-card-body"><h3>🔪 ماب MM2</h3><p>باقات ومستلزمات ماب Murder Mystery 2.</p><span class="rgp-action">عرض باقات MM2 →</span></div></button>
      </div>
    </div>`;
    document.body.appendChild(p);
    p.addEventListener('click',function(e){
      if(e.target.closest('[data-rgp-back]')){closePage();return}
      var choice=e.target.closest('[data-rgp-choice]');if(!choice)return;
      if(choice.dataset.rgpChoice==='robux'){
        closePage();
        if(typeof window.openRobuxPackages==='function')window.openRobuxPackages();
        return;
      }
      showMm2Page();
    });
  }

  async function showMm2Page(){
    var p=document.getElementById(pageId);if(!p)return;
    var grid=document.createElement('div');grid.className='rgp-packages';grid.innerHTML='<div class="rgp-empty">جاري تحميل باقات MM2…</div>';
    p.querySelector('.rgp-grid').replaceWith(grid);
    p.querySelector('.rgp-title').textContent='باقات ماب MM2';
    try{
      var client=window.supabase.createClient(supabaseUrl,supabaseKey);
      var r=await client.from('products').select('*').eq('active',true).order('sort_order');
      var list=(r.data||[]).filter(function(x){var s=String(x.game||'')+' '+String(x.name||'')+' '+String(x.product_key||'');return /mm2|murder mystery|murdermystery|ماب/i.test(s)});
      if(!list.length){grid.innerHTML='<div class="rgp-empty">ما فيش باقات MM2 مضافة حالياً.</div>';return}
      grid.innerHTML=list.map(function(x){return '<button class="rgp-package" type="button" data-mm2-id="'+String(x.id).replace(/"/g,'&quot;')+'"><strong>'+escapeHtml(x.name)+'</strong><span>'+Number(x.amount||0)+' · '+Number(x.price||0).toFixed(2)+' د.ل</span></button>'}).join('');
      grid.addEventListener('click',function(e){var b=e.target.closest('[data-mm2-id]');if(!b)return;closePage();if(typeof window.selectPackage==='function')window.selectPackage(b.dataset.mm2Id);});
    }catch(err){grid.innerHTML='<div class="rgp-empty">تعذر تحميل باقات MM2. حاول مرة ثانية.</div>'}
  }

  function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  document.addEventListener('click',function(e){
    var roblox=e.target.closest('[data-product="roblox"]');
    if(!roblox)return;
    e.preventDefault();e.stopImmediatePropagation();showRobloxPage();
  },true);
})();
