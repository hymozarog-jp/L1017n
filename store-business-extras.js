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
 let loyaltyBalanceValue=null,loyaltyRedeeming=false;
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
       +'<p class="e-sub" id="loyaltyProgressText">كل 100 نقطة = 1 د.ل</p><div class="points-goal-count"><strong id="loyaltyGoalCount">0 / 100 نقطة</strong><span id="loyaltyGoalReward">هدفك: 1 د.ل</span></div><div class="e-progress" role="progressbar" aria-label="التقدم نحو مكافأتك" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loyaltyProgressTrack"><i id="loyaltyProgress" style="width:0%"></i></div>'
       +'<label for="loyaltyRedeemAmount">عدد النقاط</label><div class="points-input-wrap"><input id="loyaltyRedeemAmount" inputmode="numeric" type="number" min="1" max="10000" step="1" value="100" aria-describedby="pointsInputHint"><span>نقطة</span></div>'
       +'<small id="pointsInputHint">مضاعفات 100 · حتى 10,000 نقطة في المرة</small>'
       +'<div class="points-conversion"><span id="pointsConversionLabel">قيمة النقاط</span><strong id="pointsCreditPreview">1.00 د.ل</strong></div>'
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
       +'<label for="reviewComment">اكتب تجربتك (اختياري، حتى 300 حرف)</label><textarea id="reviewComment" rows="3" maxlength="300" placeholder="كيف كانت تجربة الشراء والاستلام؟"></textarea>'
       +'<div class="e-row"><button id="saveStoreReview" class="e-button" type="button">نشر التقييم</button><small class="e-sub">تقييم واحد لكل طلب، وتقدر تعدّله.</small></div></div>'
       +'<p id="reviewFormStatus" class="e-status" role="status" aria-live="polite">جاري تحميل مشترياتك…</p>';
     orders.appendChild(section);
   }
   if(store&&!q("#l1017PublicReviews")){
     const section=document.createElement("section");section.id="l1017PublicReviews";section.className="l1017-extra";
     section.setAttribute("aria-labelledby","publicReviewsTitle");
     section.innerHTML='<header class="crr-header"><h2 id="publicReviewsTitle">آراء العملاء</h2><p>تقييمات حقيقية من مشتري متجر L1017n</p></header>'
       +'<div class="crr-summary" id="publicReviewSummary" aria-busy="true"><div class="crr-score"><strong id="publicReviewAverage">—</strong><div id="publicReviewStars">'+reviewStars(0)+'</div><span id="publicReviewCount">جاري تحميل التقييمات…</span></div>'
       +'<div class="crr-distribution" id="publicReviewDistribution" aria-label="توزيع التقييمات حسب عدد النجوم"></div></div>'
       +'<div class="e-review-list" id="publicReviewsList"></div><p id="publicReviewsStatus" class="e-status" role="status" aria-live="polite"></p>';

     store.appendChild(section);
   }
   if(admin&&!q("#l1017BusinessPanel")){
     const section=document.createElement("section");section.id="l1017BusinessPanel";section.className="l1017-extra";
     section.innerHTML='<div class="l1017-extra-head"><h3>الأرباح والمبيعات</h3><button type="button" class="e-button e-secondary" id="refreshBusiness">تحديث ↻</button></div>'
       +'<p>تابع المبالغ الناتجة عن الطلبات المكتملة وتكلفة شرائها، ثم شوف الربح التقديري بعد خصم التكلفة.</p>'
       +'<div class="finance-periods" role="group" aria-label="فترة التقرير"><button type="button" data-finance-period="today" aria-pressed="false">اليوم</button><button type="button" data-finance-period="week" aria-pressed="false">7 أيام</button><button type="button" data-finance-period="month" aria-pressed="true">30 يوم</button><button type="button" data-finance-period="all" aria-pressed="false">كل الفترة</button></div><div class="e-grid finance-metrics" id="businessPeriodCards" aria-live="polite"></div><p id="businessSummaryStatus" class="e-status">جاري تحميل التقرير…</p>'
       +'<details class="finance-cost-details"><summary>ضبط تكلفة الشراء</summary>'
       +'<p class="e-legend">تكلفة الروبوكس تُحسب لكل 100 روبوكس، أما المنتجات الأخرى فتُحسب تكلفة بيع الباقة أو القطعة كاملة. تعديل التكلفة يعيد حساب الربح التقديري تاريخيًا، ولا يغير رصيد الزبائن.</p>'
       +'<section class="robux-cost-calculator"><h4>حاسبة تكلفة الروبوكس</h4><p>كل 1,000 روبوكس = 121 د.ل · بلس 70 د.ل لكل 10,000 أو جزء منها.</p>'
       +'<label for="businessRobuxQuantity">كمية الروبوكس</label><input id="businessRobuxQuantity" type="text" inputmode="numeric" autocomplete="off" placeholder="مثال: 10000" aria-describedby="businessRobuxCalcStatus">'
       +'<div class="e-grid robux-cost-results" aria-live="polite"><div class="e-metric"><span>شراء الروبوكس</span><strong id="businessRobuxBase">—</strong></div><div class="e-metric"><span>اشتراك بلس</span><strong id="businessRobuxPlus">—</strong><small id="businessRobuxCycles">—</small></div></div>'
       +'<div class="robux-cost-total"><span>إجمالي التكلفة</span><strong id="businessRobuxTotal">—</strong></div>'
       +'<label for="businessRobuxCost">متوسط تكلفة 100 روبوكس (د.ل)</label><input id="businessRobuxCost" type="number" readonly step="any" placeholder="يُحسب تلقائيًا">'
       +'<p id="businessRobuxCalcStatus" class="e-status" role="status">اكتب الكمية لحساب التكلفة.</p>'
       +'<button class="e-button" type="button" id="saveRobuxBusinessCost" disabled>حفظ التكلفة لحساب الأرباح</button><p class="e-sub">الحفظ يحدّث تكلفة حساب الأرباح التقديرية، بما فيها الطلبات السابقة. لا يغيّر سعر البيع للزبائن.</p></section>'
       +'<label for="businessProductSelect">تكلفة بقية المنتجات</label><select id="businessProductSelect"></select>'
       +'<div class="e-row"><input id="businessProductCost" type="number" min="0" max="100000" step="0.01" placeholder="سعر شراء الباقة بالدينار"><button type="button" class="e-button" id="saveProductBusinessCost">حفظ تكلفة المنتج</button></div>'
       +'<p class="e-status" id="businessCostStatus" role="status"></p></details>'
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
   const raw=q("#loyaltyRedeemAmount")?.value||"",amount=Number(raw);
   const valid=raw.trim()!==""&&Number.isSafeInteger(amount)&&amount>=0&&amount<=10000;
   q("#pointsCreditPreview").textContent=valid?cash(amount/100):"—";
   const eligible=valid&&amount>=100&&amount%100===0;
   const enough=loyaltyBalanceValue!==null&&amount<=loyaltyBalanceValue;
   const button=q("#loyaltyRedeemBtn");if(button)button.disabled=loyaltyRedeeming||!eligible||!enough;
   const label=q("#pointsConversionLabel");if(label)label.textContent=eligible?"يُضاف إلى محفظتك":"قيمة النقاط";
   const hint=q("#pointsInputHint");
   if(hint)hint.textContent=!valid?"اكتب من 1 إلى 10,000 نقطة لعرض قيمتها."
     :amount<100?"كل نقطة = 0.01 د.ل · التحويل يبدأ من 100 نقطة."
     :amount%100!==0?"للتحويل، اختار عددًا من مضاعفات 100."
     :!enough?"رصيد نقاطك لا يكفي للتحويل حاليًا.":"جاهز للتحويل إلى محفظتك.";
 }
 function paintPointsGoal(balance){
   const goal=Math.max(100,Math.ceil(balance/100)*100);
   const percent=Math.min(100,Math.max(0,balance/goal*100));
   q("#loyaltyProgress").style.width=percent+"%";
   q("#loyaltyProgressTrack")?.setAttribute("aria-valuenow",String(Math.round(percent)));
   q("#loyaltyGoalCount").textContent=qty(balance)+" / "+qty(goal)+" نقطة";
   q("#loyaltyGoalReward").textContent="هدفك: "+cash(goal/100);
   q("#loyaltyProgressText").textContent=balance>=goal?"وصلت للهدف! حوّل نقاطك لرصيد."
     :balance===0?"أول طلب مكتمل يبدأ رحلة مكافأتك."
     :"باقي "+qty(goal-balance)+" نقطة وتوصل إلى "+cash(goal/100)+"!";
 }
 async function loadLoyalty(){
   if(loyaltyLoading||!q("#l1017Loyalty"))return;
   loyaltyLoading=true;
   try{
     if(!await getCurrentUser()){
       setMessage("#loyaltyStatus","سجّل دخولك عشان تظهر نقاطك.");
       loyaltyBalanceValue=0;paintPointsGoal(0);updatePointsPreview();
       q("#loyaltyBalance").textContent="0";q("#loyaltyEarned").textContent="0";
       q("#loyaltyRedeemBtn").disabled=true;q("#loyaltyProgress").style.width="0%";
       q("#loyaltyProgressText").textContent="سجّل دخولك لعرض رصيد مكافآتك.";return;
     }
     const d=await getRpc("get_my_store_loyalty");
     const balance=Math.max(0,Number(d?.points_balance)||0);
     q("#loyaltyBalance").textContent=qty(balance);
     q("#loyaltyEarned").textContent=qty(d?.points_earned);
     loyaltyBalanceValue=balance;paintPointsGoal(balance);
     const input=q("#loyaltyRedeemAmount");
     if(input&&balance>=100&&Number(input.value)>balance)input.value=String(Math.min(10000,Math.floor(balance/100)*100));
     updatePointsPreview();

     setMessage("#loyaltyStatus",balance>=100?'تقدر تستبدل النقاط الآن، وتنضاف لمحفظتك فورًا.':'نقاطك تزيد بعد اكتمال كل طلب. الطلبات السابقة للتفعيل لا تمنح نقاطًا بأثر رجعي.');
   }catch(e){
     loyaltyBalanceValue=null;updatePointsPreview();q("#loyaltyRedeemBtn").disabled=true;
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
   loyaltyRedeeming=true;button.disabled=true;button.textContent="جاري الاستبدال…";
   try{
     const d=await getRpc("redeem_store_loyalty",{p_points:amount,p_request_key:window.crypto.randomUUID()});

     if(typeof renderWallet==="function")void renderWallet().catch(()=>{});
     await loadLoyalty();
     setMessage("#loyaltyStatus","تم تحويل "+cash(d.wallet_credit)+" إلى محفظتك بنجاح.","success");
   }catch(e){
     setMessage("#loyaltyStatus",e?.message?.includes("insufficient_reward_points")?"نقاطك غير كافية. حدّث الرصيد.":"تعذر الاستبدال الآن. تأكد من النقاط وحاول مجددًا.","warning");
   }finally{loyaltyRedeeming=false;updatePointsPreview();button.textContent="تحويل إلى المحفظة"}
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
     if(!reviewable.length){form.hidden=true;setMessage("#reviewFormStatus","التقييم متاح مرة واحدة لكل حساب، بعد اكتمال الطلب.");return}
     const old=select.value;
     select.innerHTML=reviewable.map((o,i)=>'<option value="'+esc(o.order_id)+'">'+esc(o.product_name)+' · '+cash(o.total_amount)+(o.reviewed?' · تم تقييمه':' · لم يُقيّم')+'</option>').join("");
     if(reviewable.some(x=>x.order_id===old))select.value=old;
     form.hidden=false;
     syncReviewChoice();
     setMessage("#reviewFormStatus","تقدر تقيّم المتجر مرة واحدة فقط من حسابك.");
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
   if(comment.length>300){setMessage("#reviewFormStatus","التعليق يجب ألا يتجاوز 300 حرف.","warning");return}
   button.disabled=true;button.textContent="جاري نشر التقييم…";
   try{
     await getRpc("submit_verified_store_review",{p_order_id:orderId,p_rating:reviewRating,p_comment:comment});
     setMessage("#reviewFormStatus","تم حفظ تقييمك بنجاح. شكرًا على رأيك!","success");
     await Promise.all([loadReviewable(),loadPublicReviews()]);
   }catch(e){if(String(e?.message||"").includes("review_already_submitted")){q("#reviewFormWrap").hidden=true;setMessage("#reviewFormStatus","سبق أن أرسلت تقييمك. شكرًا لك!","success")}else setMessage("#reviewFormStatus","تعذر حفظ التقييم. تأكد من اكتمال الطلب وحاول مجددًا.","warning")}
   finally{button.disabled=false;button.textContent="نشر التقييم"}
 }
 function reviewStars(value){
   const rating=Math.max(0,Math.min(5,Number(value)||0));
   return '<span class="crr-stars" role="img" aria-label="'+rating.toFixed(1)+' من 5 نجوم" style="--crr-fill:'+((rating/5)*100).toFixed(2)+'%"><span aria-hidden="true">★★★★★</span><span class="crr-stars-fill" aria-hidden="true">★★★★★</span></span>';
 }
 function reviewDate(value){
   const date=new Date(value),elapsed=Date.now()-date.getTime();
   if(!Number.isFinite(elapsed))return '';
   const seconds=Math.max(0,Math.floor(elapsed/1000));
   try{
     const unit=seconds<3600?'minute':seconds<86400?'hour':'day';
     const size=unit==='minute'?60:unit==='hour'?3600:86400;
     return new Intl.RelativeTimeFormat('ar',{numeric:'auto'}).format(-Math.max(1,Math.floor(seconds/size)),unit);
   }catch(_){return fmtDate(value)}
 }
 function publicReviewCard(r){
   const buyerName=String(r.display_name||'').trim().slice(0,60)||'مشتري من المتجر';
   const buyerInitial=Array.from(buyerName)[0]||'م';
   const comment=String(r.comment||'').trim();
   const date=new Date(r.created_at),validDate=Number.isFinite(date.getTime());
   const check='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="m6 10 3 3 5-6" fill="none" stroke="#103425" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
   return '<article class="crr-review'+(comment?'':' crr-without-comment')+'"><div class="crr-review-heading"><div class="crr-avatar" aria-hidden="true"><span>'+esc(buyerInitial)+'</span></div>'
     +'<div class="crr-buyer"><h3 dir="auto" style="text-align:right">'+esc(buyerName)+'</h3><span class="crr-verified">'+check+'مشتري موثّق</span></div>'
     +'<svg class="crr-quote" viewBox="0 0 32 28" aria-hidden="true"><path d="M2 15C2 7 5 3 12 2v5c-4 1-5 3-5 6h6v13H2V15Zm17 0c0-8 3-12 10-13v5c-4 1-5 3-5 6h6v13H19V15Z" fill="currentColor"/></svg></div>'
     +'<div class="crr-review-meta">'+reviewStars(r.rating)+(validDate?'<time datetime="'+esc(date.toISOString())+'" title="'+esc(fmtDate(r.created_at))+'">'+esc(reviewDate(r.created_at))+'</time>':'')+'</div>'
     +(comment?'<p class="crr-comment">'+esc(comment)+'</p>':'')
     +'<small class="crr-product">'+esc(r.product_name)+'</small></article>';
 }
 async function loadPublicReviews(){
   if(!q("#l1017PublicReviews"))return;
   try{
     const d=await getRpc("get_public_verified_store_reviews",{p_limit:20});
     const reviews=Array.isArray(d?.reviews)?d.reviews:[];
     const total=Math.max(0,Math.trunc(Number(d?.count)||0));
     const average=total&&Number.isFinite(Number(d?.average))?Math.max(0,Math.min(5,Number(d.average))):0;
     const histogram=d?.distribution&&typeof d.distribution==='object'?d.distribution:{};
     if(!d?.distribution&&reviews.length===total)reviews.forEach(r=>{histogram[r.rating]=(Number(histogram[r.rating])||0)+1});
     q("#publicReviewAverage").textContent=total?average.toFixed(1):'—';
     q("#publicReviewStars").innerHTML=reviewStars(average);
     q("#publicReviewCount").textContent=qty(total)+' تقييم';
     q("#publicReviewDistribution").innerHTML=[5,4,3,2,1].map(n=>{
       const count=Math.max(0,Math.trunc(Number(histogram[n])||0));
       const width=total?Math.min(100,count/total*100):0;
       return '<div class="crr-bar-row" aria-label="'+n+' نجوم: '+count+' تقييم"><span class="crr-bar-label"><span aria-hidden="true">★</span> '+n+'</span><span class="crr-bar-track" aria-hidden="true"><i style="width:'+width.toFixed(2)+'%"></i></span><b dir="ltr">'+qty(count)+'</b></div>';
     }).join('');
     q("#publicReviewsList").innerHTML=reviews.length?reviews.map(publicReviewCard).join(''):'<p class="crr-empty">لا توجد تقييمات منشورة بعد. يظهر تقييمك هنا بعد اكتمال طلبك.</p>';
     q("#publicReviewSummary").setAttribute('aria-busy','false');
     setMessage("#publicReviewsStatus",total>reviews.length?'أحدث '+qty(reviews.length)+' تقييمًا من مشتري المتجر.':'');
     if(!lastPublicLoaded&&window.location.hash==="#l1017PublicReviews")q("#l1017PublicReviews").scrollIntoView({block:"start",behavior:"auto"});
     lastPublicLoaded=true;
   }catch(e){
     q("#publicReviewSummary")?.setAttribute('aria-busy','false');
     if(!lastPublicLoaded)q("#publicReviewCount").textContent='التقييمات غير متاحة حاليًا';
     setMessage("#publicReviewsStatus","تعذر تحميل التقييمات حاليًا. جرّب تحديث الصفحة.","warning");
   }
 }

 let adminData=null;
 let financePeriod='month';
 function renderFinanceSummary(){
   const r=adminData?.finance?.[financePeriod];
   const root=q('#businessPeriodCards');if(!root)return;
   if(!r){root.innerHTML='<p>بيانات هذه الفترة غير متاحة.</p>';return;}
   const missing=Number(r.missing_cost_orders)||0;
   const known=r.estimated_profit!==null&&r.estimated_profit!==undefined&&Number.isFinite(Number(r.estimated_profit));
   const complete=missing===0&&known;
   const profit=Number(r.estimated_profit);
   const metric=(label,value,note,extra='')=>'<article class="e-metric '+extra+'"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></article>';
   root.innerHTML=metric('إجمالي المبيعات',cash(r.revenue),'طلبات مكتملة فقط')+
     metric('تكلفة الشراء',complete?cash(Number(r.revenue)-profit):'غير مكتملة','وفق التكاليف المحفوظة')+
     metric('الربح التقديري',complete?cash(profit):'أكمل التكاليف',complete?'المبيعات − تكلفة الشراء':'لا يُحسب بدقة قبل إدخال التكلفة',complete&&profit<0?'finance-loss':'finance-profit')+
     metric('عدد الطلبات',qty(r.orders),'طلب مكتمل في الفترة المختارة');
   q('#l1017BusinessPanel').querySelectorAll('[data-finance-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.financePeriod===financePeriod)));
   setMessage('#businessSummaryStatus',missing?'تنقص تكلفة '+qty(missing)+' طلب. افتح «ضبط تكلفة الشراء» لإكمالها.':'الربح تقديري حسب تكلفة الشراء الحالية. شحن المحافظ لا يُحسب مبيعات، والمصاريف الأخرى غير مشمولة.',missing?'warning':null);
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
     renderFinanceSummary();
     updateRobuxCostCalculator();
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
 function calculateRobuxBatch(raw){
   const normalized=String(raw??"").replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[,،٬\s]/g,"");
   if(!/^\d+$/.test(normalized))return null;
   const quantity=Number(normalized);
   if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000000)return null;
   const cycles=Math.ceil(quantity/10000),base=quantity*121/1000,plus=cycles*70;
   return {quantity,cycles,base,plus,total:base+plus,per100:(base+plus)*100/quantity};
 }
 function updateRobuxCostCalculator(){
   const input=q("#businessRobuxQuantity");if(!input)return null;
   const result=calculateRobuxBatch(input.value);
   q("#saveRobuxBusinessCost").disabled=!result;
   q("#businessRobuxCost").value=result?String(Number(result.per100.toFixed(6))):"";
   q("#businessRobuxBase").textContent=result?cash(result.base):"—";
   q("#businessRobuxPlus").textContent=result?cash(result.plus):"—";
   q("#businessRobuxCycles").textContent=result?qty(result.cycles)+" × 70 د.ل":"—";
   q("#businessRobuxTotal").textContent=result?cash(result.total):"—";
   q("#businessRobuxCalcStatus").textContent=result?"تم حساب التكلفة تلقائيًا.":input.value.trim()?"اكتب عدد روبوكس صحيحًا من 1 إلى 10,000,000.":"اكتب الكمية لحساب التكلفة.";
   return result;
 }
 async function saveCost(kind){
   if(kind==="robux"&&!updateRobuxCostCalculator())return;
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
   q('#l1017BusinessPanel')?.addEventListener('click',e=>{const b=e.target.closest('[data-finance-period]');if(b){financePeriod=b.dataset.financePeriod;renderFinanceSummary();}});

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
   q("#businessRobuxQuantity")?.addEventListener("input",updateRobuxCostCalculator);
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

 // Completion prompt uses the same authenticated, owner-checked review API.
 let completionDialog,completionOrder=null,completionRating=0,completionBusy=false,promptLoading=false,pendingCompletionPrompt=null;
 function mountCompletionRating(){
   const style=document.createElement('style');
   style.textContent=`#completionRating{box-sizing:border-box;width:min(92vw,460px);max-height:88dvh;overflow:auto;margin:auto;padding:30px 22px 20px;border:1px solid #64567d;border-radius:28px;background:linear-gradient(145deg,#24243b,#131521);color:#fff;text-align:center;font-family:inherit;box-shadow:0 24px 80px #0008;direction:rtl}#completionRating::backdrop{background:#080914b8;backdrop-filter:blur(5px)}#completionRating .cr-check{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 18px;border:3px solid #52df8e;border-radius:50%;color:#a5ffc7;background:#234435;font-size:36px}#completionRating h2{font-size:25px;margin:12px 0}#completionRating p{color:#c8c6d8;line-height:1.7}#completionRating .cr-product{font-size:13px;color:#bca3e5}#completionRating .cr-stars{display:flex;justify-content:center;gap:4px;margin:20px 0 6px}#completionRating .cr-stars button{padding:3px;border:0;background:none;color:#696479;font-size:44px;line-height:1.2;min-width:44px;cursor:pointer;transition:color .16s,transform .16s}#completionRating .cr-stars button.is-on{color:#ffce40;text-shadow:0 2px 8px #fbbf2430;transform:translateY(-2px)}#completionRating button:focus-visible{outline:2px solid #dec7ff;outline-offset:3px}#completionRating textarea{box-sizing:border-box;width:100%;margin:14px 0 6px;padding:14px;background:#151625;color:white;border:1px solid #77708d;border-radius:16px;font:inherit;font-size:16px;resize:vertical}#completionRating .cr-send{width:100%;min-height:52px;border:0;border-radius:16px;background:linear-gradient(120deg,#8d45ff,#6525e7);color:white;font:inherit;font-weight:700;font-size:18px;cursor:pointer}#completionRating .cr-send:disabled{opacity:.5;cursor:default}#completionRating .cr-later{display:block;margin:12px auto 0;padding:10px 22px;background:none;border:0;color:#c9c6d7;font:inherit;cursor:pointer}#completionRating .cr-status{min-height:24px;font-size:13px}#completionRating .cr-label{display:block;min-height:24px;color:#e5dcee}@media(prefers-reduced-motion:reduce){#completionRating .cr-stars button{transition:none}}`;
   document.head.appendChild(style);
   completionDialog=document.createElement('dialog');completionDialog.id='completionRating';
   completionDialog.setAttribute('aria-labelledby','crTitle');
   completionDialog.innerHTML='<span class="cr-check" aria-hidden="true">✓</span><h2 id="crTitle">تم إكمال طلبك بنجاح</h2><p class="cr-product"></p><p>كيف كانت تجربتك معنا؟</p><div class="cr-stars" role="group" aria-label="اختر تقييمًا من خمس نجوم">'+[1,2,3,4,5].map(n=>'<button type="button" data-cr-star="'+n+'" aria-label="'+n+' من 5 نجوم" aria-pressed="false">★</button>').join('')+'</div><span class="cr-label" aria-live="polite">اختر عدد النجوم</span><textarea maxlength="300" rows="3" aria-label="تعليق اختياري" placeholder="اكتب رأيك هنا (اختياري)"></textarea><p class="cr-status" role="status"></p><button type="button" class="cr-send" disabled>إرسال التقييم</button><button type="button" class="cr-later">إغلاق</button>';
   document.body.appendChild(completionDialog);
   completionDialog.querySelectorAll('[data-cr-star]').forEach(b=>b.addEventListener('click',()=>{
     if(completionBusy)return;
     completionRating=Number(b.dataset.crStar);
     completionDialog.querySelectorAll('[data-cr-star]').forEach(star=>{star.classList.toggle('is-on',Number(star.dataset.crStar)<=completionRating);star.setAttribute('aria-pressed',String(Number(star.dataset.crStar)===completionRating));});
     completionDialog.querySelector('.cr-label').textContent=['','ضعيف','مقبول','جيد','جيد جدًا','ممتاز'][completionRating];
     completionDialog.querySelector('.cr-send').disabled=false;
   }));
   completionDialog.querySelector('.cr-later').onclick=()=>{if(!completionBusy)completionDialog.close()};
   completionDialog.addEventListener('cancel',e=>{if(completionBusy)e.preventDefault()});
   completionDialog.querySelector('.cr-send').onclick=async()=>{
     if(completionBusy||!completionOrder||!completionRating)return;
     completionBusy=true;
     const button=completionDialog.querySelector('.cr-send'),status=completionDialog.querySelector('.cr-status');
     button.disabled=true;button.textContent='جاري إرسال التقييم…';status.textContent='';
     try{
       await getRpc('submit_verified_store_review',{p_order_id:completionOrder.order_id,p_rating:completionRating,p_comment:completionDialog.querySelector('textarea').value.trim()});
       status.textContent='شكرًا لك! تم حفظ تقييمك بنجاح.';button.textContent='تم إرسال التقييم';
       completionDialog.querySelector('.cr-later').textContent='إغلاق';
       completionOrder=null;
       void loadReviewable();void loadPublicReviews();
     }catch(e){if(String(e?.message||'').includes('review_already_submitted')){status.textContent='سبق أن أرسلت تقييمك. شكرًا لك!';button.textContent='تم التقييم';completionOrder=null;pendingCompletionPrompt=null;void loadReviewable()}else{status.textContent='تعذر حفظ التقييم. حاول مرة أخرى.';button.disabled=false;button.textContent='إرسال التقييم'}}
     finally{completionBusy=false}
   };
 }
 async function promptCompletedOrder(){
   if(promptLoading||completionDialog?.open||document.visibilityState==='hidden')return;
   if(q('#l1017EntrySplash')||document.querySelector('dialog[open]'))return;
   promptLoading=true;
   try{
     const user=await getCurrentUser();if(!user)return;
     if(pendingCompletionPrompt?.userId!==user.id)pendingCompletionPrompt=null;
     const order=pendingCompletionPrompt?.order||await getRpc('claim_latest_completed_review_prompt');
     if(order?.order_id)pendingCompletionPrompt={userId:user.id,order};
     if(order?.order_id){const eligible=await getRpc('get_my_reviewable_purchases');if(!Array.isArray(eligible)||!eligible.length){pendingCompletionPrompt=null;return}}
     const current=await getCurrentUser();
     if(current?.id!==user.id){pendingCompletionPrompt=null;return;}
     if(!order?.order_id||completionDialog?.open||document.visibilityState==='hidden'||document.querySelector('dialog[open]'))return;
     completionOrder=order;completionRating=0;
     completionDialog.querySelector('.cr-product').textContent=order.product_name+' · #'+String(order.order_id).slice(0,8).toUpperCase();
     completionDialog.querySelectorAll('[data-cr-star]').forEach(b=>{b.classList.remove('is-on');b.setAttribute('aria-pressed','false')});
     completionDialog.querySelector('textarea').value='';completionDialog.querySelector('.cr-status').textContent='';
     completionDialog.querySelector('.cr-label').textContent='اختر عدد النجوم';
     completionDialog.querySelector('.cr-send').textContent='إرسال التقييم';completionDialog.querySelector('.cr-send').disabled=true;
     completionDialog.querySelector('.cr-later').textContent='إغلاق';completionDialog.showModal();pendingCompletionPrompt=null;
   }catch(e){/* Keep browsing available when the review API is offline. */}
   finally{promptLoading=false}
 }

 function init(){
   if(!api())return;
   addSections();
   wire();
   mountCompletionRating();
   window.addEventListener("l1017n:orders-updated",()=>void promptCompletedOrder());
   setTimeout(()=>void promptCompletedOrder(),6500);
   setInterval(()=>void promptCompletedOrder(),30000);
   api()?.auth?.onAuthStateChange?.((event)=>{if(event==="SIGNED_OUT"){completionDialog?.close();completionOrder=null;pendingCompletionPrompt=null;}});
   void loadPublicReviews();
   if(q("#accountView")&&!q("#accountView").classList.contains("hidden"))void loadLoyalty();
   if(q("#ordersView")&&!q("#ordersView").classList.contains("hidden"))void loadReviewable();
   if(q("#adminView")&&!q("#adminView").classList.contains("hidden"))setTimeout(()=>void loadAdminFinance(),750);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();