CREATE OR REPLACE FUNCTION public.require_saved_phone_for_customer_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- Preserve trusted backend administration. Normal customer purchases carry
  -- a Supabase Auth user ID in the authenticated request context.
  if (select auth.uid()) is not null then
    if new.user_id is distinct from (select auth.uid()) then
      raise exception 'purchase_owner_mismatch' using errcode='23514';
    end if;

    if not exists (
      select 1
      from public.wallet_accounts as wa
      where wa.user_id = new.user_id
        and wa.libyana_phone ~ '^9[1-4][0-9]{7}$'
    ) then
      raise exception 'phone_required_before_purchase'
        using errcode='23514';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_omnex_purchase(p_user uuid, p_product text, p_quote uuid, p_client uuid, p_fields jsonb, p_terms boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE q private.omnex_quotes%ROWTYPE;p private.omnex_roblox_catalog%ROWTYPE;j private.omnex_jobs%ROWTYPE;f jsonb;k text;v numeric;pid uuid;oid uuid;rk text;body text;fname text;
BEGIN
 IF p_user IS NULL OR p_client IS NULL OR p_terms IS DISTINCT FROM true OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object' OR octet_length(p_fields::text)>4000 THEN RAISE EXCEPTION 'invalid_purchase'; END IF;
 PERFORM pg_advisory_xact_lock(7114,hashtext(p_user::text));
 SELECT * INTO j FROM private.omnex_jobs WHERE user_id=p_user AND client_key=p_client FOR UPDATE;
 IF FOUND THEN
  IF j.product_id<>p_product OR j.fields<>p_fields THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN public.omnex_order_snapshot(p_user,j.order_id);
 END IF;
 SELECT * INTO j FROM private.omnex_jobs WHERE user_id=p_user AND product_id=p_product AND state NOT IN ('completed','refunded') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF j.fields<>p_fields THEN RAISE EXCEPTION 'supplier_order_already_pending';END IF;
  RETURN public.omnex_order_snapshot(p_user,j.order_id);
 END IF;
 IF NOT (SELECT enabled FROM private.omnex_settings WHERE id) THEN RAISE EXCEPTION 'supplier_sales_paused';END IF;
 SELECT * INTO q FROM private.omnex_quotes WHERE id=p_quote AND user_id=p_user AND product_id=p_product FOR UPDATE;
 IF NOT FOUND OR q.expires_at<=now() THEN RAISE EXCEPTION 'quote_expired';END IF;
 IF EXISTS(SELECT 1 FROM private.omnex_jobs WHERE quote_id=q.id) THEN RAISE EXCEPTION 'quote_already_used';END IF;
 SELECT * INTO p FROM private.omnex_roblox_catalog WHERE supplier_product_id=p_product AND published FOR UPDATE;
 IF NOT FOUND OR NOT p.available THEN RAISE EXCEPTION 'product_not_available';END IF;
 IF (SELECT count(*) FROM private.omnex_jobs WHERE user_id=p_user AND state NOT IN ('completed','refunded'))>=3 THEN RAISE EXCEPTION 'too_many_pending_orders';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wallet_accounts w WHERE w.user_id=p_user AND w.libyana_phone ~ '^9[1-4][0-9]{7}$') THEN RAISE EXCEPTION 'phone_required_before_purchase';END IF;
 FOR f IN SELECT * FROM jsonb_array_elements(q.fields_schema) LOOP
  k:=coalesce(f->>'key',f->>'code');
  IF coalesce((f->>'required')::boolean,false) AND nullif(btrim(p_fields->>k),'') IS NULL THEN RAISE EXCEPTION 'missing_product_field';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_fields) e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>200 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.fields_schema) sf WHERE coalesce(sf->>'key',sf->>'code')=e.key)) THEN RAISE EXCEPTION 'invalid_product_fields';END IF;
 SELECT balance INTO v FROM public.wallet_accounts WHERE user_id=p_user FOR UPDATE;
 IF v IS NULL OR v<q.retail_price THEN RAISE EXCEPTION 'insufficient_balance';END IF;
 fname:=left((CASE WHEN p.game='pubg' THEN 'PUBG Mobile · ' WHEN p.game='psn' THEN 'PlayStation · ' ELSE 'Roblox · ' END)||p.name||' ('||p.group_name||')',160);
 INSERT INTO public.products(product_key,name,game,amount,price,active) VALUES('omnex-'||p.game||'-'||p_product,fname,'omnex-'||p.game,1,q.retail_price,false) ON CONFLICT(product_key) DO UPDATE SET price=excluded.price,active=false RETURNING id INTO pid;
 UPDATE public.wallet_accounts SET balance=balance-q.retail_price,updated_at=now() WHERE user_id=p_user RETURNING balance INTO v;
 PERFORM set_config('l1017n.omnex_write','on',true);
 INSERT INTO public.purchase_orders(user_id,product_id,product_name,amount,unit_price,total_amount,roblox_username,inventory_reserved,supplier_managed) VALUES(p_user,pid,fname,1,q.retail_price,q.retail_price,'DIGITAL_CODE',false,true) RETURNING id INTO oid;
 PERFORM set_config('l1017n.omnex_write','off',true);
 rk:=replace(gen_random_uuid()::text,'-','');
 body:=jsonb_build_object('id',p_product,'wallet',q.wallet,'expected_price',to_char(q.supplier_cost,'FM9999999990.000'),'accepted_terms',true,'fields',p_fields,'request_key',rk)::text;
 INSERT INTO private.omnex_jobs(order_id,user_id,product_id,quote_id,client_key,request_key,payload_text,fields,supplier_cost,retail_price,wallet) VALUES(oid,p_user,p_product,q.id,p_client,rk,body,p_fields,q.supplier_cost,q.retail_price,q.wallet);
 INSERT INTO public.wallet_transactions(user_id,amount,transaction_type,balance_after,created_by) VALUES(p_user,-q.retail_price,'purchase',v,p_user);
 INSERT INTO public.store_product_costs(product_id,cost_per_sale) VALUES(pid,q.supplier_cost) ON CONFLICT(product_id) DO UPDATE SET cost_per_sale=excluded.cost_per_sale,updated_at=now();
 RETURN public.omnex_order_snapshot(p_user,oid);
END $function$;

CREATE OR REPLACE FUNCTION public.create_ussd_topup_intent_for_sender(p_amount numeric, p_sender_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := (select auth.uid());
  verified_phone text;
  sender text;
  existing public.topup_requests%rowtype;
  created public.topup_requests%rowtype;
  counter integer;
  shared_sender boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'login_required' USING errcode='28000'; END IF;
  IF p_amount IS NULL OR p_amount<>trunc(p_amount)
     OR p_amount<1 OR p_amount>10000 THEN
    RAISE EXCEPTION 'invalid_ussd_amount' USING errcode='22023';
  END IF;
  sender:=regexp_replace(coalesce(p_sender_phone,''),'[^0-9]','','g');
  IF left(sender,3)='218' AND length(sender)=12 THEN sender:=substr(sender,4); END IF;
  IF left(sender,1)='0' AND length(sender)=10 THEN sender:=substr(sender,2); END IF;
  IF sender !~ '^9(2|4)[0-9]{7}$' THEN
    RAISE EXCEPTION 'invalid_sender_phone' USING errcode='22023';
  END IF;

  perform pg_advisory_xact_lock(1017,hashtext(uid::text));
  SELECT w.libyana_phone INTO verified_phone
  FROM public.wallet_accounts w
  JOIN public.resala_otp_sessions otp ON otp.user_id=w.user_id
    AND otp.verified_phone=w.libyana_phone AND otp.verified_at IS NOT NULL
  WHERE w.user_id=uid AND w.libyana_phone ~ '^9(2|4)[0-9]{7}$';
  -- Verified account number is optional on a manually reviewed transfer.
  -- Matching an existing verified number retains the original secure route.
  IF sender=verified_phone THEN
    RETURN public.create_ussd_topup_intent(p_amount);
  END IF;

  -- Allow a payer's phone to fund a different store account without
  -- changing the verified phone's owner or the unique sender-wallet link.
  -- These requests are explicitly marked for independent manual review.
  shared_sender := EXISTS (select 1 from public.account_contact_phones where phone=sender and user_id<>uid) OR EXISTS (
    SELECT 1 FROM public.wallet_accounts w
    WHERE w.user_id<>uid AND w.libyana_phone=sender
  ) OR EXISTS (
    SELECT 1 FROM public.sms_sender_wallet_links l
    WHERE l.provider='libyana' AND l.transfer_phone=sender AND l.user_id<>uid
  ) OR EXISTS (
    SELECT 1 FROM public.resala_otp_sessions o
    WHERE o.user_id<>uid AND o.verified_phone=sender AND o.verified_at IS NOT NULL
  );

  -- Serialize competing claims for the same source and amount between users.
  PERFORM pg_advisory_xact_lock(1018,hashtext(sender||':'||p_amount::text));

  -- Keep the SMS matching unambiguous: one source+amount in the active window.
  IF EXISTS (
    SELECT 1 FROM public.topup_requests t
    WHERE t.user_id<>uid AND t.status='pending' AND t.method='libyana'
      AND t.amount=p_amount
      AND right(regexp_replace(t.phone,'[^0-9]','','g'),9)=sender
      AND t.created_at>now()-interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'sender_has_pending_request' USING errcode='22023';
  END IF;

  SELECT * INTO existing FROM public.topup_requests t
  WHERE t.user_id=uid AND t.status='pending'
    AND t.method='libyana' AND t.amount=p_amount
    AND t.phone='0'||sender AND t.transfer_reference LIKE 'ussd-intent:%'
    AND t.created_at>now()-interval '30 minutes'
    AND EXISTS (
      SELECT 1 FROM public.sms_topup_receipts r
      WHERE r.request_id=t.id AND r.status='matched'
    )
  ORDER BY t.created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('request_id',existing.id,'amount',existing.amount,
      'state','matched','expires_at',existing.created_at+interval '30 minutes');
  END IF;

  SELECT * INTO existing FROM public.topup_requests t
  WHERE t.user_id=uid AND t.status='pending'
    AND t.method='libyana' AND t.amount=p_amount
    AND t.phone='0'||sender AND t.transfer_reference LIKE 'ussd-intent:%'
    AND t.created_at>now()-interval '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.sms_topup_receipts r WHERE r.request_id=t.id
    )
  ORDER BY t.created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('request_id',existing.id,'amount',existing.amount,
      'state','pending','expires_at',existing.created_at+interval '30 minutes');
  END IF;

  SELECT count(*) INTO counter FROM public.topup_requests t
  WHERE t.user_id=uid AND t.transfer_reference LIKE 'ussd-intent:%'
    AND t.created_at>now()-interval '24 hours';
  IF verified_phone IS NULL AND counter>=24 THEN
    RAISE EXCEPTION 'manual_topup_daily_limit' USING errcode='22023';
  END IF;
  IF counter>=240 THEN RAISE EXCEPTION 'ussd_daily_limit' USING errcode='22023'; END IF;

  INSERT INTO public.topup_requests(
    user_id,amount,method,phone,transfer_reference,status
  ) VALUES (
    uid,p_amount,'libyana','0'||sender,
    'ussd-intent:external:'||(CASE WHEN shared_sender THEN 'shared:' ELSE '' END)||gen_random_uuid()::text,'pending'
  ) RETURNING * INTO created;

  RETURN jsonb_build_object('request_id',created.id,'amount',created.amount,
    'state','pending','external_sender',true,'shared_sender',shared_sender,
    'expires_at',created.created_at+interval '30 minutes');
END
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
  if exists(select 1 from public.account_contact_phones c where c.user_id<>req.user_id and c.phone=r.transfer_phone) or exists(
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

create function public.get_my_saved_sender_phones()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('phone','0'||n.phone,'primary',n.is_primary) order by n.is_primary desc,n.phone),'[]'::jsonb)
  from (
    select phone, bool_or(is_primary) as is_primary from (
      select libyana_phone as phone,true as is_primary from public.wallet_accounts where user_id=auth.uid()
      union all
      select phone,false from public.account_contact_phones where user_id=auth.uid()
      union all
      select transfer_phone,false from public.sms_sender_wallet_links where user_id=auth.uid() and verified_at is not null
    ) numbers where phone ~ '^9[1-4][0-9]{7}$' group by phone
  ) n;
$$;
revoke all on function public.get_my_saved_sender_phones() from public, anon;
grant execute on function public.get_my_saved_sender_phones() to authenticated;

