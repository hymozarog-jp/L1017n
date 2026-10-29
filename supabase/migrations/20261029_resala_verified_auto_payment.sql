-- Automatic Libyana wallet credit is limited to fully verified customers.
-- Resala SMS OTP proves ownership of phone, not the authenticity of any payment.
-- KEEP separate operator transfer evidence and admin-approved sender linkage.
CREATE OR REPLACE FUNCTION public.is_my_auto_libyana_topup_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists(
  select 1
  from public.sms_auto_credit_settings cfg
  join public.wallet_accounts wallet
    on wallet.user_id=(select auth.uid())
  join public.resala_otp_sessions otp
    on otp.user_id=wallet.user_id
   and otp.verified_phone=wallet.libyana_phone
   and otp.verified_at is not null
  join public.sms_sender_wallet_links link
    on link.provider='libyana'
   and link.user_id=wallet.user_id
   and link.transfer_phone=wallet.libyana_phone
  where cfg.id=1 and cfg.enabled=true
    and wallet.libyana_phone ~ '^9[1-4][0-9]{7}$'
);
$function$;
REVOKE ALL ON FUNCTION public.is_my_auto_libyana_topup_ready() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_auto_libyana_topup_ready() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sms_auto_credit_receipt(p_review_number bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 r public.sms_topup_receipts%rowtype;
 cfg public.sms_auto_credit_settings%rowtype;
 uid uuid;
 n bigint;
 tot numeric;
 result jsonb;
begin
 perform pg_advisory_xact_lock(1017,444);
 select * into cfg from public.sms_auto_credit_settings where id=1;
 if not found or not cfg.enabled then
   return jsonb_build_object('credited',false,'reason','disabled');
 end if;
 select * into r from public.sms_topup_receipts
  where review_number=p_review_number for update;
 if not found or r.status<>'unmatched' or r.request_id is not null then
   return jsonb_build_object('credited',false,'reason','not_unmatched');
 end if;
 if r.received_at < cfg.activated_at or r.sms_received_at < cfg.activated_at
    or r.sms_received_at < now()-interval '10 minutes'
    or r.sms_received_at > now()+interval '2 minutes' then
   return jsonb_build_object('credited',false,'reason','old_or_delayed');
 end if;
 if r.provider<>'libyana' or lower(r.sender_label)<>'libyana'
    or r.amount < 1 or r.amount > 10 then
   return jsonb_build_object('credited',false,'reason','sender_or_amount');
 end if;
 select user_id into uid from public.sms_sender_wallet_links
  where provider='libyana' and transfer_phone=r.transfer_phone;
 if uid is null then
   return jsonb_build_object('credited',false,'reason','not_linked');
 end if;
 -- Fail closed unless this EXACT wallet phone was verified by the customer via Resala.
 if not exists(
   select 1 from public.wallet_accounts wallet
   join public.resala_otp_sessions otp on otp.user_id=wallet.user_id
     and otp.verified_phone=wallet.libyana_phone
     and otp.verified_at is not null
   where wallet.user_id=uid
     and wallet.libyana_phone=r.transfer_phone
 ) then
   return jsonb_build_object('credited',false,'reason','phone_not_verified');
 end if;
 if exists(select 1 from public.sms_topup_receipts x
    where x.id<>r.id and x.provider=r.provider
      and x.transfer_phone=r.transfer_phone and x.amount=r.amount
      and x.sms_received_at between r.sms_received_at-interval '30 minutes'
                                and r.sms_received_at+interval '30 minutes'
      and x.received_at <= r.received_at) then
   return jsonb_build_object('credited',false,'reason','possible_duplicate');
 end if;
 select count(*),coalesce(sum(amount),0) into n,tot
  from public.sms_topup_receipts
  where status='approved' and note='AUTO_SMS_V1'
    and transfer_phone=r.transfer_phone and reviewed_at>now()-interval '24 hours';
 if n >= 3 or tot+r.amount>30 then
   return jsonb_build_object('credited',false,'reason','sender_daily_limit');
 end if;
 select coalesce(sum(amount),0) into tot
  from public.sms_topup_receipts where status='approved' and note='AUTO_SMS_V1'
    and reviewed_at>now()-interval '24 hours';
 if tot+r.amount>100 then
   return jsonb_build_object('credited',false,'reason','store_daily_limit');
 end if;
 result:=public.sms_review_direct_topup(p_review_number,'approved');
 update public.sms_topup_receipts set note='AUTO_SMS_V1' where id=r.id;
 return result || jsonb_build_object('credited',true);
end $function$;
REVOKE ALL ON FUNCTION public.sms_auto_credit_receipt(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_auto_credit_receipt(bigint) TO service_role;
