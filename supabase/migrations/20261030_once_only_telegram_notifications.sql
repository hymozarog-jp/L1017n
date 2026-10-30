-- Telegram top-up and purchase notifications are claimed atomically once per
-- request/order. A notification send might succeed before the sender receives
-- Telegram's response; therefore a claimed attempt is never automatically
-- retried and cannot flood the administrator's Telegram chat.
alter table public.topup_requests
  add column if not exists telegram_notification_claimed_at timestamptz,
  add column if not exists telegram_notified_at timestamptz;
alter table public.purchase_orders
  add column if not exists telegram_notification_claimed_at timestamptz,
  add column if not exists telegram_notified_at timestamptz;
comment on column public.topup_requests.telegram_notification_claimed_at is
  'Single top-up Telegram notification attempt claim; prevents duplicates';
comment on column public.purchase_orders.telegram_notification_claimed_at is
  'Single purchase Telegram notification attempt claim; prevents duplicates';
