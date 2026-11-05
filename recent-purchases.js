/* L1017n real purchase activity feed. Only paid or completed purchases,
   anonymized by default. Identity appears solely after explicit opt-in. */
(function(){
 "use strict";
 const feed=document.getElementById("storeRecentPurchases");
 if(!feed)return;
 const list=feed.querySelector("#storeRecentPurchaseList");
 const count=feed.querySelector("#recentPurchaseCount");
 const timestamp=feed.querySelector("#recentPurchaseUpdated");
 const more=feed.querySelector("#recentPurchaseMore");
 const refresh=feed.querySelector("#recentPurchaseRefresh");
 let entries=[],expanded=false,loading=false,lastStamp="",lastRefresh=0,loadAttempts=0;
 const nameLimit=6;
 const dateFmt=new Intl.DateTimeFormat("ar-LY",{timeZone:"Africa/Tripoli",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
 const priceFmt=new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
 const asEl=(tag,cls,txt)=>{
   const e=document.createElement(tag);
   if(cls)e.className=cls;
   if(txt!==undefined)e.textContent=String(txt);
   return e;
 };
 function storeClient(){return typeof supabaseClient!=="undefined"?supabaseClient:null}
 function labelOf(p){
   const raw=String(p||"");
   if(/robux|روبوكس|roblox|روبلوكس/i.test(raw))return {kind:"robux",logo:"game-covers/roblox-mark.svg?v=logo-square1",alt:"Roblox"};
   if(/MM2|nightblade|deathshard|elderwood|minty|سلاح/i.test(raw))return {kind:"mm2",logo:"game-covers/mm2-nightblade.svg?v=nightblade-20261105-1",alt:"MM2"};
   if(/دراقون|سرق|brainrot|dragon/i.test(raw))return {kind:"brainrot",logo:"game-covers/dragon-card.webp?v=dragon-photo-20261105-1",alt:"ماب السرقة"};
   return {kind:"other",logo:"",alt:""};
 }
 function stateOf(p){
   return p==="completed"?"مكتمل":"قيد التنفيذ";
 }
 function formatPrice(value){
   const number=Number(value);
   return Number.isFinite(number)&&number>0?priceFmt.format(number):"—";
 }
 function show(){
   if(!list)return;
   const rows=entries.slice(0,expanded?60:nameLimit);
   const frag=document.createDocumentFragment();
   if(!rows.length){
     frag.appendChild(asEl("p","recent-purchase-empty","ما فيش مشتريات معتمدة للعرض حتى الآن."));
   }
   rows.forEach((p,i)=>{
     const style=labelOf(p.product_name);
     const item=asEl("article","recent-purchase-card");
     item.setAttribute("aria-label","شراء "+String(p.product_name||"")+" بقيمة "+formatPrice(p.purchase_value)+" دينار");
     if(i===0&&lastStamp&&lastStamp===String(p.purchased_at)+"|"+String(p.product_name)&&Date.now()-lastRefresh<19000){
       item.classList.add("recent-purchase-new");
     }
     const visual=asEl("div","recent-purchase-art recent-purchase-art-"+style.kind);
     if(style.logo){
       const image=asEl("img");
       image.src=style.logo;
       image.alt="";
       image.loading="lazy";
       image.decoding="async";
       image.onerror=()=>{image.remove();visual.textContent="◈"};
       visual.appendChild(image);
     }else{
       visual.textContent="◈";
       visual.setAttribute("aria-hidden","true");
     }
     const main=asEl("div","recent-purchase-main");
     main.appendChild(asEl("strong","recent-purchase-product",String(p.product_name||"منتج رقمي").slice(0,100)));
     const sub=asEl("div","recent-purchase-secondary");
     const user=asEl("span","recent-purchase-buyer",String(p.buyer_name||"مشتري من المتجر").slice(0,36));
     user.appendChild(asEl("span","recent-purchase-buyer-icon","●"));
     sub.appendChild(user);
     const when=new Date(p.purchased_at);
     if(!Number.isNaN(when.getTime())){
       const t=asEl("time","recent-purchase-time",dateFmt.format(when));
       t.dateTime=when.toISOString();
       sub.appendChild(t);
     }
     main.appendChild(sub);
     const side=asEl("div","recent-purchase-side");
     const price=asEl("b","recent-purchase-price",formatPrice(p.purchase_value));
     price.appendChild(asEl("small",""," د.ل"));
     price.dir="ltr";
     side.appendChild(price);
     const status=asEl("span","recent-purchase-status "+(p.purchase_status==="completed"?"is-completed":"is-progress"),stateOf(p.purchase_status));
     side.appendChild(status);
     item.append(visual,main,side);
     frag.appendChild(item);
   });
   list.replaceChildren(frag);
   count.textContent=entries.length?entries.length+" عملية حديثة":"آخر المشتريات";
   more.hidden=entries.length<=nameLimit;
   more.textContent=expanded?"عرض آخر 6 مشتريات":"عرض المزيد من المشتريات";
   more.setAttribute("aria-expanded",String(expanded));
 }
 async function load(silent=false){
   if(loading)return;
   const db=storeClient();
   if(!db){
     if(loadAttempts++<5){setTimeout(()=>load(silent),2500)}
     else if(!entries.length){list.replaceChildren(asEl("p","recent-purchase-empty","تعذر تحميل بيانات المتجر. حدّث الصفحة."))}
     return;
   }
   loading=true;refresh.disabled=true;
   if(!silent&&!entries.length)list.replaceChildren(asEl("p","recent-purchase-empty","جاري تحميل المشتريات الحقيقية…"));
   try{
     const {data,error}=await db.rpc("get_public_purchase_activity",{p_limit:60});
     if(error)throw error;
     const next=Array.isArray(data)?data:[];
     const newest=next[0]?String(next[0].purchased_at)+"|"+String(next[0].product_name):"";
     const changed=!!lastStamp&&newest!==lastStamp;
     lastStamp=newest;
     entries=next;
     lastRefresh=changed?Date.now():0;
     show();
     const now=new Date();
     timestamp.textContent="آخر تحديث "+new Intl.DateTimeFormat("ar-LY",{timeZone:"Africa/Tripoli",hour:"2-digit",minute:"2-digit"}).format(now);
     timestamp.classList.remove("has-error");
   }catch(err){
     console.warn("[purchase-feed] Unable to load",err?.message||"unknown");
     if(!entries.length)list.replaceChildren(asEl("p","recent-purchase-empty","تعذر تحميل المشتريات حاليًا. حاول التحديث."));
     timestamp.textContent="تعذر التحديث";
     timestamp.classList.add("has-error");
   }finally{loading=false;refresh.disabled=false}
 }
 function updateWhenVisible(){
   if(document.hidden)return;
   const store=document.getElementById("storeView");
   if(store?.classList.contains("hidden"))return;
   void load(true);
 }
 more?.addEventListener("click",()=>{expanded=!expanded;show()});
 refresh?.addEventListener("click",()=>void load(false));
 window.addEventListener("focus",updateWhenVisible);
 document.addEventListener("visibilitychange",updateWhenVisible);
 setInterval(updateWhenVisible,20000);
 void load();
 
 // Consent is independent from the leaderboard. No opt-in means anonymous
 // purchase rows; nothing about a user's wallet or purchase identity leaks.
 const privacyButton=document.getElementById("accountPurchasePrivacyButton");
 const detail=document.getElementById("accountSettingsDetail");
 function setPrivacyStatus(node,message,isError=false){node.textContent=message;node.dataset.error=String(isError)}
 async function openPrivacy(){
   if(!detail)return;
   const db=storeClient();
   if(!db)return;
   const {data:session,error:sessionError}=await db.auth.getUser();
   if(sessionError||!session?.user){return}
   const user=session.user;
   detail.replaceChildren();
   detail.classList.remove("hidden");
   const title=asEl("h3","","خصوصية آخر المشتريات");
   const description=asEl("p","","كل عملية شراء مدفوعة تظهر في القسم العام بالمنتج والقيمة والحالة. اسم المشتري مخفي افتراضيًا؛ إذا وافقت، يظهر اسم حسابك بجانب مشترياتك.");
   const box=asEl("label","recent-purchase-privacy-label");
   const checkbox=asEl("input");
   checkbox.type="checkbox";
   checkbox.id="purchaseActivityIdentityOptIn";
   checkbox.disabled=true;
   const desc=asEl("span","","إظهار اسمي في سجل المشتريات العام");
   box.append(checkbox,desc);
   const note=asEl("p","recent-purchase-privacy-note","لا يظهر البريد الإلكتروني أو رقم الهاتف أو اسم Roblox أو رقم الطلب أبدًا. تقدر تلغي الموافقة في أي وقت.");
   const status=asEl("p","recent-purchase-privacy-status","جاري تحميل إعدادات الخصوصية…");
   status.setAttribute("role","status");status.setAttribute("aria-live","polite");
   detail.append(title,description,box,note,status);
   detail.scrollIntoView({block:"nearest",behavior:"smooth"});
   try{
     const {data,error}=await db.from("leaderboard_profiles")
       .select("nickname,public_visible,share_google_profile,show_in_purchase_feed")
       .eq("user_id",user.id).maybeSingle();
     if(error)throw error;
     let saved=!!data?.show_in_purchase_feed;
     checkbox.checked=saved;
     checkbox.disabled=false;
     setPrivacyStatus(status,saved?"اسمك ظاهر بجانب مشترياتك.":"مشترياتك تظهر بدون اسمك.");
     checkbox.addEventListener("change",async()=>{
       const next=checkbox.checked;
       checkbox.disabled=true;
       setPrivacyStatus(status,"جاري حفظ الإعدادات…");
       try{
         const update={
           user_id:user.id,
           nickname:data?.nickname||"متسوق"+user.id.replace(/-/g,"").slice(0,12),
           public_visible:data?.public_visible??false,
           share_google_profile:data?.share_google_profile??false,
           show_in_purchase_feed:next,
           updated_at:new Date().toISOString()
         };
         const {error:saveError}=await db.from("leaderboard_profiles").upsert(update,{onConflict:"user_id"});
         if(saveError)throw saveError;
         saved=next;
         setPrivacyStatus(status,next?"تمت الموافقة: سيظهر اسم حسابك بجانب مشترياتك.":"تم إخفاء اسمك من سجل المشتريات.");
         void load(true);
       }catch(err){
         console.warn("[purchase-feed/consent] Save failed",err?.message||"unknown");
         checkbox.checked=saved;
         setPrivacyStatus(status,"تعذر حفظ الاختيار. حاول مرة ثانية.",true);
       }finally{checkbox.disabled=false}
     });
   }catch(err){
     console.warn("[purchase-feed/consent] Load failed",err?.message||"unknown");
     setPrivacyStatus(status,"تعذر قراءة إعدادات الخصوصية. جرّب مرة ثانية.",true);
   }
 }
 privacyButton?.addEventListener("click",event=>{event.stopPropagation();void openPrivacy()});
 window.L1017nPurchaseActivity={refresh:()=>load(true),openPrivacy};
})();
