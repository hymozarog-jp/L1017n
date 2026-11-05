/**
 * Authenticated Libyana prepaid-card top-up submissions.
 * Card numbers are never stored, logged or returned to the browser:
 * only HMAC fingerprints and last-four digits are retained by PostgreSQL.
 * Raw card numbers go solely to the private Telegram store admin.
 * A claim is NEVER credited automatically. Admin must redeem/verify first.
 */
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
const origins=new Set(["https://hymozarog-jp.github.io","https://l1017n.ct.ws","http://localhost:5173","http://127.0.0.1:5500"]);
const reply=(value:unknown,status=200,origin="")=>new Response(JSON.stringify(value),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
 ...(origins.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin",
 "access-control-allow-methods":"POST,OPTIONS",
 "access-control-allow-headers":"authorization,apikey,x-client-info,content-type"}:{})}
});
function serviceKey():string{
 const direct=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(direct)return direct;
 try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{return ""}
}
async function fingerprint(secret:string,code:string):Promise<string>{
 const enc=new TextEncoder();
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=await crypto.subtle.sign("HMAC",key,enc.encode("L1017n-card-v1:"+code));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Card={code:string,amount:number,hash:string,last4:string};
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get("origin")||"";
 if(request.method==="OPTIONS")return origins.has(origin)
  ?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"vary":"Origin",
   "access-control-allow-methods":"POST,OPTIONS",
   "access-control-allow-headers":"authorization,apikey,x-client-info,content-type",
   "access-control-max-age":"600"}})
  :new Response(null,{status:403});
 if(request.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
 if(Number(request.headers.get("content-length")||0)>4096)return reply({error:"request_too_large"},413,origin);
 const url=Deno.env.get("SUPABASE_URL")||"",key=serviceKey();
 const tgToken=Deno.env.get("TG_BOT_TOKEN")||"",admin=Deno.env.get("TG_ADMIN_ID")||"";
 if(!url||!key||!tgToken||!/^[0-9]+$/.test(admin))return reply({error:"server_not_configured"},503,origin);
 const bearer=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";
 if(!bearer)return reply({error:"unauthorized"},401,origin);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(bearer);
 const user=auth?.user;
 if(authError||!user?.id||user.is_anonymous)return reply({error:"unauthorized"},401,origin);
 let input:{submission_id?:unknown;cards?:unknown};
 try{
  const raw=await request.text();
  if(raw.length>4096)return reply({error:"request_too_large"},413,origin);
  input=JSON.parse(raw);
 }catch{return reply({error:"invalid_json"},400,origin)}
 const id=String(input?.submission_id||"");
 if(!uuid.test(id))return reply({error:"invalid_request_id"},400,origin);
 if(!Array.isArray(input?.cards)||input.cards.length<1||input.cards.length>8)
  return reply({error:"invalid_card_count"},400,origin);
 const cards:Card[]=[];
 const hashes=new Set<string>();
 for(const item of input.cards){
  if(!item||typeof item!=="object")return reply({error:"invalid_card_entry"},400,origin);
  const rawCode=String(item.code||"");
  const code=rawCode.replace(/[\s-]/g,"");
  const amount=Number(item.amount);
  if(!/^[0-9]{8,24}$/.test(code))return reply({error:"invalid_card_number"},400,origin);
  if(!Number.isFinite(amount)||!Number.isInteger(amount)||amount<1||amount>1000)
    return reply({error:"invalid_card_amount"},400,origin);
  const hash=await fingerprint(key,code);
  if(hashes.has(hash))return reply({error:"duplicate_card"},400,origin);
  hashes.add(hash);
  cards.push({code,amount,hash,last4:code.slice(-4)});
 }
 const total=cards.reduce((sum,c)=>sum+c.amount,0);
 if(total>5000)return reply({error:"card_total_limit"},400,origin);
 // Create request and deduplicate all fingerprints in a single DB transaction.
 // The RPC is exclusively executable by the service role, not authenticated visitors.
 const {data:saved,error:saveError}=await db.rpc("submit_card_topup_batch",{
  p_request_id:id,p_user:user.id,
  p_cards:cards.map(c=>({hash:c.hash,last4:c.last4,amount:c.amount}))
 });
 if(saveError){
  const msg=String(saveError.message||"");
  const known=["invalid_card_submission","invalid_card_count","invalid_card_entry",
   "invalid_card_amount","card_total_limit","card_request_conflict",
   "card_already_submitted","phone_required","card_submission_rate_limit"];
  const reason=known.find(k=>msg.includes(k))||"submission_failed";
  return reply({error:reason},reason==="card_submission_rate_limit"?429:400,origin);
 }
 if(saved!==id)return reply({error:"submission_failed"},500,origin);
 const {data:row,error:readError}=await db.from("topup_requests")
  .select("id,amount,phone,status,telegram_notified_at,telegram_notification_claimed_at")
  .eq("id",id).eq("user_id",user.id).maybeSingle();
 if(readError||!row)return reply({error:"submission_saved_notify_unavailable",saved:true,request_id:id},503,origin);
 if(row.status!=="pending")return reply({ok:true,saved:true,request_id:id,status:row.status},200,origin);
 if(row.telegram_notified_at)return reply({ok:true,saved:true,request_id:id,status:"pending",already_notified:true},200,origin);
 const claimTime=new Date().toISOString();
 const threshold=new Date(Date.now()-120000).toISOString();
 const {data:claimed,error:claimError}=await db.from("topup_requests")
  .update({telegram_notification_claimed_at:claimTime})
  .eq("id",id).eq("user_id",user.id).eq("status","pending")
  .is("telegram_notified_at",null)
  .or("telegram_notification_claimed_at.is.null,telegram_notification_claimed_at.lt."+threshold)
  .select("id").maybeSingle();
 if(claimError)return reply({error:"submission_saved_notify_unavailable",saved:true,request_id:id},503,origin);
 if(!claimed)return reply({ok:true,saved:true,notification_pending:true,request_id:id},200,origin);
 const lines=cards.map((c,i)=>String(i+1)+") كرت "+c.amount.toFixed(2)+" د.ل\n🔐 رقم الكرت: "+c.code);
 const msg="🎟️ طلب شحن محفظة بكروت ليبيانا\n\n"
   +"🧾 الطلب: "+id+"\n"
   +"👤 الحساب: "+String(user.email||"مستخدم").slice(0,100)+"\n"
   +"☎️ الهاتف المسجّل: 0"+String(row.phone||"")+"\n"
   +"🧮 عدد الكروت: "+cards.length+"\n"
   +"💰 الإجمالي المطلوب: "+total.toFixed(2)+" د.ل\n\n"
   +lines.join("\n\n")
   +"\n\n⚠️ المبالغ كتبها العميل. افحص كل كرت واستخدمه وتأكد من قيمته وصلاحيته قبل الضغط على «قبول». لا يتم شحن المحفظة قبل اعتمادك.";
 try{
  const tg=await fetch("https://api.telegram.org/bot"+tgToken+"/sendMessage",{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({chat_id:Number(admin),text:msg,
    reply_markup:{inline_keyboard:[
      [{text:"✅ قبول بعد التأكد من الكروت",callback_data:"wt:a:"+id}],
      [{text:"❌ رفض الكروت",callback_data:"wt:r:"+id}]
    ]}}),signal:AbortSignal.timeout(12000)
  });
  const response=await tg.json().catch(()=>({ok:false}));
  if(!tg.ok||response.ok!==true)throw Error("telegram_not_delivered");
  const {error:markError}=await db.from("topup_requests")
   .update({telegram_notified_at:new Date().toISOString()})
   .eq("id",id).eq("user_id",user.id);
  if(markError)console.error("[card-topup] Notification mark failed");
  return reply({ok:true,saved:true,notified:true,request_id:id,status:"pending",
   count:cards.length,total},200,origin);
 }catch{
  // Keep the request pending and the original card codes only in the client's
  // current form. A retry of the SAME submission ID may resend this notification.
  // Never silently approve or credit on delivery failure.
  await db.from("topup_requests").update({telegram_notification_claimed_at:null})
   .eq("id",id).eq("user_id",user.id).is("telegram_notified_at",null);
  return reply({error:"submission_saved_notify_failed",saved:true,request_id:id},502,origin);
 }
});