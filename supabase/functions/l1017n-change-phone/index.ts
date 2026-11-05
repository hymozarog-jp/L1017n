/**
 * Secure mobile number replacement for signed-in L1017n customers.
 * The original phone remains linked until a new-phone Resala OTP is verified.
 * This Edge Function uses privileged DB functions; the browser never receives
 * a service-role key or an SMS provider credential.
 */
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
const allowed=new Set(["https://hymozarog-jp.github.io","https://l1017n.ct.ws","http://localhost:5173","http://127.0.0.1:5500"]);
const reply=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    ...(allowed.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin",
      "access-control-allow-methods":"POST,OPTIONS",
      "access-control-allow-headers":"authorization,apikey,content-type,x-client-info"}:{})}
});
function serviceKey():string{
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(key)return key;
  try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{return ""}
}
function canonicalPhone(raw:unknown):string{
  let digits=String(raw||"").replace(/[^0-9]/g,"");
  if(digits.startsWith("00218"))digits=digits.slice(5);
  else if(digits.startsWith("218"))digits=digits.slice(3);
  if(digits.startsWith("0"))digits=digits.slice(1);
  return /^9[1-4][0-9]{7}$/.test(digits)?digits:"";
}
async function otpHash(secret:string,userId:string,phone:string,code:string):Promise<string>{
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const bytes=await crypto.subtle.sign("HMAC",key,enc.encode("change-phone:"+userId+":"+phone+":"+code));
  return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get("origin")||"";
  if(request.method==="OPTIONS")return allowed.has(origin)
    ?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"vary":"Origin",
      "access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
      "access-control-max-age":"600"}})
    :new Response(null,{status:403});
  if(request.method!=="POST")return reply({error:"method_not_allowed"},405,origin);
  if(Number(request.headers.get("content-length")||0)>2048)return reply({error:"request_too_large"},413,origin);
  const url=Deno.env.get("SUPABASE_URL")||"",role=serviceKey();
  if(!url||!role)return reply({error:"database_unavailable"},503,origin);
  const client=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});
  const bearer=request.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1]||"";
  if(!bearer)return reply({error:"unauthorized"},401,origin);
  const {data:auth,error:authError}=await client.auth.getUser(bearer);
  if(authError||!auth.user?.id||auth.user.is_anonymous)return reply({error:"unauthorized"},401,origin);
  let body:{action?:string;phone?:unknown;code?:unknown};
  try{const raw=await request.text();if(raw.length>2048)return reply({error:"request_too_large"},413,origin);body=JSON.parse(raw)}catch{return reply({error:"invalid_json"},400,origin)}
  const action=body?.action;
  if(!["status","send","verify"].includes(String(action)))return reply({error:"invalid_action"},400,origin);
  const {data:wallet,error:walletError}=await client.from("wallet_accounts").select("libyana_phone").eq("user_id",auth.user.id).maybeSingle();
  if(walletError)return reply({error:"database_unavailable"},503,origin);
  const current=String(wallet?.libyana_phone||"");
  if(!current)return reply({error:"phone_required"},400,origin);
  const apiKey=(Deno.env.get("RESALA_API_KEY")||"").trim();
  if(!apiKey)return reply(action==="status"?{configured:false}:{error:"not_configured"},action==="status"?200:503,origin);
  if(action==="status"){
    const {data:s,error}=await client.from("phone_change_requests")
      .select("old_phone,new_phone,pin_hash,expires_at,last_sent_at").eq("user_id",auth.user.id).maybeSingle();
    if(error)return reply({error:"database_unavailable"},503,origin);
    const valid=!!s&&s.old_phone===current;
    const now=Date.now(),secs=valid&&s?.last_sent_at?Math.max(0,Math.ceil((240000-(now-Date.parse(s.last_sent_at)))/1000)):0;
    const exp=valid&&s?.expires_at?Math.max(0,Math.ceil((Date.parse(s.expires_at)-now)/1000)):0;
    return reply({configured:true,current_phone:"0"+current,pending_phone:valid?"0"+s.new_phone:null,
      retry_after_seconds:secs,expires_in_seconds:exp,code_pending:!!(valid&&s.pin_hash&&exp>0)},200,origin);
  }
  if(action==="send"){
    const phone=canonicalPhone(body.phone);
    if(!phone)return reply({error:"invalid_phone"},400,origin);
    const token=crypto.randomUUID();
    const {data:result,error:reserveError}=await client.rpc("reserve_phone_change",{p_user:auth.user.id,p_phone:phone,p_token:token});
    if(reserveError)return reply({error:"database_unavailable"},503,origin);
    if(result!=="reserved"){
      let retry=0;
      if(result==="cooldown"){
        const {data:s}=await client.from("phone_change_requests").select("last_sent_at").eq("user_id",auth.user.id).maybeSingle();
        retry=s?.last_sent_at?Math.max(0,Math.ceil((240000-(Date.now()-Date.parse(s.last_sent_at)))/1000)):240;
      }
      return reply({error:result||"send_unavailable",retry_after_seconds:retry},["cooldown","hour_limit","day_limit"].includes(result)?429:400,origin);
    }
    let sent:Response;
    try{sent=await fetch("https://dev.resala.ly/api/v1/pins?service_name=L1017N&len=6",{
      method:"POST",headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json"},
      body:JSON.stringify({phone:"218"+phone}),signal:AbortSignal.timeout(12000)
    })}catch{return reply({error:"sms_gateway_unavailable"},502,origin)}
    if(sent.status!==201){console.error("Change-phone SMS failed",sent.status);return reply({error:"sms_gateway_unavailable"},502,origin)}
    let code:string;
    try{const parsed=await sent.json();code=String(parsed.pin);if(!/^\\d{6}$/.test(code))throw Error("bad_pin")}
    catch{return reply({error:"sms_gateway_unavailable"},502,origin)}
    const hash=await otpHash(apiKey,auth.user.id,phone,code);
    const {data:saved,error:storeError}=await client.from("phone_change_requests")
      .update({pin_hash:hash,expires_at:new Date(Date.now()+300000).toISOString()})
      .eq("user_id",auth.user.id).eq("request_token",token).eq("new_phone",phone)
      .select("user_id").maybeSingle();
    if(storeError||!saved)return reply({error:"database_unavailable"},503,origin);
    return reply({sent:true,pending_phone:"0"+phone,expires_in_seconds:300,retry_after_seconds:240},200,origin);
  }
  const code=String(body.code||"").trim();
  if(!/^\\d{6}$/.test(code))return reply({error:"invalid_format"},400,origin);
  const {data:pending,error:readError}=await client.from("phone_change_requests")
    .select("old_phone,new_phone").eq("user_id",auth.user.id).maybeSingle();
  if(readError)return reply({error:"database_unavailable"},503,origin);
  if(!pending||pending.old_phone!==current)return reply({error:"not_requested"},400,origin);
  const hash=await otpHash(apiKey,auth.user.id,pending.new_phone,code);
  const {data:verdict,error:verifyError}=await client.rpc("verify_phone_change",{
    p_user:auth.user.id,p_phone:pending.new_phone,p_hash:hash
  });
  if(verifyError)return reply({error:"database_unavailable"},503,origin);
  if(verdict==="changed")return reply({changed:true,verified:true,phone:"0"+pending.new_phone},200,origin);
  return reply({error:verdict||"verification_failed"},verdict==="locked"?429:400,origin);
});
