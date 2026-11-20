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
  if not public.is_store_admin() then raise exception 'not_admin'; end if;
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

-- Create a pending Almadar request. Approval remains in the existing admin workflow.
create or replace function public.submit_madar_topup(p_request_id uuid, p_amount numeric, p_sender_phone text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  sender text := public.normalize_store_phone(p_sender_phone);
  saved uuid;
begin
  if customer is null then raise exception 'login_required' using errcode='28000'; end if;
  if p_request_id is null or p_amount is null or p_amount not between 1 and 20 or p_amount <> trunc(p_amount)
     or sender is null or sender !~ '^9[13][0-9]{7}$' or sender = '910005566' then
    raise exception 'invalid_madar_topup' using errcode='22023';
  end if;

  select id into saved from public.topup_requests
   where id=p_request_id and user_id=customer and method='almadar' and amount=p_amount and phone=sender;
  if found then return saved; end if;

  if not exists (select 1 from public.wallet_accounts where user_id=customer and libyana_phone=sender)
     and not exists (select 1 from public.account_contact_phones where user_id=customer and phone=sender)
     and not exists (select 1 from public.sms_sender_wallet_links where user_id=customer and provider='almadar' and transfer_phone=sender and verified_at is not null) then
    raise exception 'madar_sender_not_saved' using errcode='22023';
  end if;

  insert into public.topup_requests(id,user_id,amount,method,phone,transfer_reference)
   values(p_request_id,customer,p_amount,'almadar',sender,'madar-manual:'||p_request_id)
   on conflict (id) do nothing;
  select id into saved from public.topup_requests
   where id=p_request_id and user_id=customer and method='almadar' and amount=p_amount and phone=sender;
  if not found then raise exception 'madar_request_conflict' using errcode='22023'; end if;
  return saved;
end
$$;

revoke all on function public.submit_madar_topup(uuid,numeric,text) from public, anon;
grant execute on function public.submit_madar_topup(uuid,numeric,text) to authenticated;
