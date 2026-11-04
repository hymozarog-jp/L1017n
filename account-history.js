/* L1017n — signed-in account top-up & purchase history.
   Read-only: never credits wallets, sends purchases, or changes order state. */
(function(){
  'use strict';
  const pageId='l1017AccountHistory';
  const limit=50;
  const state={filter:'all',topups:[],purchases:[],errors:[],serial:0,authSubscribed:false};

  const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function money(value){
    const n=Number(value);
    return value==null||!Number.isFinite(n)||n<0?'—':n.toFixed(2);
  }
  function dateTime(value){
    if(!value)return 'غير متوفر';
    const date=new Date(value);
    if(Number.isNaN(date.valueOf()))return 'غير متوفر';
    try{return new Intl.DateTimeFormat('ar-LY',{timeZone:'Africa/Tripoli',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date)}
    catch(_){return date.toLocaleString('ar-LY')}
  }
  function stateOf(item){
    if(item.kind==='topup'){
      if(item.status==='approved')return ['تم الشحن','complete'];
      if(item.status==='rejected')return ['مرفوض','rejected'];
      return ['قيد المراجعة','pending'];
    }
    if(item.status==='completed')return ['مكتمل','complete'];
    if(item.status==='refunded')return ['مسترجع','rejected'];
    if(item.status==='rejected')return ['مرفوض','rejected'];
    if(item.status==='paid_pending_fulfillment')return ['مدفوع · بانتظار التنفيذ','pending'];
    if(item.status==='approved')return ['تم قبول الطلب','pending'];
    if(item.status==='processing'||item.status==='fulfilling')return ['قيد التنفيذ','pending'];
    return ['قيد المراجعة','pending'];
  }
  function labelFor(item){
    if(item.kind==='topup'){
      return 'شحن المحفظة · '+(item.method==='libyana'?'ليبيانا':['madar','almadar'].includes(item.method)?'المدار الجديد':'وسيلة أخرى');
    }
    return String(item.product_name||'طلب شراء');
  }
  function ensurePage(){
    let page=document.getElementById(pageId);
    if(page)return page;
    page=document.createElement('section');
    page.id=pageId;
    page.className='l1017-history-page';
    page.setAttribute('aria-label','سجل الشحن والمدفوعات');
    page.dir='rtl';
    page.innerHTML=
      '<div class="l1017-history-shell">'+
        '<header class="l1017-history-top">'+
          '<button type="button" class="l1017-history-back" aria-label="العودة إلى حسابي">'+
            '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>'+
          '<h2>سجل الشحن والمدفوعات</h2>'+
          '<button type="button" class="l1017-history-refresh" aria-label="تحديث السجل" title="تحديث السجل">'+
            '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 0 12-2l2 5M4 12l2 5a7 7 0 0 1 12-2"/></svg></button>'+
        '</header>'+
        '<div class="l1017-history-tabs" role="tablist" aria-label="تصفية العمليات">'+
          '<button type="button" role="tab" aria-selected="true" aria-controls="l1017HistoryItems" data-history-filter="all">الكل <span id="l1017HistoryAllCount">—</span></button>'+
          '<button type="button" role="tab" aria-selected="false" aria-controls="l1017HistoryItems" data-history-filter="topup">الشحن <span id="l1017HistoryTopupTabCount">—</span></button>'+
          '<button type="button" role="tab" aria-selected="false" aria-controls="l1017HistoryItems" data-history-filter="purchase">المشتريات <span id="l1017HistoryPurchaseTabCount">—</span></button>'+
        '</div>'+
        '<p class="l1017-history-state" role="status" aria-live="polite" id="l1017HistoryStatus" data-mode="loading">جاري تحميل السجل…</p>'+
        '<div class="l1017-history-list" id="l1017HistoryItems" role="list" aria-label="المعاملات حسب الفلتر"></div>'+
      '</div>';
    document.body.appendChild(page);
    page.querySelector('.l1017-history-back').addEventListener('click',close);
    page.querySelector('.l1017-history-refresh').addEventListener('click',refresh);
    page.querySelectorAll('[data-history-filter]').forEach(button=>{
      button.addEventListener('click',()=>{state.filter=button.dataset.historyFilter;render()});
    });
    return page;
  }
  function close(){
    const page=document.getElementById(pageId);
    if(!page)return;
    state.serial++;
    page.classList.remove('visible');
    document.body.classList.remove('l1017-history-open');
    document.querySelector('[data-account-action="history"]')?.focus({preventScroll:true});
  }
  function amountDisplay(item){
    // Only settled wallet credits and recorded paid orders receive a signed amount.
    // A pending or rejected request must not look like a completed transfer.
    if(item.kind==='topup')return item.status==='approved'?['credit','+']:['neutral',''];
    if(item.status==='refunded')return ['credit','+'];
    if(['paid_pending_fulfillment','approved','processing','fulfilling','completed','in_processing','in_progress'].includes(item.status))
      return ['debit','−'];
    return ['neutral',''];
  }
  function itemHtml(item){
    const [status,statusClass]=stateOf(item);
    const [direction,sign]=amountDisplay(item);
    const title=labelFor(item);
    const amount=money(item.kind==='topup'?item.amount:item.total_amount);
    const date=dateTime(item.created_at);
    const icon=item.kind==='topup'
      ?'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v13m0 0-5-5m5 5 5-5"/><path d="M4 19v2h16v-2"/></svg>'
      :'<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h2l2 11h12l2-8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
    return '<article class="l1017-history-item '+safe(item.kind)+'" role="listitem">'+
        '<span class="l1017-history-mark" aria-hidden="true">'+icon+'</span>'+
        '<span class="l1017-history-main"><strong>'+safe(title)+'</strong><small>'+safe(date)+'</small></span>'+
        '<span class="l1017-history-side">'+
          '<b class="l1017-history-amount '+direction+'" dir="ltr">'+sign+safe(amount)+' <small>د.ل</small></b>'+
          '<span class="l1017-history-badge '+statusClass+'">'+safe(status)+'</span>'+
        '</span></article>';
  }
  function render(){
    const page=document.getElementById(pageId);
    if(!page||!page.classList.contains('visible'))return;
    page.querySelectorAll('[data-history-filter]').forEach(button=>{
      button.setAttribute('aria-selected',String(button.dataset.historyFilter===state.filter));
    });
    const topupCount=state.errors.includes('topup')?'—':String(state.topups.length);
    const purchaseCount=state.errors.includes('purchase')?'—':String(state.purchases.length);
    page.querySelector('#l1017HistoryTopupTabCount').textContent=topupCount;
    page.querySelector('#l1017HistoryPurchaseTabCount').textContent=purchaseCount;
    page.querySelector('#l1017HistoryAllCount').textContent=state.errors.length?'—':String(state.topups.length+state.purchases.length);
    const list=page.querySelector('#l1017HistoryItems'),status=page.querySelector('#l1017HistoryStatus');
    const all=[...state.topups.map(x=>({...x,kind:'topup'})),...state.purchases.map(x=>({...x,kind:'purchase'}))]
      .sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
    const rows=all.filter(x=>state.filter==='all'||x.kind===state.filter);
    const emptyTitle=state.filter==='topup'?'لا توجد طلبات شحن':state.filter==='purchase'?'لا توجد مشتريات':'سجلك فارغ حاليًا';
    list.innerHTML=rows.length?rows.map(itemHtml).join(''):
      state.errors.length?'':'<p class="l1017-history-empty">'+emptyTitle+'</p>';
    if(state.errors.length){
      const single=state.errors.length===1?(state.errors[0]==='topup'?'سجل الشحن':'سجل المدفوعات'):'السجل';
      status.textContent='تعذر تحميل '+single+' بالكامل. اضغط تحديث للمحاولة مرة ثانية.';
      status.dataset.mode='error';
    }else{
      status.dataset.mode='ready';
      status.textContent='';
    }
  }
  async function refresh(){
    const page=document.getElementById(pageId);
    if(!page||!page.classList.contains('visible'))return;
    const serial=++state.serial;
    const status=page.querySelector('#l1017HistoryStatus');
    status.dataset.mode='loading';
    status.textContent='جاري تحديث السجل…';
    const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!client){status.dataset.mode='error';status.textContent='تعذر الاتصال بخدمة الحساب. حدّث الصفحة.';return;}
    try{
      const {data:auth,error:authError}=await client.auth.getUser();
      if(serial!==state.serial)return;
      if(authError||!auth?.user){
        // Keep the screen open instead of silently doing nothing.
        state.topups=[];state.purchases=[];state.errors=[];
        page.querySelector('#l1017HistoryItems').replaceChildren();
        status.dataset.mode='error';
        status.textContent='تعذّر التحقق من حسابك. سجّل دخولك ثم اضغط تحديث، أو ارجع إلى حسابي.';
        return;
      }
      const id=auth.user.id;
      const [topups,purchases]=await Promise.all([
        client.from('topup_requests').select('id,amount,method,status,created_at,transfer_reference,admin_note')
          .eq('user_id',id).order('created_at',{ascending:false}).limit(limit),
        client.from('purchase_orders').select('id,product_name,total_amount,status,created_at,admin_note')
          .eq('user_id',id).order('created_at',{ascending:false}).limit(limit),
      ]);
      if(serial!==state.serial)return;
      state.errors=[];
      if(topups.error)state.errors.push('topup');
      else state.topups=topups.data||[];
      if(purchases.error)state.errors.push('purchase');
      else state.purchases=purchases.data||[];
      // Never display stale data when a source is unavailable.
      if(topups.error)state.topups=[];
      if(purchases.error)state.purchases=[];
      render();
    }catch(error){
      if(serial!==state.serial)return;
      state.topups=[];state.purchases=[];state.errors=['topup','purchase'];
      render();
      console.warn('[account/history] History request failed',error);
    }
  }
  function open(){
    // Show the interface immediately. Auth/network checks happen in refresh().
    // Never make a tap silently fail if auth.getUser() stalls or rejects.
    const page=ensurePage();
    page.classList.add('visible');
    document.body.classList.add('l1017-history-open');
    state.filter='all';
    state.topups=[];state.purchases=[];state.errors=[];
    page.querySelector('#l1017HistoryItems').replaceChildren();
    page.querySelector('#l1017HistoryStatus').textContent='جاري تحميل السجل…';
    page.querySelector('#l1017HistoryStatus').dataset.mode='loading';
    page.querySelector('#l1017HistoryAllCount').textContent='—';
    page.querySelector('#l1017HistoryTopupTabCount').textContent='—';
    page.querySelector('#l1017HistoryPurchaseTabCount').textContent='—';
    page.querySelector('.l1017-history-back').focus({preventScroll:true});
    page.scrollTop=0;
    const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(client&&!state.authSubscribed){
      state.authSubscribed=true;
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'||(!session?.user&&event==='USER_DELETED'))close();
      });
    }
    void refresh();
  }
  // Bind the action directly, independent of optional account menu handlers.
  // Capture phase prevents another account handler consuming the tap first.
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#accountModern [data-account-action="history"]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    open();
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.getElementById(pageId)?.classList.contains('visible'))close();
  });
  window.L1017nAccountHistory={open,close};
})();
