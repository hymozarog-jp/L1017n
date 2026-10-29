-- Prevent re-dial while a matched receipt awaits the bot/admin decision.
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
