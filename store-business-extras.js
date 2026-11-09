/* L1017N Business Extras — sales analytics, wallet rewards, real-buyer reviews.
   Mutations go through authenticated, server-verified Supabase RPCs. */
(function(){
 "use strict";
 const q=s=>document.querySelector(s);
 const pointsRewardArt="<svg class=\"points-reward-art\" viewBox=\"0 0 320 240\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\"><defs><linearGradient id=\"pointsGift\" x1=\"100\" y1=\"70\" x2=\"230\" y2=\"210\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#CFACFF\"/><stop offset=\"1\" stop-color=\"#8050CF\"/></linearGradient><linearGradient id=\"pointsGold\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#FFF0B5\"/><stop offset=\"1\" stop-color=\"#E3AA48\"/></linearGradient></defs><ellipse cx=\"164\" cy=\"208\" rx=\"105\" ry=\"13\" fill=\"#080E20\" opacity=\".35\"/><circle cx=\"166\" cy=\"120\" r=\"92\" fill=\"#B58DF3\" opacity=\".07\"/><circle cx=\"166\" cy=\"120\" r=\"73\" stroke=\"#D5B5FF\" stroke-opacity=\".15\" stroke-dasharray=\"3 8\"/><g class=\"points-art-gift\"><path d=\"M107 119 170 101l61 22-63 22-61-26Z\" fill=\"#DFC7FF\"/><path d=\"M107 119v66l61 24v-64l-61-26Z\" fill=\"url(#pointsGift)\"/><path d=\"m168 145 63-22v64l-63 22v-64Z\" fill=\"#7950B8\"/><path d=\"m132 130 14 6v64l-14-6v-64Z\" fill=\"#F9D58F\"/><path d=\"m193 136 14-5v64l-14 5v-64Z\" fill=\"#EABF73\"/><path d=\"m100 106 68-23 71 26-71 25-68-28Z\" fill=\"#E5CFFF\"/><path d=\"M100 106v18l68 27v-17l-68-28Z\" fill=\"#B28AE7\"/><path d=\"m168 134 71-25v18l-71 24v-17Z\" fill=\"#9364CC\"/><path d=\"m128 97 69 27 15-5-69-27-15 5Z\" fill=\"#FFE4AC\"/><path d=\"m193 92-67 25 15 6 68-25-16-6Z\" fill=\"#FFDB92\"/><path d=\"M169 86c-38-2-52-22-39-29 13-8 30 10 39 29Z\" fill=\"#F8CC7F\" stroke=\"#FFE6B2\" stroke-width=\"3\"/><path d=\"M169 86c5-34 25-48 34-36 10 13-10 31-34 36Z\" fill=\"#E6B05D\" stroke=\"#FFE6B2\" stroke-width=\"3\"/><ellipse cx=\"170\" cy=\"86\" rx=\"9\" ry=\"7\" fill=\"#FFE6B2\"/><path d=\"m111 153 15 6m-15 1 9 3\" stroke=\"#EEDAFF\" stroke-opacity=\".55\" stroke-width=\"3\" stroke-linecap=\"round\"/></g><g class=\"points-art-coin\"><ellipse cx=\"68\" cy=\"129\" rx=\"25\" ry=\"29\" transform=\"rotate(-20 68 129)\" fill=\"#B77C36\"/><ellipse cx=\"64\" cy=\"126\" rx=\"24\" ry=\"29\" transform=\"rotate(-20 64 126)\" fill=\"url(#pointsGold)\" stroke=\"#FFE8A5\" stroke-width=\"2\"/><path d=\"m62 110 5 9 10 1-7 7 2 11-10-5-9 4 2-11-7-7 10-1 4-8Z\" fill=\"#BF873A\"/></g><g class=\"points-art-coin points-art-coin-two\"><circle cx=\"258\" cy=\"70\" r=\"22\" fill=\"#BD873C\"/><circle cx=\"254\" cy=\"67\" r=\"22\" fill=\"url(#pointsGold)\" stroke=\"#FFE9B2\" stroke-width=\"2\"/><path d=\"m254 53 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1 4-9Z\" fill=\"#BA8134\"/></g><g stroke=\"#DEC5FF\" stroke-width=\"3\" stroke-linecap=\"round\"><path d=\"M75 57v12m-6-6h12M264 160v12m-6-6h12M225 35v8m-4-4h8\"/><path d=\"m42 175 4 5m239-61 5-3\" stroke=\"#F5D694\"/></g><circle cx=\"107\" cy=\"39\" r=\"3\" fill=\"#E9BD73\"/><circle cx=\"279\" cy=\"195\" r=\"3\" fill=\"#B58DF3\"/></svg>";
 const pointsIcons={"bag":"<svg viewBox=\"0 0 48 48\" fill=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"10\" y=\"16\" width=\"28\" height=\"26\" rx=\"7\" fill=\"#A985DB\" fill-opacity=\".25\" stroke=\"#C9AAF1\" stroke-width=\"2\"/><path d=\"M17 18v-6a7 7 0 0 1 14 0v6M18 29l4 4 8-9\" stroke=\"#E2CCFF\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>","coin":"<svg viewBox=\"0 0 48 48\" fill=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"27\" cy=\"25\" r=\"15\" fill=\"#C89C52\" fill-opacity=\".25\" stroke=\"#E6BE79\" stroke-width=\"2\"/><path d=\"M18 8a16 16 0 0 0-6 28\" stroke=\"#9D7B4A\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"m27 16 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1 3-6Z\" fill=\"#EAC78F\"/></svg>","wallet":"<svg viewBox=\"0 0 48 48\" fill=\"none\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"7\" y=\"13\" width=\"34\" height=\"27\" rx=\"7\" fill=\"#86BEB5\" fill-opacity=\".2\" stroke=\"#A1D9CE\" stroke-width=\"2\"/><path d=\"m10 14 23-7v7\" stroke=\"#A1D9CE\" stroke-width=\"2\" stroke-linejoin=\"round\"/><rect x=\"29\" y=\"23\" width=\"14\" height=\"10\" rx=\"3\" fill=\"#25433F\" stroke=\"#B9E9DE\" stroke-width=\"2\"/><circle cx=\"34\" cy=\"28\" r=\"1.5\" fill=\"#D4F5ED\"/></svg>"};
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
     const entry=document.createElement("button");
     entry.id="openMyPoints";entry.type="button";entry.className="points-entry";
     entry.innerHTML='<span class="points-entry-icon" aria-hidden="true">'+pointsIcons.coin+'</span><span><b>نقاطي</b><small>مكافآت مشترياتك · حوّلها لرصيد</small></span><span class="points-entry-arrow" aria-hidden="true">‹</span>';
     const accountMenu=account.querySelector(".account-core-settings");
     if(accountMenu)accountMenu.prepend(entry);
     else account.prepend(entry);
     const section=document.createElement("dialog");
     section.id="l1017Loyalty";section.className="l1017-extra points-page";
     section.setAttribute("aria-labelledby","pointsTitle");
     section.innerHTML='<div class="points-shell"><header class="points-header"><button type="button" id="closeMyPoints" aria-label="الرجوع إلى حسابي">→</button><h2 id="pointsTitle">نقاطي</h2><button class="e-button e-secondary" type="button" id="refreshLoyalty">تحديث</button></header>'
       +'<div class="points-intro"><span>مكافآت L1017n</span><h3>كل طلب يقرّبك لمكافأة</h3><p>اجمع نقاطك، وحوّلها لرصيد في محفظتك.</p></div>'
       +'<section class="points-balance"><div class="points-hero-art">'+pointsRewardArt+'</div><div class="points-balance-copy"><span>رصيد نقاطك المتوفرة</span><strong id="loyaltyBalance">—</strong><small>نقطة قابلة للاستبدال</small></div><div class="points-rate">100 نقطة <span>↔</span> 1 د.ل</div></section>'
       +'<div class="points-total"><span>إجمالي النقاط المكتسبة</span><strong id="loyaltyEarned">—</strong></div>'
       +'<section class="points-panel"><div class="points-section-heading"><div><span class="points-eyebrow">استبدال النقاط</span><h3>من نقاط… إلى رصيد</h3></div><span class="points-wallet-art">'+pointsIcons.wallet+'</span></div>'
       +'<p class="e-sub" id="loyaltyProgressText">كل 100 نقطة = 1 د.ل</p><div class="e-progress"><i id="loyaltyProgress" style="width:0%"></i></div>'
       +'<label for="loyaltyRedeemAmount">عدد النقاط</label><div class="points-input-wrap"><input id="loyaltyRedeemAmount" inputmode="numeric" type="number" min="100" max="10000" step="100" value="100" aria-describedby="pointsInputHint"><span>نقطة</span></div>'
       +'<small id="pointsInputHint">مضاعفات 100 · حتى 10,000 نقطة في المرة</small>'
       +'<div class="points-conversion"><span>يُضاف إلى محفظتك</span><strong id="pointsCreditPreview">1.00 د.ل</strong></div>'
       +'<button class="e-button" type="button" id="loyaltyRedeemBtn" disabled>تحويل إلى المحفظة</button>'
       +'<p id="loyaltyStatus" class="e-status" role="status" aria-live="polite">جاري جلب النقاط…</p></section>'
       +'<section class="points-guide"><h3>رحلة مكافأتك</h3><div class="points-journey"><article><div class="points-step-art">'+pointsIcons.bag+'</div><b>تسوّق</b><p>أكمل طلبك من المتجر</p></article><article><div class="points-step-art">'+pointsIcons.coin+'</div><b>اجمع</b><p>كل دينار = نقطة</p></article><article><div class="points-step-art">'+pointsIcons.wallet+'</div><b>استبدل</b><p>100 نقطة = 1 د.ل</p></article></div></section></div>';
     document.body.appendChild(section);
     let previousOverflow="";
     entry.addEventListener("click",()=>{
       previousOverflow=document.body.style.overflow;
       section.showModal();document.body.style.overflow="hidden";
       section.scrollTop=0;void loadLoyalty();
     });
     q("#closeMyPoints").addEventListener("click",()=>section.close());
     section.addEventListener("close",()=>{document.body.style.overflow=previousOverflow;entry.focus()});
     q("#loyaltyRedeemAmount").addEventListener("input",updatePointsPreview);
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
 function updatePointsPreview(){
   const amount=Number(q("#loyaltyRedeemAmount")?.value);
   q("#pointsCreditPreview").textContent=Number.isSafeInteger(amount)&&amount>=100&&amount<=10000&&amount%100===0?cash(amount/100):"—";
 }
 async function loadLoyalty(){
   if(loyaltyLoading||!q("#l1017Loyalty"))return;
   loyaltyLoading=true;
   try{
     if(!await getCurrentUser()){
       setMessage("#loyaltyStatus","سجّل دخولك عشان تظهر نقاطك.");
       q("#loyaltyBalance").textContent="0";q("#loyaltyEarned").textContent="0";
       q("#loyaltyRedeemBtn").disabled=true;q("#loyaltyProgress").style.width="0%";
       q("#loyaltyProgressText").textContent="سجّل دخولك لعرض رصيد مكافآتك.";return;
     }
     const d=await getRpc("get_my_store_loyalty");
     const balance=Math.max(0,Number(d?.points_balance)||0);
     q("#loyaltyBalance").textContent=qty(balance);
     q("#loyaltyEarned").textContent=qty(d?.points_earned);
     q("#loyaltyProgress").style.width=Math.min(100,balance)+"%";
     q("#loyaltyProgressText").textContent=balance>=100?'متاح للاستبدال: '+Math.floor(balance/100)+' د.ل':
       'باقي '+(100-balance%100)+' نقطة لأول دينار مكافأة';
     const input=q("#loyaltyRedeemAmount");
     if(input&&balance>=100&&Number(input.value)>balance)input.value=String(Math.min(10000,Math.floor(balance/100)*100));
     updatePointsPreview();
     const button=q("#loyaltyRedeemBtn");if(button)button.disabled=balance<100;
     setMessage("#loyaltyStatus",balance>=100?'تقدر تستبدل النقاط الآن، وتنضاف لمحفظتك فورًا.':'نقاطك تزيد بعد اكتمال كل طلب. الطلبات السابقة للتفعيل لا تمنح نقاطًا بأثر رجعي.');
   }catch(e){
     q("#loyaltyRedeemBtn").disabled=true;
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

     if(typeof renderWallet==="function")void renderWallet().catch(()=>{});
     await loadLoyalty();
     setMessage("#loyaltyStatus","تم تحويل "+cash(d.wallet_credit)+" إلى محفظتك بنجاح.","success");
   }catch(e){
     setMessage("#loyaltyStatus",e?.message?.includes("insufficient_reward_points")?"نقاطك غير كافية. حدّث الرصيد.":"تعذر الاستبدال الآن. تأكد من النقاط وحاول مجددًا.","warning");
   }finally{button.disabled=Number(q("#loyaltyBalance").textContent.replace(/,/g,""))<100;button.textContent="تحويل إلى المحفظة"}
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
     if(q("#l1017Loyalty")?.open||q("#accountView")&&!q("#accountView").classList.contains("hidden"))void loadLoyalty();
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