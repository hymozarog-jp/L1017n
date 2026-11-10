ALTER TABLE public.sms_sender_wallet_links ADD COLUMN IF NOT EXISTS verified_at timestamptz;
-- Only existing SMS verification proves ownership; manual routing links do not.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.wallet_accounts w JOIN public.resala_otp_sessions s ON s.user_id=w.user_id AND s.verified_phone=w.libyana_phone AND s.verified_at IS NOT NULL JOIN public.sms_sender_wallet_links l ON l.transfer_phone=w.libyana_phone AND l.user_id<>w.user_id) THEN RAISE EXCEPTION 'phone_ownership_conflict'; END IF;
END $$;
INSERT INTO public.sms_sender_wallet_links(provider,transfer_phone,user_id,verified_at)
SELECT CASE WHEN w.libyana_phone ~ '^9[24]' THEN 'libyana' ELSE 'almadar' END,w.libyana_phone,w.user_id,s.verified_at FROM public.wallet_accounts w JOIN public.resala_otp_sessions s ON s.user_id=w.user_id AND s.verified_phone=w.libyana_phone AND s.verified_at IS NOT NULL
ON CONFLICT(provider,transfer_phone) DO UPDATE SET verified_at=excluded.verified_at WHERE sms_sender_wallet_links.user_id=excluded.user_id;
CREATE OR REPLACE FUNCTION public.guard_linked_account_phone() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7110,hashtext(NEW.user_id::text));
 PERFORM pg_advisory_xact_lock(7111,hashtext(NEW.transfer_phone));
 IF EXISTS(SELECT 1 FROM public.wallet_accounts w WHERE w.libyana_phone=NEW.transfer_phone AND w.user_id<>NEW.user_id) OR EXISTS(SELECT 1 FROM public.sms_sender_wallet_links l WHERE l.transfer_phone=NEW.transfer_phone AND l.user_id<>NEW.user_id) THEN RAISE EXCEPTION 'phone_already_registered'; END IF;
 IF NEW.verified_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sms_sender_wallet_links l WHERE l.user_id=NEW.user_id AND l.transfer_phone=NEW.transfer_phone AND l.verified_at IS NOT NULL) AND (SELECT count(*) FROM public.sms_sender_wallet_links l WHERE l.user_id=NEW.user_id AND l.verified_at IS NOT NULL)>=3 THEN RAISE EXCEPTION 'phone_limit'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_linked_account_phone BEFORE INSERT OR UPDATE ON public.sms_sender_wallet_links FOR EACH ROW EXECUTE FUNCTION public.guard_linked_account_phone();
CREATE OR REPLACE FUNCTION public.guard_wallet_phone_ownership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.libyana_phone IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(7111,hashtext(NEW.libyana_phone));
 IF EXISTS(SELECT 1 FROM public.sms_sender_wallet_links l WHERE l.transfer_phone=NEW.libyana_phone AND l.user_id<>NEW.user_id) THEN RAISE EXCEPTION 'phone_already_registered'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_wallet_phone_ownership BEFORE INSERT OR UPDATE OF libyana_phone ON public.wallet_accounts FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_phone_ownership();
CREATE OR REPLACE FUNCTION public.mirror_verified_account_phone() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.verified_at IS NOT NULL AND NEW.verified_phone IS NOT NULL AND EXISTS(SELECT 1 FROM public.wallet_accounts w WHERE w.user_id=NEW.user_id AND w.libyana_phone=NEW.verified_phone) THEN
 INSERT INTO public.sms_sender_wallet_links(provider,transfer_phone,user_id,verified_at) VALUES(CASE WHEN NEW.verified_phone ~ '^9[24]' THEN 'libyana' ELSE 'almadar' END,NEW.verified_phone,NEW.user_id,NEW.verified_at) ON CONFLICT(provider,transfer_phone) DO UPDATE SET verified_at=excluded.verified_at WHERE sms_sender_wallet_links.user_id=excluded.user_id;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER mirror_verified_account_phone AFTER INSERT OR UPDATE OF verified_at,verified_phone ON public.resala_otp_sessions FOR EACH ROW EXECUTE FUNCTION public.mirror_verified_account_phone();
CREATE OR REPLACE FUNCTION public.get_my_verified_account_phones() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('phone','0'||l.transfer_phone,'provider',l.provider,'primary',l.transfer_phone=w.libyana_phone) ORDER BY (l.transfer_phone=w.libyana_phone) DESC,l.verified_at),'[]'::jsonb) FROM public.sms_sender_wallet_links l JOIN public.wallet_accounts w ON w.user_id=l.user_id WHERE l.user_id=auth.uid() AND l.verified_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_my_verified_account_phones() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_verified_account_phones() TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_phone_change(p_user uuid, p_phone text, p_token uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_old text;
  v_session public.phone_change_requests%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_user IS NULL OR p_token IS NULL OR p_phone !~ '^9[1-4][0-9]{7}$' THEN RETURN 'invalid_phone'; END IF;
  PERFORM pg_advisory_xact_lock(7110,hashtext(p_user::text));
  SELECT libyana_phone INTO v_old FROM public.wallet_accounts WHERE user_id=p_user FOR UPDATE;
  IF v_old IS NULL THEN RETURN 'phone_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.resala_otp_sessions WHERE user_id=p_user AND verified_phone=v_old AND verified_at IS NOT NULL) THEN RETURN 'primary_verification_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.sms_sender_wallet_links WHERE user_id=p_user AND transfer_phone=p_phone AND verified_at IS NOT NULL) THEN RETURN 'same_phone'; END IF;
  IF (SELECT count(*) FROM public.sms_sender_wallet_links WHERE user_id=p_user AND verified_at IS NOT NULL)>=3 THEN RETURN 'phone_limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_accounts WHERE libyana_phone=p_phone AND user_id<>p_user)
     OR EXISTS (SELECT 1 FROM public.sms_sender_wallet_links WHERE transfer_phone=p_phone AND user_id<>p_user)
    THEN RETURN 'phone_already_registered'; END IF;
  INSERT INTO public.phone_change_requests(user_id,old_phone,new_phone)
    VALUES(p_user,v_old,p_phone) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_session FROM public.phone_change_requests WHERE user_id=p_user FOR UPDATE;
  IF v_session.last_sent_at>v_now-interval '240 seconds' THEN RETURN 'cooldown'; END IF;
  IF v_session.hour_started_at>v_now-interval '1 hour' AND v_session.hour_sends>=4 THEN RETURN 'hour_limit'; END IF;
  IF v_session.day_started_at>v_now-interval '24 hours' AND v_session.day_sends>=10 THEN RETURN 'day_limit'; END IF;
  UPDATE public.phone_change_requests SET
    old_phone=v_old,new_phone=p_phone,pin_hash=NULL,request_token=p_token,expires_at=NULL,attempts=0,
    last_sent_at=v_now,
    hour_started_at=CASE WHEN v_session.hour_started_at<=v_now-interval '1 hour' THEN v_now ELSE v_session.hour_started_at END,
    hour_sends=CASE WHEN v_session.hour_started_at<=v_now-interval '1 hour' THEN 1 ELSE v_session.hour_sends+1 END,
    day_started_at=CASE WHEN v_session.day_started_at<=v_now-interval '24 hours' THEN v_now ELSE v_session.day_started_at END,
    day_sends=CASE WHEN v_session.day_started_at<=v_now-interval '24 hours' THEN 1 ELSE v_session.day_sends+1 END,
    updated_at=v_now
    WHERE user_id=p_user;
  RETURN 'reserved';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_phone_change(p_user uuid, p_phone text, p_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_request public.phone_change_requests%ROWTYPE;
  v_current text;
  v_now timestamptz:=now();
BEGIN
  PERFORM pg_advisory_xact_lock(7110,hashtext(p_user::text));
  SELECT * INTO v_request FROM public.phone_change_requests WHERE user_id=p_user FOR UPDATE;
  IF NOT FOUND OR v_request.new_phone IS DISTINCT FROM p_phone THEN RETURN 'not_requested'; END IF;
  SELECT libyana_phone INTO v_current FROM public.wallet_accounts WHERE user_id=p_user FOR UPDATE;
  IF v_current IS DISTINCT FROM v_request.old_phone THEN RETURN 'phone_changed'; END IF;
  IF v_request.pin_hash IS NULL OR v_request.expires_at IS NULL OR v_request.expires_at<=v_now THEN RETURN 'expired'; END IF;
  IF v_request.attempts>=5 THEN RETURN 'locked'; END IF;
  IF v_request.pin_hash IS DISTINCT FROM p_hash THEN
    UPDATE public.phone_change_requests SET
      attempts=attempts+1,pin_hash=CASE WHEN attempts+1>=5 THEN NULL ELSE pin_hash END,
      updated_at=v_now WHERE user_id=p_user;
    RETURN CASE WHEN v_request.attempts+1>=5 THEN 'locked' ELSE 'invalid' END;
  END IF;
  PERFORM pg_advisory_xact_lock(7111,hashtext(p_phone));
  IF (SELECT count(*) FROM public.sms_sender_wallet_links WHERE user_id=p_user AND verified_at IS NOT NULL)>=3 THEN RETURN 'phone_limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_accounts WHERE libyana_phone=p_phone AND user_id<>p_user)
     OR EXISTS (SELECT 1 FROM public.sms_sender_wallet_links WHERE transfer_phone=p_phone AND user_id<>p_user)
    THEN RETURN 'phone_already_registered'; END IF;
  INSERT INTO public.sms_sender_wallet_links(provider,transfer_phone,user_id,verified_at)
    VALUES(CASE WHEN p_phone ~ '^9[24]' THEN 'libyana' ELSE 'almadar' END,p_phone,p_user,v_now)
    ON CONFLICT(provider,transfer_phone) DO UPDATE SET verified_at=excluded.verified_at WHERE sms_sender_wallet_links.user_id=excluded.user_id;
  UPDATE public.phone_change_requests SET pin_hash=NULL,request_token=NULL,expires_at=NULL,attempts=0,updated_at=v_now
    WHERE user_id=p_user;
  RETURN 'changed';
EXCEPTION WHEN unique_violation THEN
  RETURN 'phone_already_registered';
END;
$function$
;

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
 OR EXISTS(SELECT 1 FROM public.sms_topup_receipts d WHERE d.id<>r.id AND d.provider=r.provider AND d.transfer_phone=r.transfer_phone AND d.amount=r.amount AND d.sms_received_at BETWEEN r.sms_received_at-interval '30 minutes' AND r.sms_received_at+interval '30 minutes')
 THEN RETURN NULL; END IF;
 INSERT INTO public.topup_requests(user_id,amount,method,phone,transfer_reference,status,created_at)
 VALUES(owner_id,r.amount,r.provider,r.transfer_phone,'ussd-intent:external:verified-sms:'||r.id::text,'pending',r.sms_received_at) RETURNING id INTO new_request;
 UPDATE public.sms_topup_receipts SET status='matched',request_id=new_request WHERE id=r.id AND status='unmatched';
 RETURN new_request;
END $function$
;

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
   elsif cnt=0 then
     candidate:=public.sms_attach_verified_external_receipt(rec.review_number);
     if candidate is not null then matched:=matched+1; end if;
   end if;
 end loop;
 return matched;
end;
$function$
;
REVOKE ALL ON FUNCTION public.guard_linked_account_phone() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_wallet_phone_ownership() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mirror_verified_account_phone() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_my_verified_account_phones_for_user(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('phone','0'||l.transfer_phone,'provider',l.provider,'primary',l.transfer_phone=w.libyana_phone) ORDER BY (l.transfer_phone=w.libyana_phone) DESC,l.verified_at),'[]'::jsonb) FROM public.sms_sender_wallet_links l JOIN public.wallet_accounts w ON w.user_id=l.user_id WHERE l.user_id=p_user AND l.verified_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_my_verified_account_phones_for_user(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_verified_account_phones_for_user(uuid) TO service_role;
