CREATE TABLE IF NOT EXISTS private.omnex_roblox_catalog(
 supplier_product_id text PRIMARY KEY CHECK(supplier_product_id ~ '^[a-f0-9]{32}$'),
 name text NOT NULL CHECK(char_length(name)<=180),
 group_name text NOT NULL DEFAULT '',
 supplier_cost numeric(12,3) CHECK(supplier_cost>0),
 wallet text NOT NULL CHECK(wallet IN ('libyana','bank','usd')),
 unit text NOT NULL,
 stock integer CHECK(stock>=0),
 available boolean NOT NULL DEFAULT false,
 image_url text NOT NULL DEFAULT '',
 sale_price numeric(12,3) CHECK(sale_price>0),
 synced_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.omnex_roblox_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.omnex_roblox_catalog FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.omnex_roblox_catalog TO service_role;
CREATE OR REPLACE FUNCTION public.sync_omnex_roblox_catalog(p_items jsonb,p_wallet text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF p_wallet NOT IN ('libyana','bank','usd') OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'invalid_supplier_catalog'; END IF;
 PERFORM pg_advisory_xact_lock(7113,1);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'category'<>'cd40561b622c4fa9ed9984c31f0c697f' OR x->>'category' IS NULL) THEN RAISE EXCEPTION 'roblox_only'; END IF;
 UPDATE private.omnex_roblox_catalog SET available=false;
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
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.sync_omnex_roblox_catalog(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_omnex_roblox_catalog(jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.get_omnex_roblox_admin_catalog()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN jsonb_build_object('scope','roblox','purchasing_enabled',false,
 'synced_at',(SELECT max(synced_at) FROM private.omnex_roblox_catalog),
 'products',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY group_name,supplier_cost,name) FROM private.omnex_roblox_catalog p),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_omnex_roblox_admin_catalog() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_omnex_roblox_admin_catalog() TO authenticated;
CREATE OR REPLACE FUNCTION public.set_omnex_roblox_draft_price(p_product_id text,p_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_row private.omnex_roblox_catalog%ROWTYPE;
BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
 SELECT * INTO v_row FROM private.omnex_roblox_catalog WHERE supplier_product_id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'supplier_product_not_found'; END IF;
 IF v_row.wallet<>'libyana' THEN RAISE EXCEPTION 'supplier_wallet_requires_conversion'; END IF;
 IF p_price IS NOT NULL AND (p_price<=0 OR p_price>100000 OR p_price<>round(p_price,3) OR v_row.supplier_cost IS NULL OR p_price<v_row.supplier_cost) THEN RAISE EXCEPTION 'sale_price_below_cost'; END IF;
 UPDATE private.omnex_roblox_catalog SET sale_price=p_price,updated_at=now() WHERE supplier_product_id=p_product_id;
END $$;
REVOKE ALL ON FUNCTION public.set_omnex_roblox_draft_price(text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_omnex_roblox_draft_price(text,numeric) TO authenticated;
