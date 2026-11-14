/* OMNEX Roblox supplier catalog. Admin only; prices stay private drafts. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const db=window.supabase.createClient('https://cmtxsjlehjworqypbxjz.supabase.co','sb_publishable_NrahtO5qp8p4OgjODMbxdQ_XqbUWSAk',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let rows=[],busy=false,closed=false,salesEnabled=false,markup=10;
if(new URLSearchParams(location.search).get('embedded')==='1')$('#omnexBack').hidden=true;
const money=(n,unit)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})+' '+(unit==='USD'?'$':unit==='LIBYANA'?'د.ل ليبيانا':'د.ل');
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function failClosed(){closed=true;rows=[];$('#omnexProducts').replaceChildren();$('#omnexWorkspace').hidden=true;$('#omnexAuthStatus').textContent='هذه الصفحة مخصّصة لحساب إدارة المتجر. سجّل دخولك من الموقع أولًا.'}
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw error;return data}
function render(){
const query=$('#omnexSearch').value.trim().toLowerCase(),group=$('#omnexGroup').value,availableOnly=$('#omnexOnlyAvailable').checked;
const list=$('#omnexProducts');list.replaceChildren();
const filtered=rows.filter(p=>(!query||(p.name+' '+p.group_name).toLowerCase().includes(query))&&(!group||p.group_name===group)&&(!availableOnly||p.available));
for(const p of filtered){
const card=node('article','om-card'),head=node('header'),info=node('div');info.append(node('strong','om-name',p.name),node('span','om-group',p.group_name||'روبلوكس'));
const stock=node('span','om-stock',p.available?'متوفر':'غير متوفر');stock.dataset.available=String(p.available);head.append(info,stock);
const cost=node('div','om-cost');cost.append(node('span','','تكلفة المورد'),node('b','',p.supplier_cost?money(p.supplier_cost,p.unit):'غير متاح'));
const label=node('label','om-price-label','سعر بيع مخصص (اتركه فارغًا للسعر التلقائي)');label.htmlFor='omPrice-'+p.supplier_product_id;
const form=node('form','om-price-form'),input=node('input');input.id=label.htmlFor;input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=12;input.placeholder='تلقائي: '+Number(p.retail_price||0).toFixed(2);input.value=p.sale_price?Number(p.sale_price).toFixed(2):'';
const save=node('button','','حفظ');save.type='submit';form.append(input,save);const status=node('p','om-feedback','سعر البيع: '+Number(p.retail_price||0).toFixed(2)+' د.ل');status.setAttribute('role','status');
form.addEventListener('submit',async e=>{e.preventDefault();if(closed)return;const raw=input.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));const price=raw?Number(raw):null;
if(raw&&(!/^\d+(\.\d{1,2})?$/.test(raw)||!Number.isFinite(price)||price<=0||price>100000)){status.textContent='اكتب سعرًا صحيحًا، بحد أقصى منزلتين عشريتين.';return}
if(p.wallet!=='libyana'){status.textContent='محفظة المورد مختلفة. حدّد طريقة التحويل قبل التسعير.';return}
if(price!==null&&(!p.supplier_cost||price<Number(p.supplier_cost))){status.textContent='سعر البيع أقل من تكلفة المورد.';return}
save.disabled=true;status.textContent='جاري حفظ السعر…';try{await rpc('set_omnex_roblox_draft_price',{p_product_id:p.supplier_product_id,p_price:price});p.sale_price=price;status.textContent='تم حفظ سعر البيع. السعر النهائي يظهر للعميل قبل التأكيد.';$('#omnexPriced').textContent=rows.filter(x=>x.sale_price).length}catch(err){status.textContent=String(err.message||'').includes('sale_price_below_cost')?'تكلفة المورد تغيّرت أو السعر أقل من التكلفة. حدّث المنتجات.':'تعذر الحفظ. تحقق من اتصالك وصلاحية حسابك.'}finally{save.disabled=false}});
const visible=node('label','om-published');const toggle=node('input');toggle.type='checkbox';toggle.checked=p.published===true;visible.append(toggle,node('span','','ظاهر للزبائن'));toggle.onchange=async()=>{toggle.disabled=true;try{await rpc('admin_set_omnex_product',{p_product:p.supplier_product_id,p_published:toggle.checked});p.published=toggle.checked}catch{toggle.checked=p.published;status.textContent='تعذر تغيير ظهور المنتج.'}finally{toggle.disabled=false}};
card.append(head,cost,visible,label,form,status);list.append(card);
}
if(!filtered.length)list.append(node('p','','لا توجد منتجات مطابقة للبحث.'));
}
async function load(){
const data=await rpc('get_omnex_roblox_admin_catalog');if(closed)return;
rows=Array.isArray(data.products)?data.products:[];salesEnabled=data.purchasing_enabled===true;markup=Number(data.markup_percent)||0;$('#omnexMarkup').value=markup;$('#omnexSalesState').textContent=salesEnabled?'البيع الآلي مفعّل':'البيع متوقف مؤقتًا';$('#omnexPause').textContent=salesEnabled?'إيقاف البيع':'تفعيل البيع';
$('#omnexTotal').textContent=rows.length;$('#omnexAvailable').textContent=rows.filter(p=>p.available).length;$('#omnexPriced').textContent=rows.filter(p=>p.sale_price).length;
$('#omnexSyncTime').textContent=data.synced_at?'آخر تحديث: '+new Date(data.synced_at).toLocaleString('ar-LY'):'';
const previous=$('#omnexGroup').value;$('#omnexGroup').replaceChildren();const all=node('option','','جميع الفئات');all.value='';$('#omnexGroup').append(all);
[...new Set(rows.map(p=>p.group_name))].sort().forEach(name=>{const op=node('option','',name||'روبلوكس');op.value=name;$('#omnexGroup').append(op)});$('#omnexGroup').value=previous;
render();
}
$('#omnexSync').onclick=async()=>{
if(busy||closed)return;busy=true;$('#omnexSync').disabled=true;$('#omnexStatus').textContent='جاري جلب منتجات روبلوكس من المورد…';
try{const {data,error}=await db.functions.invoke('l1017n-omnex',{body:{action:'sync'}});if(error||!data?.ok)throw Error('sync_failed');await load();$('#omnexStatus').textContent='تم تحديث المنتجات. أسعار البيع المخصصة محفوظة.'}catch{$('#omnexStatus').textContent='تعذر تحديث المنتجات. تحقق من مفتاح OMNEX والمحفظة الرئيسية، ثم حاول مجددًا.'}finally{busy=false;$('#omnexSync').disabled=false}};
$('#omnexSyncPsn').onclick=async()=>{
 if(closed)return;
 const button=$('#omnexSyncPsn');button.disabled=true;
 $('#omnexPsnStatus').textContent='جاري جلب بطاقات البلايستيشن…';
 try {
  const {data,error}=await db.functions.invoke('l1017n-omnex',{body:{action:'sync_psn'}});
  if(error||!data?.ok)throw Error('sync_failed');
  const {data:catalog}=await db.rpc('get_public_omnex_psn_catalog');
  $('#omnexPsnStatus').textContent='تمت المزامنة: '+Number(data.imported||0)+' بطاقة. المتوفر للزبائن: '+(catalog?.products||[]).filter(p=>p.available).length+'.';
 } catch(_) {$('#omnexPsnStatus').textContent='لم تكتمل المزامنة. راجع فئات البطاقات في حساب Omnex والمخزون وصلاحيات API.';}
 finally {button.disabled=false;}
};
async function saveSettings(enabled){await rpc('admin_set_omnex_settings',{p_enabled:enabled,p_markup:Number($('#omnexMarkup').value)});await load();$('#omnexStatus').textContent='تم تحديث إعدادات البيع. الطلبات المؤكدة تظل قيد المتابعة.'}
$('#omnexSaveSettings').onclick=async()=>{try{await saveSettings(salesEnabled)}catch{$('#omnexStatus').textContent='تعذر حفظ الإعدادات. أدخل نسبة من 0 إلى 100.'}};
$('#omnexPause').onclick=async()=>{try{await saveSettings(!salesEnabled)}catch{$('#omnexStatus').textContent='تعذر تغيير حالة البيع.'}};
async function loadOrders(){try{const items=await rpc('admin_get_omnex_orders');const list=$('#omnexOrderList');list.replaceChildren();for(const item of items||[]){const box=node('article','om-order');box.append(node('strong','',item.product_name),node('small','','#'+String(item.order_id).slice(0,8).toUpperCase()+' · '+item.state));if(item.last_error)box.append(node('p','',item.last_error));if(!['completed','refunded'].includes(item.state)){const retry=node('button','','إعادة متابعة نفس الطلب');retry.type='button';retry.onclick=async()=>{retry.disabled=true;try{await rpc('admin_retry_omnex_order',{p_order:item.order_id});$('#omnexOrdersState').textContent='ستتم متابعة نفس المحاولة؛ لا يتم إنشاء شراء جديد.'}catch{$('#omnexOrdersState').textContent='تعذر إعادة المتابعة.'}finally{retry.disabled=false}};box.append(retry)}list.append(box)}$('#omnexOrdersState').textContent=items?.length?'':'لا توجد طلبات من المورد بعد.'}catch{$('#omnexOrdersState').textContent='تعذر تحميل الطلبات.'}}
$('#omnexReloadOrders').onclick=loadOrders;
$('#omnexSearch').addEventListener('input',render);$('#omnexGroup').addEventListener('change',render);$('#omnexOnlyAvailable').addEventListener('change',render);
db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')failClosed()});
(async()=>{try{const {data,error}=await db.auth.getUser();if(error||!data?.user||data.user.is_anonymous||await rpc('is_store_admin')!==true){failClosed();return}await load();void loadOrders();if(closed)return;$('#omnexAuthStatus').hidden=true;$('#omnexWorkspace').hidden=false;const {data:state,error:stateError}=await db.functions.invoke('l1017n-omnex',{body:{action:'status'}});$('#omnexConnection').textContent=!stateError&&state?.configured?'✓ OMNEX متصل · روبلوكس فقط':'تحقق من إعدادات OMNEX';}catch{failClosed()}})();
})();
