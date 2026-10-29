(function(){
'use strict';
/* Google leaderboard: public rankings, explicit consent for name/photo. */

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


function formatDinar(amount) {
  return Number(amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function publicName(item,rank){
  return String(item?.display_name||'').trim()||('متسوق المركز '+rank);
}
function attachImage(container,url,alt){
  const safe=photoUrl(url);
  if(!safe)return;
  const img=document.createElement('img');
  img.src=safe;
  img.alt=alt||'صورة Google';
  img.loading='lazy';
  img.referrerPolicy='no-referrer';
  img.onerror=()=>img.remove();
  container.appendChild(img);
}
function makePodiumCard(item,rank){
  const style=rank===1?'lb-first':rank===2?'lb-second':'lb-third';
  const card=node('div','lb-podium-card '+style+(item?'':' lb-empty'));
  const avatar=node('div','lb-podium-avatar');
  avatar.appendChild(node('span','',item?'👤':'♙'));
  if(item)attachImage(avatar,item.avatar_url,'صورة المتسوق');
  avatar.appendChild(node('span','lb-podium-medal',String(rank)));
  card.appendChild(avatar);
  card.appendChild(node('strong','lb-podium-name',item?publicName(item,rank):'المركز متاح'));
  card.appendChild(node('div','lb-podium-amount',item?formatDinar(item.points):'—'));
  card.appendChild(node('small','',item?'د.ل من مشتريات مكتملة':'بانتظار متسوق'));
  return card;
}
function makeOtherRow(item,rank){
  const row=node('div','lb-other-row');
  row.appendChild(node('span','lb-other-position',String(rank)));
  const avatar=node('span','lb-other-avatar','👤');
  attachImage(avatar,item.avatar_url,'صورة المتسوق');
  row.appendChild(avatar);
  row.appendChild(node('span','lb-other-name',publicName(item,rank)));
  const money=node('strong','lb-other-amount',formatDinar(item.points));
  money.appendChild(node('small','','د.ل'));
  row.appendChild(money);
  return row;
}
async function renderOwnRank(){
  const root=document.getElementById('lbMyRank');
  if(!root)return;
  const user=await currentUser();
  if(!user){root.classList.add('hidden');root.replaceChildren();return}
  const meta=user.user_metadata||{};
  const realName=String(meta.full_name||meta.name||meta.given_name||user.email?.split('@')[0]||'متسوق').trim();
  const {data,error}=await supabaseClient.rpc('get_my_store_leaderboard_rank');
  const own=(!error&&Array.isArray(data))?data[0]:null;
  if(error)console.warn('Personal rank unavailable',error);
  const rank=Number(own?.my_rank)||0;
  const spent=Math.max(Number(own?.my_spend)||0,0);
  const gap=Number(own?.gap_to_next)||0;
  const participating=!!own?.participating;
  const top=node('div','lb-self-top');
  const who=node('div','lb-self-user');
  const avatar=node('span','lb-self-avatar',realName.slice(0,1).toUpperCase());
  attachImage(avatar,meta.avatar_url||meta.picture,'صورتك في Google');
  who.appendChild(avatar);
  const whoText=node('span','lb-self-name');
  whoText.appendChild(node('strong','',realName));
  whoText.appendChild(node('small','','بطاقة ترتيبك الشخصية'));
  who.appendChild(whoText);
  top.appendChild(who);
  const total=node('div','lb-self-spend');
  total.appendChild(node('small','','إجمالي مشترياتك المكتملة'));
  total.appendChild(node('strong','',formatDinar(spent)+' د.ل'));
  top.appendChild(total);
  const position=node('div','lb-self-position');
  position.appendChild(node('small','','ترتيبك'));
  position.appendChild(node('strong','',rank?'#'+rank:'—'));
  top.appendChild(position);
  root.replaceChildren(top);
  const track=node('div','lb-progress-track');
  const fill=document.createElement('span');
  let progress=0,message='';
  if(rank===1){progress=100;message='أنت المتصدر حاليًا 🏆'}
  else if(rank>1){progress=Math.min(99,Math.round(100*spent/Math.max(spent+gap,0.01)));message='باقي لك '+formatDinar(gap+0.01)+' د.ل لتتقدم إلى المركز #'+(rank-1);}
  else if(!participating){message='فعّل المشاركة في التصنيف من الخيارات الموجودة تحت بطاقتك.'}
  else{message='أول ما تكمل عملية شراء، يبدأ يظهر ترتيبك بين المتسوقين.'}
  fill.style.width=progress+'%';
  track.appendChild(fill);
  root.appendChild(track);
  root.appendChild(node('p','lb-progress-caption',message));
  root.classList.remove('hidden');
}
window.loadLeaderboard=async function(){
  const host=document.getElementById('leaderboardList');
  if(!host)return;
  host.replaceChildren(node('p','lb-empty-message','جاري تحميل الترتيب…'));
  // Personal summary is private to the logged-in shopper.
  renderOwnRank().catch(err=>console.warn('Could not show personal rank',err));
  try{
    const result=await supabaseClient.rpc('get_store_leaderboard_with_google');
    if(result.error)throw result.error;
    const data=Array.isArray(result.data)?result.data:[];
    const shell=node('div','lb-results');
    const podium=node('div','lb-podium');
    [2,1,3].forEach(rank=>podium.appendChild(makePodiumCard(data.find(item=>Number(item.rank)===rank),rank)));
    shell.appendChild(podium);
    const header=node('div','lb-section-label');
    const label=node('h2','','☷ باقي المتصدرين');
    const count=node('small','',''+data.length+' مشارك في التصنيف');
    header.append(label,count);
    shell.appendChild(header);
    const remaining=data.filter(item=>Number(item.rank)>3);
    if(remaining.length){
      const rows=node('div','lb-other-rows');
      remaining.forEach(item=>rows.appendChild(makeOtherRow(item,Number(item.rank))));
      shell.appendChild(rows);
    }else{
      shell.appendChild(node('p','lb-empty-message',data.length?'المراكز التالية تظهر مع زيادة المتسوقين المشاركين.':'ما فيش مشتريات مكتملة لمشاركين في التصنيف حتى الآن.'));
    }
    host.replaceChildren(shell);
  }catch(err){
    console.warn('Cannot load public ranking',err);
    host.replaceChildren(node('p','lb-empty-message','تعذر تحميل التصنيف حالياً. حاول تحديث الصفحة.'));
  }
};

window.renderLeaderboardProfile=async function(){
  const panel=document.getElementById('leaderboardParticipation');
  if(!panel)return;
  // Older versions rendered these settings in "حسابي"; remove that copy.
  const obsolete=document.querySelector('.account-panel #leaderboardProfileForm');
  if(obsolete)obsolete.remove();
  let guest=document.getElementById('leaderboardParticipationGuest');
  if(!guest){
    guest=document.createElement('div');
    guest.id='leaderboardParticipationGuest';
    guest.className='leaderboard-participation-guest hidden';
    guest.innerHTML='<strong>تبي تظهر في التصنيف؟ 🏆</strong>'+
      '<p>سجّل دخولك باش تتحكم في ظهور اسمك وصورتك من Google في الترتيب.</p>'+
      '<button type="button" class="btn btn-primary" data-view="account">تسجيل الدخول</button>';
    panel.appendChild(guest);
  }
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
  if(!user){
    form.classList.add('hidden');
    guest.classList.remove('hidden');
    return;
  }
  guest.classList.add('hidden');
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

supabaseClient.auth.onAuthStateChange(function(event){
  if(['SIGNED_IN','SIGNED_OUT','INITIAL_SESSION','USER_UPDATED'].includes(event)){
    setTimeout(function(){
      window.renderLeaderboardProfile();
      window.loadLeaderboard();
    },0);
  }
});

document.addEventListener('click',function(e){
  if(e.target.closest('[data-view="leaderboard"]')){
    setTimeout(function(){window.renderLeaderboardProfile();},0);
  }
  if(e.target.closest('#refreshLeaderboard')){
    e.preventDefault();e.stopImmediatePropagation();
    window.loadLeaderboard();
  }
},true);
window.renderLeaderboardProfile();
window.loadLeaderboard();
})();