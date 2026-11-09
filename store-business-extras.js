/* L1017N Business Extras — sales analytics, wallet rewards, real-buyer reviews.
   Mutations go through authenticated, server-verified Supabase RPCs. */
(function(){
 "use strict";
 const q=s=>document.querySelector(s);
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const cash=x=>Number(x||0).toFixed(2)+" د.ل";
 const qty=x=>Number(x||0).toLocaleString("en-US");
 const stars=x=>"★".repeat(Math.max(0,Math.min(5,Number(x)||0)))+"☆".repeat(Math.max(0,5-Math.min(5,Number(x)||0)));
 const api=()=>typeof supabaseClient!=="undefined"?supabaseClient:null;
 const fmtDate=x=>{try{return new Date(x).toLocaleDateString("ar-LY",{day:"numeric",month:"short",year:"numeric"})}catch{return ""}};
 let reviewable=[],reviewRating=5,loyaltyLoading=false,reviewLoading=false,adminLoading=false;
 let lastPublicLoaded=false;
 function setMessage(selector,msg,kind){
   const node=q(selector);if(!node)return;
   node.textContent=msg;
   node.classList.toggle("e-warning",kind==="warning");
   node.classList.toggle("e-success",kind==="success");
 }
 function addSections(){
   const account=q("#accountView"),orders=q("#ordersView"),store=q("#storeView"),admin=q("#adminContent");
   if(account&&!q("#l1017Loyalty")){
     const section=document.createElement("section");
     section.id="l1017Loyalty";
     section.className="l1017-extra";
     section.innerHTML='<div class="l1017-extra-head"><h3>✦ نقاط المكافآت</h3><button class="e-button e-secondary" type="button" id="refreshLoyalty">تحديث</button></div>'
       +'<p>كل دينار من طلب مكتمل يعطيك نقطة واحدة. كل 100 نقطة تساوي 1 د.ل تقدر تحولها لرصيد المحفظة.</p>'
       +'<div class="e-grid"><div class="e-metric"><span>نقاطك المتوفرة</span><strong id="loyaltyBalance">—</strong><small>النقاط القابلة للاستبدال</small></div>'
       +'<div class="e-metric"><span>مجموع النقاط المكتسبة</span><strong id="loyaltyEarned">—</strong><small>من الطلبات المكتملة</small></div></div>'
       +'<div class="e-progress"><i id="loyaltyProgress" style="width:0%"></i></div>'
       +'<p class="e-sub" id="loyaltyProgressText">كل 100 نقطة = 1 د.ل</p>'
       +'<div class="e-row"><label for="loyaltyRedeemAmount">استبدال نقاط</label><input id="loyaltyRedeemAmount" inputmode="numeric" type="number" min="100" max="10000" step="100" value="100">'
       +'<button class="e-button" type="button" id="loyaltyRedeemBtn">تحويل إلى المحفظة</button></div>'
       +'<p id="loyaltyStatus" class="e-status" role="status" aria-live="polite">جاري جلب النقاط…</p>';
     account.appendChild(section);
   }
   if(orders&&!q("#l1017CustomerReviews")){
     const section=document.createElement("section");
     section.id="l1017CustomerReviews";section.className="l1017-extra";
     section.innerHTML='<div class="l1017-extra-head"><h3>★ تقييم مشترياتك</h3><button class="e-button e-secondary" type="button" id="refreshReviewable">تحديث</button></div>'
       +'<p>اكتب رأيك في المنتجات اللي اكتمل تسليمها. تقييمك يظهر باسم «مشتري موثّق» بدون بيانات حسابك.</p>'
       +'<div id="reviewFormWrap" hidden><label for="reviewOrderSelect">اختر طلبًا مكتملًا</label><select id="reviewOrderSelect"></select>'
       +'<label>كم نجمة تعطي المنتج؟</label><div class="e-stars" id="reviewStarPicker" role="group" aria-label="التقييم من خمس نجوم"></div>'
       +'<label for="reviewComment">اكتب تجربتك (10 إلى 300 حرف)</label><textarea id="reviewComment" rows="3" maxlength="300" placeholder="كيف كانت تجربة الشراء والاستلام؟"></textarea>'
       +'<div class="e-row"><button id="saveStoreReview" class="e-button" type="button">نشر التقييم</button><small class="e-sub">تقييم واحد لكل طلب، وتقدر تعدّله.</small></div></div>'
       +'<p id="reviewFormStatus" class="e-status" role="status" aria-live="polite">جاري تحميل مشترياتك…</p>';
     orders.appendChild(section);
   }
   if(store&&!q("#l1017PublicReviews")){
     const section=document.createElement("section");section.id="l1017PublicReviews";section.className="l1017-extra";
     section.innerHTML='<div class="l1017-extra-head"><h3>★ آراء المشترين الموثّقين</h3><span class="e-sub" id="publicReviewAverage">التقييمات الفعلية</span></div>'
       +'<p>التقييمات هنا من طلبات مكتملة فقط.</p><div class="e-review-list" id="publicReviewsList"></div>'
       +'<p id="publicReviewsStatus" class="e-status"></p>';
     store.appendChild(section);
   }
   if(admin&&!q("#l1017BusinessPanel")){
     const section=document.createElement("section");section.id="l1017BusinessPanel";section.className="l1017-extra";
     section.innerHTML='<div class="l1017-extra-head"><h3>◈ لوحة الأرباح والمبيعات</h3><button type="button" class="e-button e-secondary" id="refreshBusiness">تحديث ↻</button></div>'
       +'<p>تقارير المبيعات المكتملة، والربح التقديري بناءً على تكلفة شراء المنتجات اللي تحددها.</p>'
       +'<div class="e-grid" id="businessPeriodCards"></div><p id="businessSummaryStatus" class="e-status">جاري تحميل التقرير…</p>'
       +'<div class="e-divider"></div><h4>إدخال تكاليف الشراء</h4>'
       +'<p class="e-legend">تكلفة الروبوكس تُحسب لكل 100 روبوكس، أما المنتجات الأخرى فتُحسب تكلفة بيع الباقة أو القطعة كاملة. تعديل التكلفة يعيد حساب الربح التقديري تاريخيًا، ولا يغير رصيد الزبائن.</p>'
       +'<label for="businessRobuxCost">تكلفة شراء 100 روبوكس (د.ل)</label>'
       +'<div class="e-row"><input id="businessRobuxCost" type="number" min="0" max="100000" step="0.01" placeholder="مثال: 11.50"><button class="e-button" type="button" id="saveRobuxBusinessCost">حفظ تكلفة الروبوكس</button></div>'
       +'<label for="businessProductSelect">تكلفة بقية المنتجات</label><select id="businessProductSelect"></select>'
       +'<div class="e-row"><input id="businessProductCost" type="number" min="0" max="100000" step="0.01" placeholder="سعر شراء الباقة بالدينار"><button type="button" class="e-button" id="saveProductBusinessCost">حفظ تكلفة المنتج</button></div>'
       +'<p class="e-status" id="businessCostStatus"></p>'
       +'<div class="e-divider"></div><h4>المنتجات الأكثر مبيعًا</h4><div id="businessTopProducts" class="e-review-list"></div>'
       +'<div class="e-divider"></div><h4>إدارة تقييمات الزبائن</h4><div id="businessReviews" class="e-review-list"></div>';
     admin.insertBefore(section,admin.firstChild);
   }
 }
 async function getCurrentUser(){
   const db=api();if(!db)return null;
   try{const {data,error}=await db.auth.getUser();return error?null:data?.user??null}catch{return null}
 }
 async function getRpc(name,params){
   const db=api();if(!db)throw new Error("الاتصال بقاعدة البيانات غير متاح");
   const {data,error}=await db.rpc(name,params||{});
   if(error)throw error;
   return data;
 }
 function renderStars(){
   const root=q("#reviewStarPicker");if(!root)return;
   root.innerHTML=[1,2,3,4,5].map(n=>'<button type="button" class="e-star'+(n<=reviewRating?' is-on':'')+
     '" data-review-star="'+n+'" aria-label="'+n+' نجوم" aria-pressed="'+(n===reviewRating?'true':'false')+'">★</button>').join("");
 }
 async function loadLoyalty(){
   if(loyaltyLoading||!q("#l1017Loyalty"))return;
   loyaltyLoading=true;
   try{
     if(!await getCurrentUser()){
       setMessage("#loyaltyStatus","سجّل دخولك عشان تظهر نقاطك.");
       q("#loyaltyBalance").textContent="0";q("#loyaltyEarned").textContent="0";return;
     }
     const d=await getRpc("get_my_store_loyalty");
     const balance=Math.max(0,Number(d?.points_balance)||0);
     q("#loyaltyBalance").textContent=qty(balance);
     q("#loyaltyEarned").textContent=qty(d?.points_earned);
     q("#loyaltyProgress").style.width=(balance%100)+"%";
     q("#loyaltyProgressText").textContent=balance>=100?'متاح للاستبدال: '+Math.floor(balance/100)+' د.ل':
       'باقي '+(100-balance%100)+' نقطة لأول دينار مكافأة';
     const input=q("#loyaltyRedeemAmount");
     if(input&&balance>=100&&Number(input.value)>balance)input.value=String(Math.min(10000,Math.floor(balance/100)*100));
     const button=q("#loyaltyRedeemBtn");if(button)button.disabled=balance<100;
     setMessage("#loyaltyStatus",balance>=100?'تقدر تستبدل النقاط الآن، وتنضاف لمحفظتك فورًا.':'نقاطك تزيد بعد اكتمال كل طلب. الطلبات السابقة للتفعيل لا تمنح نقاطًا بأثر رجعي.');
   }catch(e){
     setMessage("#loyaltyStatus","تعذر جلب النقاط. اضغط تحديث.", "warning");
   }finally{loyaltyLoading=false}
 }
 async function redeemLoyalty(){
   const input=q("#loyaltyRedeemAmount"),button=q("#loyaltyRedeemBtn");
   const amount=Number(input?.value);
   if(!Number.isSafeInteger(amount)||amount<100||amount>10000||amount%100!==0){
     setMessage("#loyaltyStatus","اكتب عدد نقاط من مضاعفات 100، بحد أقصى 10,000 في المرة.","warning");return;
   }
   if(!window.crypto?.randomUUID){setMessage("#loyaltyStatus","حدّث المتصفح للمشاركة في المكافآت.","warning");return}
   button.disabled=true;button.textContent="جاري الاستبدال…";
   try{
     const d=await getRpc("redeem_store_loyalty",{p_points:amount,p_request_key:window.crypto.randomUUID()});
     setMessage("#loyaltyStatus","تم تحويل "+cash(d.wallet_credit)+" إلى محفظتك بنجاح.","success");
     if(typeof renderWallet==="function")void renderWallet().catch(()=>{});
     await loadLoyalty();
   }catch(e){
     setMessage("#loyaltyStatus",e?.message?.includes("insufficient_reward_points")?"نقاطك غير كافية. حدّث الرصيد.":"تعذر الاستبدال الآن. تأكد من النقاط وحاول مجددًا.","warning");
   }finally{button.disabled=false;button.textContent="تحويل إلى المحفظة"}
 }
 async function loadReviewable(){
   if(reviewLoading||!q("#l1017CustomerReviews"))return;
   reviewLoading=true;
   try{
     if(!await getCurrentUser()){
       q("#reviewFormWrap").hidden=true;
       setMessage("#reviewFormStatus","سجّل دخولك لمشاهدة طلباتك التي تستطيع تقييمها.");return;
     }
     const rows=await getRpc("get_my_reviewable_purchases");
     reviewable=Array.isArray(rows)?rows:[];
     const select=q("#reviewOrderSelect"),form=q("#reviewFormWrap");
     if(!reviewable.length){form.hidden=true;setMessage("#reviewFormStatus","ما في طلبات مكتملة بعد. يظهر التقييم بعد تسليم الطلب.");return}
     const old=select.value;
     select.innerHTML=reviewable.map((o,i)=>'<option value="'+esc(o.order_id)+'">'+esc(o.product_name)+' · '+cash(o.total_amount)+(o.reviewed?' · تم تقييمه':' · لم يُقيّم')+'</option>').join("");
     if(reviewable.some(x=>x.order_id===old))select.value=old;
     form.hidden=false;
     syncReviewChoice();
     setMessage("#reviewFormStatus","تقدر تقيّم أي طلب مكتمل مرة واحدة وتعدّل تقييمك لاحقًا.");
   }catch(e){setMessage("#reviewFormStatus","تعذر تحميل طلبات التقييم. اضغط تحديث.","warning")}
   finally{reviewLoading=false}
 }
 function syncReviewChoice(){
   const order=reviewable.find(o=>String(o.order_id)===q("#reviewOrderSelect")?.value);
   reviewRating=Math.max(1,Math.min(5,Number(order?.rating)||5));
   const field=q("#reviewComment");if(field)field.value=order?.comment||"";
   const button=q("#saveStoreReview");if(button)button.textContent=order?.reviewed?"تحديث التقييم":"نشر التقييم";
   renderStars();
 }
 async function submitReview(){
   const button=q("#saveStoreReview"),orderId=q("#reviewOrderSelect")?.value;
   const comment=q("#reviewComment")?.value.trim()||"";
   if(!reviewable.some(x=>x.order_id===orderId)){setMessage("#reviewFormStatus","اختر طلبًا مكتملًا.","warning");return}
   if(comment.length<10||comment.length>300){setMessage("#reviewFormStatus","اكتب مراجعة من 10 إلى 300 حرف.","warning");return}
   button.disabled=true;button.textContent="جاري نشر التقييم…";
   try{
     await getRpc("submit_verified_store_review",{p_order_id:orderId,p_rating:reviewRating,p_comment:comment});
     setMessage("#reviewFormStatus","تم حفظ تقييمك بنجاح. شكرًا على رأيك!","success");
     await Promise.all([loadReviewable(),loadPublicReviews()]);
   }catch(e){setMessage("#reviewFormStatus","تعذر حفظ التقييم. تأكد من اكتمال الطلب وحاول مجددًا.","warning")}
   finally{button.disabled=false;button.textContent="نشر التقييم"}
 }
 async function loadPublicReviews(){
   if(!q("#l1017PublicReviews"))return;
   try{
     const d=await getRpc("get_public_verified_store_reviews",{p_limit:8});
     const reviews=Array.isArray(d?.reviews)?d.reviews:[];
     q("#publicReviewAverage").textContent=reviews.length&&d?.average!=null?'★ '+Number(d.average).toFixed(1)+'/5 · '+qty(d.count)+' تقييم':'تقييمات المشترين الفعليين';
     q("#publicReviewsList").innerHTML=reviews.length?reviews.map(r=>
       '<article class="e-review"><div class="e-review-top"><b>مشتري موثّق · '+esc(r.product_name)+'</b><span class="e-rating">'+stars(r.rating)+'</span></div>'+
       '<p>'+esc(r.comment)+'</p><span class="e-sub">'+esc(fmtDate(r.created_at))+'</span></article>'
     ).join(""):'<p>ما في تقييمات منشورة بعد. أول مشتري يكتمل طلبه يقدر يكتب تقييمه هنا.</p>';
     setMessage("#publicReviewsStatus",reviews.length?'جميع الآراء مرتبطة بطلبات مكتملة.':'');
     lastPublicLoaded=true;
   }catch(e){setMessage("#publicReviewsStatus","تعذر تحميل التقييمات حاليًا.","warning")}
 }
 let adminData=null;
 function financeCard(name,row){
   const r=row||{revenue:0,orders:0,missing_cost_orders:0,estimated_profit:0};
   const profit=r.estimated_profit;
   return '<article class="e-metric"><span>'+name+' · '+qty(r.orders||0)+' طلب</span>'+
     '<strong>'+cash(r.revenue)+'</strong><small>المبيعات المكتملة</small>'+
     '<p>الربح: <b>'+((profit===null||profit===undefined)?'غير محسوب':cash(profit))+'</b></p>'+
     ((r.missing_cost_orders||0)>0?'<small class="e-warning">تنقص تكلفة '+qty(r.missing_cost_orders)+' طلب</small>':'')+
     '</article>';
 }
 function updateCostSelection(){
   if(!adminData)return;
   const sel=q("#businessProductSelect");
   const p=(adminData.product_costs||[]).find(x=>String(x.id)===sel?.value);
   const input=q("#businessProductCost");
   if(input)input.value=(p&&p.cost_per_sale!==null&&p.cost_per_sale!==undefined)?String(p.cost_per_sale):"";
 }
 async function loadAdminFinance(){
   const root=q("#l1017BusinessPanel");
   if(!root||q("#adminView")?.classList.contains("hidden")||q("#adminContent")?.classList.contains("hidden")||adminLoading)return;
   adminLoading=true;
   try{
     const d=await getRpc("get_admin_store_business_dashboard");
     if(!d||typeof d!=="object")throw Error("invalid_admin_data");
     adminData=d;
     const fin=d.finance||{};
     q("#businessPeriodCards").innerHTML=financeCard("اليوم",fin.today)+financeCard("آخر 7 أيام",fin.week)+
       financeCard("آخر 30 يوم",fin.month)+financeCard("كل الفترة",fin.all);
     setMessage("#businessSummaryStatus","صافي الربح تقديري وفق تكاليف الشراء الحالية، والمبيعات تشمل الطلبات المكتملة فقط. اضبط كل التكاليف ليظهر الربح بدقة أكبر.");
     q("#businessRobuxCost").value=(d.robux_cost_per_100===null||d.robux_cost_per_100===undefined)?"":String(d.robux_cost_per_100);
     const select=q("#businessProductSelect"),old=select.value;
     const items=Array.isArray(d.product_costs)?d.product_costs:[];
     select.innerHTML=items.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.game)+'</option>').join("");
     if(items.some(p=>p.id===old))select.value=old;
     updateCostSelection();
     const most=Array.isArray(d.top_products)?d.top_products:[];
     q("#businessTopProducts").innerHTML=most.length?most.map(p=>'<article class="e-review">'+
       '<div class="e-review-top"><b>'+esc(p.product_name)+'</b><span class="e-sub">'+qty(p.count)+' طلب</span></div>'+
       '<p>إجمالي المبيعات: '+cash(p.revenue)+'</p></article>').join(""):'<p>لا توجد مبيعات مكتملة بعد.</p>';
     const reviews=Array.isArray(d.reviews)?d.reviews:[];
     q("#businessReviews").innerHTML=reviews.length?reviews.map(r=>'<article class="e-review"><div class="e-review-top">'+
       '<b>'+esc(r.product_name)+'</b><span class="e-rating">'+stars(r.rating)+'</span></div>'+
       '<p>'+esc(r.comment)+'</p><div class="e-row"><span class="e-sub">'+esc(fmtDate(r.created_at))+
       ' · '+(r.visible?'ظاهر للزبائن':'مخفي')+'</span>'+
       '<button type="button" class="e-button e-secondary" data-admin-review-id="'+esc(r.id)+'" data-next-visible="'+(!r.visible)+'">'+(r.visible?'إخفاء':'إظهار')+'</button></div></article>').join(""):'<p>ما في تقييمات حتى الآن.</p>';
   }catch(e){
     setMessage("#businessSummaryStatus","تعذر تحميل لوحة المبيعات. افتحها من حساب الإدارة واضغط تحديث.","warning");
     console.warn("[business] Financial dashboard unavailable",e);
   }finally{adminLoading=false}
 }
 async function saveCost(kind){
   const button=q(kind==="robux"?"#saveRobuxBusinessCost":"#saveProductBusinessCost");
   const input=q(kind==="robux"?"#businessRobuxCost":"#businessProductCost");
   const value=Number(input?.value);
   if(input?.value===""||!Number.isFinite(value)||value<0||value>100000){
     setMessage("#businessCostStatus","اكتب تكلفة شراء صحيحة بالدينار الليبي.","warning");return;
   }
   const payload=kind==="robux"?{p_cost:value}:{p_product_id:q("#businessProductSelect")?.value,p_cost:value};
   if(kind!=="robux"&&!payload.p_product_id){setMessage("#businessCostStatus","اختر المنتج أولًا.","warning");return}
   button.disabled=true;
   try{
     await getRpc(kind==="robux"?"admin_set_robux_cost_per_100":"admin_set_store_product_cost",payload);
     setMessage("#businessCostStatus","تم حفظ التكلفة وتحديث حساب الربح التقديري.","success");
     await loadAdminFinance();
   }catch(e){setMessage("#businessCostStatus","تعذر حفظ التكلفة. تأكد من صلاحيات الإدارة.","warning")}
   finally{button.disabled=false}
 }
 async function toggleReview(id,visible,button){
   if(button)button.disabled=true;
   try{
     await getRpc("admin_set_store_review_visibility",{p_review_id:id,p_visible:visible});
     await Promise.all([loadAdminFinance(),loadPublicReviews()]);
   }catch(e){setMessage("#businessSummaryStatus","تعذر تغيير ظهور التقييم.","warning")}
   finally{if(button)button.disabled=false}
 }
 function wire(){
   q("#refreshLoyalty")?.addEventListener("click",()=>void loadLoyalty());
   q("#loyaltyRedeemBtn")?.addEventListener("click",()=>void redeemLoyalty());
   q("#refreshReviewable")?.addEventListener("click",()=>void loadReviewable());
   q("#reviewOrderSelect")?.addEventListener("change",syncReviewChoice);
   q("#reviewStarPicker")?.addEventListener("click",e=>{
     const el=e.target.closest("[data-review-star]");
     if(el){reviewRating=Number(el.dataset.reviewStar);renderStars()}
   });
   q("#saveStoreReview")?.addEventListener("click",()=>void submitReview());
   q("#refreshBusiness")?.addEventListener("click",()=>void loadAdminFinance());
   q("#saveRobuxBusinessCost")?.addEventListener("click",()=>void saveCost("robux"));
   q("#saveProductBusinessCost")?.addEventListener("click",()=>void saveCost("product"));
   q("#businessProductSelect")?.addEventListener("change",updateCostSelection);
   q("#businessReviews")?.addEventListener("click",e=>{
     const el=e.target.closest("[data-admin-review-id]");
     if(el)void toggleReview(el.dataset.adminReviewId,el.dataset.nextVisible==="true",el);
   });
   document.addEventListener("click",e=>{
     const btn=e.target.closest("[data-view],[data-ll-nav],#openAdminDashboard,#refreshAdmin");
     if(!btn)return;
     const dest=btn.dataset?.view||btn.dataset?.llNav;
     if(dest==="orders")setTimeout(()=>void loadReviewable(),100);
     if(dest==="account")setTimeout(()=>void loadLoyalty(),100);
     if(btn.id==="openAdminDashboard"||btn.id==="refreshAdmin"){
       setTimeout(()=>void loadAdminFinance(),950);
     }
   });
   window.addEventListener("pageshow",()=>{
     if(!lastPublicLoaded)void loadPublicReviews();
   });
   document.addEventListener("visibilitychange",()=>{
     if(document.visibilityState!=="visible")return;
     if(q("#adminView")&&!q("#adminView").classList.contains("hidden"))void loadAdminFinance();
   });
   setInterval(()=>{
     if(q("#adminView")&&!q("#adminView").classList.contains("hidden")&&document.visibilityState==="visible")void loadAdminFinance();
   },90000);
   const db=api();
   db?.auth?.onAuthStateChange?.(()=>setTimeout(()=>{
     if(q("#accountView")&&!q("#accountView").classList.contains("hidden"))void loadLoyalty();
     if(q("#ordersView")&&!q("#ordersView").classList.contains("hidden"))void loadReviewable();
   },500));
 }
 function init(){
   if(!api())return;
   addSections();
   wire();
   void loadPublicReviews();
   if(q("#accountView")&&!q("#accountView").classList.contains("hidden"))void loadLoyalty();
   if(q("#ordersView")&&!q("#ordersView").classList.contains("hidden"))void loadReviewable();
   if(q("#adminView")&&!q("#adminView").classList.contains("hidden"))setTimeout(()=>void loadAdminFinance(),750);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();