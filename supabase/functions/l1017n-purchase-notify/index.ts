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
  .select("id,user_id,product_name,total_amount,roblox_username,status,created_at,telegram_notification_claimed_at,telegram_notified_at")
  .eq("id",id).maybeSingle();
 if(readError)return reply({error:"order_lookup_failed"},500);
 if(!order||order.user_id!==auth.user.id)return reply({error:"order_not_found"},404);
 if(!["paid_pending_fulfillment","completed"].includes(order.status))
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
  .in("status",["paid_pending_fulfillment","completed"])
  .is("telegram_notification_claimed_at",null)
  .is("telegram_notified_at",null)
  .select("id").maybeSingle();
 if(claimError)return reply({error:"notification_claim_failed"},500);
 if(!claimed)return reply({ok:true,already_processing:true});

 const amount=Number(order.total_amount);
 const price=Number.isFinite(amount)?amount.toFixed(2):"—";
 const product=String(order.product_name||"منتج رقمي").slice(0,140);
 const username=String(order.roblox_username||"").slice(0,50);
 const isInstantCode=username==="DIGITAL_CODE";
 const completed=order.status==="completed";
 const msg="🛍️ طلب شراء جديد — L1017n\n\n"
   +"📦 المنتج: "+product+"\n"
   +"💰 المدفوع من المحفظة: "+price+" د.ل\n"
   +(username && username!=="DIGITAL_CODE"?"🎮 اسم Roblox: "+username+"\n":"")
   +"📋 الحالة: "+(isInstantCode?"✅ تم تسليم الكود آليًا":completed?"✅ تم التنفيذ":"⏳ لم يتم التنفيذ بعد")+"\n"
   +"🆔 رقم الطلب: "+id+"\n\n"
   +"✅ هذا إشعار بعملية شراء ناجحة، وليس طلب دفع جديد.";
 try{
   const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({
       chat_id:Number(chat),
       text:msg,
       disable_web_page_preview:true,
       // Codes are already delivered automatically: no manual fulfillment actions.
       // All other orders keep one Telegram message with inline status controls.
       ...(isInstantCode||completed ? {} : {
         reply_markup:{inline_keyboard:[[
           {text:"✅ تم التنفيذ",callback_data:"po:done:"+id},
           {text:"🔄 فحص الحالة",callback_data:"po:check:"+id}
         ]]}
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
