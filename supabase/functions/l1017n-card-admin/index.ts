/**
 * Encrypted prepaid voucher admin console.
 * Every request requires an authenticated Supabase session, confirmed email,
 * admin_users membership AND current private.wallet_admins membership.
 * Redeemable codes are decrypted only on explicit admin reveal and audited.
 */
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
const origins=new Set(["https://hymozarog-jp.github.io","https://l1017n.ct.ws","http://localhost:5173","http://127.0.0.1:5500"]);
const json=(body:unknown,status=200,origin="")=>new Response(JSON.stringify(body),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
  ...(origins.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin",
  "access-control-allow-methods":"POST,OPTIONS",
  "access-control-allow-headers":"authorization,apikey,x-client-info,content-type"}:{})}
});
function serviceKey():string{
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(key)return key;
 try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||""}catch{return ""}
}
const enc=new TextEncoder();
async function decryptKey(secret:string):Promise<CryptoKey>{
 const derived=await crypto.subtle.digest("SHA-256",enc.encode("L1017n:card-voucher:AES256-GCM:v1:"+secret));
 return crypto.subtle.importKey("raw",derived,{name:"AES-GCM"},false,["decrypt"]);
}
function decodeB64(text:string):Uint8Array{
 return Uint8Array.from(atob(text),c=>c.charCodeAt(0));
}
async function revealCode(key:CryptoKey,cipher:string,nonce:string):Promise<string>{
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:decodeB64(nonce)},
  key,decodeB64(cipher));
 return new TextDecoder().decode(plain);
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return origins.has(origin)
  ?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,
    "vary":"Origin","access-control-allow-methods":"POST,OPTIONS",
    "access-control-allow-headers":"authorization,apikey,x-client-info,content-type",
    "access-control-max-age":"600"}})
  :new Response(null,{status:403});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405,origin);
 if(Number(req.headers.get("content-length")||0)>2048)return json({error:"request_too_large"},413,origin);
 const token=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";
 if(!token)return json({error:"unauthorized"},401,origin);
 const role=serviceKey(),url=Deno.env.get("SUPABASE_URL")||"";
 if(!role||!url)return json({error:"backend_unavailable"},503,origin);
 const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 const user=auth?.user;
 if(authError||!user?.id||user.is_anonymous)return json({error:"unauthorized"},401,origin);
 let payload:{action?:unknown;request_id?:unknown}={};
 try{const raw=await req.text();if(raw.length>2048)return json({error:"request_too_large"},413,origin);payload=JSON.parse(raw)}
 catch{return json({error:"invalid_json"},400,origin)}
 const action=String(payload.action||"");
 if(!["status","list","reveal"].includes(action))return json({error:"invalid_action"},400,origin);
 // Service-only authorization combines two independent admin lists plus
 // a confirmed login email; user-owned metadata is never trusted.
 const {data:allowed,error:checkError}=await db.rpc("is_authorized_card_admin",{p_admin_id:user.id});
 if(checkError)return json({error:"admin_check_unavailable"},503,origin);
 if(!allowed){
  return action==="status"?json({is_admin:false},200,origin):json({error:"forbidden"},403,origin);
 }
 if(action==="status")return json({is_admin:true},200,origin);
 if(action==="list"){
  const {data:requests,error:readError}=await db.from("topup_requests")
   .select("id,user_id,amount,phone,status,created_at,telegram_notified_at")
   .like("transfer_reference","card-batch:%").order("created_at",{ascending:false}).limit(75);
  if(readError)return json({error:"database_unavailable"},503,origin);
  const ids=(requests||[]).map(x=>x.id);
  if(!ids.length)return json({is_admin:true,requests:[]},200,origin);
  const {data:items,error:itemError}=await db.from("card_topup_items")
   .select("request_id,item_position,claimed_amount,code_suffix,code_ciphertext")
   .in("request_id",ids).order("item_position",{ascending:true});
  if(itemError)return json({error:"database_unavailable"},503,origin);
  const byRequest=new Map<string,Array<{position:number;amount:number;last4:string;recoverable:boolean}>>();
  for(const item of items||[]){
   const list=byRequest.get(item.request_id)||[];
   list.push({position:item.item_position,amount:Number(item.claimed_amount),
    last4:String(item.code_suffix),recoverable:!!item.code_ciphertext});
   byRequest.set(item.request_id,list);
  }
  return json({is_admin:true,requests:(requests||[]).map(r=>({
   id:r.id,amount:Number(r.amount),status:r.status,created_at:r.created_at,
   phone:"0"+String(r.phone||""),notified:!!r.telegram_notified_at,
   cards:byRequest.get(r.id)||[]
  }))},200,origin);
 }
 const id=String(payload.request_id||"");
 if(!uuid.test(id))return json({error:"invalid_request_id"},400,origin);
 const {data:request,error:requestError}=await db.from("topup_requests")
  .select("id,status,transfer_reference").eq("id",id).maybeSingle();
 if(requestError)return json({error:"database_unavailable"},503,origin);
 if(!request||request.transfer_reference!=="card-batch:"+id)
  return json({error:"not_found"},404,origin);
 const {count:recent,error:countError}=await db.from("card_topup_admin_audit")
  .select("id",{count:"exact",head:true}).eq("admin_id",user.id)
  .gte("viewed_at",new Date(Date.now()-60000).toISOString());
 if(countError)return json({error:"audit_unavailable"},503,origin);
 if(Number(recent||0)>=15)return json({error:"reveal_rate_limit"},429,origin);
 const {data:items,error:itemError}=await db.from("card_topup_items")
  .select("item_position,claimed_amount,code_suffix,code_ciphertext,code_nonce")
  .eq("request_id",id).order("item_position",{ascending:true});
 if(itemError)return json({error:"database_unavailable"},503,origin);
 const {error:auditError}=await db.from("card_topup_admin_audit")
  .insert({admin_id:user.id,request_id:id});
 if(auditError)return json({error:"audit_unavailable"},503,origin);
 try{
  const key=await decryptKey(role);
  const cards=[];
  for(const c of items||[]){
   const code=c.code_ciphertext&&c.code_nonce
    ?await revealCode(key,String(c.code_ciphertext),String(c.code_nonce)):null;
   cards.push({position:c.item_position,amount:Number(c.claimed_amount),
    last4:String(c.code_suffix),code});
  }
  return json({request_id:id,status:request.status,cards},200,origin);
 }catch{
  console.error("[card-admin] Decryption failure");
  return json({error:"decryption_unavailable"},503,origin);
 }
});