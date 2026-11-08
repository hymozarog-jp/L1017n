/**
 * L1017n Telegram administration bot.
 * Webhook security: Telegram secret header + exact private admin chat ID.
 * Secrets never belong in the public GitHub Pages site.
 *
 * Commands operate on existing public.products and protected telegram_code_stock.
 * This function does NOT fulfill customer purchases, touch wallets, or send codes.
 */
import { buildTransferAudit, auditCommand } from "./transfer-audit.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import { MENU_TEXT, MAIN_KEYBOARD, BUTTONS, dialogKeyboard, walletMenu, activityMenu } from "./menu.ts";
import { handleWalletAction } from "./wallet-actions.ts";
import { handleArabicAdmin } from "./arabic-chat.ts";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function serviceRoleKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return keys.default ?? "";
  } catch { return ""; }
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function telegramMessage(token: string, chatId: number, message: string, keyboard:unknown=MAIN_KEYBOARD): Promise<void> {
  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 3900), reply_markup:keyboard }),
  });
  if (!response.ok) throw new Error("Telegram response " + response.status);
}

const HELP = MENU_TEXT;

const textPart = (text: string): string[] =>
  text.split("|").map(v => v.trim());

function validKey(value: string): boolean {
  return /^[a-zA-Z0-9_-]{3,100}$/.test(value);
}

function reportError(error: unknown): never {
  if (error && typeof error === "object" && "message" in error)
    throw new Error("تعذر تنفيذ العملية: " + String((error as { message: unknown }).message).slice(0, 110));
  throw new Error("تعذر تنفيذ العملية");
}

type Product = {
  id: string; product_key: string; name: string; game: string;
  amount: number; price: number; active: boolean;
};

Deno.serve(async (request: Request) => {
  if (request.method === "GET") return json({ status: "deployed", configured: Boolean(Deno.env.get("TG_BOT_TOKEN") && Deno.env.get("TG_WEBHOOK_SECRET")), documentation: "See repository setup guide" });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = Deno.env.get("TG_BOT_TOKEN") ?? "";
  const webhookSecret = Deno.env.get("TG_WEBHOOK_SECRET") ?? "";
  const adminId = Deno.env.get("TG_ADMIN_ID") ?? "";
  if (!token || !webhookSecret) return json({ error: "bot_not_configured" }, 503);

  const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!supplied || !sameSecret(supplied, webhookSecret))
    return json({ error: "unauthorized" }, 401);

  // Telegram update bodies are small; reject unexpected oversized payloads.
  if (Number(request.headers.get("content-length") || "0") > 10000)
    return json({ error: "payload_too_large" }, 413);

  let update: { action?: string; callback_query?: { id: string; data?: string; from?: { id?: number }; message?: { message_id?: number; text?: string; chat?: { id?: number; type?: string } } }; message?: { message_id?: number; text?: string; chat?: { id?: number; type?: string }; from?: { id?: number } } };
  try { update = await request.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  // Secure initial activation through the Supabase Dashboard "Test" tool.
  // Use the same webhook secret in the request header; the bot token stays on the server.
  if (update.action === "register_webhook") {
    const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!projectUrl.startsWith("https://")) return json({ error: "project_url_missing" }, 503);
    const url = (projectUrl.endsWith("/") ? projectUrl.slice(0, -1) : projectUrl) + "/functions/v1/l1017n-telegram-admin";
    const result = await fetch("https://api.telegram.org/bot" + token + "/setWebhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    });
    const data = await result.json().catch(() => ({ ok: false }));
    return json({ ok: result.ok && data.ok === true, description: data.description ?? "Webhook setup response" }, result.ok && data.ok === true ? 200 : 502);
  }
  // Inline approvals operate only on authenticated Telegram webhook updates
  // from the exact authorized private admin account.
  if (update?.callback_query) {
    const cb = update.callback_query;
    const adminChat = cb.message?.chat?.id;
    const actor = cb.from?.id;
    if (!adminId || String(adminChat) !== adminId || String(actor) !== adminId ||
        cb.message?.chat?.type !== "private") return json({ ok:true });
    const auditChoice=/^ta:([0-9a-f-]{36})$/i.exec(cb.data??"");
    if(auditChoice){
      await fetch("https://api.telegram.org/bot"+token+"/answerCallbackQuery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({callback_query_id:cb.id,text:"جاري فحص السجلات…"})});
      try{
        const db=createClient(Deno.env.get("SUPABASE_URL")||"",serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}});
        const report=await buildTransferAudit(db,auditChoice[1]);
        await telegramMessage(token,Number(adminId),report,{inline_keyboard:[[{text:"🔄 إعادة الفحص",callback_data:"ta:"+auditChoice[1]}]]});
      }catch{await telegramMessage(token,Number(adminId),"تعذر إكمال الفحص؛ لم يتم تأكيد المبلغ أو الرصيد. حاول مجددًا.");}
      return json({ok:true});
    }
    if(/^wm:/.test(cb.data??"")){
      const db=createClient(Deno.env.get("SUPABASE_URL")||"",serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}});
      await fetch("https://api.telegram.org/bot"+token+"/answerCallbackQuery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({callback_query_id:cb.id})});
      try{await walletMenu(db,token,Number(adminId),(cb.data??"").slice(3));}
      catch{await telegramMessage(token,Number(adminId),"تعذر تحميل المحافظ، جرّب مرة ثانية.");}
      return json({ok:true});
    }
    if(/^sw:/.test(cb.data??"")){
      const db=createClient(Deno.env.get("SUPABASE_URL")||"",serviceRoleKey(),{auth:{persistSession:false,autoRefreshToken:false}});
      try{await handleWalletAction(db,cb,token);}
      catch{console.error("telegram_wallet_action_failed");return json({error:"wallet_action_failed"},503);}
      return json({ok:true});
    }
    // Purchases: independent manual stages and one atomic wallet refund on rejection.
    // Webhook secret, private admin chat ID, and actor ID have already been verified.
    // Recharge requests use a separate two-choice (accept/reject) handler below.
    const manualChoice = /^po:(accept|process|fulfill|done|reject|check):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(cb.data ?? "");
    if (manualChoice) {
      const notify = async (method: string, params: unknown): Promise<boolean> => {
        try{
          const response = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
            method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(params)
          });
          if(!response.ok)console.error("telegram_purchase_action_failed",method,response.status);
          return response.ok;
        }catch(err){
          console.error("telegram_purchase_action_unreachable",method,err instanceof Error?err.message:"unknown");
          return false;
        }
      };
      const databaseUrl=Deno.env.get("SUPABASE_URL")||"";
      const key=serviceRoleKey();
      if(!databaseUrl||!key){
        await notify("answerCallbackQuery",{callback_query_id:cb.id,text:"خدمة الطلبات غير جاهزة، جرّب لاحقًا",show_alert:true});
        return json({ok:true});
      }
      const db=createClient(databaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
      const orderId=manualChoice[2];
      const action=manualChoice[1].toLowerCase();
      let {data:order,error:readError}=await db.from("purchase_orders")
        .select("id,roblox_username,status").eq("id",orderId).maybeSingle();
      if(readError||!order||order.roblox_username==="DIGITAL_CODE"){
        await notify("answerCallbackQuery",{callback_query_id:cb.id,text:"الطلب غير موجود أو تم تسليم كوده آليًا",show_alert:true});
        return json({ok:true});
      }
      let changed=false;
      let refunded=false;
      if(action!=="check"){
        const {data:decision,error:decisionError}=await db.rpc("telegram_update_purchase_status",{
          p_order_id:orderId,p_action:action
        });
        if(decisionError){
          console.error("telegram_purchase_review_failed",String(decisionError.code||""),String(decisionError.message||"").slice(0,130));
          const message=/invalid_purchase_transition/.test(decisionError.message||"")
            ?"نفّذ مراحل الطلب بالترتيب، وابدأ بالزر الظاهر في الرسالة"
            :/wallet_missing_cannot_refund/.test(decisionError.message||"")
              ?"تعذّر إرجاع الرصيد؛ راجع المحفظة ولا تعيد الرفض قبل حل المشكلة"
              :"تعذّر تحديث حالة الطلب. لم يتم تأكيد العملية";
          await notify("answerCallbackQuery",{callback_query_id:cb.id,text:message.slice(0,190),show_alert:true});
          return json({ok:true});
        }
        changed=decision?.changed===true;
        refunded=decision?.wallet_refunded===true;
        const latest=await db.from("purchase_orders").select("id,roblox_username,status")
          .eq("id",orderId).maybeSingle();
        if(latest.error||!latest.data){
          await notify("answerCallbackQuery",{callback_query_id:cb.id,text:"تم إرسال القرار، لكن تعذّر إعادة قراءة الحالة",show_alert:true});
          return json({ok:true});
        }
        order=latest.data;
      }
      const names:Record<string,string>={
        paid_pending_fulfillment:"⏳ قيد الانتظار",
        approved:"🔵 تم القبول",
        processing:"🟣 قيد المعالجة",
        fulfilling:"🟠 قيد التنفيذ",
        completed:"✅ تم التنفيذ",
        rejected:"❌ مرفوض — أُرجع المبلغ لمحفظة المتجر",
        refunded:"↩️ تمت إعادة الرصيد"
      };
      const statusLabel=names[order.status]||"حالة غير معروفة";
      const final=["completed","rejected","refunded"].includes(order.status);
      // Display only the next actionable step as the order progresses.
      const nextStep:Record<string,{action:string;label:string}>={
        paid_pending_fulfillment:{action:"accept",label:"1️⃣ 🔵 تم القبول"},
        approved:{action:"process",label:"2️⃣ 🟣 قيد المعالجة"},
        processing:{action:"fulfill",label:"3️⃣ 🟠 قيد التنفيذ"},
        fulfilling:{action:"done",label:"4️⃣ ✅ تم التنفيذ"}
      };
      const next=nextStep[order.status];
      const controls={inline_keyboard:next?[
        [{text:next.label,callback_data:"po:"+next.action+":"+orderId}],
        [{text:"❌ رفض واسترجاع المبلغ",callback_data:"po:reject:"+orderId}]
      ]:[]};
      if(cb.message?.message_id){
        const oldText=String(cb.message.text||"🛍️ طلب شراء — L1017n\n🆔 رقم الطلب: "+orderId);
        const statusText=/📋 الحالة:[^\n]*/.test(oldText)
          ?oldText.replace(/📋 الحالة:[^\n]*/,"📋 الحالة: "+statusLabel)
          :oldText+"\n\n📋 الحالة: "+statusLabel;
        const following=final?(order.status==="completed"?"✅ انتهت المراحل بنجاح":"⛔ الطلب مغلق"):
          (next?.label||"بانتظار المراجعة");
        const updatedText=/➡️ الخطوة التالية:[^\n]*/.test(statusText)
          ?statusText.replace(/➡️ الخطوة التالية:[^\n]*/,"➡️ الخطوة التالية: "+following)
          :statusText+"\n➡️ الخطوة التالية: "+following;
        await notify("editMessageText",{
          chat_id:adminChat,message_id:cb.message.message_id,
          text:updatedText.slice(0,3900),
          reply_markup:final?{inline_keyboard:[]}:controls
        });
      }
      await notify("answerCallbackQuery",{
        callback_query_id:cb.id,
        text:refunded?"تم رفض الطلب وإرجاع المبلغ إلى محفظة الزبون":changed?statusLabel:("الحالة الحالية: "+statusLabel),
        show_alert:refunded
      });
      return json({ok:true});
    }
    // SMS receipt review buttons. A receipt is not itself proof of payment.
    // Only Telegram's authenticated private admin can authorize this path.
    const smsChoice=/^sr:([ar]):([1-9][0-9]{0,14})$/.exec(cb.data??"");
    if(smsChoice){
      const respondTelegram=async(method:string,body:unknown)=>{
        try{
          const reply=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
            method:"POST",headers:{"content-type":"application/json"},
            body:JSON.stringify(body)
          });
          if(!reply.ok)console.error("sms_receipt_telegram_error",method,reply.status);
        }catch{console.error("sms_receipt_telegram_unavailable",method)}
      };
      const receiptNo=Number(smsChoice[2]);
      if(!Number.isSafeInteger(receiptNo))return json({ok:true});
      const databaseUrl=Deno.env.get("SUPABASE_URL")||"";
      const serviceKey=serviceRoleKey();
      if(!databaseUrl||!serviceKey){
        await respondTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"الخدمة غير جاهزة، حاول لاحقًا",show_alert:true});
        return json({ok:true});
      }
      const db=createClient(databaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data:receipt,error:lookupError}=await db.from("sms_topup_receipts")
        .select("review_number,status,request_id,amount").eq("review_number",receiptNo).maybeSingle();
      if(lookupError||!receipt){
        await respondTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"رسالة التحويل غير موجودة",show_alert:true});
        return json({ok:true});
      }
      if(receipt.status==="approved"||receipt.status==="rejected"){
        await respondTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"تمت مراجعة هذا التحويل سابقًا؛ لا يمكن تكراره",show_alert:true});
        return json({ok:true});
      }
      const approving=smsChoice[1]==="a";
      if(approving&&(receipt.status!=="matched"||!receipt.request_id)){
        await respondTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"لا يمكن القبول: رسالة التحويل غير مطابقة لطلب شحن",show_alert:true});
        return json({ok:true});
      }
      // The existing SQL RPC locks and validates the request, credits once,
      // and also rejects unmatched receipts without issuing any credit.
      const {error:reviewError}=await db.rpc("sms_review_topup",{
        p_review_number:receiptNo,p_decision:approving?"approved":"rejected"
      });
      if(reviewError){
        const already=/receipt_already_reviewed|topup_changed_or_mismatched/i.test(String(reviewError.message||""));
        await respondTelegram("answerCallbackQuery",{
          callback_query_id:cb.id,
          text:already?"التحويل تمت مراجعته أو تغيرت حالة الطلب":"تعذر الاعتماد؛ راجع وصول التحويل وحالة الطلب",
          show_alert:true
        });
        return json({ok:true});
      }
      const state=approving?"✅ تم التأكد من التحويل وإضافة الرصيد":"❌ تم رفض التحويل دون إضافة رصيد";
      const oldText=String(cb.message?.text||"📩 إشعار تحويل ليبيانا #"+receiptNo).slice(0,3400);
      const amended=/📋 الحالة:[^\n]*/.test(oldText)
        ?oldText.replace(/📋 الحالة:[^\n]*/,"📋 الحالة: "+state)
        :oldText+"\n\n📋 الحالة: "+state;
      await respondTelegram("editMessageText",{
        chat_id:adminChat,message_id:cb.message?.message_id,
        text:amended,reply_markup:{inline_keyboard:[]}
      });
      await respondTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:state,show_alert:false});
      return json({ok:true});
    }
    const choice = /^wt:([ar]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(cb.data ?? "");
    if (!choice) return json({ ok:true });
    const callTelegram=async(method:string,body:unknown)=>{
      const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)
      });
      return response.ok;
    };
    const databaseUrl=Deno.env.get("SUPABASE_URL")||"";
    const serviceKey=serviceRoleKey();
    if(!databaseUrl||!serviceKey){
      console.error("telegram_wallet_review_unconfigured");
      await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"خدمة مراجعة الشحن غير مهيأة حاليًا. لم يتغير الرصيد.",show_alert:true});
      return json({ok:true});
    }
    const db=createClient(databaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const approve=choice[1]==="a";
    if(approve){
      // Do not present a payment-approval button as a retryable network error
      // when a shared sender's independent carrier SMS has not arrived.
      const {data:requestRow,error:lookupError}=await db.from("topup_requests")
        .select("status,transfer_reference").eq("id",choice[2]).maybeSingle();
      if(lookupError){
        console.error("telegram_wallet_review_lookup_failed",String(lookupError.code||""),String(lookupError.message||"").slice(0,120));
        await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"تعذر قراءة طلب الشحن. لم يُضف أي رصيد؛ حاول /topups.",show_alert:true});
        return json({ok:true});
      }
      if(!requestRow){
        await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"طلب الشحن غير موجود. لم يُضف رصيد.",show_alert:true});
        return json({ok:true});
      }
      if(requestRow.status!=="pending"){
        await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"تمت مراجعة هذا الطلب سابقًا. لا يمكن اعتماد المبلغ مرتين.",show_alert:true});
        return json({ok:true});
      }
      if(String(requestRow.transfer_reference||"").startsWith("ussd-intent:external:shared:")){
        // Match an already received SMS before reviewing; never invent one.
        const {error:matchError}=await db.rpc("sms_match_pending_receipts");
        if(matchError){
          console.error("telegram_wallet_sms_match_failed",String(matchError.code||""),String(matchError.message||"").slice(0,120));
          await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"تعذر فحص رسائل ليبيانا حاليًا. لم يُضف الرصيد؛ افحص /sms.",show_alert:true});
          return json({ok:true});
        }
        const {data:receipt,error:receiptError}=await db.from("sms_topup_receipts")
          .select("id").eq("request_id",choice[2]).eq("status","matched").maybeSingle();
        if(receiptError){
          console.error("telegram_wallet_receipt_lookup_failed",String(receiptError.code||""),String(receiptError.message||"").slice(0,120));
          await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:"تعذر فحص رسالة التحويل. لم يُضف رصيد؛ جرّب /sms.",show_alert:true});
          return json({ok:true});
        }
        if(!receipt){
          await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,
            text:"لم تصل رسالة تحويل ليبيانا مطابقة لهذا الطلب. تأكد من وصول التحويل فعليًا، ثم افحص /sms. لم يُضف رصيد.",
            show_alert:true});
          return json({ok:true});
        }
      }
    }
    const {error}=await db.rpc("telegram_review_topup_request",{p_request_id:choice[2],p_approve:approve});
    if(error){
      const reason=String(error.message||"");
      console.error("telegram_wallet_review_failed",String(error.code||""),reason.slice(0,160));
      const already=/request_already_reviewed|topup_already_reviewed/.test(reason);
      const notice=already?"تمت مراجعة هذا الطلب سابقًا؛ لا يمكن تكرار القرار.":
        /shared_sender_receipt_not_verified/.test(reason)
          ?"لم يصل إشعار SMS مطابق لرقم المحوّل والمبلغ. لا يمكن إضافة الرصيد الآن؛ افحص /sms.":
        /request_not_found|topup_not_found/.test(reason)
          ?"طلب الشحن غير موجود. لم يُضف رصيد.":
        /not_authorized/.test(reason)
          ?"حساب الإدارة غير مخوّل بمراجعة هذا الطلب.":
          "تعذرت مراجعة طلب الشحن. لم يُضف أي رصيد؛ راجع /topups ثم حاول مرة ثانية.";
      await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:notice,show_alert:!already});
      return json({ok:true});
    }
    const label=approve?"✅ تمت الموافقة وإضافة الرصيد":"❌ تم رفض الطلب";
    await callTelegram("editMessageText",{chat_id:adminChat,message_id:cb.message?.message_id,text:(cb.message?.text||"طلب شحن المحفظة").slice(0,3500)+"\n\n"+label,reply_markup:{inline_keyboard:[]}});
    await callTelegram("answerCallbackQuery",{callback_query_id:cb.id,text:approve?"تم قبول الطلب":"تم رفض الطلب"});
    return json({ok:true});
  }
  const message = update?.message;
  const chatId = message?.chat?.id;
  const senderId = message?.from?.id;
  const rawText = message?.text?.trim() ?? "";
  const text = BUTTONS[rawText] ?? rawText;
  if (message?.chat?.type !== "private" || !Number.isSafeInteger(chatId) ||
      !Number.isSafeInteger(senderId) || !text) return json({ ok: true });

  const command = (text.match(/^\/([a-z_]+)(?:@[a-zA-Z0-9_]+)?(?:\s|$)/i)?.[1] ?? "").toLowerCase();
  const payload = text.replace(/^\/[a-z_]+(?:@[a-zA-Z0-9_]+)?\s*/i, "").trim();
  if (command === "id") {
    await telegramMessage(token, chatId!, "رقم حسابك في تيليجرام: " + senderId);
    return json({ ok: true });
  }

  // Fail closed until the owner ID has been explicitly configured.
  if (!adminId || String(chatId) !== adminId || String(senderId) !== adminId)
    return json({ ok: true });

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = serviceRoleKey();
  if (!url || !serviceKey) return json({ error: "database_not_configured" }, 503);
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    let reply = "";
    let deleteSensitiveMessage = false;
    if (BUTTONS[rawText] && !["✅ نعم، تأكيد","❌ إلغاء"].includes(rawText) || command==="start" || command==="help") {
      const {error}=await db.from("telegram_admin_dialog").delete().eq("chat_id",chatId);if(error)reportError(error);
    }
    if(command==="check"||/^(تحقق|افحص)(?:\s|$)/.test(text)){
      const query=command==="check"?payload:text.replace(/^(تحقق|افحص)\s*/,"");
      await telegramMessage(token,chatId!,await auditCommand(db,query));
      return json({ok:true});
    }
    if(command==="sms"||command==="orders"){
      await activityMenu(db,token,chatId!,command);
      return json({ok:true});
    }
    if(command==="wallets"){
      await walletMenu(db,token,chatId!);
      return json({ok:true});
    }
    if (command === "topups") {
      // Private admin-only recovery for requests created before notifications
      // were enabled, or when the customer's browser never returned.
      const {data:pending,error:readError}=await db.from("topup_requests")
        .select("id,user_id,amount,method,phone,created_at,status")
        .eq("status","pending").order("created_at",{ascending:false}).limit(8);
      if(readError)reportError(readError);
      if(!pending?.length){
        reply="✅ ما فيش طلبات شحن معلّقة حاليًا.";
      }else{
        let sent=0;
        for(const requestRow of pending){
          const {data:sms}=await db.from("sms_topup_receipts")
            .select("review_number,status")
            .eq("request_id",requestRow.id)
            .order("received_at",{ascending:false}).limit(1).maybeSingle();
          const verifiedSms=sms?.status==="matched"
            ?"📨 وصلت رسالة تحويل مطابقة #"+sms.review_number
            :"⚠️ لا توجد رسالة تحويل مطابقة مسجّلة";
          const when=new Date(requestRow.created_at).toLocaleString("ar-LY",{
            timeZone:"Africa/Tripoli",year:"numeric",month:"2-digit",day:"2-digit",
            hour:"2-digit",minute:"2-digit",hour12:true
          });
          const text="🧾 طلب شحن معلّق — مراجعة الإدارة\n"
            +"💰 المبلغ: "+Number(requestRow.amount).toFixed(3)+" د.ل\n"
            +"📱 المشغّل: "+(requestRow.method==="libyana"?"ليبيانا":"المدار")+"\n"
            +"☎️ رقم التحويل: "+String(requestRow.phone||"—").slice(0,30)+"\n"
            +"🕒 وقت الطلب: "+when+"\n"
            +"🆔 رقم الطلب: "+requestRow.id+"\n"
            +verifiedSms+"\n"
            +"⚠️ لا تقبل إلا بعد التحقق من وصول المبلغ الحقيقي. القبول يضيف الرصيد إلى حساب الزبون.";
          const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{
            method:"POST",headers:{"content-type":"application/json"},
            body:JSON.stringify({
              chat_id:Number(adminId),text,
              reply_markup:{inline_keyboard:[[{text:"🔎 فحص التحويل والمحفظة",callback_data:"ta:"+requestRow.id}],[
                {text:"✅ قبول بعد التحقق",callback_data:"wt:a:"+requestRow.id},
                {text:"❌ رفض",callback_data:"wt:r:"+requestRow.id}
              ]]}
            })
          });
          if(!response.ok){console.error("topups_command_send_failed",response.status);break;}
          sent++;
        }
        reply=sent?"📨 أرسلت "+sent+" طلبات شحن معلّقة مع أزرار المراجعة."
          :"تعذّر إرسال الطلبات. حاول مرة ثانية.";
      }
    } else if (command === "orders") {
      const {data:orders,error:listError}=await db.from("purchase_orders")
        .select("id,product_name,total_amount,roblox_username,status")
        .neq("roblox_username","DIGITAL_CODE")
        .order("created_at",{ascending:false}).limit(15);
      if(listError)reportError(listError);
      reply=!orders?.length?"📋 لا توجد طلبات تنفيذ يدوي حاليًا."
        :"📋 آخر الطلبات اليدوية (بدون الأكواد):\n\n"
        +orders.map(o=>
          "📦 "+String(o.product_name||"طلب").slice(0,90)
          +" — "+Number(o.total_amount).toFixed(2)+" د.ل"
          +"\n🎮 @"+String(o.roblox_username||"—").slice(0,40)
          +"\n"+(o.status==="completed"?"✅ تم التنفيذ":o.status==="approved"?"🔵 تم القبول":o.status==="processing"?"🟣 قيد المعالجة":o.status==="fulfilling"?"🟠 قيد التنفيذ":o.status==="paid_pending_fulfillment"?"⏳ قيد الانتظار":o.status==="rejected"?"❌ رُفض وأُرجع الرصيد":"↩️ تم إرجاع الرصيد")
          +"\n🆔 "+o.id
        ).join("\n\n");
    } else if (command === "smsauto") {
      const action = payload.toLowerCase();
      if (!action || action === "status") {
        const { data: cfg, error: cfgError } = await db.from("sms_auto_credit_settings")
          .select("enabled,approval_mode").eq("id",1).single();
        if (cfgError) reportError(cfgError);
        const {data:lastSms,error:lastSmsError}=await db.from("sms_topup_receipts")
          .select("received_at").order("received_at",{ascending:false}).limit(1).maybeSingle();
        if(lastSmsError)reportError(lastSmsError);
        const {count:pendingCount,error:pendingError}=await db.from("topup_requests")
          .select("id",{head:true,count:"exact"}).eq("status","pending").eq("method","libyana")
          .gte("created_at",new Date(Date.now()-24*60*60*1000).toISOString());
        if(pendingError)reportError(pendingError);
        const lastReceived=lastSms?.received_at?Date.parse(lastSms.received_at):0;
        const ageMinutes=lastReceived?Math.max(0,Math.floor((Date.now()-lastReceived)/60000)):null;
        const flowState=ageMinutes===null
          ?"⚠️ لا يوجد سجل SMS مستلَم؛ راجع إعدادات تطبيق تحويل الرسائل."
          :ageMinutes>30
            ?"⚠️ آخر رسالة SMS مسجلة منذ "+(ageMinutes<60?ageMinutes+" دقيقة":Math.floor(ageMinutes/60)+" ساعة")+" تقريبًا. إذا حدث تحويل أحدث، تحقق من تشغيل تطبيق تحويل الرسائل وصلاحياته والويبهوك."
            :"📨 آخر إشعار SMS مسجل منذ "+ageMinutes+" دقيقة.";
        reply = "📨 استقبال طلبات شحن ليبيانا: " + (cfg?.enabled ? "✅ مفعّل" : "⏸️ متوقف") +
          "\n🧾 اعتماد الرصيد: " + (cfg?.approval_mode==="manual" ? "يدوي — أنت تضغط قبول أو رفض من تيليجرام لكل مبلغ" : "آلي عند مطابقة اسم المرسل ورقم المحوّل والمبلغ") +
          "\n🔎 يعتمد الشحن الآلي على SMS مع توثيق الرقم ومنع التكرار؛ وليس تأكيد تحصيل رسميًا من الشركة." +
          "\n⚠️ لقبول الطلب يدويًا تأكد بنفسك من وصول المبلغ؛ إنشاء الطلب أو وصول SMS ليس إثباتًا كافيًا." +
          "\n"+flowState+
          "\n⏳ طلبات ليبيانا المعلقة في آخر 24 ساعة: "+String(pendingCount||0)+
          "\nاستخدم زري التشغيل والإيقاف من القائمة.";
      } else if (action === "on" || action === "off") {
        const { error: setError } = await db.from("sms_auto_credit_settings")
          .update({enabled:action==="on",activated_at:new Date().toISOString()}).eq("id",1);
        if (setError) reportError(setError);
        reply = action === "on"
          ? "✅ تم تشغيل معالجة الشحن حسب وضع الاعتماد المضبوط. اضغط «حالة الشحن الآلي» لعرضه."
          : "⏸️ أوقفت الشحن الآلي. الطلبات والرسائل تبقى متاحة للمراجعة.";
      } else reply = "الصيغة: /smsauto status أو /smsauto on أو /smsauto off";
    } else if (command === "sms") {
      const { error: matchError } = await db.rpc("sms_match_pending_receipts");
      if (matchError) reportError(matchError);
      const { data: receipts, error: listError } = await db.from("sms_topup_receipts")
        .select("review_number,status,provider,amount,transfer_phone,received_at,request_id,note")
        .in("status", ["matched","unmatched","approved"]).order("received_at", { ascending: false }).limit(15);
      if (listError) reportError(listError);
      const phones = [...new Set((receipts ?? []).map(r => String(r.transfer_phone)))];
      let linked = new Set<string>();
      if (phones.length) {
        const { data: links, error: linkError } = await db.from("sms_sender_wallet_links")
          .select("provider,transfer_phone").in("transfer_phone", phones);
        if (linkError) reportError(linkError);
        linked = new Set((links ?? []).map(l => l.provider + ":" + l.transfer_phone));
      }
      reply = !receipts?.length ? "📨 ما فيش رسائل تحويل جديدة للمراجعة." :
        "📨 رسائل التحويل (آخر 15):\n\n" + receipts.map(r => {
          const hasLink = linked.has(r.provider + ":" + r.transfer_phone);
          const state = r.status === "approved"
            ? (r.note === "AUTO_SMS_V1" ? "🤖 تم الشحن آليًا" : "✅ تم اعتماد الرصيد")
            : r.status === "matched"
              ? "✅ طلب شحن مطابق"
              : hasLink ? "✅ رقم مربوط بحساب — جاهز للشحن الآلي للرسائل الجديدة" : "⚠️ رقم غير مربوط بحساب";
          return "رقم " + r.review_number + " | " +
            (r.provider === "libyana" ? "ليبيانا" : "المدار") +
            " | " + Number(r.amount).toFixed(3) + " د.ل" +
            " | ***" + String(r.transfer_phone).slice(-4) +
            "\n" + state +
            "\n" + (r.status === "approved" ? "🔒 أُضيف الرصيد بالفعل" :
              (r.status === "matched" || hasLink ? "/smsok " + r.review_number + "    " : "") +
              "/smsno " + r.review_number +
              (!hasLink && r.status !== "matched" ? "\nلربط الرقم مرة واحدة: /smsbind " + r.review_number + " EMAIL" : ""));
        }).join("\n\n") +
        "\n\n⚠️ رسالة SMS مش إثبات من مشغّل الشبكة. ما تعتمدش إلا بعد التحقق. كل رسالة تُستخدم مرة واحدة.";
    } else if (command === "smsbind") {
      const m = payload.match(/^([0-9]{1,15})\s+([^\s]{5,254})$/);
      if (!m || !Number.isSafeInteger(Number(m[1])) || Number(m[1]) < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m[2])) {
        reply = "الصيغة: /smsbind 1 email@example.com\nاربط الرقم بحساب الزبون بعد التأكد من ملكيته فقط. هذا الإجراء مرة واحدة.";
      } else {
        const { data: bind, error: bindError } = await db.rpc("sms_link_sender_wallet", {
          p_review_number: Number(m[1]), p_email: m[2]
        });
        if (bindError) {
          if (bindError.message?.includes("store_account_not_found"))
            reply = "🚫 ما لقيتش حسابًا بهذا البريد. خلي الزبون يسجّل في المتجر أولاً.";
          else if (bindError.message?.includes("phone_already_linked_to_other_account"))
            reply = "🚫 الرقم مربوط مسبقًا بحساب ثاني، وما غيرناش الربط.";
          else if (bindError.message?.includes("registered_account_phone_does_not_match_sender"))
            reply = "🚫 رقم المحوّل ما يطابقش رقم الهاتف المسجّل في حساب الزبون. خلّيه يسجّل بالرقم الصحيح وتحقق من ملكيته أولًا.";
          else reportError(bindError);
        } else reply = "✅ ربطت رقم المحوّل في الرسالة " + bind.review_number +
          " بحساب " + bind.account_email +
          ". من توا ما يحتاجش الزبون يقدم طلب شحن في كل مرة.\n" +
          "بعد مراجعة وصول التحويل الحقيقي، اعتمده بالأمر /smsok " + bind.review_number;
      }
    } else if (command === "smsok" || command === "smsno") {
      const number = Number(payload);
      if (!/^[0-9]{1,15}$/.test(payload) || !Number.isSafeInteger(number) || number < 1) {
        reply = "اكتب رقم الرسالة، مثلاً: /smsok 1 أو /smsno 1";
      } else {
        const { error: matchError } = await db.rpc("sms_match_pending_receipts");
        if (matchError) reportError(matchError);
        const { data: receipt, error: readError } = await db.from("sms_topup_receipts")
          .select("review_number,status,amount,provider,transfer_phone,request_id")
          .eq("review_number",number).maybeSingle();
        if (readError) reportError(readError);
        if (!receipt) reply = "ما لقيتش رسالة بهذا الرقم. استخدم /sms";
        else if (receipt.status === "approved" || receipt.status === "rejected")
          reply = "هذه الرسالة تمت مراجعتها سابقًا، وما نقدرش نعتمدها مرة ثانية.";
        else {
          const decision = command === "smsok" ? "approved" : "rejected";
          const isOldMatched = receipt.status === "matched" && !!receipt.request_id;
          let senderLinked = false;
          if (!isOldMatched && decision === "approved") {
            const { data: link, error: linkError } = await db.from("sms_sender_wallet_links")
              .select("user_id").eq("provider",receipt.provider)
              .eq("transfer_phone",receipt.transfer_phone).maybeSingle();
            if (linkError) reportError(linkError);
            senderLinked = !!link;
          }
          if (!isOldMatched && decision === "approved" && !senderLinked) {
            reply = "🚫 رقم المحوّل مش مربوط بحساب زبون. تأكد من صاحب الرقم ثم اربطه مرة واحدة:\n/smsbind " +
              number + " email@example.com\nوبعدها استخدم /smsok " + number;
          } else {
            const rpc = isOldMatched ? "sms_review_topup" : "sms_review_direct_topup";
            const { data: reviewed, error: reviewError } = await db.rpc(rpc, {
              p_review_number:number, p_decision:decision
            });
            if (reviewError) {
              if (reviewError.message?.includes("requires_manual_verification"))
                reply = "⚠️ المبلغ أو تاريخ التحويل يحتاج مراجعة خارج مسار SMS. لم يُضف رصيد.";
              else if (reviewError.message?.includes("sender_phone_not_linked"))
                reply = "🚫 رقم المحوّل مش مربوط بحساب. استخدم /smsbind أولاً.";
              else if (reviewError.message?.includes("receipt_already_reviewed"))
                reply = "الرسالة تمت مراجعتها مسبقًا، وما نقدرش نضيف رصيدًا مرتين.";
              else reportError(reviewError);
            } else reply = decision === "approved"
              ? "✅ اعتمدت التحويل رقم " + number + "، وأضفت " +
                Number(reviewed?.amount ?? receipt.amount).toFixed(3) +
                " د.ل لمحفظة الزبون " + (isOldMatched ? "حسب طلبه." : "مباشرةً، بدون طلب شحن.") +
                "\n🔒 نفس الرسالة ما تقدرش تنشحن مرتين."
              : "⛔ رفضت رسالة التحويل رقم " + number + ". ما أضفناش أي رصيد.";
          }
        }
      }
    } else if (!command) {
      const natural = await handleArabicAdmin(db, chatId!, text);
      reply = natural.reply;
      deleteSensitiveMessage = !!natural.deleteMessage;
    } else if (command === "start" || command === "help") {
      reply = HELP;
    } else if (command === "games") {
      const { data, error } = await db.from("products").select("game,active").limit(1000);
      if (error) reportError(error);
      const games = new Map<string, number>();
      for (const product of data ?? []) {
        const game = String(product.game);
        games.set(game, (games.get(game) ?? 0) + 1);
      }
      reply = games.size
        ? "🎮 الألعاب:\n" + [...games].map(([game, qty]) => game + " — " + qty + " باقة").join("\n")
        : "ما فيش ألعاب مضافة.";
    } else if (command === "list") {
      const { data, error } = await db.from("products")
        .select("product_key,name,game,price,active")
        .order("game").order("sort_order").limit(40);
      if (error) reportError(error);
      reply = (data?.length ?? 0)
        ? "📦 الباقات (أول 40):\n\n" + (data ?? []).map(p =>
            (p.active ? "✅ " : "⛔ ") + p.product_key + "\n" + p.name +
            " / " + p.game + " / " + p.price + " د.ل"
          ).join("\n\n")
        : "ما فيش باقات.";
    } else if (command === "add") {
      const args = textPart(payload);
      if (args.length !== 5) reply = "الصيغة:\n/add key | game | name | amount | price";
      else {
        const [key, game, name, amountText, priceText] = args;
        const amount = Number(amountText), price = Number(priceText);
        if (!validKey(key) || !/^[a-z0-9_-]{2,50}$/.test(game) ||
            name.length < 2 || name.length > 160 ||
            !Number.isSafeInteger(amount) || amount < 1 || amount > 100000000 ||
            !Number.isFinite(price) || price <= 0 || price > 1000000)
          reply = "تحقق من المعرف (حروف إنجليزية وأرقام وشرطة)، اللعبة، الاسم، الكمية والسعر.";
        else {
          const { error } = await db.from("products").insert({
            product_key: key, game, name, amount,
            price: Math.round(price * 100) / 100, active: false, sort_order: 1000,
          });
          if (error?.code === "23505") reply = "هذا المعرف مستخدم من قبل. اختار معرفًا ثانيًا.";
          else if (error) reportError(error);
          else reply = "✅ تمت إضافة الباقة " + key + " (مخفية).\nراجع بياناتها وبعدها استخدم /on " + key;
        }
      }
    } else if (["price", "rename", "on", "off"].includes(command)) {
      const args = textPart(payload);
      const key = command === "on" || command === "off" ? payload.trim() : args[0] ?? "";
      if (!validKey(key) || (["price", "rename"].includes(command) && args.length !== 2))
        reply = "الصيغة الصحيحة:\n/" + command + " key" + (["price", "rename"].includes(command) ? " | القيمة" : "");
      else {
        let change: Record<string, unknown> = {};
        if (command === "on" || command === "off") change = { active: command === "on" };
        if (command === "price") {
          const price = Number(args[1]);
          if (!Number.isFinite(price) || price <= 0 || price > 1000000) reply = "السعر غير صحيح.";
          else change = { price: Math.round(price * 100) / 100 };
        }
        if (command === "rename") {
          if (args[1].length < 2 || args[1].length > 160) reply = "اسم الباقة لازم بين حرفين و160 حرف.";
          else change = { name: args[1] };
        }
        if (!reply) {
          const { data, error } = await db.from("products").update(change)
            .eq("product_key", key).select("product_key").maybeSingle();
          if (error) reportError(error);
          reply = data ? "✅ تم تحديث الباقة " + key : "ما لقيتش باقة بالمعرف " + key;
          if (data && command === "on")
            reply += "\nتنبيه: فعّل الباقات الرقمية بعد إضافة أكواد للمخزون. الروبوكس ما زال تنفيذه يدويًا.";
        }
      }
    } else if (command === "code") {
      const args = textPart(payload);
      if (args.length !== 2) reply = "الصيغة:\n/code product-key | DIGITAL-CODE";
      else {
        const [key, code] = args;
        if (!validKey(key) || code.length < 3 || code.length > 300)
          reply = "معرف الباقة أو طول الكود غير صالح.";
        else {
          const { data: product, error: findError } = await db.from("products")
            .select("id,product_key").eq("product_key", key).maybeSingle();
          if (findError) reportError(findError);
          if (!product) reply = "الباقة غير موجودة. أضفها أولاً.";
          else {
            const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
            const hash = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
            const { error } = await db.from("telegram_code_stock").insert({
              product_id: product.id, code_value: code, code_sha256: hash,
            });
            if (error?.code === "23505") reply = "الكود هذا مسجّل مسبقًا لهذه الباقة؛ ما أضفناش نسخة ثانية.";
            else if (error) reportError(error);
            else reply = "✅ تم حفظ كود جديد في المخزون المحمي للباقة " + key +
              ".\nالأكواد تُسلَّم فورًا للمشتري عند شراء باقة رقمية مدعومة من المحفظة.";
          }
        }
      }
    } else if (command === "stock") {
      const key = payload.trim();
      if (!validKey(key)) reply = "الصيغة:\n/stock product-key";
      else {
        const { data: product, error: findError } = await db.from("products")
          .select("id").eq("product_key", key).maybeSingle();
        if (findError) reportError(findError);
        if (!product) reply = "الباقة غير موجودة.";
        else {
          const { count, error } = await db.from("telegram_code_stock")
            .select("id", { head: true, count: "exact" })
            .eq("product_id", product.id).eq("status", "available");
          if (error) reportError(error);
          reply = "📊 المخزون المتاح للباقة " + key + ": " + (count ?? 0) + " كود.";
        }
      }
    } else {
      reply = "الأمر غير معروف. اكتب /help لعرض الأوامر.";
    }

    // Code commands contain supplier secrets. Best-effort remove the original message
    // from the private bot conversation once handled; do not echo the secret.
    if ((command === "code" || deleteSensitiveMessage) && Number.isSafeInteger(message?.message_id)) {
      try {
        await fetch("https://api.telegram.org/bot" + token + "/deleteMessage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: message!.message_id }),
        });
      } catch { /* deletion is best-effort */ }
    }
    await telegramMessage(token, chatId!, reply, await dialogKeyboard(db,chatId!));
    return json({ ok: true });
  } catch (error) {
    // Never log the Telegram message, codes, API keys, or customer data.
    console.error("L1017n Telegram bot operation failed:", error instanceof Error ? error.name : "unknown");
    try { await telegramMessage(token, chatId!, "تعذر تنفيذ العملية حاليًا. راجع إعدادات البوت أو جرّب بعد قليل."); }
    catch { /* Telegram may be unavailable */ }
    return json({ error: "operation_failed" }, 500);
  }
});

