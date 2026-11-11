import { createClient } from "npm:@supabase/supabase-js@2.75.0";

// Customer-authenticated notification, separate from checkout and payment.
// Only actual orders owned by the authenticated caller are eligible.
// A permanent atomic DB claim allows at most one Telegram delivery attempt
// per order, even if the customer reloads the page or multiple tabs race.
const headers={
 "content-type":"application/json; charset=utf-8",
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS"
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
function secretKey():string{
 const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}
 catch{return ""}
}
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method==="GET")return reply({status:"deployed"});
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);

 const bearer=req.headers.get("authorization")||"";
 if(!bearer.startsWith("Bearer "))return reply({error:"unauthorized"},401);
 const token=Deno.env.get("TG_BOT_TOKEN")||"";
 const chat=Deno.env.get("TG_ADMIN_ID")||"";
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=secretKey();
 if(!token||!/^[0-9]+$/.test(chat)||!url||!key)
   return reply({error:"server_not_configured"},503);

 let body:{order_id?:string}={};
 try{body=await req.json()}catch{return reply({error:"invalid_json"},400)}
 const id=String(body?.order_id||"");
 if(!uuidPattern.test(id))return reply({error:"invalid_order_id"},400);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(bearer.slice(7));
 if(authError||!auth.user)return reply({error:"unauthorized"},401);
 const {data:order,error:readError}=await db.from("purchase_orders")
  .select("id,user_id,product_name,total_amount,roblox_username,status,created_at,telegram_notification_claimed_at,telegram_notified_at,supplier_managed")
  .eq("id",id).maybeSingle();
 if(readError)return reply({error:"order_lookup_failed"},500);
 if(!order||order.user_id!==auth.user.id)return reply({error:"order_not_found"},404);
 if(!["paid_pending_fulfillment","completed"].includes(order.status)&&!(order.supplier_managed&&["approved","processing"].includes(order.status)))
   return reply({error:"order_not_eligible"},409);
 if(Date.now()-new Date(order.created_at).getTime()>24*60*60*1000)
   return reply({error:"order_too_old"},409);
 if(order.telegram_notified_at)return reply({ok:true,already_sent:true});
 if(order.telegram_notification_claimed_at)return reply({ok:true,already_processing:true});

 const claimedAt=new Date().toISOString();
 const {data:claimed,error:claimError}=await db.from("purchase_orders")
  .update({telegram_notification_claimed_at:claimedAt})
  .eq("id",id)
  .eq("user_id",auth.user.id)
  .in("status",["paid_pending_fulfillment","completed","approved","processing"])
  .is("telegram_notification_claimed_at",null)
  .is("telegram_notified_at",null)
  .select("id").maybeSingle();
 if(claimError)return reply({error:"notification_claim_failed"},500);
 if(!claimed)return reply({ok:true,already_processing:true});

 const amount=Number(order.total_amount);
 const price=Number.isFinite(amount)?amount.toFixed(3):"—";
 const product=String(order.product_name||"منتج رقمي").replace(/[\r\n\t]/g," ").slice(0,140);
 const username=String(order.roblox_username||"").replace(/[\r\n\t]/g," ").slice(0,50);
 const isSupplier=order.supplier_managed===true;
 const isInstantCode=username==="DIGITAL_CODE"&&!isSupplier;
 const isPubg=/pubg|ببجي|بوبجي/i.test(product);
 const completed=order.status==="completed";
 // Customer metadata is displayed only in the authenticated owner's private bot.
 let customer="حساب مسجّل";
 try{
   const {data:profile,error:profileError}=await db.auth.admin.getUserById(order.user_id);
   if(!profileError&&profile?.user){
     const u=profile.user;
     customer=String(u.user_metadata?.full_name||u.user_metadata?.name||u.email?.split("@")[0]||customer)
       .replace(/[\r\n\t]/g," ").trim().slice(0,65)||customer;
   }
 }catch{console.warn("purchase_owner_name_unavailable")}
 const {data:wallet}=await db.from("wallet_accounts")
   .select("libyana_phone").eq("user_id",order.user_id).maybeSingle();
 const phone=String(wallet?.libyana_phone||"").replace(/\D/g,"").slice(-9);
 const when=new Date(order.created_at).toLocaleString("ar-LY",{
   timeZone:"Africa/Tripoli",year:"numeric",month:"2-digit",day:"2-digit",
   hour:"2-digit",minute:"2-digit",hour12:true
 });
 const msg="🛍️ طلب شراء — L1017n\n"
   +"━━━━━━━━━━━━━━━━\n"
   +"👤 الزبون: "+customer+"\n"
   +(phone?"📱 رقم الحساب: 0"+phone+"\n":"")
   +"📦 المنتج: "+product+"\n"
   +"💰 المدفوع من المحفظة: "+price+" د.ل\n"
   +(username && username!=="DIGITAL_CODE"?(isPubg?"🎮 معرف لاعب PUBG (UID): ":"🎮 اسم Roblox: ")+username+"\n":"")
   +"🕒 وقت الطلب: "+when+"\n"
   +"📋 الحالة: "+(isSupplier?(completed?"✅ تم التنفيذ الآلي":"⏳ طلب آلي لدى OMNEX؛ يُتابع تلقائيًا"):isInstantCode?"✅ تم تسليم الكود آليًا":completed?"✅ تم التنفيذ":"⏳ بانتظار تنفيذ الإدارة")+"\n"
   +"🆔 رقم الطلب: "+id+"\n\n"
   +"✅ عملية شراء مدفوعة من رصيد المحفظة؛ ليست طلب شحن جديد."
   +(isSupplier?"\n\n🔗 التنفيذ والاسترداد لهذا الطلب يديرهما الربط تلقائيًا؛ تابع حالته من إدارة OMNEX.":isInstantCode||completed?"":"\n\n🧭 ترتيب متابعة الطلب:\n1️⃣ قبول الطلب\n2️⃣ قيد المعالجة\n3️⃣ قيد التنفيذ\n4️⃣ تم التنفيذ\n\n➡️ الخطوة التالية: 1️⃣ تم القبول\nاضغط الزر الحالي بعد التحقق من المرحلة.");
 try{
   const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({
       chat_id:Number(chat),
       text:msg,
       disable_web_page_preview:true,
       // Only the NEXT actionable stage is shown. After it is confirmed,
       // the private Telegram admin bot edits this same message with the next.
       // Failed/undeliverable purchases retain a separate refund action.
       ...(isSupplier||isInstantCode||completed ? {} : {
         reply_markup:{inline_keyboard:[
           [{text:"1️⃣ 🔵 تم القبول",callback_data:"po:accept:"+id}],
           [{text:"❌ رفض واسترجاع المبلغ",callback_data:"po:reject:"+id}]
         ]}
       })
     })
   });
   const data=await response.json().catch(()=>({ok:false}));
   if(!response.ok||data.ok!==true)
     throw Error("telegram_send_failed");
   const {error:markError}=await db.from("purchase_orders")
     .update({telegram_notified_at:new Date().toISOString()})
     .eq("id",id)
     .eq("telegram_notification_claimed_at",claimedAt);
   if(markError)console.error("Telegram purchase notification delivered but DB marking failed");
   return reply({ok:true,delivery_recorded:!markError});
 }catch(error){
   // A transport failure may occur AFTER Telegram received a message.
   // Keep the claim to prevent a second send and admin spam.
   console.error("Telegram purchase notification attempt failed",
     error instanceof Error?error.message:"unknown");
   return reply({error:"telegram_delivery_unconfirmed"},502);
 }
});
