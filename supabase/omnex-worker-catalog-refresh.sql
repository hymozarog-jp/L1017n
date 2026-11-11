CREATE OR REPLACE FUNCTION public.omnex_catalog_sync_due() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(max(synced_at)<now()-interval '5 minutes',true) FROM private.omnex_roblox_catalog $$;
REVOKE ALL ON FUNCTION public.omnex_catalog_sync_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.omnex_catalog_sync_due() TO service_role;
CREATE OR REPLACE FUNCTION public.omnex_order_snapshot(p_user uuid,p_order uuid DEFAULT NULL,p_client uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('order_id',j.order_id,'product_id',j.product_id,'product_name',o.product_name,'price',j.retail_price,'status',o.status,'state',j.state,'codes',CASE WHEN j.state='completed' THEN j.delivery_codes ELSE '[]'::jsonb END,'created_at',j.created_at) FROM private.omnex_jobs j JOIN public.purchase_orders o ON o.id=j.order_id WHERE j.user_id=p_user AND (j.order_id=p_order OR j.client_key=p_client) ORDER BY j.created_at DESC LIMIT 1;
$$;
