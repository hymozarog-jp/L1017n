/* L1017n premium personal account details, nonfinancial view customization.
   Never infer verified phone, account age, or SMS status from presentation.
*/
(function(){
"use strict";
const glyph={
 user:'<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c0-3.6 2.8-6 6.5-6s6.5 2.4 6.5 6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
 phone:'<rect x="7" y="2" width="10" height="20" rx="2.3"/><path d="M11 18h2"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M7 2v6M17 2v6M3 10h18"/><path d="M8 15h3M8 18h6"/>',
 edit:'<path d="m4 20 4.8-1.1L19.5 8.2a2.1 2.1 0 0 0-3-3L5.8 15.9 4 20Z"/>',
 save:'<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 3v6h8V3M8 21v-8h8v8"/>',
 check:'<path d="m5 12 4 4L19 6"/>'
};
const svg=k=>'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyph[k]+'</svg>';
const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function row(type,label,value,kind){
 return '<div class="premium-info-row"><span class="premium-row-icon premium-icon-'+type+'">'+svg(type)+'</span>'+
 '<span class="premium-row-copy"><small>'+label+'</small><b class="'+(kind||'')+'">'+value+'</b></span></div>';
}
function verifiedState(page){
 const badge=page.querySelector('#personalPhoneBadge');
 const state=badge?.dataset.state||'loading';
 const phone=page.querySelector('.premium-phone-value');
 const security=page.querySelector('.premium-security-value');
 if(phone){
  phone.textContent=state==='verified'?'موثّق':state==='unverified'?'غير موثّق':state==='empty'?'لم يُضف رقم':state==='unknown'?'تعذر التحقق':'جاري التحقق…';
  phone.dataset.state=state;
 }
 if(security){
  security.textContent=state==='verified'?'توثيق SMS مفعّل':state==='unverified'?'يتطلب توثيق الهاتف':state==='empty'?'أضف رقمك أولًا':state==='unknown'?'تعذر فحص الأمان':'جاري الفحص…';
  security.dataset.state=state;
 }
}
function openVerification(page){
 if(typeof window.openPhoneVerificationPage==='function')window.openPhoneVerificationPage();
 else page.querySelector('#personalPhoneSlot')?.scrollIntoView({behavior:'auto',block:'center'});
}
function decorate(page,user,name){
 if(!page||!user)return;
 page.dataset.premiumProfile='ready';
 page.classList.add('premium-personal-profile');
 const header=page.querySelector('.personal-page-header > div');
 if(header&&!header.querySelector('p')){
  const intro=document.createElement('p');intro.textContent='إدارة بيانات حسابك ومعلوماتك الشخصية';header.append(intro);
 }
 const avatar=page.querySelector('.personal-page-avatar');
 if(avatar){
  const original=avatar.textContent.trim();
  avatar.textContent='';
  const initial=document.createElement('span');initial.className='premium-avatar-initial';initial.textContent=original;
  const edit=document.createElement('span');edit.className='premium-avatar-edit';edit.innerHTML=svg('edit');edit.setAttribute('aria-hidden','true');
  avatar.append(initial,edit);
 }
 const profile=page.querySelector('.personal-page-user');
 if(profile){
  const member=document.createElement('span');member.className='premium-member-badge';
  const joined=user.created_at?new Date(user.created_at):null;
  const dateValid=joined&&!Number.isNaN(joined.getTime());
  const age=dateValid?Date.now()-joined.getTime():Infinity;
  member.innerHTML=svg('check')+'<span>'+(dateValid&&age>=0&&age<30*864e5?'عضو جديد':dateValid?'عضو منذ '+joined.getFullYear():'عضو L1017n')+'</span>';
  profile.append(member);
 }
 const title=page.querySelector('.personal-page-group-heading > span');
 if(title)title.textContent='معلوماتك الشخصية والتفاصيل العامة';
 const form=page.querySelector('#personalDetailsForm'),fields=page.querySelector('.personal-page-fields');
 if(fields&&form){
  const nameLabel=fields.querySelector('label[for="personalFullName"]');
  const emailLabel=fields.querySelector('label[for="personalEmail"]');
  fields.classList.add('premium-info-list');
  function wrap(label,k,action){
   if(!label)return;
   const box=document.createElement('div');box.className='premium-info-row premium-info-'+k;
   const symbol=document.createElement('span');symbol.className='premium-row-icon premium-icon-'+k;symbol.innerHTML=svg(k);
   box.append(symbol,label);
   const side=document.createElement('span');side.className='premium-row-side';
   side.innerHTML=action?svg('edit'):'✓';
   box.append(side);
   fields.append(box);
   if(action){
    side.setAttribute('aria-hidden','true');
    box.addEventListener('click',e=>{if(e.target!==label.querySelector('input'))label.querySelector('input')?.focus()});
   }
  }
  wrap(nameLabel,'user',true);
  wrap(emailLabel,'mail',false);
  const phone=document.createElement('button');phone.type='button';phone.className='premium-info-row premium-info-button premium-info-phone';
  phone.innerHTML='<span class="premium-row-icon premium-icon-phone">'+svg('phone')+'</span><span class="premium-row-copy"><small>رقم الهاتف</small><b class="premium-phone-value" data-state="loading">جاري التحقق…</b></span><span class="premium-row-side">‹</span>';
  phone.addEventListener('click',()=>openVerification(page));fields.append(phone);
  const active=document.createElement('div');active.innerHTML=row('shield','حالة الحساب','مسجل الدخول','premium-active-value');
  fields.append(active.firstElementChild);
  const secure=document.createElement('div');secure.innerHTML=row('lock','حماية الحساب','جاري الفحص…','premium-security-value');
  fields.append(secure.firstElementChild);
  const joined=user.created_at?new Date(user.created_at):null;
  const date=(joined&&!Number.isNaN(joined.getTime()))?joined.toLocaleDateString('ar-LY',{year:'numeric',month:'long',day:'numeric'}):'غير متوفر';
  const dateRow=document.createElement('div');dateRow.innerHTML=row('calendar','تاريخ الانضمام',escapeText(date));
  fields.append(dateRow.firstElementChild);
  const save=form.querySelector('.personal-save');
  if(save)save.innerHTML=svg('save')+'<span>حفظ التغييرات</span>';
 }
 const section=page.querySelector('#personalPhoneSection');
 const heading=section?.querySelector('.personal-phone-heading');
 if(heading){
  const button=document.createElement('button');button.type='button';button.id='premiumOpenPhone';button.className='personal-phone-heading';
  button.setAttribute('aria-label','فتح توثيق رقم الهاتف');
  while(heading.firstChild)button.appendChild(heading.firstChild);
  const arrow=document.createElement('span');arrow.className='premium-phone-arrow';arrow.textContent='‹';arrow.setAttribute('aria-hidden','true');
  button.append(arrow);heading.replaceWith(button);
  button.addEventListener('click',()=>openVerification(page));
 }
 const badge=page.querySelector('#personalPhoneBadge');
 if(badge){
  page._premiumBadgeObserver?.disconnect();
  const observer=new MutationObserver(()=>verifiedState(page));
  observer.observe(badge,{attributes:true,attributeFilter:['data-state'],childList:true});
  page._premiumBadgeObserver=observer;
 }
 verifiedState(page);
}
async function refreshFromServer(){
 const page=document.getElementById('personalDetailsPage');
 if(!page?.classList.contains('visible')||typeof window.renderResalaOtp!=='function')return;
 try{
  const client=typeof supabaseClient==='undefined'?null:supabaseClient;
  if(!client)return;
  const {data:{session}}=await client.auth.getSession();
  if(session?.user)await window.renderResalaOtp(session.user);
 }catch(err){console.warn('[account/personal] Phone status refresh failed',err)}
}
window.L1017nPersonalPremium=Object.freeze({decorate,refresh:verifiedState,refreshFromServer});
})();