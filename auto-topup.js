/* L1017n — Libyana SMS verified automatic wallet credits only. */
(function(){
  'use strict';
  const transferNumber='0925620538';
  let generation=0;
  let lastIdentity=null;
  let lastPhone=null;
  let lastReady=false;
  let lastVerified=false;
  let lastCheckAt=0;

  const css=document.createElement('style');
  css.id='auto-topup-css';
  css.textContent=[
    '#topupForm .auto-topup-intro{padding:13px;border-radius:14px;background:#1b33255c;border:1px solid #77b37b54;line-height:1.8;font-size:13px;margin:14px 0}',
    '#topupForm .auto-topup-status{padding:15px 13px;border:1px solid #a4a0a050;border-radius:14px;background:#0e1f22;line-height:1.8;font-size:13px}',
    '#topupForm .auto-topup-status.warning{border-color:#e1b66287;background:#5b411f29;color:#f1d0a0}',
    '#topupForm .auto-topup-status.ok{border-color:#27a96590;background:#195f3a28;color:#b9f2ca}',
    '#topupForm .auto-topup-transfer{display:grid;gap:10px;margin:14px 0}',
    '#topupForm .auto-topup-transfer .ussd-code{padding:15px;display:block;border:1px solid #75a8846b;border-radius:12px;background:#14241b;overflow-wrap:anywhere;text-align:center;font-size:19px}',
    '#topupForm .auto-topup-transfer a{display:flex;align-items:center;justify-content:center;text-align:center;min-height:49px}',
    '#topupForm .auto-topup-transfer button{min-height:45px}',
    '#topupForm .auto-topup-note{font-size:12px;line-height:1.75;color:#b7c5bc}',
    '#topupForm .auto-topup-note b{color:#f5d57d}'
  ].join('\n');
  document.head.appendChild(css);

  function el(tag,classname,text){
    const item=document.createElement(tag);
    if(classname)item.className=classname;
    if(text!==undefined)item.textContent=String(text);
    return item;
  }
  async function checkEligibility(db,user,force){
    if(!force && lastIdentity===user.id && Date.now()-lastCheckAt<15000){
      return {hasPhone:!!lastPhone,ready:lastReady,verified:lastVerified};
    }
    const [wallet,readiness,verification]=await Promise.all([
      db.from('wallet_accounts').select('libyana_phone').eq('user_id',user.id).maybeSingle(),
      db.rpc('is_my_auto_libyana_topup_ready'),
      db.functions.invoke('l1017n-resala-otp',{body:{action:'status'}})
    ]);
    if(wallet.error)throw wallet.error;
    if(readiness.error)throw readiness.error;
    if(verification.error||verification.data?.configured!==true)throw verification.error||new Error("verification_unavailable");
    lastIdentity=user.id;
    lastPhone=wallet.data?.libyana_phone||null;
    lastVerified=verification.data?.verified===true;
    lastReady=!!readiness.data&&lastVerified;
    lastCheckAt=Date.now();
    return {hasPhone:!!lastPhone,ready:lastReady,verified:lastVerified};
  }
  function show(node,cls,msg){
    node.replaceChildren(el('div','auto-topup-status '+cls,msg));
  }
  async function render(force){
    const host=document.getElementById('transferInstructions');
    const amountInput=document.getElementById('topupAmount');
    if(!host||!amountInput)return;
    const run=++generation;
    show(host,'','جاري التأكد من تفعيل الشحن الآلي لحسابك…');
    const client=typeof supabaseClient==='undefined'?null:supabaseClient;
    if(!client){show(host,'warning','تعذر فتح خدمة الشحن الآلي. حدّث الصفحة.');return}
    try{
      const {data:auth,error}=await client.auth.getUser();
      if(error)throw error;
      const user=auth?.user;
      if(run!==generation)return;
      if(!user){show(host,'warning','سجّل دخولك باش تشحن المحفظة آليًا.');return}
      const state=await checkEligibility(client,user,!!force);
      if(run!==generation)return;
      if(!state.hasPhone){
        show(host,'warning','📱 سجّل رقم ليبيانا الخاص بك من حسابي قبل الشحن.');
        return;
      }
      if(!state.verified){
        show(host,'warning','📱 لازم توثّق رقمك برسالة SMS من «حسابي» قبل ما تقدر تفعّل الشحن الآلي أو تشتري من محفظتك.');
        const action=el('button','btn btn-primary','توثيق رقم الهاتف');
        action.type='button'; action.addEventListener('click',()=>{if(typeof switchView==='function')switchView('account')});
        host.appendChild(action);
        return;
      }
      if(!state.ready){
        show(host,'warning','✅ رقمك موثّق برسالة SMS والدفع من المحفظة متاح بعد تأكيد الشراء. الشحن الآلي لتحويلات ليبيانا يحتاج أيضًا ربط رقم المحوّل لدى إدارة المتجر بعد التحقق من أول تحويل. ما تحوّلش رصيد قبل تفعيل الربط.');
        return;
      }
      const raw=Number(amountInput.value);
      if(!Number.isFinite(raw)||raw<1||raw>10||!Number.isInteger(raw*1000)){
        show(host,'warning','المبلغ المسموح للشحن الآلي من 1 إلى 10 د.ل للتحويل الواحد.');
        return;
      }
      const code='*122*'+transferNumber+'*'+Math.round(raw*1000)+'#';
      const info=el('div','auto-topup-status ok','✅ رقمك مفعّل للشحن الآلي عبر ليبيانا. التحويلات المطابقة للشروط تُعتمد آليًا عند استلام رسالة التحويل.');
      const panel=el('div','auto-topup-transfer');
      const label=el('strong','', 'كود تحويل '+raw.toFixed(2)+' د.ل');
      const ussd=el('strong','ussd-code',code);
      ussd.setAttribute('dir','ltr');
      const link=el('a','btn btn-primary full-width direct-transfer-btn','📞 تحويل عبر ليبيانا');
      link.href='tel:'+code.replace('#','%23');
      const copy=el('button','btn btn-soft full-width','نسخ كود التحويل');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try{
          if(!navigator.clipboard)throw new Error('clipboard_unavailable');
          await navigator.clipboard.writeText(code);
          copy.textContent='تم نسخ الكود ✓';
        }catch(error){
          window.prompt('انسخ كود التحويل:',code);
        }
      });
      const note=el('p','auto-topup-note');
      note.textContent='الشحن الآلي لليبيانا فقط، من 1 إلى 10 د.ل للتحويل، وفق حدود التحقق اليومية. الشحن موش فوريًا مضمون؛ ما تكررش التحويل إذا تأخر الرصيد، وتواصل مع الإدارة.';
      panel.append(label,ussd,link,copy,note);
      host.replaceChildren(info,panel);
    }catch(err){
      if(run!==generation)return;
      console.warn('Automatic topup availability check failed',err);
      show(host,'warning','تعذر التأكد من تفعيل رقمك للشحن الآلي. ما تحوّلش فلوس حتى يتم التحقق.');
    }
  }
  window.refreshAutoTopup=()=>render(true);
  document.getElementById('topupAmount')?.addEventListener('input',()=>render(false));
  document.querySelectorAll('[data-amount]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>render(false),0)));
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-view="wallet"],#walletActionTopup,#topupModalContinue'))setTimeout(()=>render(true),50);
  },true);
  if(typeof supabaseClient!=='undefined'){
    supabaseClient.auth.onAuthStateChange(event=>{
      if(['SIGNED_IN','SIGNED_OUT','INITIAL_SESSION','USER_UPDATED'].includes(event)){
        lastIdentity=null;lastPhone=null;lastReady=false;lastVerified=false;lastCheckAt=0;
        setTimeout(()=>render(true),0);
      }
    });
  }
  render(true);
})();