/* OMNEX Roblox storefront. Supplier credentials and financial settlement stay on the server. */
(function(){
'use strict';
const api=()=>typeof supabaseClient!=='undefined'?supabaseClient:null;
let catalog=[],dialog=null,quote=null,currentProduct=null,currentOrder=null,requestKey=null,owner='',liveUser='',generation=0,buying=false,polling=false,watching=false,lastPending=new Set();
const $=s=>dialog?.querySelector(s),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const cash=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v).toFixed(2)+' د.ل':'السعر غير متاح';
const errors={unauthorized:'سجّل دخولك أولًا.',insufficient_balance:'رصيد محفظتك غير كافٍ.',phone_verification_required_before_purchase:'وثّق رقم هاتفك من حسابي أولًا.',supplier_out_of_stock:'هذه الباقة غير متوفرة حاليًا.',product_not_available:'هذه الباقة غير متاحة حاليًا.',supplier_sales_paused:'الشراء متوقف مؤقتًا. حاول لاحقًا.',supplier_price_unavailable:'تعذر التحقق من سعر الباقة الآن. حاول بعد قليل.',supplier_wallet_changed:'الباقة غير متاحة للدفع حاليًا.',supplier_price_requires_review:'سعر الباقة قيد التحديث. حاول لاحقًا.',quote_expired:'انتهت صلاحية السعر. حدّث السعر وأكّد من جديد.',missing_product_field:'أكمل بيانات الباقة المطلوبة.',invalid_product_fields:'راجع بيانات المستفيد.',unsupported_product_fields:'هذه الباقة تحتاج مراجعة قبل عرضها للبيع.',supplier_order_already_pending:'عندك طلب لهذه الباقة قيد التنفيذ. تابعه من طلباتي.',too_many_pending_orders:'تابع طلباتك الحالية قبل إنشاء طلب آخر.',quote_rate_limit:'انتظر قليلًا ثم حاول مجددًا.'};
async function invoke(body){const db=api();if(!db)throw Error('supplier_unavailable');const {data,error}=await db.functions.invoke('l1017n-omnex',{body});if(error){let code;try{code=(await error.context?.json())?.error}catch{}throw Error(code||'supplier_unavailable')}if(data?.error)throw Error(data.error);return data}
function pendingKey(user,product){return 'l1017n:omnex:pending:'+user+':'+product}
function clearPending(){try{localStorage.removeItem(pendingKey(owner,currentProduct?.id))}catch{}}
function refreshStore(){if(typeof renderWallet==='function')void Promise.resolve(renderWallet()).catch(()=>{});if(typeof renderOrders==='function'&&!document.querySelector('#ordersView')?.classList.contains('hidden'))void Promise.resolve(renderOrders()).catch(()=>{});window.dispatchEvent(new Event('l1017n:orders-updated'))}
function watchAuth(){const db=api();if(!db||watching)return;watching=true;db.auth.onAuthStateChange((_event,session)=>{const uid=session?.user?.id||'';if(liveUser&&uid!==liveUser){generation++;dialog?.close();quote=null;currentOrder=null;owner='';lastPending.clear()}liveUser=uid})}
function close(){if(buying)return;generation++;dialog?.close()}
function status(text){if($('.ox-status'))$('.ox-status').textContent=text}
function showOrder(order){
 if(!dialog?.open||owner!==liveUser)return;
 currentOrder=order;$('.ox-form').hidden=true;$('.ox-progress').hidden=false;$('.ox-progress').replaceChildren();
 const area=$('.ox-progress'),final=order.state==='completed'||order.state==='refunded';
 area.append(make('h3','',order.state==='completed'?'تم تنفيذ طلبك ✓':order.state==='refunded'?'تم إرجاع المبلغ':'طلبك قيد المتابعة'));
 area.append(make('p','',order.product_name));area.append(make('small','ox-order-id','#'+String(order.order_id).slice(0,8).toUpperCase()));
 const msg=order.state==='completed'?'منتجك جاهز. يمكنك الرجوع له من طلباتي.':order.state==='refunded'?'رجع المبلغ إلى محفظتك.':order.state==='review'?'الطلب قيد المراجعة لدى المورد. لا تعاود الشراء؛ المبلغ محفوظ على نفس الطلب.':'ننتظر تنفيذ المورد، ونتابع حالته تلقائيًا حتى لو أغلقت الصفحة.';
 area.append(make('p','',msg));
 if(order.state==='completed'&&Array.isArray(order.codes))for(const code of order.codes){const value=make('pre','ox-code',String(code)),copy=make('button','ox-soft','نسخ الكود');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(String(code));copy.textContent='تم النسخ ✓'}catch{copy.textContent='اضغط مطولًا على الكود لنسخه'}};area.append(value,copy)}
 const orders=make('button','ox-primary','فتح طلباتي');orders.type='button';orders.onclick=()=>{close();if(typeof switchView==='function')switchView('orders')};area.append(orders);status('');
 if(final){clearPending();refreshStore()}
}
async function quoteProduct(product,seq){
 $('.ox-form').hidden=true;$('.ox-progress').hidden=true;$('.ox-refresh').hidden=true;status('جاري التحقق من الباقة والسعر…');
 try{const data=await invoke({action:'quote',id:product.id});if(seq!==generation||!dialog.open||owner!==liveUser)return;quote=data;
 $('.ox-name').textContent=data.name;$('.ox-region').textContent=data.region||'روبلوكس';$('.ox-price').textContent=cash(data.price);
 $('.ox-fields').replaceChildren();for(const field of data.fields||[]){const label=make('label','ox-field',field.label);label.htmlFor='ox-'+field.key;let input;if(field.type==='select'){input=make('select');const blank=make('option','','اختر');blank.value='';input.append(blank);for(const op of field.options){const o=make('option','',op.label);o.value=op.value;input.append(o)}}else{input=make('input');input.type='text';input.inputMode=field.type==='number'?'numeric':'text';input.maxLength=200;input.autocomplete='off'}input.id=label.htmlFor;input.name=field.key;input.required=field.required;label.append(input);$('.ox-fields').append(label)}
 $('.ox-terms').checked=false;$('.ox-submit').disabled=false;$('.ox-submit').textContent='تأكيد الشراء · '+cash(data.price);$('.ox-form').hidden=false;status('');
 }catch(err){if(seq===generation){status(errors[err.message]||'تعذر تحميل الباقة. حاول مرة ثانية.');$('.ox-refresh').hidden=false}}
}
function mount(){if(dialog)return;dialog=make('dialog','ox-checkout');dialog.id='omnexCheckout';dialog.dir='rtl';dialog.setAttribute('aria-labelledby','oxTitle');dialog.innerHTML='<header class="ox-dialog-head"><h2 id="oxTitle">تأكيد الباقة</h2><button type="button" class="ox-close" aria-label="إغلاق">×</button></header><div class="ox-summary"><img src="game-covers/robux-100-tokens.svg" alt="" aria-hidden="true"><div><strong class="ox-name"></strong><small class="ox-region"></small></div><b class="ox-price"></b></div><form class="ox-form" hidden><div class="ox-fields"></div><p class="ox-delivery-note">تابع تنفيذ الطلب واستلام منتجك من «طلباتي».</p><label class="ox-accept"><input type="checkbox" class="ox-terms" required><span>راجعت الباقة والمنطقة وبيانات المستفيد وأوافق على <a href="https://omnex.ly/terms.html" target="_blank" rel="noopener noreferrer">شروط المنتجات الرقمية</a>.</span></label><button type="submit" class="ox-primary ox-submit">تأكيد الشراء</button></form><div class="ox-progress" hidden></div><p class="ox-status" role="status" aria-live="polite"></p><button type="button" class="ox-soft ox-refresh" hidden>تحديث السعر</button><button type="button" class="ox-soft ox-phone" hidden>توثيق رقم الهاتف</button>';document.body.append(dialog);
 $('.ox-close').onclick=close;dialog.addEventListener('cancel',e=>{if(buying)e.preventDefault();else generation++});
 $('.ox-refresh').onclick=()=>quoteProduct(currentProduct,++generation);
 $('.ox-phone').onclick=()=>{close();window.openPhoneVerificationPage?.()};
 $('.ox-form').onsubmit=async event=>{
 event.preventDefault();if(buying||!quote||currentOrder||!$('.ox-terms').checked)return;
 const fields={};for(const input of $('.ox-fields').querySelectorAll('input,select'))if(input.value.trim())fields[input.name]=input.value.trim();
 const body={action:'purchase',id:currentProduct.id,quote_id:quote.quote_id,client_key:requestKey,accepted_terms:true,fields};
 try{localStorage.setItem(pendingKey(owner,currentProduct.id),JSON.stringify({client_key:requestKey,product:currentProduct.id}))}catch{}
 buying=true;$('.ox-submit').disabled=true;status('جاري تسجيل طلبك بأمان…');const seq=generation;
 try{const result=await invoke(body);if(seq!==generation||owner!==liveUser)return;showOrder(result);refreshStore();void api().functions.invoke('l1017n-purchase-notify',{body:{order_id:result.order_id}}).catch(()=>{});}
 catch(err){if(seq!==generation)return;
 if(err.message==='quote_expired'){status(errors.quote_expired);$('.ox-form').hidden=true;$('.ox-refresh').hidden=false}
 else{status(errors[err.message]||'لم نتأكد من نتيجة الاتصال. تابع طلباتي أو حاول المتابعة؛ ما نعيدش الخصم لنفس المحاولة.');$('.ox-submit').disabled=false;$('.ox-submit').textContent='متابعة الطلب';if(err.message==='phone_verification_required_before_purchase')$('.ox-phone').hidden=false;
 try{const resumed=await invoke({action:'resume',client_key:requestKey});if(resumed?.order_id&&seq===generation)showOrder(resumed)}catch{}}
 }finally{buying=false}
 };
}
async function openProduct(product){
 const db=api();if(!db)return;watchAuth();const {data,error}=await db.auth.getUser();if(error||!data?.user){if(typeof toast==='function')toast('سجّل دخولك أولًا لشراء الباقة');if(typeof switchView==='function')switchView('account');return}
 liveUser=data.user.id;owner=liveUser;mount();generation++;const seq=generation;quote=null;currentOrder=null;currentProduct=product;requestKey=crypto.randomUUID();buying=false;
 try{const saved=JSON.parse(localStorage.getItem(pendingKey(owner,product.id))||'null');if(saved?.client_key)requestKey=saved.client_key}catch{}
 $('.ox-name').textContent=product.name;$('.ox-region').textContent=product.region||'';$('.ox-price').textContent=cash(product.price);$('.ox-form').hidden=true;$('.ox-progress').hidden=true;$('.ox-phone').hidden=true;dialog.showModal();status('جاري تحميل الباقة…');
 try{const previous=await invoke({action:'resume',client_key:requestKey});if(seq!==generation)return;if(previous?.order_id){showOrder(previous);return}}catch{}
 if(seq===generation)await quoteProduct(product,seq);
}
window.openRobloxCodesPage=function(root){
 if(!root||root.id!=='robloxGamePage'||!root.isConnected)return;
 const old=root.querySelector('.rgp-grid,.rgp-method-page');if(!old)return;
 const page=make('section','rgp-method-page ox-catalog');old.replaceWith(page);root.classList.add('rgp-inner-page');root.classList.remove('rgp-category-hub');root.querySelector('.rgp-hub-subtitle')?.remove();if(typeof window.setRobloxInnerHeader==='function')window.setRobloxInnerHeader(root,'باقات وأكواد Roblox','codes');root.scrollTop=0;
 page.innerHTML='<header class="ox-catalog-head"><h2>باقات وأكواد روبلوكس</h2><p>اختر الباقة والمنطقة المناسبة لحسابك.</p></header><div class="ox-filters"><input type="search" class="ox-search" aria-label="ابحث عن باقة روبلوكس" placeholder="ابحث عن باقة"><select class="ox-filter-region" aria-label="المنطقة"><option value="">كل المناطق</option></select><label><input type="checkbox" class="ox-instock" checked> المتوفر فقط</label></div><p class="ox-catalog-status" role="status">جاري تحميل الباقات…</p><div class="ox-catalog-grid"></div><button class="ox-more ox-soft" type="button" hidden>عرض المزيد</button>';
 let limit=12;function draw(){const query=page.querySelector('.ox-search').value.trim().toLowerCase(),region=page.querySelector('.ox-filter-region').value,availableOnly=page.querySelector('.ox-instock').checked;const list=catalog.filter(p=>(!query||(p.name+' '+p.region).toLowerCase().includes(query))&&(!region||p.region===region)&&(!availableOnly||p.available));const grid=page.querySelector('.ox-catalog-grid');grid.replaceChildren();for(const p of list.slice(0,limit)){const card=make('button','ox-product');card.type='button';card.disabled=!p.available;card.setAttribute('aria-label',p.name+'، '+p.region+'، '+cash(p.price));const pic=make('img');pic.src='game-covers/robux-100-tokens.svg';pic.alt='';pic.loading='lazy';const info=make('span','ox-product-info');info.append(make('strong','',p.name),make('small','',p.region));const price=make('b','ox-product-price',cash(p.price)),stock=make('small','ox-product-stock',p.available?'اختيار الباقة ←':'غير متوفر');info.append(price,stock);card.append(pic,info);card.onclick=()=>openProduct(p);grid.append(card)}page.querySelector('.ox-catalog-status').textContent=list.length?'':'لا توجد باقات متاحة لهذا الاختيار.';page.querySelector('.ox-more').hidden=list.length<=limit}
 page.querySelector('.ox-search').oninput=()=>{limit=12;draw()};page.querySelector('.ox-filter-region').onchange=()=>{limit=12;draw()};page.querySelector('.ox-instock').onchange=()=>{limit=12;draw()};page.querySelector('.ox-more').onclick=()=>{limit+=12;draw()};
 (async()=>{try{const {data,error}=await api().rpc('get_public_omnex_roblox_catalog');if(!page.isConnected)return;if(error)throw error;catalog=Array.isArray(data?.products)?data.products:[];if(!data?.enabled){page.querySelector('.ox-catalog-status').textContent='الباقات قيد التحديث. جرّب مرة ثانية بعد قليل.';return}const select=page.querySelector('.ox-filter-region');[...new Set(catalog.map(p=>p.region))].sort().forEach(region=>{const op=make('option','',region||'روبلوكس');op.value=region;select.append(op)});draw()}catch{if(page.isConnected)page.querySelector('.ox-catalog-status').textContent='تعذر تحميل الباقات. حاول مرة ثانية.'}})();
};
async function poll(){
 if(polling||document.visibilityState==='hidden'||!api())return;polling=true;watchAuth();
 try{const {data:auth}=await api().auth.getUser();if(!auth?.user)return;const uid=auth.user.id;liveUser=uid;const {data,error}=await api().rpc('get_my_omnex_orders');if(error)return;const jobs=Array.isArray(data)?data:[];const ids=new Set(jobs.map(j=>j.order_id));if([...lastPending].some(id=>!ids.has(id)))refreshStore();lastPending=ids;
 const targets=new Set(jobs.slice(0,3).map(j=>j.order_id));if(dialog?.open&&owner===uid&&currentOrder?.order_id&&!['completed','refunded'].includes(currentOrder.state))targets.add(currentOrder.order_id);
 for(const id of targets){try{const order=await invoke({action:'order',order_id:id});if(liveUser!==uid)return;if(dialog?.open&&owner===uid&&currentOrder?.order_id===id)showOrder(order)}catch{}}
 }finally{polling=false}
}
setInterval(()=>void poll(),15000);setTimeout(()=>void poll(),5000);document.addEventListener('visibilitychange',()=>void poll());window.addEventListener('l1017n:orders-updated',()=>{if(!polling)void poll()});
})();
