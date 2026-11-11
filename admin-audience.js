/* L1017n private audience dashboards. Only secured admin RPCs return account or visit details. */
(function () {
  "use strict";
  const $ = sel => document.querySelector(sel);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const n = value => Math.max(0,Number(value)||0);
  const fmt = value => n(value).toLocaleString("en-US");
  const money = value => n(value).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" د.ل";
  const date = value => {
    if(!value)return "لم يسجّل دخولًا بعد";
    const time=new Date(value);
    if(Number.isNaN(time.valueOf()))return "—";
    return time.toLocaleDateString("ar-LY",{year:"numeric",month:"short",day:"numeric",timeZone:"Africa/Tripoli"});
  };
  const stamp = value => {
    if(!value)return "—";
    const time=new Date(value);
    if(Number.isNaN(time.valueOf()))return "—";
    return time.toLocaleString("ar-LY",{
      month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Tripoli"
    });
  };
  const client=()=>typeof supabaseClient!=="undefined"?supabaseClient:null;
  let accountOffset=0,accountsTotal=0,accountRequest=0,visitorRequest=0;
  const pageSize=16;
  let currentAccountQuery="";
  let searchTimer=0;
  function canDisplay(panel){
    const view=$("#adminView"),root=$(panel);
    return !!view&&!view.classList.contains("hidden")
      &&!!$("#adminContent")&&!$("#adminContent").classList.contains("hidden")
      &&root?.classList.contains("admin-hub-active");
  }
  function metric(label,value,hint){
    return '<article class="admin-audience-metric"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(hint)+'</span></article>';
  }
  async function rpc(name,args){
    const api=client();
    if(!api)throw Error("الاتصال بخدمة المتجر غير جاهز");
    const {data,error}=await api.rpc(name,args||{});
    if(error){
      if(/not_authorized|42501|permission denied/i.test(String(error.message)))
        throw Error("غير مصرح لهذا الحساب بعرض البيانات");
      throw Error("تعذر استرجاع البيانات من المتجر");
    }
    return data;
  }
  function chartRow(record,maximum){
    const day=String(record.date||"");
    const sessions=n(record.sessions),visitors=n(record.visitors);
    const width=maximum>0?Math.max(1.5,100*sessions/maximum):0;
    const dayShort=/^\d{4}-\d{2}-\d{2}$/.test(day)?day.slice(5).replace("-","/"):day;
    return '<div class="admin-audience-bar-line" title="'+esc(day)+'">'
      +'<span class="admin-audience-bar-day" dir="ltr">'+esc(dayShort)+'</span>'
      +'<div class="admin-audience-bar-track"><span class="admin-audience-bar-fill" style="width:'+width.toFixed(2)+'%"></span></div>'
      +'<strong>'+fmt(sessions)+'</strong><small>'+fmt(visitors)+' زائر</small></div>';
  }
  async function loadVisitors(){
    if(!canDisplay("#adminHubVisitors"))return;
    const seq=++visitorRequest,button=$("#adminVisitorsRefresh");
    const status=$("#adminVisitorsStatus");
    if(button)button.disabled=true;
    if(status)status.textContent="جاري تحديث البيانات…";
    try{
      const data=await rpc("admin_store_visitors");
      if(seq!==visitorRequest||!canDisplay("#adminHubVisitors"))return;
      const s=data?.summary||{};
      $("#adminVisitorsMetrics").innerHTML=[
        metric("زوار اليوم",fmt(s.today_visitors),"متصفحات مميزة"),
        metric("آخر 7 أيام",fmt(s.week_visitors),"متصفحات مميزة"),
        metric("إجمالي المتصفحات",fmt(s.all_time_visitors),"منذ بدء العدّاد"),
        metric("جلسات الزيارة",fmt(s.total_visits),"كل الجلسات المسجلة")
      ].join("");
      const daily=Array.isArray(data?.daily)?data.daily:[];
      const max=Math.max(0,...daily.map(x=>n(x.sessions)));
      $("#adminVisitorsChart").innerHTML=daily.length?daily.map(x=>chartRow(x,max)).join("")
        :'<p class="admin-audience-empty">لم تُسجل بيانات زيارة بعد.</p>';
      const recent=Array.isArray(data?.recent)?data.recent:[];
      $("#adminVisitorsRecent").innerHTML=recent.length?
        '<div class="admin-audience-recent-list">'+recent.map((entry,i)=>
          '<article class="admin-audience-visit"><span class="admin-audience-visit-icon" aria-hidden="true">◎</span>'
          +'<div><b>زيارة #'+(i+1)+'</b><small>متصفح مجهول · '+esc(String(entry.anonymous_browser||"").toUpperCase())+'</small></div>'
          +'<time>'+esc(stamp(entry.first_seen_at))+'</time></article>'
        ).join("")+'</div>':
        '<p class="admin-audience-empty">لا توجد جلسات مسجلة بعد.</p>';
      if(status)status.textContent="آخر تحديث: "+stamp(new Date().toISOString());
    }catch(error){
      if(seq!==visitorRequest)return;
      if(status)status.textContent=error.message||"تعذر تحميل الإحصائيات";
      $("#adminVisitorsChart").innerHTML='<p class="admin-audience-empty">تعذر تحميل مخطط الزيارات.</p>';
    }finally{if(button)button.disabled=false}
  }
  async function loadAccounts(){
    if(!canDisplay("#adminHubAccounts"))return;
    const seq=++accountRequest,button=$("#adminAccountsRefresh"),status=$("#adminAccountsStatus");
    if(button)button.disabled=true;
    if(status)status.textContent="جاري تحديث الحسابات…";
    try{
      const data=await rpc("admin_store_accounts",{
        p_search:currentAccountQuery,p_offset:accountOffset,p_limit:pageSize
      });
      if(seq!==accountRequest||!canDisplay("#adminHubAccounts"))return;
      const rows=Array.isArray(data?.rows)?data.rows:[];
      accountsTotal=n(data?.total);
      $("#adminAccountsMetrics").innerHTML=[
        metric("كل الحسابات",fmt(data?.registered_total),"حسابات في المتجر"),
        metric("المسجّلون آخر 7 أيام",fmt(data?.registered_week),"حساب جديد"),
        metric("نتائج البحث",fmt(accountsTotal),"حساب مطابق")
      ].join("");
      $("#adminAccountsList").innerHTML=rows.length?rows.map(a=>{
        const name=String(a.display_name||"زبون");
        const initial=name.trim().slice(0,1)||"ز";
        const id=String(a.id||"");
        return '<article class="admin-audience-account">'
          +'<div class="admin-audience-avatar" aria-hidden="true">'+esc(initial)+'</div>'
          +'<div class="admin-audience-account-main"><div class="admin-audience-account-heading"><strong>'+esc(name)+'</strong>'
          +(n(a.completed_orders)>0?'<span class="admin-audience-buyer">مشتري</span>':'')+'</div>'
          +'<span class="admin-audience-email" dir="ltr">'+esc(a.email||"بلا بريد إلكتروني")+'</span>'
          +'<span class="admin-audience-account-id" dir="ltr">ID: '+esc(id.slice(0,8).toUpperCase())+'</span>'
          +'<div class="admin-audience-account-facts"><span>التسجيل: '+esc(date(a.created_at))+'</span>'
          +'<span>آخر دخول: '+esc(date(a.last_sign_in_at))+'</span>'
          +'<span>الطلبات: '+fmt(a.order_count)+'</span>'
          +'<span>المحفظة: '+esc(money(a.wallet_balance))+'</span></div></div></article>';
      }).join(""):'<p class="admin-audience-empty">ما فيش حسابات تطابق البحث.</p>';
      $("#adminAccountsPrev").disabled=accountOffset===0;
      $("#adminAccountsNext").disabled=accountOffset+rows.length>=accountsTotal;
      const first=accountsTotal?accountOffset+1:0;
      const last=Math.min(accountOffset+rows.length,accountsTotal);
      $("#adminAccountsPage").textContent=fmt(first)+" – "+fmt(last)+" من "+fmt(accountsTotal);
      if(status)status.textContent="تم تحديث الحسابات.";
    }catch(error){
      if(seq!==accountRequest)return;
      $("#adminAccountsList").innerHTML='<p class="admin-audience-empty">تعذر تحميل الحسابات. جرّب تحديث.</p>';
      if(status)status.textContent=error.message||"تعذر تحميل الحسابات";
    }finally{if(button)button.disabled=false}
  }
  document.addEventListener("l1017n:admin-screen",event=>{
    if(event.detail?.key==="visitors")void loadVisitors();
    if(event.detail?.key==="accounts")void loadAccounts();
  });
  document.addEventListener("click",event=>{
    const target=event.target;
    if(!(target instanceof Element))return;
    if(target.closest("#adminVisitorsRefresh"))void loadVisitors();
    if(target.closest("#adminAccountsRefresh"))void loadAccounts();
    if(target.closest("#adminAccountsNext")){
      if(accountOffset+pageSize<accountsTotal){accountOffset+=pageSize;void loadAccounts()}
    }
    if(target.closest("#adminAccountsPrev")){
      if(accountOffset>0){accountOffset=Math.max(0,accountOffset-pageSize);void loadAccounts()}
    }
  });
  document.addEventListener("input",event=>{
    if(event.target?.id!=="adminAccountsSearch")return;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{
      currentAccountQuery=event.target.value.trim();
      accountOffset=0;void loadAccounts();
    },260);
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState!=="visible")return;
    if(canDisplay("#adminHubVisitors"))void loadVisitors();
    if(canDisplay("#adminHubAccounts"))void loadAccounts();
  });
})();
