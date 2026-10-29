
-- Safe, authenticated USSD preflight: match the chosen amount with the
-- sender's Resala-verified Libyana number before the user opens phone dialer.
create or replace function public.create_ussd_topup_intent(p_amount numeric)
returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare
  uid uuid := (select auth.uid());
  phone text;
  existing public.topup_requests%rowtype;
  created public.topup_requests%rowtype;
  counter integer;
begin
  if uid is null then raise exception 'login_required' using errcode='28000'; end if;
  if p_amount is null or p_amount <> trunc(p_amount) or p_amount < 1 or p_amount > 10 then
    raise exception 'invalid_ussd_amount' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(1017,hashtext(uid::text));
  select w.libyana_phone into phone
  from public.wallet_accounts w
  join public.resala_otp_sessions otp on otp.user_id=w.user_id
     and otp.verified_phone=w.libyana_phone and otp.verified_at is not null
  where w.user_id=uid and w.libyana_phone ~ '^9(2|4)[0-9]{7}$';
  if phone is null then raise exception 'verified_libyana_phone_required' using errcode='23514'; end if;

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
  if counter >= 12 then raise exception 'ussd_daily_limit' using errcode='22023'; end if;
  insert into public.topup_requests(user_id,amount,method,phone,transfer_reference,status)
    values(uid,p_amount,'libyana','0'||phone,'ussd-intent:'||gen_random_uuid()::text,'pending')
    returning * into created;
  return jsonb_build_object('request_id',created.id,'amount',created.amount,
    'state','pending','expires_at',created.created_at+interval '30 minutes');
end;
$fn$;
revoke all on function public.create_ussd_topup_intent(numeric) from public,anon;
grant execute on function public.create_ussd_topup_intent(numeric) to authenticated,service_role;

-- Match SMS sender+amount to a single pending request; for new USSD intents,
-- the request must precede the SMS and be no more than 30 minutes old.
create or replace function public.sms_match_pending_receipts()
returns integer language plpgsql security definer set search_path to ''
as $fn$
declare
 rec record;
 candidate uuid;
 cnt bigint;
 matched integer := 0;
begin
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
         and t.created_at between rec.sms_received_at-interval '30 minutes' and rec.sms_received_at+interval '2 minutes')
       or
       (t.transfer_reference not like 'ussd-intent:%'
         and t.created_at between rec.sms_received_at-interval '2 hours' and rec.sms_received_at+interval '2 hours')
      );
   if cnt=1 then
     update public.sms_topup_receipts set status='matched',request_id=candidate
       where id=rec.id and status='unmatched';
     matched:=matched+1;
   end if;
 end loop;
 return matched;
end;
$fn$;
revoke all on function public.sms_match_pending_receipts() from public,anon,authenticated;
grant execute on function public.sms_match_pending_receipts() to service_role;

-- Manual approval of first matched receipt is also the admin approval to
-- link that verified Libyana sender for future bounded auto-credit.
create or replace function public.sms_review_topup(p_review_number bigint,p_decision text)
returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare
 rec public.sms_topup_receipts%rowtype;
 request_row public.topup_requests%rowtype;
 new_balance numeric;
 existing_owner uuid;
 link_created boolean := false;
begin
 if p_decision not in ('approved','rejected') then
   raise exception 'invalid_decision' using errcode='22023';
 end if;
 select * into rec from public.sms_topup_receipts where review_number=p_review_number for update;
 if not found then raise exception 'receipt_not_found' using errcode='P0002'; end if;
 if rec.status not in ('matched','unmatched') then raise exception 'receipt_already_reviewed' using errcode='22023'; end if;
 if p_decision='approved' then
   if rec.status<>'matched' or rec.request_id is null then
     raise exception 'receipt_not_matched' using errcode='22023';
   end if;
   select * into request_row from public.topup_requests where id=rec.request_id for update;
   if not found or request_row.status<>'pending'
     or request_row.amount<>rec.amount or request_row.method<>rec.provider
     or right(regexp_replace(request_row.phone,'[^0-9]','','g'),9)<>rec.transfer_phone
     or (case when request_row.transfer_reference like 'ussd-intent:%'
           then request_row.created_at not between rec.sms_received_at-interval '30 minutes' and rec.sms_received_at+interval '2 minutes'
           else request_row.created_at not between rec.sms_received_at-interval '2 hours' and rec.sms_received_at+interval '2 hours' end)
   then raise exception 'topup_changed_or_mismatched' using errcode='22023'; end if;
   -- If a sender is already bound, disallow mismatched wallet allocation.
   select user_id into existing_owner from public.sms_sender_wallet_links
     where provider=rec.provider and transfer_phone=rec.transfer_phone;
   if existing_owner is not null and existing_owner<>request_row.user_id
   then raise exception 'sender_linked_to_different_wallet' using errcode='23514'; end if;
   insert into public.wallet_accounts(user_id,balance,updated_at)
     values(request_row.user_id,request_row.amount,now())
     on conflict(user_id) do update set balance=public.wallet_accounts.balance+excluded.balance,updated_at=now()
     returning balance into new_balance;
   insert into public.wallet_transactions(user_id,topup_request_id,amount,transaction_type,balance_after)
     values(request_row.user_id,request_row.id,request_row.amount,'topup',new_balance);
   update public.topup_requests set status='approved',reviewed_at=now(),
      admin_note='تحويل مُطابق وافقت عليه الإدارة بعد التحقق من وصول الرصيد'
     where id=request_row.id and status='pending';
   if rec.provider='libyana' and request_row.transfer_reference like 'ussd-intent:%'
     and exists (
       select 1 from public.wallet_accounts wallet
       join public.resala_otp_sessions otp on otp.user_id=wallet.user_id
         and otp.verified_phone=wallet.libyana_phone and otp.verified_at is not null
       where wallet.user_id=request_row.user_id and wallet.libyana_phone=rec.transfer_phone
     )
     and existing_owner is null
   then
     insert into public.sms_sender_wallet_links(provider,transfer_phone,user_id)
       values('libyana',rec.transfer_phone,request_row.user_id)
       on conflict(provider,transfer_phone) do nothing;
     link_created:=true;
   end if;
 end if;
 update public.sms_topup_receipts set status=p_decision,reviewed_at=now(),
   note=case when p_decision='rejected' then 'رفضت الإدارة رسالة التحويل' else 'تأكيد صاحب المتجر عبر تيليجرام' end
   where id=rec.id;
 return jsonb_build_object('review_number',p_review_number,'status',p_decision,
   'amount',rec.amount,'request_id',rec.request_id,'balance_after',new_balance,
   'sender_linked',link_created);
end;
$fn$;
revoke all on function public.sms_review_topup(bigint,text) from public,anon,authenticated;
grant execute on function public.sms_review_topup(bigint,text) to service_role;

-- Existing signed forwarding path first matches receipts, then tries
-- sms_auto_credit_receipt. Allow an already-matched USSD intent to be
-- auto-credited only if the SAME Resala-verified customer was admin-linked.
create or replace function public.sms_auto_credit_receipt(p_review_number bigint)
returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare
 r public.sms_topup_receipts%rowtype;
 cfg public.sms_auto_credit_settings%rowtype;
 uid uuid;
 n bigint;
 tot numeric;
 result jsonb;
 req public.topup_requests%rowtype;
begin
 perform pg_advisory_xact_lock(1017,444);
 select * into cfg from public.sms_auto_credit_settings where id=1;
 if not found or not cfg.enabled then return jsonb_build_object('credited',false,'reason','disabled'); end if;
 select * into r from public.sms_topup_receipts where review_number=p_review_number for update;
 if not found or r.status not in ('unmatched','matched') or
   (r.status='unmatched' and r.request_id is not null) then
   return jsonb_build_object('credited',false,'reason','not_open');
 end if;
 if r.received_at < cfg.activated_at or r.sms_received_at < cfg.activated_at
   or r.sms_received_at < now()-interval '10 minutes'
   or r.sms_received_at > now()+interval '2 minutes'
 then return jsonb_build_object('credited',false,'reason','old_or_delayed'); end if;
 if r.provider<>'libyana' or lower(r.sender_label)<>'libyana'
   or r.amount<1 or r.amount>10 then
   return jsonb_build_object('credited',false,'reason','sender_or_amount');
 end if;
 select user_id into uid from public.sms_sender_wallet_links
   where provider='libyana' and transfer_phone=r.transfer_phone;
 if uid is null then return jsonb_build_object('credited',false,'reason','not_linked'); end if;
 if not exists (
   select 1 from public.wallet_accounts wallet
   join public.resala_otp_sessions otp on otp.user_id=wallet.user_id
     and otp.verified_phone=wallet.libyana_phone and otp.verified_at is not null
   where wallet.user_id=uid and wallet.libyana_phone=r.transfer_phone
 ) then return jsonb_build_object('credited',false,'reason','phone_not_verified'); end if;
 if r.status='matched' then
   select * into req from public.topup_requests where id=r.request_id for update;
   if not found or req.user_id<>uid or req.status<>'pending'
      or req.amount<>r.amount or req.method<>'libyana'
      or right(regexp_replace(req.phone,'[^0-9]','','g'),9)<>r.transfer_phone
   then return jsonb_build_object('credited',false,'reason','intent_mismatch'); end if;
 end if;
 if exists(select 1 from public.sms_topup_receipts x
   where x.id<>r.id and x.provider=r.provider
     and x.transfer_phone=r.transfer_phone and x.amount=r.amount
     and x.sms_received_at between r.sms_received_at-interval '30 minutes' and r.sms_received_at+interval '30 minutes'
     and x.received_at<=r.received_at)
 then return jsonb_build_object('credited',false,'reason','possible_duplicate'); end if;
 select count(*),coalesce(sum(amount),0) into n,tot from public.sms_topup_receipts
   where status='approved' and note='AUTO_SMS_V1'
     and transfer_phone=r.transfer_phone and reviewed_at>now()-interval '24 hours';
 if n>=3 or tot+r.amount>30
 then return jsonb_build_object('credited',false,'reason','sender_daily_limit'); end if;
 select coalesce(sum(amount),0) into tot from public.sms_topup_receipts
   where status='approved' and note='AUTO_SMS_V1' and reviewed_at>now()-interval '24 hours';
 if tot+r.amount>100
 then return jsonb_build_object('credited',false,'reason','store_daily_limit'); end if;
 if r.status='matched' then
   result:=public.sms_review_topup(p_review_number,'approved');
 else
   result:=public.sms_review_direct_topup(p_review_number,'approved');
 end if;
 update public.sms_topup_receipts set note='AUTO_SMS_V1' where id=r.id;
 return result || jsonb_build_object('credited',true);
end;
$fn$;
revoke all on function public.sms_auto_credit_receipt(bigint) from public,anon,authenticated;
grant execute on function public.sms_auto_credit_receipt(bigint) to service_role;
