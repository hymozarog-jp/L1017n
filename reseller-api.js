/* Account-owned developer access. Full API keys live in memory only. */
(function(){
'use strict';
const endpoint='https://cmtxsjlehjworqypbxjz.supabase.co/functions/v1/l1017n-api';
const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/></svg>';
let page=null,owner=null,liveKey=null,trigger=null,busy=false,request=0,authListener=false;
const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:null;
function notify(message){if(typeof toast==='function')toast(message);else if(page)page.querySelector('[data-api-message]').textContent=message;}
function clearSecret(){liveKey=null;const box=page?.querySelector('[data-api-secret]');if(box){box.querySelector('textarea').value='';box.hidden=true;}}
function close(fromHistory=false){request++;clearSecret();owner=null;if(page?.open)page.close();if(!fromHistory&&history.state?.l1017nAPI===true)history.back();trigger?.focus({preventScroll:true});}
async function call(action,id){const c=client();if(!c)throw Error('unavailable');const {data,error}=await c.rpc('my_reseller_api',{p_action:action,...(id?{p_key_id:id}:{})});if(error)throw Error(error.message);return data;}
async function copy(value){try{await navigator.clipboard.writeText(value);notify('تم النسخ بنجاح')}catch{notify('تعذر النسخ التلقائي. اضغط مطولًا على النص لنسخه.')}}
function createPage(){
 if(page)return;
 page=document.createElement('dialog');page.id='resellerApiPage';page.dir='rtl';page.setAttribute('aria-labelledby','resellerApiTitle');
 page.innerHTML=`<div class="rap-shell"><header class="rap-header"><button type="button" class="rap-back" data-api-close aria-label="رجوع إلى حسابي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg></button><span>حسابك / المطورون</span><span class="rap-wordmark" dir="ltr">L1017n</span></header>
 <main><section class="rap-hero"><span class="rap-emblem">${icon}</span><span class="rap-kicker" dir="ltr">L1017N SUPPLIER API</span><h1 id="resellerApiTitle">اربط متجرك معنا.</h1><p>منتجات L1017n في متجرك، بطلبات مرتبطة بمحفظتك وحالة تسليم واضحة.</p><div class="rap-pills"><span>رصيد ليبيانا</span><span>الأسعار بالدينار الليبي</span><span>ربط من خادمك</span></div></section>
 <section class="rap-card rap-key-card" aria-labelledby="rapKeyTitle"><div class="rap-card-heading"><div><small>وصول خاص بحسابك</small><h2 id="rapKeyTitle">مفتاح API</h2></div><span class="rap-key-status" data-api-status>جاري التحقق…</span></div><div data-api-keyinfo class="rap-keyinfo"></div>
 <div data-api-secret class="rap-secret" hidden><b>انسخ مفتاحك الآن</b><p>يظهر كاملًا هذه المرة فقط. يتيح الطلب والخصم من محفظتك؛ احفظه في خادم متجرك.</p><textarea readonly dir="ltr" aria-label="مفتاح API الجديد" spellcheck="false"></textarea><button type="button" data-api-copy-secret>نسخ المفتاح</button></div>
 <p class="rap-feedback" data-api-message role="status" aria-live="polite"></p><div class="rap-actions"><button type="button" data-api-create hidden>إنشاء مفتاح API</button><button type="button" data-api-refresh class="rap-secondary">تحديث الحالة</button><button type="button" data-api-revoke class="rap-danger" hidden>إلغاء المفتاح</button></div>
 <div class="rap-confirm" data-api-confirm hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg><b>هل أنت متأكد من إلغاء المفتاح؟</b><p>سيتوقف الربط بهذا المفتاح فورًا. الطلبات الموجودة تبقى محفوظة في حسابك.</p><div class="rap-actions"><button type="button" class="rap-danger" data-api-confirm-revoke>تأكيد الإلغاء</button><button type="button" class="rap-secondary" data-api-cancel>تراجع</button></div></div></section>
 <section class="rap-card"><div class="rap-card-heading"><div><small>عنوان الربط</small><h2>نقطة الاتصال</h2></div><span class="rap-method">POST</span></div><code class="rap-endpoint" dir="ltr">${endpoint}</code><button type="button" class="rap-secondary" data-api-copy-endpoint>نسخ رابط API</button><p class="rap-muted">أرسل المفتاح في ترويسة Authorization بصيغة Bearer. لا تضعه في الرابط أو كود الصفحة العام.</p></section>
 <section class="rap-card"><h2>طريقة الربط</h2><div class="rap-steps"><div><b>اجلب المنتجات</b><p><code>products</code> يعرض أسعار البيع والتوفر. الرقم من الاستجابة هو معرّف المنتج.</p></div><div><b>تحقق من السعر</b><p>أرسل <code>quote</code> مع <code>product_id</code> لتحصل على السعر والحقول المطلوبة. للأكواد، احفظ <code>quote_id</code> ووقت صلاحيته.</p></div><div><b>أنشئ طلبًا</b><p>أرسل <code>purchase</code> مع الحقول والسعر المقبول و<code>request_id</code> بصيغة UUID. أعد استخدام نفس الرقم ونفس البيانات عند إعادة المحاولة، لتجنب تكرار الخصم.</p></div><div><b>تابع التسليم</b><p>أرسل <code>order</code> مع <code>order_id</code>. الأكواد تظهر في <code>codes</code> بعد اكتمال التسليم. المنتجات اليدوية تنفذها إدارة L1017n.</p></div></div><p class="rap-note">الشراء عبر API يخصم من محفظة الحساب. السعر هو سعر المتجر الحالي؛ لا توجد خصومات جملة مضافة تلقائيًا.</p></section>
 <section class="rap-card"><h2>أمثلة الطلبات</h2><p class="rap-muted">الأمثلة للتوضيح؛ استبدل القيم بما يرجع من حسابك، وأرسل JSON إلى عنوان الربط.</p><div class="rap-table-scroll"><table><thead><tr><th>العملية</th><th>JSON</th></tr></thead><tbody><tr><td>المنتجات</td><td><code>{"action":"products"}</code></td></tr><tr><td>الرصيد</td><td><code>{"action":"balance"}</code></td></tr><tr><td>تسعير المنتج</td><td><code>{"action":"quote","product_id":"PRODUCT_ID"}</code></td></tr><tr><td>حالة الطلب</td><td><code>{"action":"order","order_id":"ORDER_UUID"}</code></td></tr></tbody></table></div>
 <details><summary>مثال طلب شراء</summary><pre dir="ltr">{
  "action": "purchase",
  "product_id": "PRODUCT_ID",
  "request_id": "NEW_UUID_FOR_THIS_ORDER",
  "quote_id": "QUOTE_UUID_FOR_DIGITAL_PRODUCTS",
  "expected_price": "PRICE_FROM_QUOTE",
  "accepted_terms": true,
  "fields": { "username": "PLAYER_USERNAME" }
}</pre><p class="rap-muted">للمنتجات الرقمية، استخدم أسماء الحقول الموجودة في استجابة quote. لا تحتاج المنتجات اليدوية إلى quote_id. لا نطلب كلمة مرور اللاعب.</p></details>
 <details><summary>مثال اتصال من خادمك</summary><pre dir="ltr">curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"action":"balance"}'</pre></details>
 <details><summary>حالات الطلب والأخطاء</summary><p>paid_pending_fulfillment: تم الدفع وبانتظار التنفيذ · approved: تم القبول · processing / fulfilling: قيد التنفيذ · completed: تم التسليم · rejected / refunded: تم الرفض أو الاسترجاع.</p><p>401: مفتاح غير صالح · 404: الطلب غير موجود في حسابك · 409: رصيد غير كافٍ أو سعر تغير أو بيانات إعادة المحاولة مختلفة · 429: انتظر قبل إعادة الطلب.</p><p>الحد: 60 طلب API في الدقيقة لكل حساب، و10 طلبات شراء جديدة في الدقيقة. تظل حدود الشراء لدى المتجر سارية.</p></details></section></main><footer class="rap-footer">L1017n · توريد المنتجات الرقمية</footer></div>`;
 document.body.append(page);
 page.addEventListener('cancel',e=>{e.preventDefault();close()});
 page.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-api-close'))return close();
  if(button.hasAttribute('data-api-copy-endpoint'))return copy(endpoint);
  if(button.hasAttribute('data-api-copy-secret')){if(liveKey)return copy(liveKey);return;}
  if(button.hasAttribute('data-api-refresh'))return refresh();
  if(button.hasAttribute('data-api-revoke')){page.querySelector('[data-api-confirm]').hidden=false;page.querySelector('[data-api-confirm-revoke]').focus();return;}
  if(button.hasAttribute('data-api-cancel')){page.querySelector('[data-api-confirm]').hidden=true;return;}
  if(busy)return;
  if(button.hasAttribute('data-api-create')||button.hasAttribute('data-api-confirm-revoke')){
   busy=true;button.disabled=true;const generation=request,uid=owner;page.querySelector('[data-api-message]').textContent='جاري تنفيذ طلبك…';
   try{
    const making=button.hasAttribute('data-api-create');const info=await call(making?'create':'revoke',page.dataset.keyId);
    if(generation!==request||owner!==uid||!page.open)return;
    if(making){liveKey=info.key;const box=page.querySelector('[data-api-secret]');box.querySelector('textarea').value=liveKey;box.hidden=false;notify('تم إنشاء مفتاح API بنجاح. انسخه الآن.');}
    else{clearSecret();page.querySelector('[data-api-confirm]').hidden=true;notify('تم إلغاء مفتاح API بنجاح');}
    await refresh();
   }catch(err){if(generation===request){page.querySelector('[data-api-message]').textContent=/active_key_exists/.test(err.message)?'يوجد مفتاح مفعّل بالفعل. حدّث الحالة.':'تعذر تأكيد العملية. حدّث الحالة قبل المحاولة مرة أخرى.';notify('تعذر إكمال طلب API');}}
   finally{busy=false;button.disabled=false;}
  }
 });
 window.addEventListener('popstate',()=>{if(page.open&&history.state?.l1017nAPI!==true)close(true)});
}
async function refresh(){
 if(!page?.open||!owner)return;const generation=request;
 page.querySelector('[data-api-status]').textContent='جاري التحقق…';
 try{
  const data=await call('list');if(generation!==request||!page.open)return;
  const key=data?.keys?.[0];page.dataset.keyId=key?.id||'';
  page.querySelector('[data-api-status]').textContent=key?'مفعّل':'غير مفعّل';page.querySelector('[data-api-status]').classList.toggle('rap-active',!!key);
  const info=page.querySelector('[data-api-keyinfo]');info.replaceChildren();
  if(key){const hint=document.createElement('code');hint.dir='ltr';hint.textContent=key.hint;const meta=document.createElement('p');meta.textContent='طلبات الربط: '+Number(key.requests||0)+' · آخر استخدام: '+(key.last_used_at?new Date(key.last_used_at).toLocaleString('ar-LY'):'لم يُستخدم بعد');info.append(hint,meta);}
  else{info.textContent='أنشئ مفتاحًا خاصًا لربط متجرك بحساب L1017n.';clearSecret();}
  page.querySelector('[data-api-create]').hidden=!!key;page.querySelector('[data-api-revoke]').hidden=!key;page.querySelector('[data-api-message]').textContent='';
 }catch{if(generation===request){page.querySelector('[data-api-status]').textContent='تعذر التحقق';page.querySelector('[data-api-message]').textContent='تعذر تحميل حالة API. حاول تحديث الحالة.';page.querySelector('[data-api-create]').hidden=true;page.querySelector('[data-api-revoke]').hidden=true;}}
}
async function open(button){
 const c=client();if(!c){notify('المتجر قيد التجهيز. حاول مجددًا.');return;}
 const {data,error}=await c.auth.getUser();if(error||!data?.user||data.user.is_anonymous){notify('سجّل دخولك لفتح قسم API');return;}
 createPage();clearSecret();owner=data.user.id;trigger=button;request++;page.dataset.keyId='';page.querySelector('[data-api-confirm]').hidden=true;page.querySelector('[data-api-keyinfo]').replaceChildren();page.querySelector('[data-api-create]').hidden=true;page.querySelector('[data-api-revoke]').hidden=true;
 if(!page.open){history.pushState({...history.state,l1017nAPI:true},'');page.showModal();}
 if(!authListener){c.auth.onAuthStateChange((event,session)=>{if(page?.open&&(!session?.user||session.user.id!==owner))close();});authListener=true;}
 await refresh();
}
document.addEventListener('click',e=>{const button=e.target.closest('#openResellerApi');if(button){e.preventDefault();void open(button);}});
})();
