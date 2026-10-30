-- Four minute enforced resend interval for Resala SMS. Browser refresh and
-- concurrent tabs cannot bypass the database lock and per-user cooldown.
-- Keep ownership verification, hourly / daily caps and existing token semantics.
CREATE OR REPLACE FUNCTION public.resala_otp_reserve(p_user uuid, p_phone text, p_token uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.resala_otp_sessions%rowtype;
  linked_phone text;
  n timestamptz := now();
begin
  if p_user is null or p_token is null or p_phone !~ '^9[1-4][0-9]{7}$'
  then return 'invalid_phone'; end if;
  select libyana_phone into linked_phone from public.wallet_accounts where user_id = p_user;
  if linked_phone is distinct from p_phone then return 'phone_mismatch'; end if;
  insert into public.resala_otp_sessions (user_id, phone) values (p_user, p_phone)
    on conflict (user_id) do nothing;
  select * into s from public.resala_otp_sessions where user_id=p_user for update;
  if s.verified_phone = p_phone and s.verified_at is not null then return 'verified'; end if;
  if s.last_sent_at is not null and s.last_sent_at > n - interval '240 seconds'
  then return 'cooldown'; end if;
  if s.hour_started_at > n - interval '1 hour' and s.hour_sends >= 4
  then return 'hour_limit'; end if;
  if s.day_started_at > n - interval '24 hours' and s.day_sends >= 10
  then return 'day_limit'; end if;
  update public.resala_otp_sessions set
    phone=p_phone, pin_hash=null, request_token=p_token, expires_at=null, attempts=0,
    last_sent_at=n,
    hour_started_at=case when s.hour_started_at <= n - interval '1 hour' then n else s.hour_started_at end,
    hour_sends=case when s.hour_started_at <= n - interval '1 hour' then 1 else s.hour_sends + 1 end,
    day_started_at=case when s.day_started_at <= n - interval '24 hours' then n else s.day_started_at end,
    day_sends=case when s.day_started_at <= n - interval '24 hours' then 1 else s.day_sends + 1 end,
    updated_at=n
  where user_id=p_user;
  return 'reserved';
end;
$function$
;
