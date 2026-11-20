alter table public.purchase_orders
  add column if not exists wallet_carrier text not null default 'libyana'
  check (wallet_carrier in ('libyana','almadar'));

create or replace function public.purchase_madar_robux(p_request_id uuid, p_roblox_username text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  username text := btrim(coalesce(p_roblox_username,''));
  product_id uuid;
  available integer;
  unlimited boolean;
  new_balance numeric;
  prior public.purchase_orders%rowtype;
  price constant numeric := 20;
  quantity constant integer := 100;
begin
  if customer is null then raise exception 'not_authenticated'; end if;
  if p_request_id is null or username !~ '^[A-Za-z0-9_]{3,20}$' or upper(username)='DIGITAL_CODE' then
    raise exception 'invalid_roblox_username';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into prior from public.purchase_orders where id=p_request_id;
  if found then
    if prior.user_id=customer and prior.wallet_carrier='almadar' and prior.roblox_username=username then
      return prior.id;
    end if;
    raise exception 'madar_request_conflict';
  end if;

  select id into product_id from public.products
   where product_key='robux-100' and amount=quantity and game='roblox' and active=true for update;
  if not found then raise exception 'product_not_available'; end if;

  select robux_available,robux_unlimited into available,unlimited
   from public.store_inventory where id=true for update;
  if not found or unlimited is null or (not unlimited and coalesce(available,0)<quantity) then
    raise exception 'robux_out_of_stock';
  end if;
  if not unlimited then
    update public.store_inventory set robux_available=robux_available-quantity,updated_at=now() where id=true;
  end if;

  update public.wallet_accounts set madar_balance=madar_balance-price,updated_at=now()
    where user_id=customer and madar_balance>=price returning madar_balance into new_balance;
  if not found then raise exception 'insufficient_madar_balance'; end if;

  insert into public.purchase_orders(id,user_id,product_id,product_name,amount,unit_price,total_amount,
    roblox_username,inventory_reserved,wallet_carrier)
   values(p_request_id,customer,product_id,'100 Robux · المدار',quantity,price,price,username,not unlimited,'almadar');
  insert into public.wallet_transactions(user_id,amount,transaction_type,balance_after,created_by)
   values(customer,-price,'purchase',new_balance,customer);
  return p_request_id;
end
$$;
revoke all on function public.purchase_madar_robux(uuid,text) from public, anon;
grant execute on function public.purchase_madar_robux(uuid,text) to authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_purchase(p_order_id uuid, p_decision text, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.purchase_orders%rowtype;
  v_balance numeric;
begin
  if not public.is_store_admin() then raise exception 'not_authorized'; end if;
  if p_decision not in ('completed','rejected') then raise exception 'invalid_decision'; end if;
  select * into v_order from public.purchase_orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  -- Allow the website's admin panel to finish/reject an order whose stage was
  -- changed in Telegram, but never act twice on completed/refunded orders.
  if v_order.status not in ('paid_pending_fulfillment','approved','processing','fulfilling') then
    raise exception 'order_already_reviewed';
  end if;
  if p_decision='rejected' then
    if v_order.wallet_carrier='almadar' then
      insert into public.wallet_accounts(user_id,madar_balance,updated_at)
      values (v_order.user_id,v_order.total_amount,now())
      on conflict(user_id) do update
        set madar_balance=public.wallet_accounts.madar_balance+excluded.madar_balance,updated_at=now()
      returning madar_balance into v_balance;
    else
      insert into public.wallet_accounts(user_id,balance,updated_at)
      values (v_order.user_id,v_order.total_amount,now())
      on conflict(user_id) do update
        set balance=public.wallet_accounts.balance+excluded.balance,updated_at=now()
      returning balance into v_balance;
    end if;
    insert into public.wallet_transactions(user_id,amount,transaction_type,balance_after,created_by)
    values(v_order.user_id,v_order.total_amount,'adjustment',v_balance,(select auth.uid()));
    if v_order.inventory_reserved then
      update public.store_inventory
      set robux_available=robux_available+v_order.amount,updated_at=now()
      where id=true;
    end if;
  end if;
  update public.purchase_orders
  set status=p_decision,reviewed_at=now(),reviewed_by=(select auth.uid()),
      admin_note=nullif(left(coalesce(p_admin_note,''),1000),'')
  where id=v_order.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refund_purchase_order(p_order_id uuid, p_admin_email text, p_admin_note text DEFAULT NULL::text)
 RETURNS purchase_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_order public.purchase_orders;
  v_balance numeric;
begin
  if not exists(select 1 from private.wallet_admins where lower(email)=lower(trim(p_admin_email))) then raise exception 'not_admin'; end if;
  select * into v_order from public.purchase_orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'paid_pending_fulfillment' then raise exception 'order_already_reviewed'; end if;
  if v_order.wallet_carrier='almadar' then
    update public.wallet_accounts set madar_balance=madar_balance+v_order.total_amount, updated_at=now() where user_id=v_order.user_id returning madar_balance into v_balance;
  else
    update public.wallet_accounts set balance=balance+v_order.total_amount, updated_at=now() where user_id=v_order.user_id returning balance into v_balance;
  end if;
  if v_balance is null then raise exception 'wallet_missing_cannot_refund'; end if;
  insert into public.wallet_transactions(user_id,amount,transaction_type,balance_after,created_by) values(v_order.user_id,v_order.total_amount,'adjustment',v_balance,auth.uid());
  -- Restore stock atomically with wallet refund, only for reserved Robux orders.
  if v_order.inventory_reserved then
    update public.store_inventory
       set robux_available=robux_available+v_order.amount, updated_at=now()
     where id=true;
    if not found then raise exception 'reserved_stock_missing'; end if;
  end if;
  update public.purchase_orders set status='refunded', reviewed_at=now(), reviewed_by=auth.uid(), admin_note=p_admin_note where id=p_order_id returning * into v_order;
  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_purchase_order(p_order_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_order public.purchase_orders%rowtype;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from private.wallet_admins wa where wa.user_id = v_user_id) then raise exception 'not_admin'; end if;
  if p_status not in ('paid_pending_fulfillment','completed','rejected','refunded') then raise exception 'invalid_status'; end if;
  select * into v_order from public.purchase_orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status in ('completed','rejected','refunded') and p_status <> v_order.status then raise exception 'order_already_final'; end if;
  if p_status in ('rejected','refunded') and v_order.status not in ('rejected','refunded') then
    if v_order.wallet_carrier='almadar' then
      update public.wallet_accounts set madar_balance = madar_balance + v_order.total_amount, updated_at = now() where user_id = v_order.user_id;
    else
      update public.wallet_accounts set balance = balance + v_order.total_amount, updated_at = now() where user_id = v_order.user_id;
    end if;
    insert into public.wallet_transactions(user_id, amount, transaction_type, balance_after, created_by)
    select v_order.user_id, v_order.total_amount, 'adjustment', case when v_order.wallet_carrier='almadar' then wa.madar_balance else wa.balance end, v_user_id
    from public.wallet_accounts wa where wa.user_id = v_order.user_id;
    -- Refunds must return reserved Robux just like the Telegram and admin paths.
    -- This is reached only once while the order is not already final.
    if v_order.inventory_reserved then
      update public.store_inventory
         set robux_available=robux_available+v_order.amount, updated_at=now()
       where id=true;
      if not found then raise exception 'reserved_stock_missing'; end if;
    end if;
  end if;
  update public.purchase_orders set status = p_status, admin_note = nullif(left(coalesce(p_note,''),500),''), reviewed_at = now(), reviewed_by = v_user_id where id = p_order_id;
end;
$function$;
