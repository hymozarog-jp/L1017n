-- Allow the authenticated, Message487-specific receipt provenance label in the
-- *existing restricted* auto-credit RPC. The Message487 webhook itself checks
-- the Bearer token, actual incoming SMS source, carrier name, amount and time.
-- Unmatched, unverified, duplicate, delayed, high-value and frequent requests
-- remain pending. This does not assert carrier attestation.
CREATE OR REPLACE FUNCTION public.sms_auto_credit_receipt(p_review_number bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.sms_topup_receipts%rowtype;
  cfg public.sms_auto_credit_settings%rowtype;
  req public.topup_requests%rowtype;
  sender_total numeric;
  store_total numeric;
  sender_count bigint;
  result jsonb;
begin
  -- Serializes credits; duplicate and account-verification safeguards remain enforced.
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
     or not (lower(r.sender_label) ~ '^([a-z]{1,4}-)?libyana
     or r.amount < 1 or r.amount > 10000 or r.amount<>trunc(r.amount)
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

  -- User-chosen transfer amounts are not limited by the previous 30-LYD
  -- sender or 100-LYD store monetary caps. Larger or repeated credits
  -- need administrator review: a forwarded SMS is not carrier attestation.
  if r.amount > 10 then
    return jsonb_build_object('credited',false,'reason','large_transfer_requires_review');
  end if;
  select count(*) into sender_count
    from public.sms_topup_receipts
    where status='approved' and note in ('AUTO_SMS_V1','AUTO_SMS_V2')
      and transfer_phone=r.transfer_phone
      and reviewed_at>now()-interval '24 hours';
  if sender_count>=3 then
    return jsonb_build_object('credited',false,'reason','additional_transfer_requires_review');
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
$function$
 or r.sender_label='ليبيانا' or r.sender_label='message487-libyana')
     or r.amount < 1 or r.amount > 10000 or r.amount<>trunc(r.amount)
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

  -- User-chosen transfer amounts are not limited by the previous 30-LYD
  -- sender or 100-LYD store monetary caps. Larger or repeated credits
  -- need administrator review: a forwarded SMS is not carrier attestation.
  if r.amount > 10 then
    return jsonb_build_object('credited',false,'reason','large_transfer_requires_review');
  end if;
  select count(*) into sender_count
    from public.sms_topup_receipts
    where status='approved' and note in ('AUTO_SMS_V1','AUTO_SMS_V2')
      and transfer_phone=r.transfer_phone
      and reviewed_at>now()-interval '24 hours';
  if sender_count>=3 then
    return jsonb_build_object('credited',false,'reason','additional_transfer_requires_review');
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
$function$
;
REVOKE ALL ON FUNCTION public.sms_auto_credit_receipt(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_auto_credit_receipt(bigint) TO service_role;
