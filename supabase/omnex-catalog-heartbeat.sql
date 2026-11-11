ALTER TABLE private.omnex_settings ADD COLUMN IF NOT EXISTS catalog_synced_at timestamptz;
CREATE OR REPLACE FUNCTION public.sync_omnex_roblox_catalog(p_items jsonb,p_wallet text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF p_wallet NOT IN ('libyana','bank','usd') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'invalid_supplier_catalog'; END IF;
 PERFORM pg_advisory_xact_lock(7113,1);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'category'<>'cd40561b622c4fa9ed9984c31f0c697f' OR x->>'category' IS NULL) THEN RAISE EXCEPTION 'roblox_only'; END IF;
 UPDATE private.omnex_roblox_catalog SET available=false WHERE available;
 INSERT INTO private.omnex_roblox_catalog(supplier_product_id,name,group_name,supplier_cost,wallet,unit,stock,available,image_url)
 SELECT x->>'id',left(x->>'name',180),left(coalesce(x->>'group_name',''),100),
 CASE WHEN x->>'price' ~ '^[0-9]{1,8}(\.[0-9]{1,3})?$' AND (x->>'price')::numeric>0 THEN (x->>'price')::numeric ELSE NULL END,
 p_wallet,CASE p_wallet WHEN 'libyana' THEN 'LIBYANA' WHEN 'bank' THEN 'LYD' ELSE 'USD' END,
 CASE WHEN x->>'stock' ~ '^[0-9]{1,8}$' THEN (x->>'stock')::integer ELSE NULL END,
 coalesce((x->>'available')::boolean,false),left(coalesce(x->>'image_url',''),500)
 FROM jsonb_array_elements(p_items) x
 ON CONFLICT(supplier_product_id) DO UPDATE SET
 name=excluded.name,group_name=excluded.group_name,supplier_cost=excluded.supplier_cost,
 wallet=excluded.wallet,unit=excluded.unit,stock=excluded.stock,available=excluded.available,image_url=excluded.image_url,
 synced_at=now(),updated_at=now();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE private.omnex_settings SET catalog_synced_at=now() WHERE id;
 RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.omnex_catalog_sync_due() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(catalog_synced_at<now()-interval '5 minutes',true) FROM private.omnex_settings WHERE id $$;
