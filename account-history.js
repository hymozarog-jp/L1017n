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
       '<div class="l1017-history-top"><button type="button" class="l1017-history-back" aria-label="العودة إلى حسابي">'+
       '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>'+
       '<div><span>حسابي</span><h2>سجل الشحن والمدفوعات</h2></div>'+
       '<button type="button" class="l1017-history-refresh" aria-label="تحديث السجل" title="تحديث السجل">'+
       '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2"/></svg></button></div>'+
       '<p class="l1017-history-intro">كل عمليات شحن المحفظة وطلبات الشراء الخاصة بحسابك، مرتبة من الأحدث إلى الأقدم.</p>'+
       '<div class="l1017-history-stats" aria-label="ملخص السجل">'+
       '<div><small>طلبات الشحن المعروضة</small><strong id="l1017HistoryTopupCount">—</strong></div>'+
       '<div><small>طلبات الشراء المعروضة</small><strong id="l1017HistoryPurchaseCount">—</strong></div></div>'+
       '<div class="l1017-history-tabs" role="tablist" aria-label="تصفية العمليات">'+
       '<button type="button" role="tab" aria-selected="true" data-history-filter="all">الكل</button>'+
       '<button type="button" role="tab" aria-selected="false" data-history-filter="topup">الشحن</button>'+
       '<button type="button" role="tab" aria-selected="false" data-history-filter="purchase">المدفوعات</button></div>'+
       '<p class="l1017-history-state" role="status" aria-live="polite" id="l1017HistoryStatus">جاري تحميل السجل…</p>'+
       '<div class="l1017-history-list" id="l1017HistoryItems"></div>'+
       '<p class="l1017-history-footnote">يعرض السجل أحدث 50 عملية من كل نوع. حالة الطلب لا تعني بالضرورة اكتمال الدفع أو التسليم.</p>'+
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
  function itemHtml(item){
    const [status,statusClass]=stateOf(item);
    const title=labelFor(item);
    const amount=money(item.kind==='topup'?item.amount:item.total_amount);
    const date=dateTime(item.created_at);
    const id=String(item.id||'');
    const note=item.admin_note?'<div class="l1017-history-note"><b>ملاحظة الإدارة:</b> '+safe(item.admin_note)+'</div>':'';
    const ref=item.kind==='topup'&&item.transfer_reference?
      '<div><span>رقم التحويل</span><b dir="ltr">'+safe(item.transfer_reference)+'</b></div>':'';
    return '<details class="l1017-history-item '+safe(item.kind)+'">'+
      '<summary><span class="l1017-history-mark" aria-hidden="true">'+(item.kind==='topup'?'＋':'−')+'</span>'+
        '<span class="l1017-history-main"><strong>'+safe(title)+'</strong><small>'+safe(date)+'</small></span>'+
        '<span class="l1017-history-side"><b dir="ltr">'+safe(amount)+' <small>د.ل</small></b>'+
         '<em class="l1017-history-badge '+statusClass+'">'+safe(status)+'</em></span>'+
        '<svg class="l1017-history-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'+
      '</summary><div class="l1017-history-detail">'+
       '<div><span>نوع العملية</span><b>'+(item.kind==='topup'?'شحن محفظة':'طلب شراء')+'</b></div>'+
       '<div><span>حالة العملية</span><b>'+safe(status)+'</b></div>'+
       '<div><span>رقم الطلب</span><b dir="ltr" class="l1017-history-id">'+safe(id)+'</b></div>'+
       ref+note+'</div></details>';
  }
  function render(){
    const page=document.getElementById(pageId);
    if(!page||!page.classList.contains('visible'))return;
    page.querySelectorAll('[data-history-filter]').forEach(button=>{
      button.setAttribute('aria-selected',String(button.dataset.historyFilter===state.filter));
    });
    page.querySelector('#l1017HistoryTopupCount').textContent=state.errors.includes('topup')?'—':String(state.topups.length);
    page.querySelector('#l1017HistoryPurchaseCount').textContent=state.errors.includes('purchase')?'—':String(state.purchases.length);
    const list=page.querySelector('#l1017HistoryItems'),status=page.querySelector('#l1017HistoryStatus');
    const all=[...state.topups.map(x=>({...x,kind:'topup'})),...state.purchases.map(x=>({...x,kind:'purchase'}))]
      .sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
    const rows=all.filter(x=>state.filter==='all'||x.kind===state.filter);
    list.innerHTML=rows.map(itemHtml).join('');
    if(state.errors.length){
      const single=state.errors.length===1?(state.errors[0]==='topup'?'سجل الشحن':'سجل المدفوعات'):'السجل';
      status.textContent='تعذر تحميل '+single+' بالكامل. اضغط تحديث للمحاولة مرة ثانية.';
      status.dataset.mode='error';
    }else{
      status.dataset.mode='ready';
      status.textContent=rows.length?'اضغط على أي عملية لعرض تفاصيلها.':'لا توجد عمليات مسجلة في هذا القسم حتى الآن.';
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
      if(authError||!auth?.user){close();return;}
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
  async function open(){
    const client=typeof supabaseClient!=='undefined'?supabaseClient:null;
    if(!client)return;
    const {data,error}=await client.auth.getUser();
    if(error||!data?.user)return;
    const page=ensurePage();
    page.classList.add('visible');
    document.body.classList.add('l1017-history-open');
    state.filter='all';
    state.topups=[];state.purchases=[];state.errors=[];
    page.querySelector('#l1017HistoryItems').innerHTML='';
    page.querySelector('#l1017HistoryTopupCount').textContent='—';
    page.querySelector('#l1017HistoryPurchaseCount').textContent='—';
    page.querySelector('#l1017HistoryStatus').textContent='جاري تحميل السجل…';
    page.querySelector('.l1017-history-back').focus({preventScroll:true});
    page.scrollTop=0;
    if(!state.authSubscribed){
      state.authSubscribed=true;
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'||(!session?.user&&event==='USER_DELETED'))close();
      });
    }
    await refresh();
  }
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.getElementById(pageId)?.classList.contains('visible'))close();
  });
  window.L1017nAccountHistory={open,close};
})();
