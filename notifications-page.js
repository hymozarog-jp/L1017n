/* L1017n — Notifications center, showing only real signed-in order activity.
   Read-only: never changes orders, balances, or browser notification settings. */
(function(){
 'use strict';
 let page=null,opener=null,afterClose=null,previousOverflow='';
 const state={filter:'all',rows:[],errors:[],loading:false,serial:0};
 const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function dateTime(raw){
  const d=new Date(raw||'');
  if(Number.isNaN(d.valueOf()))return 'التاريخ غير متوفر';
  try{return new Intl.DateTimeFormat('ar-LY',{timeZone:'Africa/Tripoli',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d)}
  catch(_){return d.toLocaleDateString('ar-LY')}
 }
 function statusOf(row){
  if(row.kind==='topup'){
   if(row.status==='approved')return ['تم الشحن','done'];
   if(row.status==='rejected')return ['مرفوض','error'];
   return ['قيد المراجعة','waiting'];
  }
  if(row.status==='completed')return ['مكتمل','done'];
  if(row.status==='refunded')return ['مسترجع','error'];
  if(row.status==='rejected')return ['مرفوض','error'];
  if(row.status==='paid_pending_fulfillment')return ['مدفوع · بانتظار التنفيذ','waiting'];
  if(row.status==='approved')return ['مقبول','waiting'];
  if(['processing','fulfilling','in_processing','in_progress'].includes(row.status))return ['قيد التنفيذ','waiting'];
  return ['قيد المراجعة','waiting'];
 }
 function label(row){
  if(row.kind==='topup')return 'شحن المحفظة'+(row.method==='libyana'?' · ليبيانا':['madar','almadar'].includes(row.method)?' · المدار':'');
  return String(row.product_name||'طلب شراء');
 }
 function moneyText(row){
  const n=Number(row.kind==='topup'?row.amount:row.total_amount);
  return Number.isFinite(n)&&n>=0?n.toFixed(2)+' د.ل':'';
 }
 function messagesFor(row){
  const product=label(row),amount=moneyText(row);
  if(row.kind==='topup'){
   if(row.status!=='approved')return [];
   return [{kind:'credit',title:'تم تعبئة الرصيد بنجاح',body:amount?
    'تم اعتماد الشحن وإضافة '+amount+' إلى محفظتك.':'تم اعتماد شحن محفظتك بنجاح.',badge:'تم الشحن'}];
  }
  if(row.status==='completed')return [
   {kind:'delivered',title:'تم تسليم طلبك بنجاح',body:'اكتمل تسليم طلب '+product+'.',badge:'تم التسليم'},
   {kind:'accepted',title:'تم قبول طلب الشراء',body:'تم قبول طلب '+product+' وتجهيزه للتسليم.',badge:'تم القبول'}
  ];
  if(['approved','processing','fulfilling','in_progress','in_processing'].includes(row.status)){
   return [{kind:'accepted',title:'تم قبول طلب الشراء',body:'تم قبول طلب '+product+' وهو قيد التجهيز.',badge:'تم القبول'}];
  }
  return [];
 }
 function messageHtml(row,message){
  const icon=message.kind==='credit'
   ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v13m0 0-5-5m5 5 5-5"/><path d="M4 19h16"/></svg>'
   :message.kind==='delivered'
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4 10-10"/><circle cx="12" cy="12" r="10"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/><path d="M4 6h6"/></svg>';
  return '<article class="np-activity-item np-event np-event-'+message.kind+'">'+
   '<span class="np-activity-icon" aria-hidden="true">'+icon+'</span>'+
   '<div class="np-activity-copy"><strong>'+safe(message.title)+'</strong>'+
   '<small class="np-event-body">'+safe(message.body)+'</small>'+
   '<small class="np-event-date">تاريخ الطلب: '+safe(dateTime(row.created_at))+'</small></div>'+
   '<span class="np-status done">'+safe(message.badge)+'</span></article>';
 }
 function itemHtml(row){
  const [status,kind]=statusOf(row);
  const val=Number(row.kind==='topup'?row.amount:row.total_amount);
  const amount=Number.isFinite(val)&&val>=0?val.toFixed(2)+' د.ل':'';
  const icon=row.kind==='topup'
   ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v13m0 0-5-5m5 5 5-5"/><path d="M4 19h16"/></svg>'
   :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h2l2 11h12l2-8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
  return '<article class="np-activity-item '+safe(row.kind)+'">'+
    '<span class="np-activity-icon" aria-hidden="true">'+icon+'</span>'+
    '<div class="np-activity-copy"><strong>'+safe(label(row))+'</strong><small>'+
    safe(dateTime(row.created_at))+(amount?' <span aria-hidden="true">·</span> '+safe(amount):'')+
    '</small></div><span class="np-status '+kind+'">'+safe(status)+'</span></article>';
 }
 function render(){
  if(!page)return;
  page.querySelectorAll('[data-np-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.npFilter===state.filter)));
  const list=page.querySelector('#npActivityList'),status=page.querySelector('#npLoadStatus');
  const rows=state.rows.filter(x=>state.filter==='all'||x.kind===state.filter);
  if(state.loading){
   status.dataset.mode='loading';status.textContent='جاري تحميل نشاط حسابك…';
   list.innerHTML='<div class="np-skeleton" aria-hidden="true"></div><div class="np-skeleton" aria-hidden="true"></div>';
   return;
  }
  if(state.errors.length===2){
   status.dataset.mode='error';status.textContent='تعذر تحميل نشاط حسابك. اضغط تحديث للمحاولة مرة ثانية.';
   list.replaceChildren();return;
  }
  status.dataset.mode=state.errors.length?'error':'ready';
  status.textContent=state.errors.length?'تعذر تحميل بعض العمليات. اضغط تحديث للمحاولة مرة ثانية.':'';
  if(rows.length){
   list.innerHTML=rows.flatMap(row=>{
    const messages=messagesFor(row);
    return messages.length?messages.map(msg=>messageHtml(row,msg)):[itemHtml(row)];
   }).join('');
   return;
  }
  list.innerHTML='<div class="np-empty">'+
   '<div class="np-empty-art" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/></svg></div>'+
   '<strong>لا توجد عمليات في هذا القسم</strong>'+
   '<p>لما تسجل عملية شحن أو شراء، بتظهر هنا بحالتها المسجلة.</p></div>';
 }
 async function refresh(){
  if(!page)return;
  const serial=++state.serial;
  state.loading=true;state.errors=[];render();
  try{
   const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
   if(!client)throw Error('Account service unavailable');
   const {data:auth,error:authError}=await client.auth.getUser();
   if(serial!==state.serial)return;
   if(authError||!auth?.user){
    state.loading=false;state.rows=[];state.errors=['topup','purchase'];
    page.querySelector('#npLoadStatus').textContent='سجّل دخولك لعرض نشاط حسابك.';
    page.querySelector('#npLoadStatus').dataset.mode='error';
    page.querySelector('#npActivityList').replaceChildren();return;
   }
   const id=auth.user.id;
   syncNoticeUser(id);
   const [topups,purchases]=await Promise.all([
    client.from('topup_requests').select('id,amount,method,status,created_at')
     .eq('user_id',id).order('created_at',{ascending:false}).limit(12),
    client.from('purchase_orders').select('id,product_name,total_amount,status,created_at')
     .eq('user_id',id).order('created_at',{ascending:false}).limit(12)
   ]);
   if(serial!==state.serial)return;
   state.errors=[];
   if(topups.error)state.errors.push('topup');
   if(purchases.error)state.errors.push('purchase');
   state.rows=[
    ...(topups.error?[]:(topups.data||[])).map(x=>({...x,kind:'topup'})),
    ...(purchases.error?[]:(purchases.data||[])).map(x=>({...x,kind:'purchase'}))
   ].sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)).slice(0,12);
   // Only mark alerts read after we successfully show both sources.
   if(!topups.error&&!purchases.error)clearUnreadForUser(id);
   state.loading=false;render();
  }catch(e){
   if(serial!==state.serial)return;
   state.loading=false;state.rows=[];state.errors=['topup','purchase'];render();
   console.warn('[notifications] Could not read customer order activity',e);
  }
 }
 // In-app status messages: compare real server snapshots while the store is open.
 // Persist a minimal status baseline per signed-in user, so an update noticed on
 // the next visit can still earn a badge. The first snapshot never fakes alerts.
 const NOTICE_STORE_PREFIX='l1017-notice-badge-v1:';
 let observedUser='',observed=new Map(),watchBusy=false,unreadEventKeys=[];
 function badgeCount(){return unreadEventKeys.length}
 function paintUnreadBadge(){
  const bell=document.getElementById('headerNotificationBell');
  const badge=document.getElementById('headerNotificationCount');
  const count=observedUser?badgeCount():0;
  if(badge){
   badge.hidden=count===0;
   badge.textContent=count?String(Math.min(count,9))+(count>9?'+':''):'';
  }
  if(bell){
   const name=count?'الإشعارات والتنبيهات، '+count+' جديدة':'الإشعارات والتنبيهات';
   if(bell.getAttribute('aria-label')!==name)bell.setAttribute('aria-label',name);
   bell.title=name;
  }
 }
 function storeNoticeState(){
  if(!observedUser)return;
  try{
   localStorage.setItem(NOTICE_STORE_PREFIX+observedUser,JSON.stringify({
    seen:[...observed.entries()].slice(0,80),
    unread:unreadEventKeys.slice(-50)
   }));
  }catch(_){/* Private browsing or disabled storage: in-memory works. */}
 }
 function syncNoticeUser(userId){
  if(!userId)return;
  if(observedUser===userId){paintUnreadBadge();return}
  observedUser=userId;observed=new Map();unreadEventKeys=[];toastQueue=[];
  try{
   const state=JSON.parse(localStorage.getItem(NOTICE_STORE_PREFIX+userId)||'null');
   if(Array.isArray(state?.seen)){
    observed=new Map(state.seen.filter(x=>Array.isArray(x)&&x.length===2&&
      typeof x[0]==='string'&&typeof x[1]==='string').slice(0,80));
   }
   if(Array.isArray(state?.unread)){
    unreadEventKeys=[...new Set(state.unread.filter(x=>typeof x==='string'&&x.length<180))].slice(-50);
   }
  }catch(_){/* Corrupt/blocked local storage should never stop the store. */}
  paintUnreadBadge();
 }
 function addUnreadEvent(key){
  if(!key||unreadEventKeys.includes(key))return;
  unreadEventKeys.push(key);
  unreadEventKeys=unreadEventKeys.slice(-50);
 }
 function clearUnreadForUser(userId){
  if(!userId)return;
  syncNoticeUser(userId);
  if(unreadEventKeys.length){unreadEventKeys=[];storeNoticeState()}
  paintUnreadBadge();
 }
 let toastQueue=[],toastBusy=false,toastTimer=0;
 function showNextToast(){
  if(toastBusy||!toastQueue.length)return;
  const next=toastQueue.shift();
  if(!next||next.userId!==observedUser){showNextToast();return;}
  toastBusy=true;
  let node=document.getElementById('l1017StatusToast');
  if(!node){
   node=document.createElement('div');
   node.id='l1017StatusToast';
   node.className='np-live-toast';
   node.setAttribute('role','status');
   node.setAttribute('aria-live','polite');
   document.body.appendChild(node);
  }
  node.className='np-live-toast type-'+next.message.kind;
  node.innerHTML='<span class="np-live-toast-icon" aria-hidden="true">✓</span>'+
   '<span class="np-live-toast-copy"><strong>'+safe(next.message.title)+'</strong>'+
   '<small>'+safe(next.message.body)+'</small></span>';
  window.requestAnimationFrame(()=>node.classList.add('visible'));
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
   node.classList.remove('visible');
   toastTimer=setTimeout(()=>{toastBusy=false;showNextToast()},350);
  },5200);
 }
 function resetObserved(){
  observedUser='';observed=new Map();unreadEventKeys=[];toastQueue=[];
  paintUnreadBadge();
  clearTimeout(toastTimer);toastBusy=false;
  document.getElementById('l1017StatusToast')?.remove();
 }
 async function watchOrderStatuses(){
  if(watchBusy||document.visibilityState==='hidden')return;
  const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
  if(!client)return;
  watchBusy=true;
  try{
   const {data:auth,error:authError}=await client.auth.getUser();
   if(authError)return;
   const userId=auth?.user?.id||'';
   if(!userId){resetObserved();return;}
   syncNoticeUser(userId);
   const [topups,purchases]=await Promise.all([
    client.from('topup_requests').select('id,amount,method,status,created_at')
     .eq('user_id',userId).order('created_at',{ascending:false}).limit(30),
    client.from('purchase_orders').select('id,product_name,total_amount,status,created_at')
     .eq('user_id',userId).order('created_at',{ascending:false}).limit(30)
   ]);
   // Do not announce or advance baselines if either source failed.
   if(topups.error||purchases.error||observedUser!==userId)return;
   const all=[
    ...(topups.data||[]).map(x=>({...x,kind:'topup'})),
    ...(purchases.data||[]).map(x=>({...x,kind:'purchase'}))
   ].sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
   const next=new Map();
   const updates=[];
   const accepted=new Set(['approved','processing','fulfilling','in_progress','in_processing','completed']);
   for(const item of all){
    const key=item.kind+':'+item.id;
    const now=String(item.status||'');
    next.set(key,now);
    if(observedUser!==userId||!observed.has(key))continue;
    const was=observed.get(key);
    if(was===now)continue;
    const messages=messagesFor(item);
    if(item.kind==='topup'&&now==='approved'&&was!=='approved'){
     if(messages[0])updates.push({message:messages[0],userId,eventKey:key+':credit'});
    }else if(item.kind==='purchase'&&now==='completed'&&was!=='completed'){
     const delivered=messages.find(x=>x.kind==='delivered');
     if(delivered)updates.push({message:delivered,userId,eventKey:key+':delivered'});
    }else if(item.kind==='purchase'&&accepted.has(now)&&!accepted.has(was)){
     const approved=messages.find(x=>x.kind==='accepted');
     if(approved)updates.push({message:approved,userId,eventKey:key+':accepted'});
    }
   }
   observed=next;
   if(page)clearUnreadForUser(userId);
   else updates.forEach(item=>addUnreadEvent(item.eventKey));
   storeNoticeState();
   paintUnreadBadge();
   if(page&&!state.loading){
    state.rows=all.slice(0,12);state.errors=[];
    render();
   }
   // Avoid flooding the screen if many old records were updated together.
   toastQueue.push(...updates.slice(0,3));
   showNextToast();
  }catch(e){
   console.warn('[notifications] Status polling failed',e);
  }finally{watchBusy=false;}
 }
 // Browser tab only: this is not background push delivery when the site is closed.
 setInterval(()=>{void watchOrderStatuses()},30000);
 window.addEventListener('focus',()=>{void watchOrderStatuses()});
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')void watchOrderStatuses();
 });
 setTimeout(()=>{void watchOrderStatuses()},1500);
 // This is a presentation-only count, scoped to the currently logged-in user.
 // The verified order queries above remain the sole source of new events.
 window.L1017nNotifications={syncUser(user){
  if(user?.id)syncNoticeUser(user.id);
  else resetObserved();
 }};
 function remove(){
  if(!page)return;
  state.serial++;
  page.close();page.remove();page=null;
  document.body.style.overflow=previousOverflow;
  if(opener?.isConnected)opener.focus({preventScroll:true});
  const next=afterClose;afterClose=null;if(next)next();
 }
 function close(next){
  afterClose=next||null;
  if(history.state?.l1017nNotificationsPage)history.back();else remove();
 }
 function navigateOrders(){
  close(()=>{
   const nav=document.querySelector('#llBottomNav [data-ll-nav="orders"]')||
     document.querySelector('.topbar [data-view="orders"]')||
     document.querySelector('.mobile-nav [data-view="orders"]');
   nav?.click();
  });
 }
 function navigateHistory(){
  close(()=>{
   if(window.L1017nAccountHistory?.open)window.L1017nAccountHistory.open();
   else document.querySelector('[data-account-action="history"]')?.click();
  });
 }
 function open(button){
  if(page)return;
  opener=button||document.activeElement;
  state.filter='all';state.rows=[];state.errors=[];state.loading=true;
  page=document.createElement('dialog');page.id='notificationsPage';page.dir='rtl';
  page.setAttribute('aria-labelledby','notificationsPageTitle');
  page.innerHTML=[
   '<div class="np-shell">',
    '<header class="np-header">',
     '<button type="button" class="np-back" aria-label="الرجوع"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>',
     '<div class="np-heading"><span>حسابي</span><h1 id="notificationsPageTitle" tabindex="-1">الإشعارات والتنبيهات</h1></div>',
     '<button type="button" class="np-refresh" aria-label="تحديث النشاط" title="تحديث النشاط"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2"/></svg></button>',
    '</header>',
    '<section class="np-hero" aria-label="مركز نشاط حسابك">',
     '<div class="np-hero-glow" aria-hidden="true"></div>',
     '<div class="np-hero-top"><span class="np-eyebrow"><i></i> مركز النشاط</span><span class="np-brand">L1017n</span></div>',
     '<div class="np-hero-body"><div class="np-hero-copy"><h2>كل جديد يخص<br><span>حسابك هنا.</span></h2><p>تابع حالة شحن المحفظة وطلبات الشراء.</p></div>',
     '<div class="np-bell-art" aria-hidden="true"><div class="np-bell-orbit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></div></div></div>',
    '</section>',
    '<section class="np-activity" aria-labelledby="npActivityTitle">',
     '<div class="np-section-heading"><h2 id="npActivityTitle">آخر نشاط حسابك</h2><small>حالة العمليات المسجلة</small></div>',
     '<div class="np-tabs" role="group" aria-label="تصفية نشاط الحساب">',
      '<button type="button" data-np-filter="all" aria-pressed="true">الكل</button>',
      '<button type="button" data-np-filter="purchase" aria-pressed="false">المشتريات</button>',
      '<button type="button" data-np-filter="topup" aria-pressed="false">الشحن</button>',
     '</div>',
     '<p class="np-load-status" id="npLoadStatus" role="status" aria-live="polite"></p>',
     '<div id="npActivityList" class="np-activity-list"></div>',
    '</section>',
    '<section class="np-shortcuts" aria-label="اختصارات الحساب"><h2>وصول سريع</h2>',
     '<button type="button" class="np-shortcut np-orders"><span class="np-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></span><span class="np-shortcut-copy"><b>طلباتي</b><small>متابعة الطلبات والتسليم</small></span><span class="np-shortcut-arrow" aria-hidden="true">‹</span></button>',
     '<button type="button" class="np-shortcut np-history"><span class="np-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 13h5M7 16h3"/></svg></span><span class="np-shortcut-copy"><b>سجل الشحن والمدفوعات</b><small>مراجعة معاملاتك المالية</small></span><span class="np-shortcut-arrow" aria-hidden="true">‹</span></button>',
    '</section>',
    '<p class="np-footnote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></svg> هذه حالات طلبات من حسابك وليست إشعارات فورية. إشعارات الهاتف غير متاحة حاليًا.</p>',
   '</div>'
  ].join('');
  page.querySelector('.np-back').addEventListener('click',()=>close());
  page.querySelector('.np-refresh').addEventListener('click',refresh);
  page.querySelector('.np-orders').addEventListener('click',navigateOrders);
  page.querySelector('.np-history').addEventListener('click',navigateHistory);
  page.querySelectorAll('[data-np-filter]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.npFilter;render()}));
  page.addEventListener('cancel',e=>{e.preventDefault();close()});
  document.body.appendChild(page);
  previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  history.pushState({...history.state,l1017nNotificationsPage:true},'');
  page.showModal();page.querySelector('.np-back').focus({preventScroll:true});
  void refresh();
 }
 window.addEventListener('popstate',()=>{if(page&&!history.state?.l1017nNotificationsPage)remove()});
 document.addEventListener('click',e=>{
  const button=e.target.closest('[data-account-action="notifications"]');if(!button)return;
  e.preventDefault();e.stopImmediatePropagation();
  document.getElementById('accountSettingsDetail')?.classList.add('hidden');open(button);
 },true);
})();
