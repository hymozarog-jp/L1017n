-- Keep supplier snapshot membership separate from merchant publication.
ALTER TABLE private.omnex_roblox_catalog ADD COLUMN supplier_listed boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.sync_omnex_roblox_catalog(p_items jsonb, p_wallet text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
 IF p_wallet NOT IN ('libyana','bank','usd') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'invalid_supplier_catalog'; END IF;
 PERFORM pg_advisory_xact_lock(7113,1);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE coalesce(x->>'id','') !~ '^[a-f0-9]{32}$' OR coalesce(x->>'name','')='') THEN RAISE EXCEPTION 'invalid_supplier_product'; END IF;
 UPDATE private.omnex_roblox_catalog SET supplier_listed=false WHERE game='roblox' AND supplier_listed;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'category'<>'cd40561b622c4fa9ed9984c31f0c697f' OR x->>'category' IS NULL) THEN RAISE EXCEPTION 'roblox_only'; END IF;
 UPDATE private.omnex_roblox_catalog SET available=false WHERE available AND game='roblox';
 INSERT INTO private.omnex_roblox_catalog(supplier_product_id,name,group_name,supplier_cost,wallet,unit,stock,available,image_url,game)
 SELECT x->>'id',left(x->>'name',180),left(coalesce(x->>'group_name',''),100),
 CASE WHEN x->>'price' ~ '^[0-9]{1,8}(\.[0-9]{1,3})?$' AND (x->>'price')::numeric>0 THEN (x->>'price')::numeric ELSE NULL END,
 p_wallet,CASE p_wallet WHEN 'libyana' THEN 'LIBYANA' WHEN 'bank' THEN 'LYD' ELSE 'USD' END,
 CASE WHEN x->>'stock' ~ '^[0-9]{1,8}$' THEN (x->>'stock')::integer ELSE NULL END,
 coalesce((x->>'available')::boolean,false),left(coalesce(x->>'image_url',''),500),'roblox'
 FROM jsonb_array_elements(p_items) x
 ON CONFLICT(supplier_product_id) DO UPDATE SET
 supplier_listed=true,name=excluded.name,group_name=excluded.group_name,supplier_cost=excluded.supplier_cost,
 wallet=excluded.wallet,unit=excluded.unit,stock=excluded.stock,available=excluded.available,image_url=excluded.image_url,
 synced_at=now(),updated_at=now();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE private.omnex_settings SET catalog_synced_at=now() WHERE id;
 RETURN v_count;
END $function$
;
CREATE OR REPLACE FUNCTION public.sync_omnex_pubg_catalog(p_items jsonb, p_wallet text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
 IF p_wallet NOT IN ('libyana','bank','usd') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'invalid_supplier_catalog'; END IF;
 PERFORM pg_advisory_xact_lock(7113,1);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE coalesce(x->>'id','') !~ '^[a-f0-9]{32}$' OR coalesce(x->>'name','')='') THEN RAISE EXCEPTION 'invalid_supplier_product'; END IF;
 UPDATE private.omnex_roblox_catalog SET supplier_listed=false WHERE game='pubg' AND supplier_listed;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'category'<>'30faee6b9893e3f424961c15a785efc3' OR x->>'category' IS NULL) THEN RAISE EXCEPTION 'pubg_only'; END IF;
 UPDATE private.omnex_roblox_catalog SET available=false WHERE available AND game='pubg';
 INSERT INTO private.omnex_roblox_catalog(supplier_product_id,name,group_name,supplier_cost,wallet,unit,stock,available,image_url,game,published)
 SELECT x->>'id',left(x->>'name',180),left(coalesce(x->>'group_name',''),100),
 CASE WHEN x->>'price' ~ '^[0-9]{1,8}(\.[0-9]{1,3})?$' AND (x->>'price')::numeric>0 THEN (x->>'price')::numeric ELSE NULL END,
 p_wallet,CASE p_wallet WHEN 'libyana' THEN 'LIBYANA' WHEN 'bank' THEN 'LYD' ELSE 'USD' END,
 CASE WHEN x->>'stock' ~ '^[0-9]{1,8}$' THEN (x->>'stock')::integer ELSE NULL END,
 coalesce((x->>'available')::boolean,false),left(coalesce(x->>'image_url',''),500),'pubg',true
 FROM jsonb_array_elements(p_items) x
 ON CONFLICT(supplier_product_id) DO UPDATE SET
 supplier_listed=true,name=excluded.name,group_name=excluded.group_name,supplier_cost=excluded.supplier_cost,
 wallet=excluded.wallet,unit=excluded.unit,stock=excluded.stock,available=excluded.available,image_url=excluded.image_url,
 synced_at=now(),updated_at=now() WHERE omnex_roblox_catalog.game='pubg';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE private.omnex_settings SET pubg_catalog_synced_at=now() WHERE id;
 RETURN v_count;
END $function$
;
CREATE OR REPLACE FUNCTION public.sync_omnex_psn_catalog(p_items jsonb, p_wallet text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
 IF p_wallet NOT IN ('libyana','bank','usd') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'invalid_supplier_catalog'; END IF;
 IF EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_items) x WHERE
    coalesce(x->>'id','') !~ '^[a-f0-9]{32}$'
    OR coalesce(x->>'category','') !~ '^[a-f0-9]{32}$'
    OR coalesce(x->>'name','')=''
 ) THEN RAISE EXCEPTION 'invalid_supplier_psn_product';END IF;
 PERFORM pg_advisory_xact_lock(7113,1);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE coalesce(x->>'id','') !~ '^[a-f0-9]{32}$' OR coalesce(x->>'name','')='') THEN RAISE EXCEPTION 'invalid_supplier_product'; END IF;
 UPDATE private.omnex_roblox_catalog SET supplier_listed=false WHERE game='psn' AND supplier_listed;
 UPDATE private.omnex_roblox_catalog SET available=false WHERE game='psn' AND available;
 INSERT INTO private.omnex_roblox_catalog(supplier_product_id,name,group_name,supplier_cost,wallet,unit,stock,available,image_url,game,supplier_category_id)
 SELECT x->>'id',left(x->>'name',180),left(coalesce(x->>'group_name',''),100),
 CASE WHEN x->>'price' ~ '^[0-9]{1,8}(\.[0-9]{1,3})?$' AND (x->>'price')::numeric>0 THEN (x->>'price')::numeric ELSE NULL END,
 p_wallet,CASE p_wallet WHEN 'libyana' THEN 'LIBYANA' WHEN 'bank' THEN 'LYD' ELSE 'USD' END,
 CASE WHEN x->>'stock' ~ '^[0-9]{1,8}$' THEN (x->>'stock')::integer ELSE NULL END,
 coalesce((x->>'available')::boolean,false),left(coalesce(x->>'image_url',''),500),'psn',x->>'category'
 FROM jsonb_array_elements(p_items) x
 ON CONFLICT(supplier_product_id) DO UPDATE SET
 supplier_listed=true,name=excluded.name,group_name=excluded.group_name,supplier_cost=excluded.supplier_cost,
 wallet=excluded.wallet,unit=excluded.unit,stock=excluded.stock,available=excluded.available,
 image_url=excluded.image_url,game='psn',supplier_category_id=excluded.supplier_category_id,
 synced_at=now(),updated_at=now();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE private.omnex_roblox_catalog SET published=false WHERE game='psn' AND published AND group_name NOT IN ('أمريكا','السعودية','الإمارات');
 UPDATE private.omnex_settings SET psn_catalog_synced_at=now() WHERE id;
 RETURN v_count;
END $function$
;
CREATE OR REPLACE FUNCTION public.get_public_omnex_roblox_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('enabled',s.enabled,'products',CASE WHEN s.enabled THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.supplier_product_id,'name',p.name,'region',p.group_name,'price',private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent),'available',p.available AND coalesce(p.stock,-1)<>0 AND p.wallet='libyana' AND p.supplier_cost>0 AND private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent)>=p.supplier_cost AND p.synced_at>now()-interval '3 minutes') ORDER BY p.group_name,p.supplier_cost) FROM private.omnex_roblox_catalog p WHERE p.published AND p.supplier_listed AND p.game='roblox'),'[]'::jsonb) ELSE '[]'::jsonb END) FROM private.omnex_settings s WHERE id;
$function$
;
CREATE OR REPLACE FUNCTION public.omnex_product_for_service(p_product text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT to_jsonb(p) FROM private.omnex_roblox_catalog p WHERE supplier_product_id=p_product AND published AND supplier_listed $function$
;
CREATE OR REPLACE FUNCTION public.get_public_omnex_psn_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('enabled',s.enabled,'products',CASE WHEN s.enabled THEN
  coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.supplier_product_id,
  'name',p.name,'region',p.group_name,'price',private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent),
  'available',p.available AND coalesce(p.stock,-1)<>0 AND p.wallet='libyana' AND p.supplier_cost>0 AND
    private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent)>=p.supplier_cost AND
    p.synced_at>now()-interval '3 minutes') ORDER BY p.group_name,p.supplier_cost)
    FROM private.omnex_roblox_catalog p WHERE p.published AND p.supplier_listed AND p.game='psn'),'[]'::jsonb)
  ELSE '[]'::jsonb END)
 FROM private.omnex_settings s WHERE id=true
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_omnex_pubg_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('enabled',s.enabled,'products',CASE WHEN s.enabled THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.supplier_product_id,'name',p.name,'region',p.group_name,'group',p.group_name,'price',round(p.supplier_cost/0.95,2),'available',p.available AND coalesce(p.stock,-1)<>0 AND p.wallet='libyana' AND p.supplier_cost>0 AND round(p.supplier_cost/0.95,2)>=p.supplier_cost AND p.synced_at>now()-interval '3 minutes') ORDER BY p.group_name,p.supplier_cost) FROM private.omnex_roblox_catalog p WHERE p.published AND p.supplier_listed AND p.game='pubg'),'[]'::jsonb) ELSE '[]'::jsonb END) FROM private.omnex_settings s WHERE id;
$function$
;
UPDATE private.omnex_roblox_catalog p SET supplier_listed=false FROM private.omnex_settings s WHERE s.id AND p.synced_at < CASE p.game WHEN 'pubg' THEN s.pubg_catalog_synced_at WHEN 'psn' THEN s.psn_catalog_synced_at ELSE s.catalog_synced_at END;
