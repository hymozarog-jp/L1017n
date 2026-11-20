create table private.checkout_wallet_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet text not null check (wallet in ('libyana','almadar'))
);
alter table private.checkout_wallet_preferences enable row level security;
revoke all on private.checkout_wallet_preferences from public, anon, authenticated;

create function public.get_checkout_wallet()
returns text language sql stable security definer set search_path = ''
as $$
  select p.wallet from private.checkout_wallet_preferences p where p.user_id=(select auth.uid());
$$;

create function public.set_checkout_wallet(p_wallet text, p_initialize boolean default false)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  selected text;
begin
  if customer is null then raise exception 'not_authenticated'; end if;
  if p_wallet is null or p_wallet not in ('libyana','almadar') then raise exception 'invalid_checkout_wallet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(customer::text,891));
  if p_initialize then
    insert into private.checkout_wallet_preferences(user_id,wallet) values(customer,p_wallet)
      on conflict (user_id) do nothing;
  else
    insert into private.checkout_wallet_preferences(user_id,wallet) values(customer,p_wallet)
      on conflict (user_id) do update set wallet=excluded.wallet;
  end if;
  select p.wallet into selected from private.checkout_wallet_preferences p where p.user_id=customer;
  return selected;
end
$$;

revoke all on function public.get_checkout_wallet(), public.set_checkout_wallet(text,boolean) from public, anon;
grant execute on function public.get_checkout_wallet(), public.set_checkout_wallet(text,boolean) to authenticated;

create function private.enforce_checkout_wallet()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  selected text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,891));
  select p.wallet into selected from private.checkout_wallet_preferences p where p.user_id=new.user_id;
  if new.wallet_carrier is distinct from coalesce(selected,'libyana') then
    raise exception 'checkout_wallet_mismatch';
  end if;
  if selected='almadar' and (new.amount is distinct from 100
    or new.total_amount is distinct from 20 or new.unit_price is distinct from 20
    or not exists (select 1 from public.products where id=new.product_id and product_key='robux-100')) then
    raise exception 'madar_product_not_supported';
  end if;
  return new;
end
$$;
revoke all on function private.enforce_checkout_wallet() from public, anon, authenticated;
create trigger enforce_checkout_wallet
before insert on public.purchase_orders
for each row execute function private.enforce_checkout_wallet();
