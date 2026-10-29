-- Allow fully-verified USSD top-up intents to be accepted automatically
-- only when a recent, distinct SMS from the signed store-phone forwarder
-- matches a unique request. Resala is an OTP provider, NOT payment attestation.
-- Old, unmatched, unverified and duplicate messages remain in review.
create or replace function public.sms_auto_credit_receipt(p_review_number bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.sms_topup_receipts%rowtype;
  cfg public.sms_auto_credit_settings%rowtype;
  req public.topup_requests%rowtype;
  sender_total numeric;
  store_total numeric;
  sender_count bigint;
  result jsonb;
begin
  -- Serializes credits and prevents two SMS requests exceeding daily limits.
  perform pg_advisory_xact_lock(1017,444);
  select * into cfg from public.sms_auto_credit_settings where id=1;
  if not found or not cfg.enabled then
    return jsonb_build_object('credited',false,'reason','disabled');
  end if;

  select * into r from public.sms_topup_receipts
    where review_number=p_review_number for update;
  if not found or r.status<>'matched' or r.request_id is null then
    return jsonb_build_object('credited',false,'reason','requires_matching_request');
  end if;
  -- Only future, timely events from the configured forwarding channel.
  if r.received_at < cfg.activated_at or r.sms_received_at < cfg.activated_at
    or r.sms_received_at < now()-interval '10 minutes'
    or r.sms_received_at > now()+interval '2 minutes' then
    return jsonb_build_object('credited',false,'reason','old_or_delayed');
  end if;
  if r.provider<>'libyana'
     or not (lower(r.sender_label) ~ '^([a-z]{1,4}-)?libyana$' or r.sender_label='ليبيانا')
     or r.amount < 1 or r.amount > 10 or r.amount<>trunc(r.amount)
  then
    return jsonb_build_object('credited',false,'reason','sender_or_amount');
  end if;

  select * into req from public.topup_requests
    where id=r.request_id for update;
  if not found or req.status<>'pending' or req.method<>'libyana'
     or req.amount<>r.amount
     or req.transfer_reference not like 'ussd-intent:%'
     or right(regexp_replace(req.phone,'[^0-9]','','g'),9)<>r.transfer_phone
     or req.created_at < r.sms_received_at-interval '30 minutes'
     or req.created_at > r.sms_received_at+interval '2 minutes'
  then
    return jsonb_build_object('credited',false,'reason','intent_mismatch');
  end if;

  -- The account MUST be Resala-verified for the exact same source number.
  -- Merely entering a phone, opening a dialer or forwarding any SMS is not proof.
  if not exists(
    select 1 from public.wallet_accounts w
    join public.resala_otp_sessions otp on otp.user_id=w.user_id
      and otp.verified_phone=w.libyana_phone and otp.verified_at is not null
    where w.user_id=req.user_id
      and w.libyana_phone=r.transfer_phone
      and w.libyana_phone ~ '^9(2|4)[0-9]{7}$'
  ) then
    return jsonb_build_object('credited',false,'reason','phone_not_verified');
  end if;

  if exists(
    select 1 from public.sms_sender_wallet_links old
     where old.provider='libyana'
       and old.transfer_phone=r.transfer_phone
       and old.user_id<>req.user_id
  ) then
    return jsonb_build_object('credited',false,'reason','sender_link_conflict');
  end if;

  if exists(
    select 1 from public.sms_topup_receipts older
    where older.id<>r.id and older.provider=r.provider
      and older.transfer_phone=r.transfer_phone and older.amount=r.amount
      and older.sms_received_at between r.sms_received_at-interval '30 minutes'
                                   and r.sms_received_at+interval '30 minutes'
      and older.received_at <= r.received_at
  ) then
    return jsonb_build_object('credited',false,'reason','possible_duplicate');
  end if;

  select count(*),coalesce(sum(amount),0) into sender_count,sender_total
    from public.sms_topup_receipts
    where status='approved' and note in ('AUTO_SMS_V1','AUTO_SMS_V2')
      and transfer_phone=r.transfer_phone
      and reviewed_at>now()-interval '24 hours';
  if sender_count>=3 or sender_total+r.amount>30 then
    return jsonb_build_object('credited',false,'reason','sender_daily_limit');
  end if;
  select coalesce(sum(amount),0) into store_total
    from public.sms_topup_receipts
    where status='approved' and note in ('AUTO_SMS_V1','AUTO_SMS_V2')
      and reviewed_at>now()-interval '24 hours';
  if store_total+r.amount>100 then
    return jsonb_build_object('credited',false,'reason','store_daily_limit');
  end if;

  -- Atomic single transaction: the existing reviewed credit RPC locks
  -- the matched request, debits no external balance and credits the wallet
  -- once; the first verified sender link is also created automatically.
  result:=public.sms_review_topup(p_review_number,'approved');
  update public.sms_topup_receipts set note='AUTO_SMS_V2' where id=r.id;
  update public.topup_requests set
    admin_note='إضافة آلية مشروطة بمطابقة طلب USSD ورسالة SMS؛ ليست تأكيد دفع رسميًا من ليبيانا'
    where id=req.id;
  return result || jsonb_build_object('credited',true,'automatic',true);
end;
$function$;
revoke all on function public.sms_auto_credit_receipt(bigint) from public,anon,authenticated;
grant execute on function public.sms_auto_credit_receipt(bigint) to service_role;

-- Frontend readiness means a verified number and an enabled auto-credit
-- channel; first-time manual linking is no longer required for matching USSD.
create or replace function public.is_my_auto_libyana_topup_ready()
returns boolean language sql stable security definer set search_path to ''
as $function$
select exists(
  select 1 from public.sms_auto_credit_settings cfg
  join public.wallet_accounts w on w.user_id=(select auth.uid())
  join public.resala_otp_sessions otp on otp.user_id=w.user_id
     and otp.verified_phone=w.libyana_phone and otp.verified_at is not null
  where cfg.id=1 and cfg.enabled=true
    and w.libyana_phone ~ '^9(2|4)[0-9]{7}$'
);
$function$;
revoke all on function public.is_my_auto_libyana_topup_ready() from public,anon;
grant execute on function public.is_my_auto_libyana_topup_ready() to authenticated,service_role;
