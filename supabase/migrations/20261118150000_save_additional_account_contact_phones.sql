create table public.account_contact_phones (
  phone text primary key check (phone ~ '^9[1-4][0-9]{7}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index account_contact_phones_user_idx on public.account_contact_phones(user_id);
alter table public.account_contact_phones enable row level security;
revoke all on public.account_contact_phones from public, anon, authenticated;
grant select on public.account_contact_phones to authenticated;
create policy contact_phones_own_read on public.account_contact_phones for select to authenticated
  using (user_id = (select auth.uid()));

create function public.save_my_additional_contact_phone(p_phone text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text := public.normalize_store_phone(p_phone);
begin
  if v_uid is null then raise exception 'login_required' using errcode='28000'; end if;
  if v_phone is null or v_phone !~ '^9[1-4][0-9]{7}$' then
    raise exception 'invalid_phone' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(41301,hashtext(v_uid::text));
  perform pg_advisory_xact_lock(41302,hashtext(v_phone));
  if not exists(select 1 from public.wallet_accounts where user_id=v_uid and libyana_phone is not null) then
    raise exception 'primary_phone_required';
  end if;
  if exists(select 1 from public.account_contact_phones where phone=v_phone and user_id=v_uid) then
    return v_phone;
  end if;
  if exists(select 1 from public.wallet_accounts where libyana_phone=v_phone)
     or exists(select 1 from public.sms_sender_wallet_links where transfer_phone=v_phone)
     or exists(select 1 from public.store_referral_codes where verified_phone=v_phone)
     or exists(select 1 from public.account_contact_phones where phone=v_phone) then
    raise exception 'phone_already_registered' using errcode='23505';
  end if;
  if (select count(*) from public.account_contact_phones where user_id=v_uid)>=2 then
    raise exception 'contact_phone_limit';
  end if;
  insert into public.account_contact_phones (phone,user_id) values(v_phone,v_uid);
  return v_phone;
exception when unique_violation then
  raise exception 'phone_already_registered' using errcode='23505';
end;
$$;
revoke all on function public.save_my_additional_contact_phone(text) from public, anon;
grant execute on function public.save_my_additional_contact_phone(text) to authenticated;

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
  perform pg_advisory_xact_lock(41301,hashtext(v_uid::text));
  perform pg_advisory_xact_lock(41302,hashtext(v_phone));
  if exists (select 1 from public.account_contact_phones where phone=v_phone)
     or exists (select 1 from public.sms_sender_wallet_links where transfer_phone=v_phone and user_id<>v_uid)
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
