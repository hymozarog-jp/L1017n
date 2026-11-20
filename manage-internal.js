/* L1017n Admin — internal navigation and secure live data panels.
 * No customer storefront navigation; no direct wallet mutation or bypass of server RPCs.
 */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const PAGES={
 overview:['الرئيسية','ملخص وإحصائيات المتجر'],orders:['طلبات الشراء','إدارة الطلبات وتسليمها'],
 topups:['طلبات الشحن','مراجعة شحن ليبيانا والمدار'],products:['المنتجات والأسعار','إضافة وتعديل الباقات'],
 stock:['مخزون الروبوكس','إدارة المخزون المتوفر'],wallets:['محافظ الزبائن','الأرصدة والمعاملات'],
 accounts:['حسابات العملاء','المسجلون وطلبات كل حساب'],visitors:['الزوار','حركة الزيارات'],
 finance:['الأرباح والمبيعات','المبيعات والتقارير'],reviews:['التقييمات','آراء الزبائن'],
 omnex:['المورد OMNEX','منتجات المورد والتحكم في المزامنة']
};
let screen=null,sequence=0;
const supa=()=>window.L1017nAdminApi||null;
const fmt=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('en-US',{maximumFractionDigits:3}):'—';
const din=x=>fmt(x)+' د.ل';
const stamp=x=>x?new Date(x).toLocaleString('ar-LY',{dateStyle:'short',timeStyle:'short',timeZone:'Africa/Tripoli'}):'—';
const make=(tag,cls='',txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
function msg(content,kind=''){
 const line=$('#maStatus');if(!line)return;
 line.textContent=content;line.className='ma-status'+(kind?' '+kind:'');line.hidden=!content;
}
function panel(){
 let node=$('#manageInternal');
 if(node)return node;
 const root=$('#dashboard');if(!root)return null;
 node=make('section','ma-panel');node.id='manageInternal';node.hidden=true;
 node.innerHTML='<div class="ma-header"><button type="button" class="ma-back" id="maBack">← كل الأقسام</button><div><h2 id="maTitle"></h2><small id="maSub"></small></div><button type="button" class="ma-reload" id="maReload" title="تحديث">↻</button></div><div id="maStatus" class="ma-status" role="status" hidden></div><div id="maContent" class="ma-content"></div>';
 root.prepend(node);
 $('#maBack',node).addEventListener('click',()=>{location.hash='';show('overview')});
 $('#maReload',node).addEventListener('click',()=>load(screen));
 return node;
}
function route(href){
 if(!href||href.startsWith('http')||href.startsWith('mailto:')||href.startsWith('tel:'))return null;
 try{
  const url=new URL(href,location.href);
  if(url.origin!==location.origin)return null;
  const file=url.pathname.split('/').pop();
  if(file==='manage.html')return url.hash.slice(1)||'overview';
  if(file==='admin-omnex.html')return 'omnex';
  if(file==='admin-wallets.html')return 'wallets';
  if(file==='admin-reports.html')return 'finance';
  if(file==='index.html'||file==='')return url.searchParams.get('section')||'overview';
  return null;
 }catch(_){return null}
}
document.addEventListener('click',e=>{
 const anchor=e.target.closest?.('a[href]');
 if(!anchor)return;
 const dest=route(anchor.getAttribute('href'));
 if(!dest||!PAGES[dest])return;
 e.preventDefault();
 if($('#dashboard')?.hidden)return;
 if(dest==='overview'){location.hash='';show('overview')}
 else if(location.hash.slice(1)!==dest)location.hash=dest;
 else show(dest);
},true);
window.addEventListener('hashchange',()=>{
 const key=location.hash.slice(1);
 if(!$('#dashboard')?.hidden)show(PAGES[key]?key:'overview');
});
window.addEventListener('l1017n:manage-view',e=>{
 if(e.detail?.which!=='dashboard'){sequence++;return}
 show(PAGES[location.hash.slice(1)]?location.hash.slice(1):'overview');
});
function show(key){
 if($('#dashboard')?.hidden)return;
 const root=$('#dashboard'),p=panel();if(!p)return;
 const valid=PAGES[key]?key:'overview';screen=valid;sequence++;
 const active=valid!=='overview';
 p.hidden=!active;root.classList.toggle('ma-section-open',active);
 $$('#bottomNav a').forEach(a=>a.classList.toggle('active',(route(a.getAttribute('href'))||'overview')===valid));
 if(!active)return;
 $('#maTitle').textContent=PAGES[valid][0];$('#maSub').textContent=PAGES[valid][1];msg('');
 load(valid);
 window.scrollTo({top:0,behavior:'instant'});
}
async function guarded(){
 const api=supa();if(!api)throw Error('تعذر الاتصال بالتطبيق. حدّث الصفحة.');
 const {data:{user},error}=await api.auth.getUser();
 if(error||!user)throw Error('سجّل الدخول من شاشة الإدارة أولاً.');
 const {data:allowed,error:roleError}=await api.rpc('is_store_admin');
 if(roleError||allowed!==true)throw Error('هذا الحساب ليس من مديري المتجر المصرح لهم.');
 return api;
}
async function records(table,fields,limit=60){
 const api=await guarded();
 const {data,error}=await api.from(table).select(fields).order('created_at',{ascending:false}).limit(limit);
 if(error)throw Error('تعذر قراءة '+table+'. '+error.message);
 return data||[];
}
async function invoke(name,params){
 const api=await guarded();const {error}=await api.rpc(name,params);
 if(error)throw Error('رفض الخادم الإجراء: '+error.message);
}
async function confirmStep(title,body,wantsReason=false){
 return new Promise(resolve=>{
  const dialog=make('dialog','ma-confirm');
  dialog.innerHTML='<div class="ma-confirm-body"><h3></h3><p></p><label class="ma-reason" hidden>ملاحظة الإدارة<textarea rows="3" maxlength="1000" placeholder="اكتب سبب القرار هنا"></textarea></label><div class="ma-confirm-buttons"><button type="button" class="ma-cancel">إلغاء</button><button type="button" class="ma-yes">تأكيد الإجراء</button></div></div>';
  $('h3',dialog).textContent=title;$('p',dialog).textContent=body;
  $('.ma-reason',dialog).hidden=!wantsReason;
  document.body.append(dialog);let finished=false;
  function finish(value){if(finished)return;finished=true;dialog.close();dialog.remove();resolve(value)}
  $('.ma-cancel',dialog).addEventListener('click',()=>finish(null));
  $('.ma-yes',dialog).addEventListener('click',()=>finish({note:$('textarea',dialog)?.value?.trim()||''}));
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null)});
  dialog.showModal();
 });
}
function card(title,details=[],actions=[]){
 const item=make('article','ma-card'),heading=make('h3','',title);item.append(heading);
 for(const [label,value] of details){
  const row=make('div','ma-row');
  row.append(make('small','',label),make('strong','',value));
  item.append(row);
 }
 if(actions.length){
  const bar=make('div','ma-actions');
  for(const act of actions){
   const b=make('button','ma-action'+(act.danger?' danger':''),act.label);
   b.type='button';b.disabled=!!act.disabled;b.addEventListener('click',act.onClick);bar.append(b);
  }
  item.append(bar);
 }
 return item;
}
function note(el,text){el.append(make('p','ma-hint',text))}
function empty(el,text='لا توجد بيانات لعرضها.'){note(el,text)}
function simpleStat(label,val){const n=make('div','ma-kpi');n.append(make('small','',label),make('strong','',fmt(val)));return n}
function appendStats(el,items){
 const row=make('div','ma-stat-grid');items.forEach(([name,val])=>row.append(simpleStat(name,val)));el.append(row);
}
function title(el,text){el.append(make('h3','ma-group-title',text))}
function searchInput(place){
 const input=make('input','ma-filter');input.type='search';input.placeholder=place;input.setAttribute('aria-label',place);return input;
}
function displayItems(rows,box,draw,query,fields){
 box.replaceChildren();
 const needle=String(query||'').toLowerCase();
 const visible=rows.filter(row=>!needle||fields(row).toLowerCase().includes(needle));
 if(!visible.length){empty(box,'لا توجد نتائج مطابقة.');return}
 visible.forEach(row=>box.append(draw(row)));
}
function adminLabel(status){
 return ({pending:'بانتظار المراجعة',approved:'تم القبول',rejected:'مرفوض',
 paid_pending_fulfillment:'مدفوع — بانتظار التنفيذ',completed:'تم التسليم',processing:'جارٍ التنفيذ',
 fulfilling:'جارٍ التسليم',refunded:'مسترجع'})[status]||status||'—';
}
async function orders(root){
 const rows=await records('purchase_orders','id,product_name,roblox_username,total_amount,wallet_carrier,status,created_at,admin_note',100);
 appendStats(root,[['جميع الطلبات المحمّلة',rows.length],['بانتظار التنفيذ',rows.filter(x=>['paid_pending_fulfillment','approved','processing','fulfilling'].includes(x.status)).length],['مكتملة',rows.filter(x=>x.status==='completed').length]]);
 const input=searchInput('ابحث عن المنتج أو رقم الطلب أو الحالة');root.append(input);
 const list=make('div','ma-list');root.append(list);
 async function act(row,decision){
  const label=decision==='completed'?'تسليم الطلب':'رفض الطلب وإعادة الرصيد';
  const ok=await confirmStep(label,'الطلب '+row.id.slice(0,8)+' — '+row.product_name+'. '+(decision==='rejected'?'سيعيد الخادم المبلغ إلى محفظة الزبون حسب طريقة دفعه.':'تأكد أن المنتج سُلّم بالفعل قبل التأكيد.'),decision==='rejected');
  if(!ok)return;
  try{await invoke('admin_review_purchase',{p_order_id:row.id,p_decision:decision,p_admin_note:ok.note||null});msg('تم تنفيذ الإجراء والتحقق منه من الخادم.','ok');setTimeout(()=>load('orders'),850)}
  catch(e){msg(e.message,'error')}
 }
 const draw=row=>card(row.product_name||'طلب شراء',[
  ['رقم الطلب',row.id.slice(0,8).toUpperCase()],
  ['التاريخ',stamp(row.created_at)],['الحالة',adminLabel(row.status)],
  ['المبلغ',din(row.total_amount)],['المحفظة',row.wallet_carrier==='almadar'?'المدار':'ليبيانا'],
  ['مستخدم Roblox',row.roblox_username||'—'],['ملاحظة',row.admin_note||'—']
 ],['paid_pending_fulfillment','approved','processing','fulfilling'].includes(row.status)?[
  {label:'تم التسليم',onClick:()=>act(row,'completed')},{label:'رفض وإرجاع',danger:true,onClick:()=>act(row,'rejected')}
 ]:[]);
 const render=()=>displayItems(rows,list,draw,input.value,row=>[row.id,row.product_name,row.status,row.roblox_username].join(' '));
 input.addEventListener('input',render);render();
}
async function topups(root){
 const rows=await records('topup_requests','id,amount,method,phone,status,created_at,admin_note,transfer_reference',100);
 appendStats(root,[['كل الطلبات المحمّلة',rows.length],['تحتاج مراجعة',rows.filter(x=>x.status==='pending').length],['تم قبولها',rows.filter(x=>x.status==='approved').length]]);
 const filter=searchInput('رقم المحوّل أو حالة الطلب');root.append(filter);
 const list=make('div','ma-list');root.append(list);
 async function act(row,decision){
  const approval=decision==='approved';
  const result=await confirmStep(approval?'تأكيد استلام التحويل':'رفض طلب الشحن',
   'راجع رسالة استلام التحويل ومطابقة الرقم والمبلغ فعليًا: '+din(row.amount)+' — '+(row.phone||'بدون رقم')+'. '+(approval?'الموافقة ستضيف هذا المبلغ إلى محفظة العميل.':'الرفض لن يضيف رصيدًا.'),!approval);
  if(!result)return;
  try{await invoke('admin_review_topup',{p_request_id:row.id,p_decision:decision,p_admin_note:result.note||null});msg('تم حفظ القرار من الخادم.','ok');setTimeout(()=>load('topups'),850)}
  catch(e){msg(e.message,'error')}
 }
 const draw=row=>card('طلب شحن '+(row.method==='almadar'?'المدار':'ليبيانا'),[
  ['الرقم',row.phone||'—'],['المبلغ',din(row.amount)],['الحالة',adminLabel(row.status)],
  ['التاريخ',stamp(row.created_at)],['مرجع التحويل',row.transfer_reference||'—'],['ملاحظة',row.admin_note||'—']
 ],row.status==='pending'?[{label:'قبول بعد التحقق',onClick:()=>act(row,'approved')},{label:'رفض',danger:true,onClick:()=>act(row,'rejected')}]:[]);
 const render=()=>displayItems(rows,list,draw,filter.value,row=>[row.phone,row.status,row.method,row.id].join(' '));
 filter.addEventListener('input',render);render();
 note(root,'لا تعتمد طلب شحن دون التأكد من وصول المبلغ عبر الوسيلة المعتمدة. لا يتم تنفيذ أي تحويل تلقائي من هذه الشاشة.');
}
async function products(root){
 const api=await guarded();
 const {data,error}=await api.from('products').select('id,product_key,name,game,price,amount,active,stock_quantity,image_url,sort_order').order('sort_order',{ascending:true}).limit(150);
 if(error)throw Error(error.message);
 const rows=data||[];
 appendStats(root,[['المنتجات',rows.length],['المفعّلة',rows.filter(x=>x.active).length],['المخفية',rows.filter(x=>!x.active).length]]);
 const add=document.createElement('details');add.className='ma-add-form';
 add.innerHTML='<summary>＋ إضافة منتج جديد</summary><form class="ma-edit-form"><label>اسم المنتج<input name="name" required maxlength="120"></label><label>القسم أو اللعبة<input name="game" required maxlength="60" placeholder="roblox"></label><label>الكمية داخل الباقة<input name="amount" type="number" min="1" step="1" required></label><label>السعر بالدينار<input name="price" type="number" min="0" step="0.01" required></label><label>المخزون (اختياري)<input name="stock" type="number" min="0" step="1"></label><button type="submit" class="ma-save">إضافة المنتج</button></form>';
 root.append(add);
 $('form',add).addEventListener('submit',async e=>{
  e.preventDefault();const fd=new FormData(e.target);
  const name=String(fd.get('name')||'').trim(),game=String(fd.get('game')||'').trim();
  const amount=Number(fd.get('amount')),price=Number(fd.get('price'));
  const stockRaw=String(fd.get('stock')||'').trim(),stock=stockRaw===''?null:Number(stockRaw);
  if(!name||!game||!Number.isInteger(amount)||amount<1||!Number.isFinite(price)||price<0||(stock!==null&&(!Number.isInteger(stock)||stock<0))){msg('تأكد من جميع الحقول.','error');return}
  const ok=await confirmStep('إضافة منتج','تأكيد إنشاء '+name+' بسعر '+din(price));if(!ok)return;
  try{
   const key='custom_'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,22):Date.now().toString(36));
   const {error}=await (await guarded()).from('products').insert({name,game,amount,price,active:true,product_key:key,stock_quantity:stock});
   if(error)throw error;msg('تم إضافة المنتج.','ok');setTimeout(()=>load('products'),750);
  }catch(err){msg('تعذرت الإضافة: '+err.message,'error')}
 });
 const search=searchInput('ابحث عن الباقة أو القسم');root.append(search);
 const list=make('div','ma-list');root.append(list);
 const draw=row=>{
  const item=card(row.name,[['القسم',row.game],['عدد وحدات الباقة',fmt(row.amount)],['المعرّف',row.product_key||'—']]);
  const form=make('form','ma-product-edit');
  form.innerHTML='<label>السعر (د.ل)<input name="price" type="number" min="0" step="0.01"></label><label>المخزون<input name="stock" type="number" min="0" step="1" placeholder="غير محدد"></label><label class="ma-checkbox"><input name="active" type="checkbox"> متوفر للعرض</label><button type="submit" class="ma-save">حفظ التغييرات</button>';
  $('[name="price"]',form).value=String(row.price);
  $('[name="stock"]',form).value=row.stock_quantity==null?'':String(row.stock_quantity);
  $('[name="active"]',form).checked=!!row.active;
  form.addEventListener('submit',async e=>{
   e.preventDefault();const price=Number(form.elements.price.value);
   const st=String(form.elements.stock.value).trim(),stock=st===''?null:Number(st);
   if(!Number.isFinite(price)||price<0||(stock!==null&&(!Number.isInteger(stock)||stock<0))){msg('السعر أو المخزون غير صحيح.','error');return}
   const ok=await confirmStep('حفظ تعديلات المنتج',row.name+' — السعر '+din(price)+' — '+(form.elements.active.checked?'ظاهر':'مخفي'));
   if(!ok)return;
   try{
    const {error}=await (await guarded()).from('products').update({price,stock_quantity:stock,active:form.elements.active.checked}).eq('id',row.id);
    if(error)throw error;msg('تم حفظ تعديل المنتج.','ok');setTimeout(()=>load('products'),750);
   }catch(err){msg('تعذر الحفظ: '+err.message,'error')}
  });
  item.append(form);return item;
 };
 const render=()=>displayItems(rows,list,draw,search.value,row=>[row.name,row.game,row.product_key].join(' '));
 search.addEventListener('input',render);render();
 note(root,'تعديل منتجات المورد OMNEX يتم من قسم المورد. الأسعار هنا لمنتجات جدول المتجر فقط.');
}
async function stock(root){
 const api=await guarded();
 const {data,error}=await api.from('store_inventory').select('robux_available,robux_unlimited,updated_at').eq('id',true).maybeSingle();
 if(error)throw Error(error.message);
 const count=Number(data?.robux_available||0);
 appendStats(root,[['المخزون المتوفر',count],['الحالة',data?.robux_unlimited?'غير محدود':'محدد']]);
 const form=make('form','ma-single-form');form.innerHTML='<label>مخزون الروبوكس الجديد<input name="stock" type="number" min="0" step="1" required></label><button type="submit" class="ma-save">حفظ المخزون</button>';
 form.elements.stock.value=String(count);
 form.addEventListener('submit',async e=>{
  e.preventDefault();const n=Number(form.elements.stock.value);
  if(!Number.isInteger(n)||n<0){msg('أدخل كمية صحيحة.','error');return}
  if(!await confirmStep('تحديث المخزون','سيصبح مخزون الروبوكس: '+fmt(n)+' وحدة. إعداد المخزون غير المحدود سيُلغى.'))return;
  try{await invoke('admin_set_robux_stock',{p_stock:n});msg('تم تحديث المخزون.','ok');setTimeout(()=>load('stock'),750)}
  catch(e){msg(e.message,'error')}
 });
 root.append(form);note(root,'هذا يغيّر مخزون الروبوكس الداخلي عبر دالة الخادم؛ لا يغيّر مخزون المورد.');
}
async function wallets(root){
 const api=await guarded();
 const {data,error}=await api.from('wallet_accounts').select('user_id,balance,madar_balance,updated_at').limit(100);
 if(error)throw Error(error.message);
 const rows=data||[];
 appendStats(root,[['المحافظ',rows.length],['إجمالي ليبيانا',rows.reduce((s,r)=>s+Number(r.balance||0),0)],['إجمالي المدار',rows.reduce((s,r)=>s+Number(r.madar_balance||0),0)]]);
 const inp=searchInput('ابحث بمعرّف العميل');root.append(inp);const list=make('div','ma-list');root.append(list);
 const draw=row=>card('محفظة العميل '+row.user_id.slice(0,8).toUpperCase(),[
  ['ليبيانا',din(row.balance)],['المدار',din(row.madar_balance)],['آخر تعديل',stamp(row.updated_at)]
 ]);
 const render=()=>displayItems(rows,list,draw,inp.value,row=>row.user_id);
 inp.addEventListener('input',render);render();note(root,'عرض الأرصدة للمدير فقط. لا تسمح هذه الصفحة بتغيير الرصيد دون عملية مالية موثّقة.');
}
async function accounts(root){
 const api=await guarded();
 const {data,error}=await api.rpc('admin_store_accounts',{p_search:'',p_offset:0,p_limit:50});
 if(error)throw Error(error.message);
 appendStats(root,[['الحسابات المسجلة',data?.registered_total||0],['آخر 7 أيام',data?.registered_week||0]]);
 const inp=searchInput('اسم أو بريد أو معرف حساب');root.append(inp);
 const list=make('div','ma-list');root.append(list);
 const rows=data?.rows||[];
 async function runSearch(text){
  const {data:found,error}=await (await guarded()).rpc('admin_store_accounts',{p_search:text,p_offset:0,p_limit:50});
  if(error)throw Error(error.message);
  list.replaceChildren();
  if(!(found?.rows||[]).length){empty(list);return}
  found.rows.forEach(a=>list.append(card(a.display_name||'زبون',[
   ['البريد',a.email||'—'],['المعرف',a.id.slice(0,8).toUpperCase()],
   ['التسجيل',stamp(a.created_at)],['آخر دخول',stamp(a.last_sign_in_at)],
   ['عدد الطلبات',fmt(a.order_count)],['مكتملة',fmt(a.completed_orders)],['رصيد ليبيانا',din(a.wallet_balance)]
  ])));
  note(list,'المعروض '+(found.rows||[]).length+' من '+fmt(found.total)+' حساب.');
 }
 await runSearch('');
 let timer;inp.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>runSearch(inp.value.trim()).catch(e=>msg(e.message,'error')),350)});
}
async function visitors(root){
 const {data,error}=await (await guarded()).rpc('admin_store_visitors');
 if(error)throw Error(error.message);
 const summary=data?.summary||{};
 appendStats(root,[['زوار اليوم',summary.today_visitors||0],['آخر 7 أيام',summary.week_visitors||0],['متصفحات مميزة',summary.all_time_visitors||0],['الجلسات',summary.total_visits||0]]);
 title(root,'آخر 14 يوم');
 const rows=make('div','ma-list');
 (data?.daily||[]).slice().reverse().forEach(day=>rows.append(card(day.date,[['جلسات',fmt(day.sessions)],['زوار مميزون',fmt(day.visitors)]])));
 root.append(rows);note(root,'هذه متصفحات مميزة وليست بالضرورة أشخاصًا أو ضيوفًا غير مسجلين.');
}
function keepFrameInsideApp(frame){
 frame.addEventListener('load',()=>{
  try{
   const doc=frame.contentDocument;
   if(!doc)return;
   // Only the admin report/OMNEX screens are embedded, never the customer storefront.
   if(/\/index\.html$/.test(frame.contentWindow.location.pathname)){
    frame.src='about:blank';location.hash='';show('overview');return;
   }
   doc.addEventListener('click',event=>{
    const a=event.target.closest?.('a[href]');
    if(!a)return;
    const href=a.getAttribute('href')||'';
    if(/(?:^|\/)index\.html(?:[?#]|$)/i.test(href)){
     event.preventDefault();event.stopPropagation();
     location.hash='';show('overview');
    }
   },true);
  }catch(e){console.warn('[L1017n Admin] Embedded admin page navigation guard unavailable',e)}
 });
}
async function finance(root){
 const orders=await records('purchase_orders','id,total_amount,status,created_at,product_name',150);
 const completed=orders.filter(x=>x.status==='completed');
 const revenue=completed.reduce((s,x)=>s+Number(x.total_amount||0),0);
 const pending=orders.filter(x=>['paid_pending_fulfillment','approved','processing','fulfilling'].includes(x.status));
 appendStats(root,[['طلبات مكتملة',completed.length],['إيراد المكتملة (د.ل)',revenue],['طلبات قيد التنفيذ',pending.length],['مرتجعات/مرفوضة',orders.filter(x=>['refunded','rejected'].includes(x.status)).length]]);
 note(root,'الإيراد لا يساوي صافي الربح؛ لا يُحتسب الربح دون تكاليف المنتجات والمورد.');
 title(root,'تقرير المبيعات التفصيلي');
 const frame=make('iframe','ma-frame');
 frame.title='تفاصيل المبيعات داخل تطبيق الإدارة';frame.loading='lazy';frame.src='./admin-reports.html?embedded=1&sales-only=1&v=manage-native-1';keepFrameInsideApp(frame);
 root.append(frame);
}
async function reviews(root){
 const api=await guarded();
 const {data,error}=await api.from('store_customer_reviews').select('id,product_name,rating,comment,visible,created_at').order('created_at',{ascending:false}).limit(100);
 if(error)throw Error(error.message);
 const rows=data||[];appendStats(root,[['التقييمات',rows.length],['المعروضة',rows.filter(x=>x.visible).length]]);
 const list=make('div','ma-list');root.append(list);
 for(const row of rows){
  const item=card(row.product_name||'تقييم',[
   ['التقييم',String(row.rating)+' / 5'],['التاريخ',stamp(row.created_at)],
   ['الرأي',row.comment||'بدون تعليق'],['الظهور',row.visible?'ظاهر':'مخفي']
  ],[{label:row.visible?'إخفاء التقييم':'إظهار التقييم',onClick:async()=>{
   if(!await confirmStep('تغيير ظهور التقييم','هل تريد '+(row.visible?'إخفاء':'إظهار')+' هذا التقييم؟'))return;
   try{await invoke('admin_set_store_review_visibility',{p_review_id:row.id,p_visible:!row.visible});msg('تم التعديل.','ok');setTimeout(()=>load('reviews'),750)}
   catch(e){msg(e.message,'error')}
  }}]);list.append(item);
 }
 if(!rows.length)empty(list);
}
async function omnex(root){
 note(root,'يمكنك التحكم في أسعار المورد ومزامنة منتجاته داخل التطبيق، باستخدام لوحة المورد المحمية الموجودة.');
 const frame=make('iframe','ma-frame ma-frame-big');
 frame.title='إدارة المورد OMNEX داخل التطبيق';
 frame.src='./admin-omnex.html?embedded=1&v=manage-native-1';keepFrameInsideApp(frame);
 frame.loading='lazy';root.append(frame);
}
async function load(key){
 if(!PAGES[key]||key==='overview'||$('#dashboard')?.hidden)return;
 const seq=++sequence,root=$('#maContent');
 root.replaceChildren(make('div','ma-loading','جاري تحميل البيانات من المتجر…'));
 msg('');
 try{
  await guarded();if(seq!==sequence)return;
  root.replaceChildren();
  await ({orders,topups,products,stock,wallets,accounts,visitors,finance,reviews,omnex})[key](root);
  if(seq!==sequence)return;
 }catch(error){
  if(seq!==sequence)return;
  root.replaceChildren();
  msg(error?.message||'تعذر تحميل هذا القسم.','error');
  empty(root,'حاول التحديث بعد التأكد من اتصال الإنترنت وحساب المدير.');
 }
}
})();
