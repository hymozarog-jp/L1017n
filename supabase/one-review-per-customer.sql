-- One immutable submitted store review and one automatic prompt per customer.
-- Historical rows are retained; public statistics show each customer's latest review once.
CREATE OR REPLACE FUNCTION public.guard_one_store_review_per_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(7112,hashtext(NEW.user_id::text));
 IF TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM public.store_customer_reviews WHERE user_id=NEW.user_id) THEN RAISE EXCEPTION 'review_already_submitted'; END IF;
 ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.rating IS DISTINCT FROM OLD.rating OR NEW.comment IS DISTINCT FROM OLD.comment THEN
  RAISE EXCEPTION 'review_already_submitted';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_one_store_review_per_customer() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER one_review_per_customer BEFORE INSERT OR UPDATE ON public.store_customer_reviews
FOR EACH ROW EXECUTE FUNCTION public.guard_one_store_review_per_customer();
CREATE OR REPLACE FUNCTION public.submit_verified_store_review(p_order_id uuid, p_rating integer, p_comment text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid := (select auth.uid());
 v_order public.purchase_orders%rowtype;
 v_id uuid;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 perform pg_advisory_xact_lock(7112,hashtext(v_uid::text));
 if exists(select 1 from public.store_customer_reviews where user_id=v_uid) then raise exception 'review_already_submitted'; end if;
 if p_rating is null or p_rating<1 or p_rating>5 then raise exception 'invalid_rating'; end if;
 if p_comment is null or char_length(btrim(p_comment))>300 then
   raise exception 'invalid_review_length'; end if;
 select * into v_order from public.purchase_orders
   where id=p_order_id and user_id=v_uid and status='completed';
 if not found then raise exception 'review_requires_completed_purchase'; end if;
 insert into public.store_customer_reviews(order_id,user_id,product_name,rating,comment)
   values(v_order.id,v_uid,left(v_order.product_name,160),p_rating,btrim(p_comment))
   returning id into v_id;
 if v_id is null then raise exception 'review_owner_mismatch'; end if;
 return jsonb_build_object('ok',true,'review_id',v_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_latest_completed_review_prompt()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid := (select auth.uid());
 v_result jsonb;
begin
 if v_uid is null then return null; end if;
 perform pg_advisory_xact_lock(7112,hashtext(v_uid::text));
 if exists(select 1 from public.store_customer_reviews where user_id=v_uid)
    or exists(select 1 from public.store_review_prompt_receipts where user_id=v_uid) then return null; end if;
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_reviewable_purchases()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid := (select auth.uid());
 v_reviews jsonb;
begin
 if v_uid is null then return '[]'::jsonb; end if;
 if exists(select 1 from public.store_customer_reviews where user_id=v_uid) then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'order_id',o.id,'product_name',o.product_name,'total_amount',o.total_amount,
  'rating',r.rating,'comment',r.comment,'reviewed',r.id is not null,
  'created_at',o.created_at
 ) order by o.created_at desc),'[]'::jsonb)
 into v_reviews
 from (
   select id,product_name,total_amount,created_at
   from public.purchase_orders where user_id=v_uid and status='completed'
   order by created_at desc,id desc limit 1
 ) o
 left join public.store_customer_reviews r on r.order_id=o.id and r.user_id=v_uid;
 return v_reviews;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_verified_store_reviews(p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_out jsonb;
begin
 select jsonb_build_object(
   'count',count(*),
   'average',round(avg(rating)::numeric,1),
   'distribution',jsonb_build_object(
     '1',count(*) filter (where rating=1),
     '2',count(*) filter (where rating=2),
     '3',count(*) filter (where rating=3),
     '4',count(*) filter (where rating=4),
     '5',count(*) filter (where rating=5)
   )
 ) into v_out
 from (select distinct on (user_id) * from public.store_customer_reviews order by user_id,created_at desc,id desc) canonical where visible=true;
 return v_out || jsonb_build_object(
   'reviews',coalesce((select jsonb_agg(
      jsonb_build_object('display_name',x.display_name,'product_name',x.product_name,'rating',x.rating,
        'comment',x.comment,'created_at',x.created_at)
      order by x.created_at desc)
      from (select r.product_name,r.rating,r.comment,r.created_at,
          case when coalesce(lp.show_in_purchase_feed,false)
               or (coalesce(lp.public_visible,true) and coalesce(lp.share_google_profile,false))
          then left(coalesce(
            nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
            nullif(btrim(u.raw_user_meta_data->>'name'),''),
            nullif(btrim(u.raw_user_meta_data->>'display_name'),''),
            case when coalesce(lp.nickname,'') !~ '^متسوق[0-9a-f]{6,}$'
                 then nullif(btrim(lp.nickname),'') end
          ),60) else null end as display_name
        from (select distinct on (user_id) * from public.store_customer_reviews order by user_id,created_at desc,id desc) r
        left join auth.users u on u.id=r.user_id
        left join public.leaderboard_profiles lp on lp.user_id=r.user_id
        where r.visible=true order by r.created_at desc
        limit least(greatest(coalesce(p_limit,8),1),20)) x
   ),'[]'::jsonb)
 );
end;
$function$
;
