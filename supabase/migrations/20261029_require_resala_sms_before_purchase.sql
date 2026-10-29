-- Enforce real Resala SMS phone verification on every customer purchase.
-- Existing BEFORE INSERT trigger on public.purchase_orders uses this function.
-- Both the Roblox checkout RPC and digital-code checkout RPC insert into
-- purchase_orders in the same transaction as wallet debit/stock reservation.
-- A rejected insert therefore rolls back the whole purchase.
create or replace function public.require_saved_phone_for_customer_purchase()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- Preserve trusted backend administration. Normal customer purchases carry
  -- a Supabase Auth user ID in the authenticated request context.
  if (select auth.uid()) is not null then
    if new.user_id is distinct from (select auth.uid()) then
      raise exception 'purchase_owner_mismatch' using errcode='23514';
    end if;

    if not exists (
      select 1
      from public.wallet_accounts as wa
      inner join public.resala_otp_sessions as otp
        on otp.user_id = wa.user_id
      where wa.user_id = new.user_id
        and wa.libyana_phone ~ '^9[1-4][0-9]{7}$'
        and otp.verified_phone = wa.libyana_phone
        and otp.verified_at is not null
    ) then
      raise exception 'phone_verification_required_before_purchase'
        using errcode='23514';
    end if;
  end if;

  return new;
end;
$function$;
-- Existing trigger remains installed:
-- check_saved_phone_before_customer_purchase BEFORE INSERT ON purchase_orders
