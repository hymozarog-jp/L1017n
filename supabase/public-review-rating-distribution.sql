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
 from public.store_customer_reviews where visible=true;
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
        from public.store_customer_reviews r
        left join auth.users u on u.id=r.user_id
        left join public.leaderboard_profiles lp on lp.user_id=r.user_id
        where r.visible=true order by r.created_at desc
        limit least(greatest(coalesce(p_limit,8),1),20)) x
   ),'[]'::jsonb)
 );
end;
$function$;
