# L1017n — Telegram administration bot

This repository contains **source code only**. Do not put Telegram bot tokens, webhook secrets, or any Supabase secret/service keys in GitHub Pages, GitHub commits, HTML, or messages to customers.

## Initial activation (Arabic)

1. افتح [@BotFather](https://t.me/BotFather) في تيليجرام وأرسل `/newbot`. اختار اسم ومعرف خاص بالبوت، وخذ **التوكن**. لا تشارك التوكن مع أي شخص.
2. افتح لوحة [Supabase Functions](https://supabase.com/dashboard/project/cmtxsjlehjworqypbxjz/functions)، ثم **Secrets**. أضف:
   - `TG_BOT_TOKEN` = التوكن من BotFather
   - `TG_WEBHOOK_SECRET` = قيمة عشوائية من 32 إلى 64 حرفًا/رقمًا (حروف إنجليزية وأرقام وشرطة أو شرطة سفلية فقط). لا تستخدم نفس التوكن.
3. في صفحة الدالة `l1017n-telegram-admin` افتح **Test** ثم اختار **POST**، وأضف Header:
   - `x-telegram-bot-api-secret-token`: نفس قيمة `TG_WEBHOOK_SECRET`
   - `content-type`: `application/json`
   - Body: `{"action":"register_webhook"}`
   
   الرد المتوقع: `{"ok":true,...}`.
4. افتح البوت في تيليجرام وأرسل `/id`. البوت يرجع رقمك (معرفك الرقمي في تيليجرام).
5. ارجع إلى **Supabase > Functions > Secrets** وأضف `TG_ADMIN_ID` = الرقم الذي أعطاك إياه البوت، بدون أي مسافات.
6. في المحادثة الخاصة مع البوت أرسل `/start` أو `/help` لعرض الأوامر.

Webhook:
`https://cmtxsjlehjworqypbxjz.supabase.co/functions/v1/l1017n-telegram-admin`

**Security:** Only the exact private chat and user ID defined by `TG_ADMIN_ID` can run administrative commands. Telegram's webhook secret is checked before any command. The Edge Function needs `verify_jwt=false` **because Telegram does not send a Supabase JWT**; the webhook secret and admin ID are mandatory instead. Missing secrets cause a fail-closed error.

## Commands

| Command | Description |
|---|---|
| `/games` | قائمة الألعاب |
| `/list` | قائمة الباقات وأسعارها وحالة ظهورها |
| `/add pubg-60 | pubg | 60 UC | 60 | 12.5` | إضافة باقة جديدة مخفية حتى مراجعتها |
| `/price pubg-60 | 14` | تغيير السعر بالدينار |
| `/rename pubg-60 | 60 UC شحن` | تعديل الاسم |
| `/on pubg-60` | إظهار الباقة |
| `/off pubg-60` | إخفاء الباقة |
| `/code pubg-60 | YOUR-SUPPLIER-CODE` | تخزين كود حقيقي تملكه، بدون عرضه مرة ثانية |
| `/stock pubg-60` | عدد الأكواد المحفوظة المتاحة |
| `/id` | معرفك في تيليجرام |

Game keys should use lowercase ASCII identifiers, such as `roblox`, `pubg`, `freefire`, or `fc`. Product keys are unique.

## Important limitations

- This bot manages products and an inventory of digital codes; it **does not manufacture official Roblox/PUBG gift codes**. Supply actual valid codes from an authorized source.
- This first version **does not auto-assign codes to purchases** and **does not modify wallets or purchases**. Payment, stock reservations, delivery, and refund handling need a transaction-safe fulfillment workflow before going live.
- Existing storefront checkout is Roblox-specific. New game types must not be sold through that checkout until a matching verification/payment path has been implemented.
- The `telegram_code_stock` table has RLS enabled and no customer-facing policies or privileges; only the Supabase backend service role can access it. Codes are stored in the restricted database, not in the public site.
- Telegram chat messages containing codes may remain in Telegram history. Delete sensitive messages when finished and restrict access to the bot.

## Deployment

The Edge Function source is `supabase/functions/l1017n-telegram-admin/index.ts`. It has already been deployed to the existing Supabase project. If the code is updated, redeploy it to the same project with `verify_jwt=false`; do **not** create an additional Supabase project.

You can check deployment status using GET on the webhook URL; this reports deployed/configured status only, not secrets.
