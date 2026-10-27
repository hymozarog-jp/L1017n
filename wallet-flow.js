(function(){
  const AMOUNTS=[5,10,20,50];
  let flowProvider='libyana';
  let flowAmount=0;
  let flowTransferred=false;

  function css(){
    if(document.getElementById('walletFlowStyles'))return;
    const s=document.createElement('style');s.id='walletFlowStyles';s.textContent=`
      #walletView .wallet-simple{max-width:760px;margin:0 auto}
      .wallet-simple-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
      .wallet-simple-head h3{margin:0;font-size:1.2rem}
      .wallet-back{width:42px;height:42px;border:0;border-radius:12px;background:var(--soft-bg,#f3f5f4);font-size:20px;cursor:pointer}
      .wallet-provider-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .wallet-provider-btn{border:1px solid rgba(120,140,130,.22);background:var(--panel,#fff);border-radius:18px;padding:20px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:right;box-shadow:0 8px 22px rgba(0,0,0,.05)}
      .wallet-provider-btn b{display:block;font-size:1.05rem}.wallet-provider-btn small{display:block;opacity:.6;margin-top:2px}
      .wallet-provider-logo{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:#0d7b55;color:#fff;font-weight:800;font-size:20px}
      .wallet-amounts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
      .wallet-amount-btn{border:1px solid rgba(120,140,130,.25);background:var(--panel,#fff);border-radius:14px;padding:14px 8px;font-weight:700;cursor:pointer}
      .wallet-amount-btn.active{background:#0d7b55;color:#fff;border-color:#0d7b55}
      .wallet-code{direction:ltr;text-align:center;font-size:1.15rem;letter-spacing:.4px;padding:18px 10px;border-radius:16px;background:#101716;color:#fff;margin:12px 0;overflow:auto}
      .wallet-flow-actions{display:grid;gap:10px}.wallet-flow-actions .btn{width:100%}
      .wallet-phone{margin-top:14px}.wallet-phone label{display:block;margin-bottom:7px;font-weight:600}.wallet-phone input{width:100%}
      .wallet-success{padding:16px;border-radius:16px;background:rgba(13,123,85,.10);text-align:center;font-weight:700;margin:12px 0}
      .wallet-history{margin-top:20px}.wallet-history h3{margin:0 0 10px}
      @media(max-width:600px){.wallet-provider-grid{grid-template-columns:1fr}.wallet-amounts{grid-template-columns:repeat(2,1fr)}}
    `;document.head.appendChild(s);
  }
  function ussd(){return '*122*0925620538*'+Math.round(flowAmount*1000)+'#'}
  function walletShell(){
    const view=$('#walletView');if(!view)return null;
    view.innerHTML=`<div class="section-head"><div><span class="eyebrow">L1017n WALLET</span><h2>المحفظة</h2></div></div><div id="walletSimpleRoot" class="wallet-simple"></div><div class="panel history-panel wallet-history"><div class="history-head"><h3>طلبات الشحن الأخيرة</h3><span class="muted">حسابك</span></div><div id="topupHistory" class="history-list"></div></div>`;
    return $('#walletSimpleRoot');
  }
  async function renderHistory(user){
    const box=$('#topupHistory');if(!box)return;
    const {data,error}=await supabaseClient.from('topup_requests').select('id,amount,method,status,created_at,admin_note').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10);
    if(error){box.innerHTML='<p class="muted">تعذر تحميل الطلبات.</p>';return}
    box.innerHTML=data?.length?data.map(x=>`<article class="history-item"><div><b>${Number(x.amount||0).toFixed(2)} د.ل</b><small>${x.method==='libyana'?'ليبيانا':'المدار الجديد'} · ${new Date(x.created_at).toLocaleString('ar-LY')}</small></div><span class="status ${x.status==='approved'?'approved':x.status==='rejected'?'rejected':'pending'}">${statusText[x.status]||x.status}</span></article>`).join(''):'<p class="muted">لا توجد طلبات شحن.</p>';
  }
  async function renderBalance(user){const {data}=await supabaseClient.from('wallet_accounts').select('balance').eq('user_id',user.id).maybeSingle();return Number(data?.balance||0)}
  function providerScreen(root){root.innerHTML=`<div class="panel"><div class="wallet-simple-head"><h3>اشحن المحفظة</h3></div><div class="wallet-provider-grid"><button type="button" class="wallet-provider-btn" data-wallet-provider="libyana"><span class="wallet-provider-logo">L</span><span><b>ليبيانا</b><small>Libyana</small></span></button><button type="button" class="wallet-provider-btn" data-wallet-provider="madar"><span class="wallet-provider-logo">M</span><span><b>المدار الجديد</b><small>Almadar</small></span></button></div></div>`}
  function amountScreen(root){const name=flowProvider==='libyana'?'ليبيانا':'المدار الجديد';root.innerHTML=`<div class="panel"><div class="wallet-simple-head"><button type="button" class="wallet-back" data-wallet-back>‹</button><h3>${name}</h3></div><div class="wallet-amounts">${AMOUNTS.map(a=>`<button type="button" class="wallet-amount-btn ${flowAmount===a?'active':''}" data-wallet-amount="${a}">${a} د.ل</button>`).join('')}</div><div id="walletTransferStep"></div></div>`;transferStep($('#walletTransferStep'))}
  function transferStep(box){
    if(!box)return;
    if(!flowAmount){box.innerHTML='<p class="muted" style="text-align:center">اختار المبلغ</p>';return}
    if(flowProvider==='madar'){box.innerHTML=`<div class="wallet-code">218910005566</div><div class="wallet-flow-actions"><button type="button" class="btn btn-primary" data-wallet-transfer>تحويل الآن</button><button type="button" class="btn btn-soft" data-wallet-copy="218910005566">نسخ الرقم</button></div>`;return}
    const code=ussd();
    if(!flowTransferred)box.innerHTML=`<div class="wallet-code">${code}</div><div class="wallet-flow-actions"><a class="btn btn-primary" data-wallet-direct href="tel:${encodeURIComponent(code)}">تحويل الآن</a><button type="button" class="btn btn-soft" data-wallet-copy="${code}">نسخ الكود</button><button type="button" class="btn btn-soft" data-wallet-done>تم التحويل</button></div>`;
    else box.innerHTML=`<div class="wallet-success">تم التحويل ✓</div><div class="wallet-phone"><label for="walletPhone">رقم الهاتف</label><input id="walletPhone" type="tel" placeholder="09xxxxxxxx" inputmode="tel"></div><div class="wallet-flow-actions" style="margin-top:12px"><button type="button" class="btn btn-primary" data-wallet-submit>إرسال الطلب</button></div>`;
  }
  async function submitTopup(){
    const user=await currentUser();if(!user){toast('سجّل دخولك أولاً');switchView('account');return}
    const phone=$('#walletPhone')?.value.trim()||'';if(phone.length<5){toast('اكتب رقم الهاتف');return}
    const {error}=await supabaseClient.from('topup_requests').insert({user_id:user.id,amount:flowAmount,method:flowProvider,phone,transfer_reference:'بدون رقم عملية'});
    if(error){toast('تعذر إرسال الطلب. حاول مرة ثانية.');return}
    toast('تم إرسال الطلب');flowAmount=0;flowTransferred=false;await renderWallet();
  }
  async function renderWallet(){
    css();const root=walletShell();if(!root)return;
    const user=await currentUser();if(!user){root.innerHTML='<div class="panel" style="text-align:center"><h3>المحفظة</h3><button type="button" class="btn btn-primary" data-wallet-login>تسجيل الدخول</button></div>';return}
    const balance=await renderBalance(user);root.innerHTML=`<div class="panel" style="margin-bottom:12px"><div class="balance-top"><span>الرصيد الحالي</span><span class="balance-icon">◈</span></div><div class="balance-amount"><strong>${balance.toFixed(2)}</strong><span>د.ل</span></div></div><div id="walletActionPanel"></div>`;
    const action=$('#walletActionPanel');providerScreen(action);await renderHistory(user);
  }
  function showProvider(provider){flowProvider=provider;flowAmount=0;flowTransferred=false;const action=$('#walletActionPanel');if(action)amountScreen(action)}
  document.addEventListener('click',async e=>{
    const p=e.target.closest('[data-wallet-provider]');if(p){showProvider(p.dataset.walletProvider);return}
    if(e.target.closest('[data-wallet-back]')){flowAmount=0;flowTransferred=false;const a=$('#walletActionPanel');if(a)providerScreen(a);return}
    const a=e.target.closest('[data-wallet-amount]');if(a){flowAmount=Number(a.dataset.walletAmount);flowTransferred=false;const root=$('#walletActionPanel');if(root)amountScreen(root);return}
    if(e.target.closest('[data-wallet-done]')){flowTransferred=true;const root=$('#walletActionPanel');if(root)transferStep($('#walletTransferStep'));return}
    if(e.target.closest('[data-wallet-submit]')){await submitTopup();return}
    const copy=e.target.closest('[data-wallet-copy]');if(copy){try{await navigator.clipboard.writeText(copy.dataset.walletCopy);toast('تم النسخ')}catch(_){toast('انسخ الكود يدويًا')}return}
    if(e.target.closest('[data-wallet-login]')){switchView('account');return}
  });
  window.renderWallet=renderWallet;
})();
