create table public.store_review_prompt_receipts (
  order_id uuid primary key references public.purchase_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompted_at timestamptz not null default now()
);
alter table public.store_review_prompt_receipts enable row level security;
revoke all on table public.store_review_prompt_receipts from public, anon, authenticated;

create or replace function public.claim_latest_completed_review_prompt()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_result jsonb;
begin
 if v_uid is null then return null; end if;
 with latest as (
   select o.id,o.product_name,o.status,o.created_at
   from public.purchase_orders o
   where o.user_id=v_uid
   order by o.created_at desc,o.id desc
   limit 1
 ), claimed as (
   insert into public.store_review_prompt_receipts(order_id,user_id)
   select o.id,v_uid from latest o
   where o.status='completed'
     and not exists (
       select 1 from public.store_customer_reviews r
       where r.order_id=o.id and r.user_id=v_uid
     )
   on conflict (order_id) do nothing
   returning order_id
 )
 select jsonb_build_object('order_id',o.id,'product_name',o.product_name,'created_at',o.created_at)
 into v_result
 from latest o join claimed c on c.order_id=o.id;
 return v_result;
end;
$function$;
revoke all on function public.claim_latest_completed_review_prompt() from public, anon;
grant execute on function public.claim_latest_completed_review_prompt() to authenticated;
