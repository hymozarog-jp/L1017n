/* Require a saved AND Resala-SMS-verified Libyan phone before checkout. */
(function(){
  'use strict';
  let pending=null;
  const style=document.createElement('style');
  style.id='purchase-phone-gate-style';
  style.textContent=[
    '#purchasePhoneOverlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:18px;background:#050a12ef;backdrop-filter:blur(7px);direction:rtl}',
    '#purchasePhoneOverlay *{box-sizing:border-box}',
    '#purchasePhoneOverlay .pp-card{width:min(100%,430px);padding:25px 21px;border:1px solid #e5bd6680;border-radius:24px;background:linear-gradient(150deg,#142338,#0b1826);color:#f5f8ff;box-shadow:0 24px 80px #000b;text-align:right}',
    '#purchasePhoneOverlay .pp-icon{display:grid;place-items:center;margin:0 auto 13px;width:65px;height:65px;border-radius:19px;background:#e1b34a21;border:1px solid #e1b34a78;font-size:32px}',
    '#purchasePhoneOverlay h2{font-size:23px;text-align:center;margin:0 0 7px;color:#f9d478}',
    '#purchasePhoneOverlay p{font-size:13px;line-height:1.8;margin:0 0 15px;color:#c1cbd8;text-align:center}',
    '#purchasePhoneOverlay label{display:block;margin-bottom:8px;font-size:14px;font-weight:750}',
    '#purchasePhoneOverlay input{width:100%;padding:14px 15px;border-radius:13px;border:1px solid #63718c;background:#07111f;color:#fff;font-size:18px;outline-offset:3px;text-align:left;direction:ltr}',
    '#purchasePhoneOverlay input:focus{border-color:#f1cc72;outline:2px solid #f1cc7240}',
    '#purchasePhoneOverlay .pp-actions{display:flex;gap:10px;margin-top:15px}',
    '#purchasePhoneOverlay button{flex:1;min-height:46px;border-radius:12px;cursor:pointer;font:inherit;font-size:14px;font-weight:850}',
    '#purchasePhoneOverlay .pp-save{border:none;background:linear-gradient(135deg,#ffe18b,#d7aa3b);color:#131b28}',
    '#purchasePhoneOverlay .pp-cancel{border:1px solid #566176;background:#182638;color:#dbe4f1}',
    '#purchasePhoneOverlay button:disabled{cursor:wait;opacity:.65}',
    '#purchasePhoneOverlay .pp-status{min-height:22px;color:#ffbdaf;margin:11px 0 0;font-size:12px;line-height:1.6;text-align:right}',
    '#purchasePhoneOverlay .pp-privacy{color:#a5b8cb;font-size:11px;margin:11px 0 0}'
  ].join('\n');
  document.head.appendChild(style);

  function normalizePhone(input){
    let digits=String(input||'').replace(/[^0-9]/g,'');
    if(/^002189[0-9]{8}$/.test(digits))digits=digits.slice(5);
    else if(/^2189[0-9]{8}$/.test(digits))digits=digits.slice(3);
    else if(/^09[0-9]{8}$/.test(digits))digits=digits.slice(1);
    return /^9[0-9]{8}$/.test(digits)?digits:null;
  }
  function modal(db,user){
    return new Promise(resolve=>{
      const overlay=document.createElement('div');
      overlay.id='purchasePhoneOverlay';
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','purchasePhoneTitle');
      const card=document.createElement('div');
      card.className='pp-card';
      card.innerHTML='<div class="pp-icon" aria-hidden="true">📱</div>'+
        '<h2 id="purchasePhoneTitle">أضف رقم هاتفك لإكمال الشراء</h2>'+
        '<p>قبل تأكيد الطلب، لازم تربط رقم هاتف ليبي بحسابك مرة واحدة فقط.</p>'+
        '<form id="purchasePhoneForm"><label for="purchasePhoneInput">رقم هاتفك</label>'+
        '<input id="purchasePhoneInput" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="18" placeholder="09xxxxxxxx" required>'+
        '<div class="pp-actions"><button class="pp-save" type="submit">حفظ ومتابعة الشراء</button><button class="pp-cancel" type="button">إلغاء</button></div>'+
        '<p class="pp-status" role="status" aria-live="polite"></p></form>'+
        '<p class="pp-privacy">🔒 رقمك يظل خاص بحسابك ولا يظهر في التصنيف أو للمتسوقين.</p>';
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      const form=card.querySelector('form'),field=card.querySelector('input'),submit=card.querySelector('.pp-save'),cancel=card.querySelector('.pp-cancel'),status=card.querySelector('.pp-status');
      let settled=false;
      function finish(allowed){
        if(settled)return;
        settled=true;
        document.removeEventListener('keydown',escape);
        overlay.remove();
        resolve(allowed);
      }
      function escape(e){if(e.key==='Escape'&&!submit.disabled){e.preventDefault();finish(false)}}
      document.addEventListener('keydown',escape);
      cancel.addEventListener('click',()=>finish(false));
      form.addEventListener('submit',async e=>{
        e.preventDefault();
        const normalized=normalizePhone(field.value);
        if(!normalized){
          status.textContent='اكتب رقمًا ليبيًا صحيحًا مثل 0912345678.';
          field.focus();
          return;
        }
        submit.disabled=true;
        cancel.disabled=true;
        status.textContent='جاري حفظ الرقم في حسابك…';
        try{
          const response=await db.rpc('save_my_libyana_phone',{p_phone:normalized});
          if(response.error)throw response.error;
          const check=await db.from('wallet_accounts').select('libyana_phone').eq('user_id',user.id).maybeSingle();
          if(check.error||!check.data?.libyana_phone)throw new Error('phone_not_saved');
          finish(true);
          if(typeof renderAccount==='function')Promise.resolve(renderAccount()).catch(()=>{});
        }catch(error){
          const text=String(error?.message||'');
          status.textContent=/already_registered|duplicate|unique|phone_belongs_to_different_login/i.test(text)
            ?'هذا الرقم مستخدم في حساب ثاني، اختار رقمك الخاص.'
            :'تعذر حفظ الرقم. تأكد منه وحاول مرة ثانية.';
        }finally{
          submit.disabled=false;
          cancel.disabled=false;
        }
      });
      field.focus();
    });
  }

  // A saved number is NOT proof of ownership: only Resala's server-side
  // verified record for the same signed-in account unlocks checkout.
  async function requireVerifiedPhone(db) {
    let state;
    try {
      const { data, error } = await db.functions.invoke("l1017n-resala-otp", {
        body: { action: "status" }
      });
      if (error || !data || data.configured !== true) throw Error("verification_unavailable");
      state = data;
    } catch (error) {
      console.warn("Cannot confirm Resala verification", error);
      alert("خدمة توثيق رقم الهاتف غير متاحة حاليًا. لا يمكن إكمال الشراء حتى نتأكد من التوثيق.");
      return false;
    }
    if (state.verified === true) return true;
    // Unverified customers are sent directly to their Personal Details phone
    // verification card. Server-side purchase restrictions remain unchanged.
    if (typeof closeRobuxPackages === "function") closeRobuxPackages();
    if (typeof switchView === "function") switchView("account");
    if (typeof window.openPersonalDetails === "function") {
      await window.openPersonalDetails({focusPhone:true});
      if (typeof toast === "function") toast("وثّق رقمك برسالة SMS من المعلومات الشخصية قبل الشراء.");
    } else {
      alert("لازم توثّق رقم هاتفك من «حسابي» ثم «المعلومات الشخصية» قبل الشراء.");
    }
    return false;
  }

  window.ensurePurchasePhone=async function(){
    if(pending)return pending;
    pending=(async()=>{
      const db=typeof supabaseClient==='undefined'?null:supabaseClient;
      if(!db)return false;
      try{
        const auth=await db.auth.getUser();
        const user=auth.data?.user;
        if(auth.error||!user)return false;
        const check=await db.from('wallet_accounts').select('libyana_phone').eq('user_id',user.id).maybeSingle();
        if(check.error)throw check.error;
        if (!check.data?.libyana_phone) {
          const saved=await modal(db,user);
          if (!saved) return false;
        }
        return await requireVerifiedPhone(db);
      }catch(error){
        console.warn('Purchase phone check unavailable',error);
        if(typeof toast==='function')toast('تعذر التحقق من رقم الهاتف. حاول ثانية.');
        return false;
      }
    })();
    try{return await pending}finally{pending=null}
  };
})();
