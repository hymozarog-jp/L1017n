/* L1017n leaderboard tabs and mutual friends, with no demo accounts.
   Access is through authenticated Supabase RPCs; profile visibility stays opt-in. */
(function(){
  'use strict';

  function make(tag,cls,value){
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(value!==undefined)el.textContent=String(value);
    return el;
  }
  function api(){return typeof supabaseClient!=='undefined'?supabaseClient:null}
  function setup(){
    const page=document.getElementById('leaderboardView');
    const toolbar=page?.querySelector('.l1017-rank-toolbar');
    if(!page||!toolbar||page.dataset.friendsTabsMounted==='1')return;
    page.dataset.friendsTabsMounted='1';
    page.dataset.rankMode='general';
    const tabs=make('div','l1017-leaderboard-tabs');
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','اختر نوع التصنيف');
    const publicButton=make('button','l1017-ranking-tab is-active','العامة');
    publicButton.type='button';publicButton.dataset.rankTab='general';
    publicButton.setAttribute('role','tab');publicButton.setAttribute('aria-selected','true');
    publicButton.setAttribute('aria-controls','leaderboardList');
    const friendsButton=make('button','l1017-ranking-tab','الأصدقاء');
    friendsButton.type='button';friendsButton.dataset.rankTab='friends';
    friendsButton.setAttribute('role','tab');friendsButton.setAttribute('aria-selected','false');
    friendsButton.setAttribute('aria-controls','leaderboardList');
    tabs.append(publicButton,friendsButton);

    const panel=make('section','l1017-friends-panel');
    panel.id='l1017RankFriendsPanel';
    panel.setAttribute('aria-label','إدارة أصدقاء المتجر');
    panel.hidden=true;
    const head=make('div','l1017-friends-head');
    const headText=make('div');
    headText.append(make('h2','', 'أصدقاء المتجر'),make('p','','أضف صديقك بالكود، وبعد موافقته يظهر في ترتيب الأصدقاء إذا كان مشاركًا في التصنيف.'));
    const count=make('span','l1017-friends-count','0 أصدقاء');
    head.append(headText,count);
    const guest=make('p','l1017-friends-guest','');
    guest.hidden=true;
    const codeBox=make('div','l1017-friend-code-box');
    const label=make('span','l1017-friend-code-label','كود الصداقة الخاص بك');
    const code=make('strong','l1017-friend-code','--------');
    code.dir='ltr';
    const copy=make('button','l1017-friend-copy','نسخ');
    copy.type='button';copy.disabled=true;
    codeBox.append(label,code,copy);
    const form=make('form','l1017-add-friend-form');
    const addLabel=make('label','', 'إضافة صديق بالكود');
    addLabel.htmlFor='l1017FriendCodeInput';
    const inputRow=make('div','l1017-friend-entry-row');
    const input=make('input','l1017-friend-entry');
    input.id='l1017FriendCodeInput';input.name='friendCode';input.type='text';
    input.placeholder='أدخل كود الصديق (8 رموز)';input.required=true;
    input.minLength=8;input.maxLength=8;input.pattern='[A-Fa-f0-9]{8}';
    input.autocomplete='off';input.spellcheck=false;input.dir='ltr';
    const send=make('button','l1017-friend-add','إرسال الطلب');
    send.type='submit';
    inputRow.append(input,send);
    form.append(addLabel,inputRow);
    const feedback=make('p','l1017-friends-message','');
    feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const list=make('div','l1017-friends-links');
    list.setAttribute('aria-live','polite');
    panel.append(head,guest,codeBox,form,feedback,list);

    toolbar.insertAdjacentElement('afterend',tabs);
    tabs.insertAdjacentElement('afterend',panel);

    let activeCode='';
    let seq=0;
    let loading=false;
    function message(text,isError){
      feedback.textContent=text||'';
      feedback.classList.toggle('is-error',!!isError);
    }
    function visibleMode(){return page.dataset.rankMode==='friends'}
    function renderLinks(rows){
      list.replaceChildren();
      const friends=rows.filter(x=>x.direction==='friend');
      const incoming=rows.filter(x=>x.direction==='incoming');
      const outgoing=rows.filter(x=>x.direction==='outgoing');
      count.textContent=friends.length+' أصدقاء';
      if(!rows.length){
        list.appendChild(make('p','l1017-friends-empty','ما عندك أصدقاء حتى الآن. شارك كودك مع صديق وخلّيه يرسل لك طلب.'));
        return;
      }
      const groups=[
        {title:'طلبات الصداقة الواردة',items:incoming},
        {title:'أصدقاؤك',items:friends},
        {title:'الطلبات المرسلة',items:outgoing}
      ];
      groups.forEach(group=>{
        if(!group.items.length)return;
        const box=make('section','l1017-friend-group');
        box.appendChild(make('h3','',group.title));
        group.items.forEach(link=>{
          const row=make('div','l1017-friend-row');
          const info=make('div','l1017-friend-info');
          info.append(
            make('strong','l1017-friend-name',String(link.display_name||'متسوق').slice(0,48)),
            make('small','l1017-friend-code-short','الكود: '+String(link.friend_code||'').slice(0,8))
          );
          const actions=make('div','l1017-friend-actions');
          const button=(label,action,cls)=>{
            const b=make('button','l1017-friend-action '+cls,label);
            b.type='button';b.dataset.friendAction=action;b.dataset.linkId=String(link.link_id||'');
            b.addEventListener('click',()=>void act(b,action,link));
            actions.appendChild(b);
          };
          if(link.direction==='incoming'){
            button('قبول','accept','is-accept');button('رفض','decline','is-muted');
          }else if(link.direction==='outgoing'){
            button('إلغاء الطلب','remove','is-muted');
          }else{
            button('إزالة','remove','is-muted');
          }
          row.append(info,actions);
          box.appendChild(row);
        });
        list.appendChild(box);
      });
    }
    async function refreshFriends(){
      if(!visibleMode()||loading)return;
      const client=api();
      const current=++seq;
      if(!client){message('تعذر تحميل الاتصال بالمتجر. حدّث الصفحة.',true);return;}
      loading=true;
      try{
        const {data:auth,error:authError}=await client.auth.getUser();
        if(current!==seq||!visibleMode())return;
        const signed=!!auth?.user&&!authError;
        guest.hidden=signed;
        codeBox.hidden=!signed;form.hidden=!signed;list.hidden=!signed;
        if(!signed){
          guest.textContent='سجّل دخولك أولًا لإضافة أصدقائك ومشاهدة ترتيبهم.';
          list.replaceChildren();count.textContent='0 أصدقاء';return;
        }
        const [codeResult,linksResult]=await Promise.all([
          client.rpc('get_my_store_friend_code'),
          client.rpc('get_my_store_friend_links')
        ]);
        if(codeResult.error)throw codeResult.error;
        if(linksResult.error)throw linksResult.error;
        if(current!==seq||!visibleMode())return;
        activeCode=String(codeResult.data||'');
        code.textContent=activeCode||'--------';copy.disabled=!activeCode;
        renderLinks(Array.isArray(linksResult.data)?linksResult.data:[]);
      }catch(err){
        console.warn('[ranking/friends] Fetch failed',err?.message||'unknown');
        message('تعذر تحميل الأصدقاء. حاول التحديث.',true);
      }finally{loading=false}
    }
    async function act(button,action,link){
      const client=api();if(!client||button.disabled)return;
      if(action==='remove'&&link.direction==='friend'&&!window.confirm('تبي تحذف هذا الصديق من قائمتك؟'))return;
      const actions=button.parentNode;
      actions?.querySelectorAll('button').forEach(b=>{b.disabled=true});
      message('جاري حفظ التغيير…');
      try{
        const args=action==='remove'
          ?['remove_store_friend_link',{p_link_id:link.link_id}]
          :['respond_store_friend_request',{p_request_id:link.link_id,p_accept:action==='accept'}];
        const result=await client.rpc(args[0],args[1]);
        if(result.error)throw result.error;
        message(action==='accept'?'تم قبول طلب الصداقة.':action==='decline'?'تم رفض الطلب.':'تم حذف الطلب أو الصداقة.');
        await refreshFriends();
        if(visibleMode()&&typeof window.loadLeaderboard==='function')void window.loadLeaderboard();
      }catch(err){
        console.warn('[ranking/friends] Action failed',err?.message||'unknown');
        message('تعذر تنفيذ العملية. جرّب مرة ثانية.',true);
        actions?.querySelectorAll('button').forEach(b=>{b.disabled=false});
      }
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const client=api();if(!client)return;
      const value=input.value.trim().toUpperCase();
      if(!/^[A-F0-9]{8}$/.test(value)){
        message('اكتب كودًا صحيحًا مكونًا من 8 رموز.',true);return;
      }
      send.disabled=true;
      message('جاري إرسال طلب الصداقة…');
      try{
        const result=await client.rpc('send_store_friend_request',{p_code:value});
        if(result.error)throw result.error;
        const phrases={
          request_sent:'تم إرسال طلب الصداقة. يظهر في ترتيبك بعد قبول الصديق.',
          already_sent:'سبق وأرسلت طلبًا لهذا الحساب.',
          already_friends:'هذا الحساب موجود في قائمة أصدقائك.',
          friends_connected:'تم قبول طلب الصداقة المتبادل، وصرتوا أصدقاء.'
        };
        message(phrases[result.data]||'تم إرسال الطلب بنجاح.');
        input.value='';
        await refreshFriends();
        if(visibleMode()&&typeof window.loadLeaderboard==='function')void window.loadLeaderboard();
      }catch(err){
        const reason=String(err?.message||'');
        message(/friend_code_not_found/.test(reason)?'ما لقيناش حسابًا بهذا الكود. تأكد من كود الصديق.':
          /cannot_add_self/.test(reason)?'ما تقدر تضيف حسابك لنفسك.':
          /too_many_pending_requests/.test(reason)?'عندك طلبات كثيرة بانتظار الموافقة.':
          'تعذر إرسال طلب الصداقة. حاول مرة ثانية.',true);
      }finally{send.disabled=false}
    });
    copy.addEventListener('click',async()=>{
      if(!activeCode)return;
      try{
        if(!navigator.clipboard?.writeText)throw Error('clipboard_unavailable');
        await navigator.clipboard.writeText(activeCode);
        message('تم نسخ كودك. تقدر ترسله لصديقك.');
      }catch(_){
        window.prompt('انسخ كود الصداقة:',activeCode);
      }
    });
    function switchTab(mode){
      const friends=mode==='friends';
      page.dataset.rankMode=friends?'friends':'general';
      publicButton.classList.toggle('is-active',!friends);
      friendsButton.classList.toggle('is-active',friends);
      publicButton.setAttribute('aria-selected',String(!friends));
      friendsButton.setAttribute('aria-selected',String(friends));
      panel.hidden=!friends;
      if(friends){
        message('');
        void refreshFriends();
      }
      if(typeof window.loadLeaderboard==='function')void window.loadLeaderboard();
    }
    publicButton.addEventListener('click',()=>{if(visibleMode())switchTab('general')});
    friendsButton.addEventListener('click',()=>{if(!visibleMode())switchTab('friends')});
    tabs.addEventListener('keydown',e=>{
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
      e.preventDefault();
      const target=e.key==='ArrowLeft'?'friends':'general';
      switchTab(target);
      (target==='friends'?friendsButton:publicButton).focus();
    });
    toolbar.querySelector('#l1017RankRefresh')?.addEventListener('click',()=>{
      if(visibleMode())void refreshFriends();
    });
    page.addEventListener('click',e=>{
      if(e.target.closest('[data-view="account"]'))page.dataset.rankMode='general';
    });
    window.addEventListener('focus',()=>{if(visibleMode()&&!document.hidden)void refreshFriends()});
    document.addEventListener('visibilitychange',()=>{if(visibleMode()&&!document.hidden)void refreshFriends()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
