-- Complete OMNEX catalog and a fixed 5% markup on supplier cost.
ALTER TABLE private.omnex_roblox_catalog DROP CONSTRAINT omnex_roblox_catalog_game_check;
ALTER TABLE private.omnex_roblox_catalog ADD CONSTRAINT omnex_roblox_catalog_game_check CHECK(game IN ('roblox','pubg','psn','supplier'));
ALTER TABLE private.omnex_roblox_catalog ADD COLUMN category_name text NOT NULL DEFAULT '', ADD COLUMN category_section text NOT NULL DEFAULT '', ADD COLUMN category_image_url text NOT NULL DEFAULT '';
ALTER TABLE private.omnex_settings ADD COLUMN all_catalog_synced_at timestamptz;

CREATE OR REPLACE FUNCTION private.omnex_retail(p_cost numeric,p_manual numeric,p_markup numeric) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT round(p_cost*1.05,2) $$;

CREATE OR REPLACE FUNCTION public.sync_omnex_complete_catalog(p_items jsonb,p_wallet text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_count integer;
BEGIN
 IF p_wallet IS DISTINCT FROM 'libyana' OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50000 THEN RAISE EXCEPTION 'invalid_supplier_catalog'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE
  coalesce(x->>'id','') !~ '^[a-f0-9]{32}$' OR coalesce(x->>'category','') !~ '^[a-f0-9]{32}$'
  OR coalesce(x->>'name','')='' OR coalesce(x->>'category_name','')=''
  OR coalesce(x->>'game','') NOT IN ('roblox','pubg','psn','supplier')
  OR coalesce(x->>'price','') !~ '^[0-9]{1,8}(\.[0-9]{1,3})?$'
 ) THEN RAISE EXCEPTION 'invalid_supplier_product';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE (x->>'price')::numeric NOT BETWEEN 0.001 AND 100000) THEN RAISE EXCEPTION 'invalid_supplier_price'; END IF;
 PERFORM pg_advisory_xact_lock(7113,1);
 UPDATE private.omnex_roblox_catalog SET supplier_listed=false,available=false WHERE supplier_listed OR available;
 INSERT INTO private.omnex_roblox_catalog(supplier_product_id,name,group_name,supplier_cost,wallet,unit,stock,available,image_url,game,supplier_category_id,category_name,category_section,category_image_url,published,supplier_listed,synced_at,updated_at)
 SELECT x->>'id',left(x->>'name',180),left(coalesce(x->>'group_name',''),100),(x->>'price')::numeric,p_wallet,'LIBYANA',
 CASE WHEN x->>'stock' ~ '^[0-9]{1,8}$' THEN (x->>'stock')::integer ELSE NULL END,
 coalesce((x->>'available')::boolean,false),left(coalesce(x->>'image_url',''),500),x->>'game',x->>'category',
 left(x->>'category_name',180),left(coalesce(x->>'section','other'),40),left(coalesce(x->>'category_image',''),500),true,true,now(),now()
 FROM jsonb_array_elements(p_items) x
 ON CONFLICT(supplier_product_id) DO UPDATE SET
 name=excluded.name,group_name=excluded.group_name,supplier_cost=excluded.supplier_cost,wallet=excluded.wallet,unit=excluded.unit,
 stock=excluded.stock,available=excluded.available,image_url=excluded.image_url,game=excluded.game,supplier_category_id=excluded.supplier_category_id,
 category_name=excluded.category_name,category_section=excluded.category_section,category_image_url=excluded.category_image_url,
 published=true,supplier_listed=true,sale_price=NULL,synced_at=now(),updated_at=now();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE private.omnex_settings SET markup_percent=5,all_catalog_synced_at=now(),catalog_synced_at=now(),pubg_catalog_synced_at=now(),psn_catalog_synced_at=now() WHERE id;
 RETURN v_count;
END $fn$;
REVOKE ALL ON FUNCTION public.sync_omnex_complete_catalog(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_omnex_complete_catalog(jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.omnex_complete_catalog_sync_due()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
SELECT coalesce(all_catalog_synced_at<now()-interval '45 seconds',true) FROM private.omnex_settings WHERE id
$fn$;
REVOKE ALL ON FUNCTION public.omnex_complete_catalog_sync_due() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.omnex_complete_catalog_sync_due() TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_omnex_complete_catalog()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
SELECT jsonb_build_object('enabled',s.enabled,'synced_at',s.all_catalog_synced_at,'markup_percent',5,'products',
 CASE WHEN s.enabled THEN coalesce((
 SELECT jsonb_agg(jsonb_build_object('id',p.supplier_product_id,'name',p.name,'game',p.game,'category_id',p.supplier_category_id,
 'category_name',p.category_name,'section',p.category_section,'category_image',p.category_image_url,'group',p.group_name,'region',p.group_name,
 'image_url',p.image_url,'price',private.omnex_retail(p.supplier_cost,NULL,5),
 'available',p.available AND coalesce(p.stock,-1)<>0 AND p.wallet='libyana' AND p.supplier_cost>0 AND p.synced_at>now()-interval '3 minutes')
 ORDER BY p.category_name,p.group_name,p.supplier_cost)
 FROM private.omnex_roblox_catalog p WHERE p.published AND p.supplier_listed AND p.supplier_category_id IS NOT NULL
 ),'[]'::jsonb) ELSE '[]'::jsonb END) FROM private.omnex_settings s WHERE id
$fn$;
REVOKE ALL ON FUNCTION public.get_public_omnex_complete_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_omnex_complete_catalog() TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.make_omnex_quote(p_user uuid, p_product text, p_cost numeric, p_wallet text, p_stock integer, p_schema jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p private.omnex_roblox_catalog%ROWTYPE;q private.omnex_quotes%ROWTYPE;s private.omnex_settings%ROWTYPE;retail numeric;
BEGIN
 SELECT * INTO s FROM private.omnex_settings WHERE id;
 IF NOT s.enabled THEN RAISE EXCEPTION 'supplier_sales_paused';END IF;
 SELECT * INTO p FROM private.omnex_roblox_catalog WHERE supplier_product_id=p_product AND published AND supplier_listed FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'product_not_available';END IF;
 IF p_wallet<>'libyana' OR p_wallet IS NULL THEN RAISE EXCEPTION 'supplier_wallet_changed';END IF;
 IF p_cost IS NULL OR p_cost<=0 OR p_cost>100000 OR p_stock=0 THEN RAISE EXCEPTION 'supplier_out_of_stock';END IF;
 IF jsonb_typeof(p_schema)<>'array' OR jsonb_array_length(p_schema)>10 THEN RAISE EXCEPTION 'unsupported_product_fields';END IF;
 retail:=private.omnex_retail(p_cost,NULL,5);
 IF retail<p_cost OR retail>100000 THEN RAISE EXCEPTION 'supplier_price_requires_review';END IF;
 IF (SELECT count(*) FROM private.omnex_quotes WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'quote_rate_limit';END IF;
 UPDATE private.omnex_roblox_catalog SET supplier_cost=p_cost,wallet=p_wallet,unit='LIBYANA',available=true,stock=p_stock,synced_at=now() WHERE supplier_product_id=p_product;
 INSERT INTO private.omnex_quotes(user_id,product_id,supplier_cost,wallet,retail_price,fields_schema) VALUES(p_user,p_product,p_cost,p_wallet,retail,p_schema) RETURNING * INTO q;
 RETURN jsonb_build_object('quote_id',q.id,'id',p_product,'name',p.name,'region',p.group_name,'price',q.retail_price,'fields',q.fields_schema,'expires_at',q.expires_at);
END $function$
;
CREATE OR REPLACE FUNCTION public.reserve_omnex_purchase(p_user uuid, p_product text, p_quote uuid, p_client uuid, p_fields jsonb, p_terms boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE q private.omnex_quotes%ROWTYPE;p private.omnex_roblox_catalog%ROWTYPE;j private.omnex_jobs%ROWTYPE;f jsonb;k text;v numeric;pid uuid;oid uuid;rk text;body text;fname text;
BEGIN
 IF p_user IS NULL OR p_client IS NULL OR p_terms IS DISTINCT FROM true OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object' OR octet_length(p_fields::text)>4000 THEN RAISE EXCEPTION 'invalid_purchase'; END IF;
 PERFORM pg_advisory_xact_lock(7114,hashtext(p_user::text));
 SELECT * INTO j FROM private.omnex_jobs WHERE user_id=p_user AND client_key=p_client FOR UPDATE;
 IF FOUND THEN
  IF j.product_id<>p_product OR j.fields<>p_fields THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN public.omnex_order_snapshot(p_user,j.order_id);
 END IF;
 SELECT * INTO j FROM private.omnex_jobs WHERE user_id=p_user AND product_id=p_product AND state NOT IN ('completed','refunded') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF j.fields<>p_fields THEN RAISE EXCEPTION 'supplier_order_already_pending';END IF;
  RETURN public.omnex_order_snapshot(p_user,j.order_id);
 END IF;
 IF NOT (SELECT enabled FROM private.omnex_settings WHERE id) THEN RAISE EXCEPTION 'supplier_sales_paused';END IF;
 SELECT * INTO q FROM private.omnex_quotes WHERE id=p_quote AND user_id=p_user AND product_id=p_product FOR UPDATE;
 IF NOT FOUND OR q.expires_at<=now() THEN RAISE EXCEPTION 'quote_expired';END IF;
 IF EXISTS(SELECT 1 FROM private.omnex_jobs WHERE quote_id=q.id) THEN RAISE EXCEPTION 'quote_already_used';END IF;
 SELECT * INTO p FROM private.omnex_roblox_catalog WHERE supplier_product_id=p_product AND published AND supplier_listed FOR UPDATE;
 IF NOT FOUND OR NOT p.available THEN RAISE EXCEPTION 'product_not_available';END IF;
 IF (SELECT count(*) FROM private.omnex_jobs WHERE user_id=p_user AND state NOT IN ('completed','refunded'))>=3 THEN RAISE EXCEPTION 'too_many_pending_orders';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wallet_accounts w WHERE w.user_id=p_user AND w.libyana_phone ~ '^9[1-4][0-9]{7}$') THEN RAISE EXCEPTION 'phone_required_before_purchase';END IF;
 FOR f IN SELECT * FROM jsonb_array_elements(q.fields_schema) LOOP
  k:=coalesce(f->>'key',f->>'code');
  IF coalesce((f->>'required')::boolean,false) AND nullif(btrim(p_fields->>k),'') IS NULL THEN RAISE EXCEPTION 'missing_product_field';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_fields) e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>200 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.fields_schema) sf WHERE coalesce(sf->>'key',sf->>'code')=e.key)) THEN RAISE EXCEPTION 'invalid_product_fields';END IF;
 SELECT balance INTO v FROM public.wallet_accounts WHERE user_id=p_user FOR UPDATE;
 IF v IS NULL OR v<q.retail_price THEN RAISE EXCEPTION 'insufficient_balance';END IF;
 fname:=left((CASE WHEN p.game='pubg' THEN 'PUBG Mobile · ' WHEN p.game='psn' THEN 'PlayStation · ' WHEN p.game='roblox' THEN 'Roblox · ' ELSE p.category_name||' · ' END)||p.name||' ('||p.group_name||')',160);
 INSERT INTO public.products(product_key,name,game,amount,price,active) VALUES('omnex-'||p.game||'-'||p_product,fname,'omnex-'||p.game,1,q.retail_price,false) ON CONFLICT(product_key) DO UPDATE SET price=excluded.price,active=false RETURNING id INTO pid;
 UPDATE public.wallet_accounts SET balance=balance-q.retail_price,updated_at=now() WHERE user_id=p_user RETURNING balance INTO v;
 PERFORM set_config('l1017n.omnex_write','on',true);
 INSERT INTO public.purchase_orders(user_id,product_id,product_name,amount,unit_price,total_amount,roblox_username,inventory_reserved,supplier_managed) VALUES(p_user,pid,fname,1,q.retail_price,q.retail_price,'DIGITAL_CODE',false,true) RETURNING id INTO oid;
 PERFORM set_config('l1017n.omnex_write','off',true);
 rk:=replace(gen_random_uuid()::text,'-','');
 body:=jsonb_build_object('id',p_product,'wallet',q.wallet,'expected_price',to_char(q.supplier_cost,'FM9999999990.000'),'accepted_terms',true,'fields',p_fields,'request_key',rk)::text;
 INSERT INTO private.omnex_jobs(order_id,user_id,product_id,quote_id,client_key,request_key,payload_text,fields,supplier_cost,retail_price,wallet) VALUES(oid,p_user,p_product,q.id,p_client,rk,body,p_fields,q.supplier_cost,q.retail_price,q.wallet);
 INSERT INTO public.wallet_transactions(user_id,amount,transaction_type,balance_after,created_by) VALUES(p_user,-q.retail_price,'purchase',v,p_user);
 INSERT INTO public.store_product_costs(product_id,cost_per_sale) VALUES(pid,q.supplier_cost) ON CONFLICT(product_id) DO UPDATE SET cost_per_sale=excluded.cost_per_sale,updated_at=now();
 RETURN public.omnex_order_snapshot(p_user,oid);
END $function$
;
CREATE OR REPLACE FUNCTION public.get_public_omnex_pubg_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('enabled',s.enabled,'products',CASE WHEN s.enabled THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.supplier_product_id,'name',p.name,'region',p.group_name,'group',p.group_name,'price',private.omnex_retail(p.supplier_cost,NULL,5),'available',p.available AND coalesce(p.stock,-1)<>0 AND p.wallet='libyana' AND p.supplier_cost>0 AND private.omnex_retail(p.supplier_cost,NULL,5)>=p.supplier_cost AND p.synced_at>now()-interval '3 minutes') ORDER BY p.group_name,p.supplier_cost) FROM private.omnex_roblox_catalog p WHERE p.published AND p.supplier_listed AND p.game='pubg'),'[]'::jsonb) ELSE '[]'::jsonb END) FROM private.omnex_settings s WHERE id;
$function$
;
UPDATE private.omnex_settings SET markup_percent=5 WHERE id;
UPDATE private.omnex_roblox_catalog SET sale_price=NULL WHERE sale_price IS NOT NULL;
UPDATE private.omnex_quotes q SET expires_at=least(q.expires_at,now()) WHERE q.expires_at>now() AND q.retail_price<>round(q.supplier_cost*1.05,2) AND NOT EXISTS(SELECT 1 FROM private.omnex_jobs j WHERE j.quote_id=q.id);
CREATE OR REPLACE FUNCTION public.reseller_api_dispatch(p_hash text, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k private.reseller_api_keys%rowtype; uid uuid; p public.products%rowtype; o public.purchase_orders%rowtype; old private.reseller_api_orders%rowtype;
 pid text:=p_data->>'product_id'; fields jsonb:=coalesce(p_data->'fields','{}'); rid uuid; expected numeric; q jsonb; snapshot jsonb; items jsonb; group_catalog jsonb; game_name text; claims text; sub text;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_data)<>'object' then raise exception 'unauthorized';end if;
 select a.* into k from private.reseller_api_keys a join auth.users u on u.id=a.user_id where a.key_hash=p_hash and a.revoked_at is null and not coalesce(u.is_anonymous,false) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) for update of a;
 if not found then raise exception 'unauthorized';end if;
 uid:=k.user_id;
 if p_action='authorize' then
  if k.window_at<=now()-interval '1 minute' then k.window_at:=now();k.window_count:=0;end if;
  if k.window_count>=60 then raise exception 'rate_limited';end if;
  update private.reseller_api_keys set window_at=k.window_at,window_count=k.window_count+1,request_count=request_count+1,last_used_at=now() where id=k.id;
  return jsonb_build_object('user_id',uid);
 elsif p_action='balance' then
  return jsonb_build_object('balance',coalesce((select balance from public.wallet_accounts where user_id=uid),0),'currency','LYD','wallet','libyana');
 elsif p_action='products' then
  select coalesce(jsonb_agg(jsonb_build_object('id','local_'||a.id,'name',a.name,'category',a.game,'price',a.price,'currency','LYD','delivery','manual','amount',a.amount,'available',a.active and (a.stock_quantity is null or a.stock_quantity>0) and (a.game<>'roblox' or coalesce((select robux_unlimited or robux_available>=a.amount from public.store_inventory where id),false)),'fields',jsonb_build_array(jsonb_build_object('key','username','label','Roblox username / Player ID','required',true))) order by a.sort_order,a.name),'[]'::jsonb) into items from public.products a where a.active and a.price>0 and a.game in ('roblox','mm2','steal-a-brainrot','pubg');
  group_catalog:=public.get_public_omnex_complete_catalog();
  items:=items||coalesce((select jsonb_agg(jsonb_build_object('id','digital_'||(a->>'id'),'name',a->>'name','category',a->>'category_name','category_id',a->>'category_id','region',a->>'region','price',a->'price','currency','LYD','delivery','digital','amount',1,'available',a->'available','fields_require_quote',true)) from jsonb_array_elements(coalesce(group_catalog->'products','[]')) a),'[]'::jsonb);
  return jsonb_build_object('products',items,'currency','LYD','priced_at',now());
 elsif p_action='order' then
  select a.* into old from private.reseller_api_orders a where a.user_id=uid and a.order_id=(p_data->>'order_id')::uuid limit 1;
  if not found then raise exception 'order_not_found';end if;
  select * into o from public.purchase_orders where id=old.order_id and user_id=uid;
  if not found then raise exception 'order_not_found';end if;
  snapshot:=public.omnex_order_snapshot(uid,o.id);
  return jsonb_build_object('order_id',o.id,'request_id',old.request_id,'product_id',old.product,'price',o.total_amount,'currency','LYD','status',o.status,'state',coalesce(snapshot->>'state',o.status),'codes',case when o.status='completed' then coalesce(snapshot->'codes','[]'::jsonb) else '[]'::jsonb end,'created_at',o.created_at);
 elsif p_action='quote_local' then
  select * into p from public.products where id=substring(pid from 7)::uuid and active and price>0 and game in ('roblox','mm2','steal-a-brainrot','pubg');
  if not found then raise exception 'product_not_available';end if;
  return jsonb_build_object('product_id',pid,'price',p.price,'currency','LYD','delivery','manual','fields',jsonb_build_array(jsonb_build_object('key','username','label','Roblox username / Player ID','required',true)));
 elsif p_action='quote_digital' then
  return public.make_omnex_quote(uid,substring(pid from 9),(p_data->>'cost')::numeric,p_data->>'wallet',(p_data->>'stock')::integer,p_data->'schema')||jsonb_build_object('product_id',pid,'currency','LYD','delivery','digital');
 elsif p_action in ('purchase_local','purchase_digital') then
  if p_data->'accepted_terms' is distinct from 'true'::jsonb or jsonb_typeof(fields)<>'object' or octet_length(fields::text)>4000 then raise exception 'invalid_purchase';end if;
  rid:=(p_data->>'request_id')::uuid; expected:=(p_data->>'expected_price')::numeric;
  if rid is null or expected is null or expected<=0 then raise exception 'invalid_purchase';end if;
  perform pg_advisory_xact_lock(7320,hashtext(uid::text));
  select * into old from private.reseller_api_orders where user_id=uid and request_id=rid;
  if found then
   if old.product is distinct from pid or old.fields is distinct from fields or old.expected_price is distinct from expected then raise exception 'idempotency_conflict';end if;
   return public.reseller_api_dispatch(p_hash,'order',jsonb_build_object('order_id',old.order_id));
  end if;
  if (select count(*) from private.reseller_api_orders where user_id=uid and created_at>now()-interval '1 minute')>=10 then raise exception 'rate_limited';end if;
  if not exists(select 1 from public.wallet_accounts where user_id=uid and libyana_phone ~ '^9[1-4][0-9]{7}$') then raise exception 'phone_required_before_purchase';end if;
  if p_action='purchase_local' then
   if exists(select 1 from jsonb_object_keys(fields) f where f<>'username') or jsonb_typeof(fields->'username') is distinct from 'string' or coalesce(fields->>'username','') !~ '^[A-Za-z0-9_]{3,40}$' or upper(fields->>'username')='DIGITAL_CODE' then raise exception 'invalid_product_fields';end if;
   select * into p from public.products where id=substring(pid from 7)::uuid and active and price>0 and game in ('roblox','mm2','steal-a-brainrot','pubg') for update;
   if not found then raise exception 'product_not_available';end if;
   if p.price is distinct from expected then raise exception 'price_changed';end if;
   -- Existing checkout uses auth.uid(). Set identity only inside this restricted
   -- service-only transaction, restoring request context immediately afterwards.
   claims:=current_setting('request.jwt.claims',true);sub:=current_setting('request.jwt.claim.sub',true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
   perform set_config('request.jwt.claim.sub',uid::text,true);
   if p.game='steal-a-brainrot' then o:=public.create_brainrot_purchase(p.id,fields->>'username',1,expected);
   else o:=public.create_purchase_order(p.id,fields->>'username');end if;
   perform set_config('request.jwt.claims',coalesce(claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(sub,''),true);
  else
   q:=public.omnex_quote_for_service(uid,(p_data->>'quote_id')::uuid);
   if q is null or q->>'product_id' is distinct from substring(pid from 9) then raise exception 'quote_expired';end if;
   if (q->>'retail_price')::numeric is distinct from expected then raise exception 'price_changed';end if;
   snapshot:=public.reserve_omnex_purchase(uid,substring(pid from 9),(p_data->>'quote_id')::uuid,rid,fields,true);
   select * into o from public.purchase_orders where id=(snapshot->>'order_id')::uuid and user_id=uid;
  end if;
  if o.id is null then raise exception 'order_not_found';end if;
  insert into private.reseller_api_orders(user_id,request_id,product,fields,expected_price,order_id) values(uid,rid,pid,fields,expected,o.id);
  return public.reseller_api_dispatch(p_hash,'order',jsonb_build_object('order_id',o.id));
 end if;
 raise exception 'invalid_action';
end $function$
;
