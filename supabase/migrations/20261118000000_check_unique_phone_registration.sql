create or replace function public.save_my_libyana_phone(p_phone text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_existing text;
begin
  if v_uid is null then raise exception 'login_required' using errcode='28000'; end if;
  v_phone := public.normalize_store_phone(p_phone);
  if v_phone is null or v_phone !~ '^9[1-4][0-9]{7}$' then
    raise exception 'invalid_phone' using errcode='22023';
  end if;
  if exists (select 1 from public.sms_sender_wallet_links where transfer_phone=v_phone and user_id<>v_uid)
     or exists (select 1 from public.store_referral_codes where verified_phone=v_phone and user_id<>v_uid) then
    raise exception 'phone_already_registered' using errcode='23505';
  end if;
  insert into public.wallet_accounts(user_id,libyana_phone) values(v_uid,v_phone)
  on conflict(user_id) do update
   set libyana_phone=coalesce(public.wallet_accounts.libyana_phone,excluded.libyana_phone)
  returning libyana_phone into v_existing;
  if v_existing is distinct from v_phone then
    raise exception 'phone_already_registered' using errcode='23505';
  end if;
  return v_phone;
exception when unique_violation then
  raise exception 'phone_already_registered' using errcode='23505';
end;
$$;
