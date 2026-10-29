/**
 * L1017n Telegram administration bot.
 * Webhook security: Telegram secret header + exact private admin chat ID.
 * Secrets never belong in the public GitHub Pages site.
 *
 * Commands operate on existing public.products and protected telegram_code_stock.
 * This function does NOT fulfill customer purchases, touch wallets, or send codes.
 */
import { createClient } from "npm:@supabase/supabase-js@2.75.0";
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

async function telegramMessage(token: string, chatId: number, message: string): Promise<void> {
  const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message.slice(0, 3900) }),
  });
  if (!response.ok) throw new Error("Telegram response " + response.status);
}

const HELP = [
  "👋 هلا بيك في مساعد إدارة متجر L1017n",
  "تقدر تكلمني بالعربي عادي؛ مش لازم تحفظ أوامر.",
  "",
  "🔐 «نبي نضيف كود» — نحدد الباقة ونحفظ الكود.",
  "📊 «كم كود عندي في ببجي؟» — نعرض المخزون.",
  "📦 «وريني الباقات» — نعرض المنتجات والأسعار.",
  "➕ «ضيف باقة جديدة» — نسألك اللعبة والاسم والكمية والسعر.",
  "💵 «غير سعر باقة ببجي» — نحدد الباقة والسعر ونطلب موافقتك.",
  "👁️ «اخفي باقة ...» أو «فعّل باقة ...».",
  "",
  "في أي وقت قول «إلغاء» أو «مساعدة».",
  "الأوامر المختصرة القديمة ما زالت تشتغل: /list /games /add /code /stock /price /rename /on /off /id.",
  "⚠️ تسليم الأكواد الفوري للباقات الرقمية فقط. روبلوكس حاليًا تنفيذ يدوي.",
].join("\n");

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

  let update: { action?: string; message?: { message_id?: number; text?: string; chat?: { id?: number; type?: string }; from?: { id?: number } } };
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
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    });
    const data = await result.json().catch(() => ({ ok: false }));
    return json({ ok: result.ok && data.ok === true, description: data.description ?? "Webhook setup response" }, result.ok && data.ok === true ? 200 : 502);
  }
  const message = update?.message;
  const chatId = message?.chat?.id;
  const senderId = message?.from?.id;
  const text = message?.text?.trim() ?? "";
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
    if (!command) {
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
    await telegramMessage(token, chatId!, reply);
    return json({ ok: true });
  } catch (error) {
    // Never log the Telegram message, codes, API keys, or customer data.
    console.error("L1017n Telegram bot operation failed:", error instanceof Error ? error.name : "unknown");
    try { await telegramMessage(token, chatId!, "تعذر تنفيذ العملية حاليًا. راجع إعدادات البوت أو جرّب بعد قليل."); }
    catch { /* Telegram may be unavailable */ }
    return json({ error: "operation_failed" }, 500);
  }
});
