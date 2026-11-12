/* OMNEX Roblox storefront. Supplier credentials and financial settlement stay on the server. */
(function(){
'use strict';
const api=()=>typeof supabaseClient!=='undefined'?supabaseClient:null;
let dialog=null,quote=null,currentProduct=null,currentOrder=null,requestKey=null,owner='',liveUser='',generation=0,buying=false,polling=false,watching=false,lastPending=new Set();
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
 $('.ox-name').textContent=data.name;$('.ox-region').textContent=data.region||(currentProduct?.game==='pubg'?'ببجي موبايل':'روبلوكس');$('.ox-price').textContent=cash(data.price);
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
 $('.ox-name').textContent=product.name;$('.ox-region').textContent=product.region||'';$('.ox-price').textContent=cash(product.price);$('.ox-summary img').src=product.game==='pubg'?'game-covers/pubg-uc.svg':'game-covers/robux-100-tokens.svg';$('.ox-form').hidden=true;$('.ox-progress').hidden=true;$('.ox-phone').hidden=true;dialog.showModal();status('جاري تحميل الباقة…');
 try{const previous=await invoke({action:'resume',client_key:requestKey});if(seq!==generation)return;if(previous?.order_id){showOrder(previous);return}}catch{}
 if(seq===generation)await quoteProduct(product,seq);
}
// Only Roblox US codes are displayed in the storefront catalog.
// Supplier catalog records are not deleted or modified.
const regionLabels = new Map([
 ['أمريكي', 'روبلوكس أمريكا'],
]);

const regionFlags = new Map([
 ['أمريكي', '🇺🇸'],
]);

function regionArtwork(key, label) {
 const art = make('span', 'ox-cover');
 const giftCard = make('span', 'ox-gift-card');
 const image = make('img', 'ox-gift-mark');
 image.src = 'game-covers/roblox-mark.svg';
 image.alt = '';
 image.width = 56;
 image.height = 56;
 const region = make('span', 'ox-gift-region');
 const flag = regionFlags.get(key);
 if (flag) {
  const icon = make('span', '', flag);
  icon.setAttribute('aria-hidden', 'true');
  region.append(icon);
 }
 region.append(make('span', '', label.replace(/^روبلوكس /, '')));
 giftCard.append(image, make('span', 'ox-gift-brand', 'ROBLOX'), region);
 art.append(giftCard);
 return art;
}

function productCard(product, regionLabel, regionKey) {
 const card = make('button', 'ox-product');
 card.type = 'button';
 card.disabled = !product.available;
 const availability = product.available ? 'شراء' : 'الكمية نفدت';
 card.setAttribute('aria-label', [product.name, regionLabel, cash(product.price), availability].join('، '));
 const art = regionArtwork(regionKey, regionLabel);
 if (!product.available) art.append(make('span', 'ox-sold-out', availability));
 const info = make('span', 'ox-product-info');
 info.append(
  make('strong', '', product.name),
  make('b', 'ox-product-price', cash(product.price)),
  make('span', 'ox-buy', availability),
 );
 card.append(art, info);
 card.onclick = () => openProduct(product);
 return card;
}

window.openOmnexProductCheckout = openProduct;

window.openRobloxCodesPage = async function(root) {
 if (!root || root.id !== 'robloxGamePage' || !root.isConnected) return;
 const old = root.querySelector('.rgp-grid,.rgp-method-page');
 if (!old) return;
 const page = make('section', 'rgp-method-page ox-catalog');
 old.replaceWith(page);
 root.classList.add('rgp-inner-page');
 root.classList.remove('rgp-category-hub');
 root.querySelector('.rgp-hub-subtitle')?.remove();
 window.setRobloxInnerHeader?.(root, 'باقات وأكواد Roblox', 'codes');
 root.scrollTop = 0;
 page.innerHTML = `
  <header class="ox-catalog-head"><h2 tabindex="-1">أكواد روبلوكس</h2></header>
  <p class="ox-catalog-status" role="status">جاري تحميل الأقسام…</p>
  <div class="ox-region-grid" aria-label="أقسام روبلوكس حسب المنطقة" hidden></div>
  <div class="ox-region-products" hidden>
   <button class="ox-region-back ox-soft" type="button">→ كل المناطق</button>
   <div class="ox-filters">
    <input type="search" class="ox-search" aria-label="ابحث في باقات المنطقة" placeholder="ابحث في الباقات">
    <label><input type="checkbox" class="ox-instock" checked> المتوفر فقط</label>
   </div>
   <div class="ox-catalog-grid"></div>
   <button class="ox-more ox-soft" type="button" hidden>عرض المزيد</button>
  </div>`;
 const heading = page.querySelector('h2');
 const status = page.querySelector('.ox-catalog-status');
 const menu = page.querySelector('.ox-region-grid');
 const products = page.querySelector('.ox-region-products');
 const grid = page.querySelector('.ox-catalog-grid');
 const search = page.querySelector('.ox-search');
 const inStock = page.querySelector('.ox-instock');
 const more = page.querySelector('.ox-more');
 let activeRegion, activeButton, limit = 12;

 function drawProducts() {
  const query = search.value.trim().toLowerCase();
  const matches = activeRegion.items.filter(product =>
   (!inStock.checked || product.available) && product.name.toLowerCase().includes(query)
  );
  grid.replaceChildren(...matches.slice(0, limit).map(product => productCard(product, activeRegion.label, activeRegion.key)));
  status.textContent = matches.length ? '' : 'لا توجد باقات تطابق اختيارك.';
  more.hidden = matches.length <= limit;
 }

 function openRegion(region, button) {
  activeRegion = region;
  activeButton = button;
  heading.textContent = region.label;
  menu.hidden = true;
  products.hidden = false;
  search.value = '';
  inStock.checked = false;
  limit = 12;
  drawProducts();
  root.scrollTop = 0;
  heading.focus({preventScroll: true});
 }

 page.querySelector('.ox-region-back').onclick = () => {
  heading.textContent = 'أكواد روبلوكس';
  products.hidden = true;
  grid.replaceChildren();
  status.textContent = '';
  menu.hidden = false;
  root.scrollTop = 0;
  activeButton.focus({preventScroll: true});
 };
 search.oninput = inStock.onchange = () => { limit = 12; drawProducts(); };
 more.onclick = () => { limit += 12; drawProducts(); };

 try {
  const {data, error} = await api().rpc('get_public_omnex_roblox_catalog');
  if (!page.isConnected) return;
  if (error) throw error;
  if (!data?.enabled) {
   status.textContent = 'الباقات قيد التحديث. جرّب مرة ثانية بعد قليل.';
   return;
  }
  const groups = new Map();
  for (const product of data.products || []) {
   const key = product.region?.trim() || '';
   if (key !== 'أمريكي') continue; // Hide global and other non-US Roblox codes.
   if (/\bUSD\b/i.test(product.name)) continue;
   const label = regionLabels.get(key);
   if (!label) continue;
   if (!groups.has(key)) groups.set(key, {key, label, items: []});
   groups.get(key).items.push(product);
  }
  for (const key of regionLabels.keys()) {
   const region = groups.get(key);
   if (!region) continue;
   const count = region.items.filter(product => product.available).length;
   const button = make('button', 'ox-region-card');
   button.type = 'button';
   const info = make('span', 'ox-region-info');
   info.append(make('strong', '', region.label), make('small', '', count ? 'المتوفر: ' + count : 'غير متوفر حاليًا'));
   const arrow = make('span', 'ox-region-arrow', '←');
   arrow.setAttribute('aria-hidden', 'true');
   const footer = make('span', 'ox-region-footer');
   footer.append(info, arrow);
   button.append(regionArtwork(key, region.label), footer);
   button.onclick = () => openRegion(region, button);
   menu.append(button);
  }
  menu.hidden = !groups.size;
  status.textContent = groups.size ? '' : 'لا توجد باقات روبلوكس حاليًا.';
 } catch {
  if (page.isConnected) status.textContent = 'تعذر تحميل الأقسام. حاول مرة ثانية.';
 }
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
