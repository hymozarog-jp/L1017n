/* Roblox charging methods. Uses real existing checkout only when supported.
   Never requests Roblox passwords and never invents stock or delivery codes. */
(function(){
  'use strict';
  const $=(root,selector)=>root&&root.querySelector(selector);
  function prepare(root,kind,label){
    if(!root||root.id!=='robloxGamePage'||!root.isConnected)return null;
    const old=$(root,'.rgp-grid,.rgp-method-page');
    if(!old)return null;
    const page=document.createElement('section');
    page.className='rgp-method-page rgp-method-'+kind;
    page.dir='rtl';
    old.replaceWith(page);
    root.classList.add('rgp-inner-page');
    root.classList.remove('rgp-category-hub');
    $(root,'.rgp-hub-subtitle')?.remove();
    if(typeof window.setRobloxInnerHeader==='function')window.setRobloxInnerHeader(root,label,kind);
    root.scrollTop=0;
    return page;
  }
  function accountPage(root){
    const page=prepare(root,'account','شحن داخل الحساب');
    if(!page)return;
    page.innerHTML=`
      <div class="rgp-method-banner">
        <div class="rgp-method-emblem"><img src="game-covers/roblox-mark.svg?v=logo-square1" alt="" loading="lazy"></div>
        <span class="rgp-method-eyebrow">ROBLOX / ACCOUNT</span>
        <h2>شحن داخل الحساب</h2>
        <p>تقدر تشتري روبوكس داخل حسابك من موقع Roblox الرسمي باستخدام وسيلة دفع يدعمها Roblox.</p>
      </div>
      <div class="rgp-method-status" role="status">
        <strong>الشحن داخل الحساب غير مفعّل عبر محفظة المتجر حاليًا.</strong>
        <span>ما يتم خصم أي مبلغ من رصيدك هنا. لا ترسل كلمة مرور Roblox ولا رمز تسجيل الدخول لأي شخص.</span>
      </div>
      <div class="rgp-method-instructions">
        <h3>كيف تشحن من حسابك؟</h3>
        <p>افتح Roblox الرسمي، سجّل الدخول بنفسك، ثم اختر باقة Robux وأكمل عملية الدفع هناك.</p>
        <a href="https://www.roblox.com/upgrades/robux" target="_blank" rel="noopener noreferrer" class="rgp-method-cta">فتح Roblox الرسمي <span aria-hidden="true">↗</span></a>
        <p class="rgp-method-footnote">إذا تبي تشتري من محفظة L1017n، اختار «شحن عبر اليوزر» من القائمة السابقة.</p>
      </div>`;
  }
  function validCodeProduct(p){
    if(!p||p.active!==true||!(Number(p.price)>0)||!p.id)return false;
    const label=[p.name,p.product_key,p.game].map(v=>String(v||'').toLowerCase()).join(' ');
    const roblox=/roblox|robux|روبلوكس|روبوكس/.test(label);
    const code=/\b(?:codes?|voucher|gift[ _-]?cards?|redeem)\b|(?:كود|اكواد|أكواد|بطاق[ةه]\s*(?:هدي[ةه]|روبلوكس))/.test(label);
    return roblox&&code;
  }
  function codePage(root){
    const page=prepare(root,'codes','أكواد روبلوكس');
    if(!page)return;
    page.innerHTML=`
      <div class="rgp-method-banner">
        <div class="rgp-method-emblem"><img src="game-covers/robux-100-tokens.svg?v=robux-art2" alt="" loading="lazy"></div>
        <span class="rgp-method-eyebrow">ROBLOX / DIGITAL CODES</span>
        <h2>أكواد روبلوكس</h2>
        <p>الأكواد المدعومة تظهر هنا فقط عند إضافتها كمنتجات منفصلة في المتجر.</p>
      </div>
      <div class="rgp-codes-list" aria-live="polite"><p class="rgp-method-empty">جاري التحقق من المنتجات…</p></div>
      <div class="rgp-method-instructions">
        <h3>طريقة استخدام الكود</h3>
        <p>بعد استلام كود صالح، يمكنك استرداده من صفحة Roblox الرسمية.</p>
        <a href="https://www.roblox.com/redeem" target="_blank" rel="noopener noreferrer" class="rgp-method-cta rgp-method-cta-soft">صفحة استرداد الأكواد <span aria-hidden="true">↗</span></a>
        <p class="rgp-method-footnote">لا يتم خصم الرصيد لمجرد فتح الصفحة أو الباقة. الطلب يُنفّذ فقط عبر نظام الأكواد المؤمن في المتجر.</p>
      </div>`;
    const list=$(page,'.rgp-codes-list');
    (async()=>{
      const db=typeof supabaseClient!=='undefined'?supabaseClient:null;
      if(!db){
        list.innerHTML='<p class="rgp-method-empty">تعذر الاتصال بالمتجر. حدّث الصفحة وجرب من جديد.</p>';return;
      }
      try{
        const result=await db.from('products')
          .select('id,product_key,name,game,price,active')
          .eq('active',true)
          .limit(200);
        if(!page.isConnected)return;
        if(result.error)throw result.error;
        const codes=(result.data||[]).filter(validCodeProduct).sort((a,b)=>Number(a.price)-Number(b.price));
        if(!codes.length){
          list.innerHTML='<p class="rgp-method-empty"><strong>لا توجد أكواد Roblox معروضة للبيع حاليًا.</strong><span>لما يضيف المتجر أكواد مدعومة، تظهر الباقات وأسعارها هنا تلقائيًا.</span></p>';
          return;
        }
        list.replaceChildren();
        codes.forEach(p=>{
          const card=document.createElement('article');card.className='rgp-code-card';
          const details=document.createElement('div');details.className='rgp-code-info';
          const title=document.createElement('strong');title.textContent=String(p.name||'كود Roblox');
          const note=document.createElement('small');note.textContent='تُفحص صلاحية الكود وتوفّره عند تأكيد الشراء';
          details.append(title,note);
          const cost=document.createElement('span');cost.className='rgp-code-price';cost.textContent=Number(p.price).toFixed(2)+' د.ل';
          const buy=document.createElement('button');
          buy.type='button';buy.className='rgp-code-open';buy.textContent='عرض الباقة';
          buy.addEventListener('click',()=>{
            if(typeof window.openInstantCodeCheckout!=='function'){alert('خدمة الأكواد غير جاهزة حاليًا.');return}
            // The server-side buy_instant_code RPC is the only payment and code-stock authority.
            void window.openInstantCodeCheckout(p.id,p.name,p.price);
          });
          card.append(details,cost,buy);list.appendChild(card);
        });
      }catch(err){
        console.warn('[roblox/codes] catalog unavailable',err);
        if(page.isConnected)list.innerHTML='<p class="rgp-method-empty">تعذر تحميل الأكواد حاليًا. جرّب مرة ثانية لاحقًا.</p>';
      }
    })();
  }
  window.openRobloxAccountChargePage=accountPage;
  window.openRobloxCodesPage=codePage;
})();