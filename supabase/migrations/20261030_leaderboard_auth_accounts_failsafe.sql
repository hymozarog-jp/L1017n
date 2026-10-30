-- L1017n: Prevent missing customers from future leaderboard rankings.
-- Use auth.users (all registered customers) as the base rather than optional
-- leaderboard_profiles or even wallet_accounts. Only completed purchases count.
-- A customer's explicit public_visible=false still hides their ranking.
-- Google photo/name require separate share_google_profile=true consent.
-- New accounts without purchase orders appear with zero spent.
CREATE OR REPLACE FUNCTION public.get_my_store_leaderboard_rank()
 RETURNS TABLE(my_rank bigint, my_spend numeric, gap_to_next numeric, participating boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with pub_totals as (
  select au.id as user_id,coalesce(sum(po.total_amount),0)::numeric as spend
  from auth.users au
  left join public.leaderboard_profiles lp on lp.user_id=au.id
  left join public.purchase_orders po
    on po.user_id=au.id and po.status='completed'
  where coalesce(lp.public_visible,true)
  group by au.id
),
ranked as (
  select user_id,spend,
         row_number() over(order by spend desc,user_id asc) as position,
         lag(spend) over(order by spend desc,user_id asc) as prev_spend
  from pub_totals
),
own as (
  select coalesce(sum(po.total_amount),0)::numeric as total
  from public.purchase_orders po
  where po.user_id=(select auth.uid()) and po.status='completed'
)
select r.position,o.total,
       case when r.position>1 then greatest(r.prev_spend-r.spend,0)::numeric
            else null::numeric end,
       coalesce(lp.public_visible,true)
from own o
left join public.leaderboard_profiles lp on lp.user_id=(select auth.uid())
left join ranked r on r.user_id=(select auth.uid())
where (select auth.uid()) is not null;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_leaderboard()
 RETURNS TABLE(rank bigint, nickname text, points numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with totals as (
  select au.id as user_id, coalesce(lp.nickname,'متسوق') as nickname,
         coalesce(sum(po.total_amount),0)::numeric as spend
  from auth.users au
  left join public.leaderboard_profiles lp on lp.user_id=au.id
  left join public.purchase_orders po
    on po.user_id=au.id and po.status='completed'
  where coalesce(lp.public_visible,true)
  group by au.id,lp.nickname
)
select row_number() over(order by spend desc,user_id asc),nickname,spend
from totals order by spend desc,user_id asc limit 100;
$function$;

CREATE OR REPLACE FUNCTION public.get_store_leaderboard_with_google()
 RETURNS TABLE(rank bigint, display_name text, avatar_url text, points numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with totals as (
  select au.id as user_id, coalesce(lp.share_google_profile,false) as share_google_profile,
         coalesce(sum(po.total_amount),0)::numeric as spend
  from auth.users au
  left join public.leaderboard_profiles lp on lp.user_id=au.id
  left join public.purchase_orders po
    on po.user_id=au.id and po.status='completed'
  where coalesce(lp.public_visible,true)
  group by au.id,lp.share_google_profile
),
ranked as (
  select row_number() over (order by spend desc,user_id asc) as position,
         user_id,share_google_profile,spend from totals
)
select r.position,
       case when r.share_google_profile and gi.identity_data is not null
            then nullif(btrim(coalesce(gi.identity_data->>'full_name',gi.identity_data->>'name','')),'')
            else null::text end as display_name,
       case when r.share_google_profile and gi.identity_data is not null
                  and coalesce(gi.identity_data->>'avatar_url',gi.identity_data->>'picture','')
                    ~ '^https://([a-z0-9-]+\.)*(googleusercontent\.com|ggpht\.com)/'
            then coalesce(gi.identity_data->>'avatar_url',gi.identity_data->>'picture')
            else null::text end as avatar_url,
       r.spend as points
from ranked r
left join lateral (
  select ai.identity_data from auth.identities ai
  where ai.user_id=r.user_id and ai.provider='google'
  order by ai.last_sign_in_at desc nulls last limit 1
) gi on r.share_google_profile
order by r.position limit 100;
$function$;

