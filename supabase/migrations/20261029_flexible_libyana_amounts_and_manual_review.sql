-- L1017n flexible Libyana top-ups: customers can request any whole-LYD amount
-- within the existing 10,000-LYD database safety constraint, subject to
-- the independent carrier's transfer restrictions.
-- Preserve auto-credit only for low-risk receipts; large/repeated requests
-- remain pending for administrator confirmation of actual receipt.
CREATE OR REPLACE FUNCTION public.create_ussd_topup_intent(p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  phone text;
  existing public.topup_requests%rowtype;
  created public.topup_requests%rowtype;
  counter integer;
begin
  if uid is null then raise exception 'login_required' using errcode='28000'; end if;
  if p_amount is null or p_amount <> trunc(p_amount) or p_amount < 1 or p_amount > 10000 then
    raise exception 'invalid_ussd_amount' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(1017,hashtext(uid::text));
  select w.libyana_phone into phone
  from public.wallet_accounts w
  join public.resala_otp_sessions otp on otp.user_id=w.user_id
     and otp.verified_phone=w.libyana_phone and otp.verified_at is not null
  where w.user_id=uid and w.libyana_phone ~ '^9(2|4)[0-9]{7}$';
  if phone is null then raise exception 'verified_libyana_phone_required' using errcode='23514'; end if;

  -- A matched SMS awaiting review must not trigger a second transfer.
  select * into existing from public.topup_requests t
    where t.user_id=uid and t.method='libyana' and t.amount=p_amount
      and t.status='pending' and t.transfer_reference like 'ussd-intent:%'
      and t.created_at > now()-interval '30 minutes'
      and exists(select 1 from public.sms_topup_receipts r
        where r.request_id=t.id and r.status='matched')
    order by t.created_at desc limit 1;
  if found then
    return jsonb_build_object('request_id',existing.id,'amount',existing.amount,
      'state','matched','expires_at',existing.created_at+interval '30 minutes');
  end if;

  -- Reuse recent pending intent rather than creating duplicates when the user
  -- reloads, taps again, or returns from the carrier's USSD menu.
  select * into existing from public.topup_requests t
    where t.user_id=uid and t.method='libyana' and t.amount=p_amount
      and t.status='pending' and t.transfer_reference like 'ussd-intent:%'
      and t.created_at > now()-interval '30 minutes'
      and not exists (select 1 from public.sms_topup_receipts r where r.request_id=t.id)
    order by t.created_at desc limit 1;
  if found then
    return jsonb_build_object('request_id',existing.id,'amount',existing.amount,
      'state','pending','expires_at',existing.created_at+interval '30 minutes');
  end if;
  select count(*) into counter from public.topup_requests t
    where t.user_id=uid and t.transfer_reference like 'ussd-intent:%'
      and t.created_at > now()-interval '24 hours';
  if counter >= 240 then raise exception 'ussd_daily_limit' using errcode='22023'; end if;
  insert into public.topup_requests(user_id,amount,method,phone,transfer_reference,status)
    values(uid,p_amount,'libyana','0'||phone,'ussd-intent:'||gen_random_uuid()::text,'pending')
    returning * into created;
  return jsonb_build_object('request_id',created.id,'amount',created.amount,
    'state','pending','expires_at',created.created_at+interval '30 minutes');
end;
$function$
;
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
     or not (lower(r.sender_label) ~ '^([a-z]{1,4}-)?libyana$' or r.sender_label='ليبيانا')
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
REVOKE ALL ON FUNCTION public.create_ussd_topup_intent(numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_ussd_topup_intent(numeric) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.sms_auto_credit_receipt(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_auto_credit_receipt(bigint) TO service_role;