/**
 * Message487 -> L1017n. Authenticated SMS transport, not payment attestation.
 *
 * IMPORTANT: Never auto-credit wallets here. Receipts are recorded for
 * admin verification, matched by the preexisting, service-only RPC.
 * Legacy SMS Forwarder/HMAC endpoint remains unchanged.
 */
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const encoder = new TextEncoder();
const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
  status,
  headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});
function serviceKey():string{
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(key)return key;
  try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}").default??""}
  catch{return ""}
}
function bearerSecret():string {
  // Prefer a separate token. Compatibility fallback: the existing, server-side
  // HMAC key can be copied locally from the owner's former Android forwarder.
  return Deno.env.get("MESSAGE487_BEARER_TOKEN")||Deno.env.get("SMS_FORWARD_HMAC_KEY")||"";
}
async function sha256(data:string):Promise<Uint8Array>{
  return new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(data)));
}
async function validToken(actual:string,expected:string):Promise<boolean>{
  if(expected.length<32||actual.length<32||actual.length>4096)return false;
  const [a,b]=await Promise.all([sha256(actual),sha256(expected)]);
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
async function fingerprint(secret:string,deviceId:string,eventId:string):Promise<string>{
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode("message487:v1:"+deviceId+":"+eventId)));
  return [...signed].map(n=>n.toString(16).padStart(2,"0")).join("");
}
function digits(v:string):string{
  return v.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c.charCodeAt(0)>=1776?1776:1632))).replace(/٫/g,".").replace(/٬/g,"");
}
function parseLibyana(text:string){
  const match=digits(text).trim().match(/^تم\s+تحويل\s+([0-9]+(?:\.[0-9]{1,3})?)\s+دينار(?:اً)?\s+من\s+الرقم\s+(0?9[0-9]{8})\s+إلى\s+رصيدك\s+بنجاح\s*[.!،]?\s*$/u);
  if(!match)return null;
  const amount=Number(match[1]);
  if(!Number.isFinite(amount)||amount<=0||amount>10000)return null;
  return {provider:"libyana" as const,amount,transfer_phone:match[2].slice(-9)};
}
function carrierSender(s:string):boolean{
  return /^(?:[a-z]{1,4}-)?libyana$/i.test(s)||s==="ليبيانا";
}
function isUUID(s:string):boolean{
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function ack(eventId:string,details:Record<string,unknown>={}){
  return respond({status:"accepted",event_id:eventId,...details});
}
async function notifyAdmin(reviewNumber:number, amount:number, phone:string,matched:boolean){
  const token=Deno.env.get("TG_BOT_TOKEN")||"";
  const owner=Deno.env.get("TG_ADMIN_ID")||"";
  if(!token||!/^\d{5,15}$/.test(owner))return;
  const message="📩 رسالة تحويل من Message487\n"+
    "💰 "+amount.toFixed(3)+" د.ل\n📱 رقم المحوّل: ***"+phone.slice(-4)+"\n"+
    "🔎 المرجع: "+reviewNumber+"\n"+
    (matched?"✅ طابق النظام طلب شحن معلقًا.":"⚠️ لم تُطابق أي طلب. راجع الرقم والمبلغ.")+
    "\n⏳ ليست إثبات دفع رسميًا؛ تأكد من وصول الرصيد لخط المتجر قبل الاعتماد."+
    "\nللمراجعة: /sms\nبعد التأكد فقط: /smsok "+reviewNumber+
    "\nللرفض: /smsno "+reviewNumber;
  try{
    const r=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({chat_id:Number(owner),text:message}),
      signal:AbortSignal.timeout(7000)
    });
    if(!r.ok)console.error("message487_admin_notification_error",r.status);
  }catch{console.error("message487_admin_notification_unavailable")}
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return respond({error:"method_not_allowed"},405);
  const secret=bearerSecret();
  if(secret.length<32){console.error("message487_missing_secret");return respond({error:"receiver_not_configured"},503)}
  const authorization=req.headers.get("authorization")||"";
  const claimed=/^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(authorization);
  if(!claimed||!await validToken(claimed[1],secret))return respond({error:"unauthorized"},401);
  if(Number(req.headers.get("content-length")||0)>5500)return respond({error:"payload_too_large"},413);
  const type=req.headers.get("content-type")||"";
  if(!type.toLowerCase().startsWith("application/json"))return respond({error:"unsupported_content_type"},415);
  let raw="";
  try{raw=await req.text()}catch{return respond({error:"unreadable_body"},400)}
  if(raw.length>5500)return respond({error:"payload_too_large"},413);
  let body:Record<string,unknown>;
  try{body=JSON.parse(raw)}catch{return respond({error:"invalid_json"},400)}
  if(!body||Array.isArray(body)||typeof body!=="object")return respond({error:"invalid_event"},400);
  const eventId=typeof body.event_id==="string"?body.event_id:"";
  if(!isUUID(eventId)||body.schema_version!==1)return respond({error:"invalid_event_id_or_schema"},400);
  const messageType=String(body.message_type||"");
  // Connection Test from Message487 proves transport only, not a transfer.
  if(messageType==="test")return ack(eventId,{stored:false,reason:"connection_test_only"});
  // Do not store OTPs or notifications; Message487 can forward both sources.
  if(messageType!=="sms"||body.source!=="android")return ack(eventId,{stored:false,reason:"not_an_sms"});
  const deviceId=String(body.device_id||"");
  const sender=String(body.sender||"").trim();
  const message=String(body.text||"");
  const occurred=String(body.occurred_at||"");
  const stamp=Date.parse(occurred);
  if(!isUUID(deviceId)||!sender||sender.length>80||!message||message.length>900||!Number.isFinite(stamp))
    return respond({error:"invalid_sms_fields"},400);
  if(!carrierSender(sender))return ack(eventId,{stored:false,reason:"unsupported_sender"});
  const receipt=parseLibyana(message);
  if(!receipt)return ack(eventId,{stored:false,reason:"unrecognized_transfer_format"});
  const now=Date.now();
  if(stamp<now-24*3600*1000||stamp>now+5*60*1000)
    return ack(eventId,{stored:false,reason:"sms_too_old_or_future"});
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=serviceKey();
  if(!url||!key)return respond({error:"database_unconfigured"},503);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const fp=await fingerprint(secret,deviceId,eventId);
  // Use a sender label distinct from carrier-authenticated channels to
  // prevent accidentally qualifying for the legacy automatic-credit RPC.
  const {data,error}=await db.from("sms_topup_receipts").insert({
    fingerprint:fp,provider:"libyana",sender_label:"message487-libyana",
    transfer_phone:receipt.transfer_phone,amount:receipt.amount,
    sms_received_at:new Date(stamp).toISOString()
  }).select("review_number").single();
  if(error?.code==="23505"){
    const {error:reMatchError}=await db.rpc("sms_match_pending_receipts");
    if(reMatchError)console.error("message487_duplicate_rematch_failed",reMatchError.code);
    return ack(eventId,{stored:false,duplicate:true,auto_credited:false});
  }
  if(error||!data){
    console.error("message487_receipt_insert_error",error?.code||"unknown");
    return respond({error:"receipt_not_saved"},503);
  }
  const {error:matchError}=await db.rpc("sms_match_pending_receipts");
  if(matchError)console.error("message487_match_error",matchError.code);
  const {data:latest}=await db.from("sms_topup_receipts")
    .select("status").eq("review_number",data.review_number).maybeSingle();
  const matched=latest?.status==="matched";
  await notifyAdmin(data.review_number,receipt.amount,receipt.transfer_phone,matched);
  // No sms_auto_credit_receipt() call here, no wallet mutations.
  return ack(eventId,{stored:true,matched,auto_credited:false,review_number:data.review_number,
    next:"admin_verification_required"});
});
