(function(){
  const panel=document.querySelector('#accountView .account-panel');
  if(!panel)return;
  const box=document.createElement('section');
  box.id='libyanaPhoneSettings';
  box.className='panel';
  box.style.cssText='margin:18px 0;padding:18px;text-align:right;border-radius:16px';
  box.innerHTML='<h3 style="margin:0 0 10px">📱 رقم ليبيانا</h3><p class="muted" style="margin:0 0 12px">أدخل رقم ليبيانا الخاص بك لحفظه في حسابك. الرقم غير موثّق حاليًا.</p><form id="libyanaPhoneForm"><label for="libyanaPhoneInput">رقم ليبيانا</label><input id="libyanaPhoneInput" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="091xxxxxxx أو 092xxxxxxx" required style="width:100%;margin:8px 0 12px"><button class="btn btn-primary" type="submit">حفظ الرقم</button><p id="libyanaPhoneStatus" role="status" aria-live="polite"></p></form>';
  const logout=document.getElementById('logoutBtn');
  panel.insertBefore(box,logout||null);
  const input=box.querySelector('#libyanaPhoneInput'),status=box.querySelector('#libyanaPhoneStatus');
  async function refresh(){
    try{
      const user=await currentUser();
      box.hidden=!user;
      if(!user)return;
      const r=await supabaseClient.from('wallet_accounts').select('libyana_phone').eq('user_id',user.id).maybeSingle();
      if(r.error){status.textContent='تعذر قراءة الرقم المحفوظ';return}
      input.value=r.data?.libyana_phone?'0'+r.data.libyana_phone:'';
      status.textContent='';
    }catch(_){box.hidden=true}
  }
  box.querySelector('form').addEventListener('submit',async function(e){
    e.preventDefault();
    const button=box.querySelector('button[type=submit]');
    button.disabled=true;status.textContent='جاري الحفظ…';
    try{
      const result=await supabaseClient.rpc('save_my_libyana_phone',{p_phone:input.value});
      if(result.error)throw result.error;
      input.value='0'+result.data;
      status.textContent='تم حفظ رقم ليبيانا في حسابك ✓ (بدون تحقق)';
    }catch(e){status.textContent=/duplicate key|unique/i.test(e.message||'')?'هذا الرقم مسجّل في حساب آخر':'تعذر حفظ الرقم. تأكد من أنه رقم ليبيانا صحيح وأنك مسجّل الدخول.'}
    finally{button.disabled=false}
  });
  document.getElementById('accountBtn')?.addEventListener('click',()=>setTimeout(refresh,150));
  document.querySelectorAll('[data-view="account"]').forEach(b=>b.addEventListener('click',()=>setTimeout(refresh,150)));
  window.addEventListener('focus',refresh);
  setTimeout(refresh,1200);
})();