/* GAMEBOXLY account pictures: customer-controlled, no email-profile scraping. */
(function(){
'use strict';
function attach(page,user){
 if(!page||!user||!page.querySelector('.personal-page-avatar'))return;
 const original=page.querySelector('.personal-page-avatar');
 if(!original.parentElement)return;
 const wrap=document.createElement('div');
 wrap.className='gb-picture-wrap';
 original.parentElement.insertBefore(wrap,original);
 wrap.append(original);
 const control=document.createElement('button');
 control.type='button';control.className='gb-picture-button';
 control.setAttribute('aria-label','اختيار صورة شخصية للحساب');
 control.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5h-5l-2 2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5l-2-2Z"/><circle cx="12" cy="13" r="3"/></svg>';
 wrap.append(control);
 const input=document.createElement('input');
 input.type='file';input.accept='image/jpeg,image/png,image/webp';
 input.className='gb-picture-file';input.setAttribute('aria-label','صورة JPG أو PNG أو WebP');
 input.hidden=true;
 wrap.append(input);
 const status=document.createElement('p');status.className='gb-picture-status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const note=document.createElement('small');note.className='gb-picture-note';
 note.textContent='صورة اختيارية — تظهر في التصنيف عندما تفعّل مشاركة الاسم والصورة.';
 const ui=document.createElement('div');ui.className='gb-picture-help';
 const label=document.createElement('button');label.type='button';label.className='gb-picture-label';label.textContent='تغيير صورة الحساب';
 ui.append(label,note,status);
 page.querySelector('.personal-page-user').insertAdjacentElement('afterend',ui);
 const showPhoto=url=>{
  const old=original.querySelector('.gb-picture-preview');if(old)old.remove();
  if(!url)return;
  const img=document.createElement('img');
  img.className='gb-picture-preview';img.alt='صورتك الشخصية';img.referrerPolicy='no-referrer';
  img.onerror=()=>img.remove();img.src=url;original.prepend(img);
 };
 const currentPhoto=typeof approvedProfilePhoto==='function'?approvedProfilePhoto(user):'';
 showPhoto(currentPhoto);
 const choose=()=>input.click();
 control.addEventListener('click',choose);
 label.addEventListener('click',choose);
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];
  if(!file)return;
  const allowed=new Set(['image/jpeg','image/png','image/webp']);
  if(!allowed.has(file.type)){status.textContent='اختار صورة JPG أو PNG أو WebP فقط.';input.value='';return}
  if(file.size>2*1024*1024){status.textContent='حجم الصورة لازم يكون أقل من 2 ميغابايت.';input.value='';return}
  control.disabled=true;label.disabled=true;status.textContent='جاري رفع الصورة…';
  try{
   const suffix=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
   const key=user.id+'/avatar.'+suffix;
   const {error:uploadError}=await supabaseClient.storage.from('gamebox-avatars')
      .upload(key,file,{contentType:file.type,cacheControl:'60',upsert:true});
   if(uploadError)throw uploadError;
   const {data:location}=supabaseClient.storage.from('gamebox-avatars').getPublicUrl(key);
   if(!location?.publicUrl)throw Error('تعذر الحصول على رابط الصورة');
   const url=location.publicUrl+'?v='+Date.now();
   const {data,error}=await supabaseClient.auth.updateUser({data:{avatar_url:url}});
   if(error)throw error;
   showPhoto(url);
   const updated=data?.user||(await supabaseClient.auth.getUser()).data?.user;
   if(updated){
    if(typeof paintGoldAccountIdentity==='function')paintGoldAccountIdentity(updated,String(updated.user_metadata?.full_name||updated.user_metadata?.name||'مستخدم'));
    if(typeof renderGoogleHeaderAvatar==='function')renderGoogleHeaderAvatar(updated);
   }
   status.textContent='تم حفظ صورتك! ستظهر في حسابك وفي التصنيف إذا كانت مشاركة الهوية مفعلة.';
   if(typeof window.loadLeaderboard==='function')void window.loadLeaderboard();
  }catch(e){console.warn('[account/picture] Upload failed:',e);status.textContent='تعذر رفع الصورة. تحقق من الاتصال وحاول مرة ثانية.'}
  finally{control.disabled=false;label.disabled=false;input.value=''}
 });
}
window.GameboxEmailProfile=Object.freeze({attach});
})();
