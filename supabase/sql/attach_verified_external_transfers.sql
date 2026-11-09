
CREATE OR REPLACE FUNCTION public.sms_attach_verified_external_receipt(p_review_number bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.sms_topup_receipts%rowtype; cfg public.sms_auto_credit_settings%rowtype; owner_id uuid; owner_count integer; new_request uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(1017,444);
 SELECT * INTO cfg FROM public.sms_auto_credit_settings WHERE id=1;
 IF NOT FOUND OR NOT cfg.enabled OR cfg.approval_mode IS DISTINCT FROM 'automatic' THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.sms_topup_receipts WHERE review_number=p_review_number FOR UPDATE;
 IF NOT FOUND OR r.status<>'unmatched' OR r.request_id IS NOT NULL THEN RETURN NULL; END IF;
 IF r.provider<>'libyana' OR NOT (lower(r.sender_label) ~ '^([a-z]{1,4}-)?libyana$' OR r.sender_label IN ('ليبيانا','message487-libyana'))
 OR r.amount<1 OR r.amount>50 OR r.amount<>trunc(r.amount)
 OR r.received_at<cfg.activated_at OR r.sms_received_at<cfg.activated_at
 OR r.sms_received_at<now()-interval '10 minutes' OR r.sms_received_at>now()+interval '2 minutes'
 THEN RETURN NULL; END IF;
 SELECT count(*),(array_agg(w.user_id))[1] INTO owner_count,owner_id
 FROM public.wallet_accounts w WHERE w.libyana_phone=r.transfer_phone
 AND EXISTS(SELECT 1 FROM public.resala_otp_sessions otp WHERE otp.user_id=w.user_id AND otp.verified_phone=w.libyana_phone AND otp.verified_at IS NOT NULL);
 IF owner_count<>1 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.sms_sender_wallet_links l WHERE l.provider=r.provider AND l.transfer_phone=r.transfer_phone AND l.user_id<>owner_id)
 OR EXISTS(SELECT 1 FROM public.resala_otp_sessions otp WHERE otp.user_id<>owner_id AND otp.verified_phone=r.transfer_phone AND otp.verified_at IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.sms_topup_receipts d WHERE d.id<>r.id AND d.provider=r.provider AND d.transfer_phone=r.transfer_phone AND d.amount=r.amount AND d.sms_received_at BETWEEN r.sms_received_at-interval '30 minutes' AND r.sms_received_at+interval '30 minutes')
 THEN RETURN NULL; END IF;
 INSERT INTO public.topup_requests(user_id,amount,method,phone,transfer_reference,status,created_at)
 VALUES(owner_id,r.amount,r.provider,r.transfer_phone,'ussd-intent:external:verified-sms:'||r.id::text,'pending',r.sms_received_at) RETURNING id INTO new_request;
 UPDATE public.sms_topup_receipts SET status='matched',request_id=new_request WHERE id=r.id AND status='unmatched';
 RETURN new_request;
END $fn$;
REVOKE ALL ON FUNCTION public.sms_attach_verified_external_receipt(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sms_attach_verified_external_receipt(bigint) TO service_role;
DO $patch$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.sms_match_pending_receipts()'::regprocedure) INTO def;
 IF position('sms_attach_verified_external_receipt' in def)=0 THEN
 def:=replace(def, E'begin\n for rec in', E'begin\n perform pg_advisory_xact_lock(1017,444);\n for rec in');
 def:=replace(def, E'     matched:=matched+1;\n   end if;', E'     matched:=matched+1;\n   elsif cnt=0 then\n     candidate:=public.sms_attach_verified_external_receipt(rec.review_number);\n     if candidate is not null then matched:=matched+1; end if;\n   end if;');
 IF position('candidate:=public.sms_attach_verified_external_receipt' in def)=0 THEN RAISE EXCEPTION 'matcher_patch_failed'; END IF;
 EXECUTE def;
 END IF;
END $patch$;
