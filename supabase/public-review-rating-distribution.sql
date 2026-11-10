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
      jsonb_build_object('product_name',x.product_name,'rating',x.rating,
        'comment',x.comment,'created_at',x.created_at)
      order by x.created_at desc)
      from (select product_name,rating,comment,created_at
        from public.store_customer_reviews
        where visible=true order by created_at desc
        limit least(greatest(coalesce(p_limit,8),1),20)) x
   ),'[]'::jsonb)
 );
end;
$function$;
