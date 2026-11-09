/* L1017n: editable displayed Robux sales total. The chosen number is
   snapshotted against real completed orders so future sales increase it
   automatically without rewriting any order, inventory or wallet data. */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const display=n=>Math.max(0,Math.round(Number(n)||0)).toLocaleString('en-US');
  let busy=false,saving=false,dirty=false,latest=null,lastLoaded=0;
  function api(){return typeof supabaseClient==='undefined'?null:supabaseClient}
  function isAdminStockOpen(){
    const view=byId('adminView'),content=byId('adminContent');
    const element=byId('adminRobuxSoldPanel');
    if(!view||!content||!element)return false;
    if(view.classList.contains('hidden')||content.classList.contains('hidden'))return false;
    const section=element.closest('section');
    if(section?.classList.contains('admin-hub-pane')&&!section.classList.contains('admin-hub-active'))return false;
    return true;
  }
  function say(message){const el=byId('adminRobuxSoldStatus');if(el)el.textContent=message}
  function render(data){
    if(!data||typeof data!=='object')throw Error('invalid_sales_counter');
    const website=Number(data.website_sold);
    const base=Number(data.display_base_total);
    const increase=Number(data.new_site_sales_since_edit);
    const total=Number(data.total_sold);
    if(!Number.isSafeInteger(website)||website<0||
       !Number.isSafeInteger(base)||base<0||
       !Number.isSafeInteger(increase)||increase<0||
       !Number.isSafeInteger(total)||total!==base+increase)throw Error('invalid_sales_values');
    latest={website,base,increase,total};
    byId('adminRobuxSoldWebsite').textContent=display(website);
    byId('adminRobuxSoldManual').textContent=display(increase);
    byId('adminRobuxSoldTotal').textContent=display(total);
    if(!dirty)byId('adminRobuxSoldInput').value=String(total);
  }
  async function refresh(){
    if(busy||saving||!isAdminStockOpen())return;
    const client=api();
    if(!client?.rpc)return;
    busy=true;
    const button=byId('adminRobuxSoldRefresh');
    if(button)button.disabled=true;
    try{
      const {data,error}=await client.rpc('get_admin_robux_sales_display');
      if(error)throw error;
      render(data);
      lastLoaded=Date.now();
      if(dirty)say('تحدثت المبيعات التلقائية. ما زال عندك تعديل على العدد الإجمالي لم تحفظه.');
      else say('تقدر تغيّر إجمالي العداد، ومبيعات الموقع الجديدة تزيده تلقائيًا بعد الحفظ.');
    }catch(e){
      console.warn('[admin/sold-robux] Could not load stats',e);
      say('تعذّر تحميل عدد الروبوكس المباعة. تأكد من اتصال الإنترنت واضغط تحديث.');
    }finally{
      busy=false;if(button)button.disabled=false;
    }
  }
  async function save(){
    if(busy||saving||!isAdminStockOpen())return;
    const input=byId('adminRobuxSoldInput');
    const raw=String(input.value).trim();
    const num=Number(raw);
    if(!/^\d{1,10}$/.test(raw)||!Number.isSafeInteger(num)||num<0||num>1000000000){
      say('اكتب عدد روبوكس صحيحًا من 0 إلى 1,000,000,000.');
      input.focus();return;
    }
    const client=api();
    if(!client?.rpc){say('الاتصال بقاعدة البيانات غير متاح حاليًا.');return}
    saving=true;
    const button=byId('adminRobuxSoldSave');
    button.disabled=true;button.textContent='جاري الحفظ…';
    say('جاري ضبط العدد الإجمالي المعروض…');
    try{
      const {data,error}=await client.rpc('admin_set_robux_sales_display',{p_total:num});
      if(error)throw error;
      dirty=false;render(data);
      lastLoaded=Date.now();
      say('✅ أصبح العدد الإجمالي '+display(data.total_sold)+' روبوكس. مبيعات الموقع الجديدة ستزيده تلقائيًا.');
    }catch(e){
      console.warn('[admin/sold-robux] Could not save',e);
      say('تعذّر حفظ العدد الإجمالي. لم تتغيّر الطلبات أو أرصدة الزبائن. حاول مرة ثانية.');
    }finally{
      saving=false;
      button.disabled=false;button.textContent='حفظ العدد';
    }
  }
  function init(){
    const panel=byId('adminRobuxSoldPanel');
    if(!panel||panel.dataset.robuxTrackerReady==='1')return;
    panel.dataset.robuxTrackerReady='1';
    const input=byId('adminRobuxSoldInput');
    const saveButton=byId('adminRobuxSoldSave');
    input.addEventListener('input',()=>{
      dirty=true;
      if(latest){
        const value=Number(input.value);
        if(Number.isSafeInteger(value)&&value>=0&&value<=1000000000){
          say('معاينة العدد بعد الحفظ: '+display(value)+' روبوكس. الطلبات المكتملة الجديدة تزيده بعد ذلك.');
        }else say('اكتب عدد روبوكس صحيحًا ثم احفظ.');
      }
    });
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void save()}});
    saveButton.addEventListener('click',()=>void save());
    byId('adminRobuxSoldRefresh').addEventListener('click',()=>void refresh());
    const check=()=>{if(isAdminStockOpen()&&Date.now()-lastLoaded>1000)void refresh()};
    const obs=new MutationObserver(check);
    const view=byId('adminView'),content=byId('adminContent'),section=panel.closest('section');
    for(const el of [view,content,section])if(el)obs.observe(el,{attributes:true,attributeFilter:['class']});
    window.addEventListener('focus',check);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    window.setInterval(()=>{if(isAdminStockOpen()&&document.visibilityState==='visible')void refresh()},15000);
    check();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();