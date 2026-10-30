-- Protect PUBG 60 UC manual top-ups from cached instant-code checkout.
-- Code delivery is only allowed for actual redeemable products; this package
-- requires the customer's PUBG UID, wallet charge, and manual fulfillment.
CREATE OR REPLACE FUNCTION public.buy_instant_code(p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_stock public.telegram_code_stock%rowtype;
  v_balance numeric;
  v_order public.purchase_orders%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_product_id is null then raise exception 'invalid_product'; end if;

  select * into v_product
  from public.products where id = p_product_id and active = true and price > 0
  for share;
  if not found then raise exception 'product_not_available'; end if;

  -- PUBG 60 UC is a manual player UID fulfillment, not a redeemable code.
  -- Reject old cached frontends attempting the instant-code purchase RPC.
  if v_product.product_key = 'pubg-60' then
    raise exception 'manual_fulfillment_required';
  end if;

  -- The Roblox fulfillment path requires verification and must never be bypassed.
  if lower(trim(v_product.game)) = 'roblox'
     or v_product.name ilike '%robux%'
     or v_product.name ilike '%روبوكس%'
     or v_product.name ilike '%روبلوكس%' then
    raise exception 'manual_fulfillment_required';
  end if;

  select * into v_stock
  from public.telegram_code_stock
  where product_id = v_product.id and status = 'available'
  order by added_at, id
  limit 1
  for update skip locked;
  if not found then raise exception 'code_out_of_stock'; end if;

  select balance into v_balance
  from public.wallet_accounts where user_id = v_uid for update;
  if not found or v_balance < v_product.price then
    raise exception 'insufficient_balance';
  end if;

  update public.wallet_accounts
     set balance = balance - v_product.price, updated_at = now()
   where user_id = v_uid
   returning balance into v_balance;

  insert into public.purchase_orders (
    user_id, product_id, product_name, amount, unit_price, total_amount,
    roblox_username, inventory_reserved, status, reviewed_at
  ) values (
    v_uid, v_product.id, v_product.name, v_product.amount, v_product.price,
    v_product.price, 'DIGITAL_CODE', false, 'completed', now()
  ) returning * into v_order;

  update public.telegram_code_stock
     set status = 'delivered', delivered_at = now()
   where id = v_stock.id and status = 'available';
  if not found then raise exception 'code_already_used'; end if;

  insert into public.digital_code_deliveries(order_id,stock_id,user_id)
  values(v_order.id,v_stock.id,v_uid);

  insert into public.wallet_transactions(user_id,amount,transaction_type,balance_after,created_by)
  values(v_uid,-v_product.price,'purchase',v_balance,v_uid);

  return jsonb_build_object(
    'order_id', v_order.id,
    'product_name', v_product.name,
    'code', v_stock.code_value
  );
end
$function$;

-- Quarantine a known placeholder code never meant to be delivered.
UPDATE public.telegram_code_stock
SET status='disabled'
WHERE product_id=(SELECT id FROM public.products WHERE product_key='pubg-60')
  AND code_value='ABC-123-XY' AND status='available';
