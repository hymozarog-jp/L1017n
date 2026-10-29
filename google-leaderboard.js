(function(){
'use strict';
/* Google leaderboard: public rankings, explicit consent for name/photo. */
const styles = document.createElement('style');
styles.id = 'google-leaderboard-styles';
styles.textContent = [
  '#leaderboardView .leaderboard-row{grid-template-columns:42px 46px minmax(0,1fr) auto;gap:12px;min-height:77px}',
  '#leaderboardView .leaderboard-user-avatar{position:relative;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#173626;border:2px solid #a8f36b52;overflow:hidden}',
  '#leaderboardView .leaderboard-user-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
  '#leaderboardView .leaderboard-display-name{min-width:0;overflow-wrap:anywhere;font-weight:700;color:#f2f8ef}',
  '#leaderboardView .leaderboard-rank{font-size:20px}',
  '#leaderboardView .leaderboard-row:first-child{border-color:#cba24d73;background:linear-gradient(110deg,#cba24d14,#ffffff03)}',
  '#leaderboardView .leaderboard-row:first-child .leaderboard-rank{color:#f8d06b}',
  '@media(max-width:510px){#leaderboardView .leaderboard-row{grid-template-columns:32px 42px minmax(0,1fr);gap:8px;padding:12px 10px}#leaderboardView .leaderboard-points{grid-column:3;font-size:12px}#leaderboardView .leaderboard-user-avatar{width:40px;height:40px}}'
].join('\n');
document.head.appendChild(styles);

function hasGoogle(user){
  return !!user && (user.app_metadata?.provider==='google' ||
    user.app_metadata?.providers?.includes('google') ||
    user.identities?.some(i=>i.provider==='google'));
}
function photoUrl(value){
  try{
    const u=new URL(String(value||''));
    const h=u.hostname.toLowerCase();
    if(u.protocol==='https:'&&(h==='googleusercontent.com'||h.endsWith('.googleusercontent.com')||h==='ggpht.com'||h.endsWith('.ggpht.com')))return u.href;
  }catch(e){}
  return '';
}
function node(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=String(text);
  return el;
}

window.loadLeaderboard=async function(){
  const host=document.getElementById('leaderboardList');
  if(!host)return;
  host.replaceChildren(node('p','muted','جاري تحميل الترتيب…'));
  try{
    const result=await supabaseClient.rpc('get_store_leaderboard_with_google');
    if(result.error)throw result.error;
    const data=result.data||[];
    if(!data.length){
      host.replaceChildren(node('p','muted','ما فيش متسوقين بمشتريات مكتملة مشاركين في التصنيف حتى الآن.'));
      return;
    }
    const list=node('div','leaderboard-rows');
    data.forEach((item,index)=>{
      const rank=Number(item.rank)||index+1;
      const row=node('div','leaderboard-row');
      const rankEl=node('span','leaderboard-rank',rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':String(rank));
      const avatar=node('span','leaderboard-user-avatar','👤');
      const photo=photoUrl(item.avatar_url);
      if(photo){
        const img=document.createElement('img');
        img.src=photo;
        img.alt='صورة حساب Google';
        img.loading='lazy';
        img.referrerPolicy='no-referrer';
        img.onerror=()=>img.remove();
        avatar.appendChild(img);
      }
      const displayName=String(item.display_name||'').trim()||('متسوق المركز '+rank);
      const display=node('span','leaderboard-display-name',displayName);
      const points=node('strong','leaderboard-points',Math.round(Number(item.points)||0).toLocaleString('ar-LY')+' نقطة');
      row.append(rankEl,avatar,display,points);
      list.appendChild(row);
    });
    host.replaceChildren(list);
  }catch(err){
    console.warn('Cannot load public ranking',err);
    host.replaceChildren(node('p','muted','تعذر تحميل التصنيف حالياً. حاول تحديث الصفحة.'));
  }
};

window.renderLeaderboardProfile=async function(){
  const panel=document.querySelector('.account-panel');
  if(!panel)return;
  let form=document.getElementById('leaderboardProfileForm');
  if(!form||form.dataset.googleVersion!=='1'){
    if(form)form.remove();
    form=document.createElement('form');
    form.id='leaderboardProfileForm';
    form.className='leaderboard-profile-form';
    form.dataset.googleVersion='1';
    form.innerHTML =
      '<h3>المشاركة في ترتيب المتسوقين</h3>'+
      '<p class="form-note">نقاطك من مشترياتك المكتملة. الترتيب عام، لكن ما ننشروش بريدك أو رقم هاتفك أو تفاصيل طلباتك.</p>'+
      '<label class="transfer-confirm"><input type="checkbox" id="leaderboardVisible"><span>أوافق على ظهور ترتيبي ونقاطي لكل زوار المتجر</span></label>'+
      '<label class="transfer-confirm" id="leaderboardGoogleConsentWrap"><input type="checkbox" id="leaderboardGooglePublic"><span>أوافق على نشر اسمي وصورتي من Google بجانب ترتيبي لكل الزوار</span></label>'+
      '<p class="form-note">بدون موافقتك على الاسم والصورة، تظهر نقاطك برقم المركز فقط. تقدر تلغي الموافقة وقت ما تبي.</p>'+
      '<button type="submit" class="btn btn-primary full-width">حفظ إعدادات الترتيب</button>'+
      '<p class="form-note" id="leaderboardProfileStatus" role="status"></p>';
    panel.appendChild(form);
    const publicCheck=form.querySelector('#leaderboardVisible');
    const googleCheck=form.querySelector('#leaderboardGooglePublic');
    googleCheck.addEventListener('change',()=>{if(googleCheck.checked)publicCheck.checked=true;});
    publicCheck.addEventListener('change',()=>{if(!publicCheck.checked)googleCheck.checked=false;});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const user=await currentUser();
      if(!user)return;
      const status=form.querySelector('#leaderboardProfileStatus');
      const button=form.querySelector('button[type="submit"]');
      const visible=publicCheck.checked;
      const shareGoogle=visible&&hasGoogle(user)&&googleCheck.checked;
      button.disabled=true;
      try{
        const prev=await supabaseClient.from('leaderboard_profiles')
          .select('nickname').eq('user_id',user.id).maybeSingle();
        if(prev.error)throw prev.error;
        const nickname=prev.data?.nickname||'متسوق'+user.id.replace(/-/g,'').slice(0,14);
        const res=await supabaseClient.from('leaderboard_profiles').upsert({
          user_id:user.id,nickname,public_visible:visible,
          share_google_profile:shareGoogle,updated_at:new Date().toISOString()
        },{onConflict:'user_id'});
        if(res.error)throw res.error;
        status.textContent=!visible?'ترتيبك مخفي عن الزوار.':
          shareGoogle?'تمت الموافقة: اسمك وصورتك من Google يظهروا للزوار بعد وجود مشتريات مكتملة.':
          'ترتيبك ظاهر بدون اسم وصورة Google.';
        await window.loadLeaderboard();
      }catch(error){
        console.warn('Leaderboard preference save failed',error);
        status.textContent='تعذر حفظ الإعدادات، حاول مرة ثانية.';
      }finally{button.disabled=false;}
    });
  }
  const user=await currentUser();
  if(!user){form.classList.add('hidden');return}
  form.classList.remove('hidden');
  const isGoogle=hasGoogle(user);
  const googleCheck=form.querySelector('#leaderboardGooglePublic');
  const note=form.querySelector('#leaderboardProfileStatus');
  googleCheck.disabled=!isGoogle;
  form.querySelector('#leaderboardGoogleConsentWrap').classList.toggle('hidden',!isGoogle);
  const result=await supabaseClient.from('leaderboard_profiles')
    .select('public_visible,share_google_profile').eq('user_id',user.id).maybeSingle();
  if(result.error){
    note.textContent='تعذر قراءة تفضيلاتك. حدّث الصفحة.';
    form.querySelector('button[type="submit"]').disabled=true;
    return;
  }
  form.querySelector('button[type="submit"]').disabled=false;
  form.querySelector('#leaderboardVisible').checked=!!result.data?.public_visible;
  googleCheck.checked=isGoogle&&!!result.data?.public_visible&&!!result.data?.share_google_profile;
};

document.addEventListener('click',function(e){
  if(e.target.closest('#refreshLeaderboard')){
    e.preventDefault();e.stopImmediatePropagation();
    window.loadLeaderboard();
  }
},true);
window.renderLeaderboardProfile();
window.loadLeaderboard();
})();