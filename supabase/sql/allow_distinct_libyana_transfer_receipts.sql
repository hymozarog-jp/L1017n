-- Match distinct official Libyana transfer messages without a same-amount cooldown.
CREATE OR REPLACE FUNCTION public.sms_match_pending_receipts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 rec record;
 candidate uuid;
 cnt bigint;
 matched integer := 0;
begin
 perform pg_advisory_xact_lock(1017,444);
 for rec in
   select * from public.sms_topup_receipts
   where status='unmatched' and sms_received_at > now()-interval '24 hours'
   order by received_at for update skip locked
 loop
   select count(*),(array_agg(t.id order by t.created_at,t.id::text))[1]
     into cnt,candidate from public.topup_requests t
   where t.status='pending' and t.method=rec.provider
      and t.amount=rec.amount
      and right(regexp_replace(t.phone,'[^0-9]','','g'),9)=rec.transfer_phone
      and not exists(select 1 from public.sms_topup_receipts r2 where r2.request_id=t.id)
      and (
       (t.transfer_reference like 'ussd-intent:%'
         and (
           t.created_at between rec.sms_received_at-interval '30 minutes' and rec.sms_received_at+interval '2 minutes'
           or (
             t.created_at between rec.sms_received_at-interval '60 minutes' and rec.sms_received_at-interval '30 minutes'
             and t.transfer_reference not like 'ussd-intent:external:shared:%'
             and exists(
               select 1 from public.sms_sender_wallet_links l
               where l.user_id=t.user_id and l.provider=rec.provider and l.transfer_phone=rec.transfer_phone and l.verified_at is not null
             )
           )
         ))
       or
       (t.transfer_reference not like 'ussd-intent:%'
         and t.created_at between rec.sms_received_at-interval '2 hours' and rec.sms_received_at+interval '2 hours')
      );
   if cnt=1 then
     update public.sms_topup_receipts set status='matched',request_id=candidate
       where id=rec.id and status='unmatched';
     matched:=matched+1;
   else
     -- With no unique request, only a verified sender-to-wallet link can assign the receipt.
     candidate:=public.sms_attach_verified_external_receipt(rec.review_number);
     if candidate is not null then matched:=matched+1; end if;
   end if;
 end loop;
 return matched;
end;
$function$;

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
  -- Explicit manual-review mode: never credit automatically.
  if cfg.approval_mode is distinct from 'automatic' then
    return jsonb_build_object('credited',false,'reason','admin_review_required');
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
     or not (lower(r.sender_label) ~ '^([a-z]{1,4}-)?libyana$' or r.sender_label='ليبيانا' or r.sender_label='message487-libyana')
     or r.amount <= 0 or r.amount >= 'Infinity'::numeric
  then
    return jsonb_build_object('credited',false,'reason','sender_or_amount');
  end if;

  select * into req from public.topup_requests
    where id=r.request_id for update;
  if not found or req.status<>'pending' or req.method<>'libyana'
     or req.amount<>r.amount
     or req.transfer_reference not like 'ussd-intent:%'
     or req.transfer_reference like 'ussd-intent:external:shared:%'
     or right(regexp_replace(req.phone,'[^0-9]','','g'),9)<>r.transfer_phone
     or req.created_at < r.sms_received_at-interval '60 minutes'
     or req.created_at > r.sms_received_at+interval '2 minutes'
  then
    return jsonb_build_object('credited',false,'reason','intent_mismatch');
  end if;

  -- The payer number was captured by the authenticated customer's intent
  -- BEFORE the SMS arrived. The unique matched forwarded receipt must carry
  -- the identical number and amount. OTP is not needed for an unclaimed payer.
  -- Do not automatically allocate a transfer from a number registered to
  -- another customer; those transfers continue to require manual review.
  if exists(
    select 1 from public.wallet_accounts w
    where w.user_id<>req.user_id and w.libyana_phone=r.transfer_phone
  ) or exists(
    select 1 from public.resala_otp_sessions otp
    where otp.user_id<>req.user_id and otp.verified_phone=r.transfer_phone
      and otp.verified_at is not null
  ) then
    return jsonb_build_object('credited',false,'reason','sender_registered_to_other_account');
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
      and older.sms_received_at = r.sms_received_at
      and (older.status='approved'
        or (older.received_at, older.review_number) < (r.received_at, r.review_number))
  ) then
    return jsonb_build_object('credited',false,'reason','possible_duplicate');
  end if;

  result:=public.sms_review_topup(p_review_number,'approved');
  update public.sms_topup_receipts set note='AUTO_SMS_V2' where id=r.id;
  update public.topup_requests set
    admin_note='شحن آلي بعد مطابقة رقم المحوّل والمبلغ مع رسالة ليبيانا الواردة إلى هاتف المتجر'
    where id=req.id;
  return result || jsonb_build_object('credited',true,'automatic',true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sms_attach_verified_external_receipt(p_review_number bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.sms_topup_receipts%rowtype; cfg public.sms_auto_credit_settings%rowtype; owner_id uuid; owner_count integer; new_request uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(1017,444);
 SELECT * INTO cfg FROM public.sms_auto_credit_settings WHERE id=1;
 IF NOT FOUND OR NOT cfg.enabled OR cfg.approval_mode IS DISTINCT FROM 'automatic' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.sms_topup_receipts WHERE review_number=p_review_number FOR UPDATE;
 IF NOT FOUND OR r.status<>'unmatched' OR r.request_id IS NOT NULL THEN RETURN NULL; END IF;
 IF r.provider<>'libyana' OR NOT (lower(r.sender_label) ~ '^([a-z]{1,4}-)?libyana$' OR r.sender_label IN ('ليبيانا','message487-libyana'))
 OR r.amount<=0 OR r.amount>='Infinity'::numeric
 OR r.received_at<cfg.activated_at OR r.sms_received_at<cfg.activated_at
 OR r.sms_received_at<now()-interval '10 minutes' OR r.sms_received_at>now()+interval '2 minutes'
 THEN RETURN NULL; END IF;
 SELECT count(*),(array_agg(l.user_id))[1] INTO owner_count,owner_id
 FROM public.sms_sender_wallet_links l WHERE l.provider=r.provider AND l.transfer_phone=r.transfer_phone AND l.verified_at IS NOT NULL;
 IF owner_count<>1 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.sms_sender_wallet_links l WHERE l.provider=r.provider AND l.transfer_phone=r.transfer_phone AND l.user_id<>owner_id)
 OR EXISTS(SELECT 1 FROM public.resala_otp_sessions otp WHERE otp.user_id<>owner_id AND otp.verified_phone=r.transfer_phone AND otp.verified_at IS NOT NULL)
 OR EXISTS(
  SELECT 1 FROM public.sms_topup_receipts d
  WHERE d.id<>r.id AND d.provider=r.provider AND d.transfer_phone=r.transfer_phone
    AND d.amount=r.amount AND d.sms_received_at=r.sms_received_at
    AND (d.status='approved'
      OR (d.received_at,d.review_number)<(r.received_at,r.review_number))
 )
 THEN RETURN NULL; END IF;
 INSERT INTO public.topup_requests(user_id,amount,method,phone,transfer_reference,status,created_at)
 VALUES(owner_id,r.amount,r.provider,r.transfer_phone,'ussd-intent:external:verified-sms:'||r.id::text,'pending',r.sms_received_at) RETURNING id INTO new_request;
 UPDATE public.sms_topup_receipts SET status='matched',request_id=new_request WHERE id=r.id AND status='unmatched';
 RETURN new_request;
END $function$;
