-- Supplier checkout: private quotes, immutable idempotent requests, leased jobs and atomic wallet settlement.
ALTER TABLE private.omnex_roblox_catalog ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_managed boolean NOT NULL DEFAULT false;
CREATE TABLE private.omnex_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,markup_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK(markup_percent BETWEEN 0 AND 100),worker_token text NOT NULL DEFAULT replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
INSERT INTO private.omnex_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE private.omnex_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,product_id text NOT NULL REFERENCES private.omnex_roblox_catalog(supplier_product_id),supplier_cost numeric(12,3) NOT NULL CHECK(supplier_cost>0),wallet text NOT NULL CHECK(wallet='libyana'),retail_price numeric(12,2) NOT NULL CHECK(retail_price>=supplier_cost),fields_schema jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes');
CREATE TABLE private.omnex_jobs(order_id uuid PRIMARY KEY REFERENCES public.purchase_orders(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,product_id text NOT NULL REFERENCES private.omnex_roblox_catalog(supplier_product_id),quote_id uuid NOT NULL UNIQUE REFERENCES private.omnex_quotes(id),client_key uuid NOT NULL,request_key text NOT NULL UNIQUE CHECK(request_key ~ '^[a-f0-9]{32}$'),payload_text text NOT NULL,fields jsonb NOT NULL DEFAULT '{}',supplier_cost numeric(12,3) NOT NULL,retail_price numeric(12,2) NOT NULL,wallet text NOT NULL CHECK(wallet='libyana'),remote_order_id text CHECK(remote_order_id ~ '^[a-f0-9]{32}$'),state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','processing','unknown','review','completed','refunded')),attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,delivery_codes jsonb NOT NULL DEFAULT '[]',last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),refunded_at timestamptz,UNIQUE(user_id,client_key));
CREATE INDEX omnex_jobs_due ON private.omnex_jobs(next_attempt_at) WHERE state NOT IN ('completed','refunded');
CREATE INDEX omnex_jobs_customer ON private.omnex_jobs(user_id,created_at DESC);
CREATE TABLE private.omnex_rate(id boolean PRIMARY KEY DEFAULT true CHECK(id),window_at timestamptz NOT NULL DEFAULT date_trunc('minute',now()),used integer NOT NULL DEFAULT 0);
INSERT INTO private.omnex_rate(id) VALUES(true);
ALTER TABLE private.omnex_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.omnex_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.omnex_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.omnex_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.omnex_settings,private.omnex_quotes,private.omnex_jobs,private.omnex_rate FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.omnex_settings,private.omnex_quotes,private.omnex_jobs,private.omnex_rate TO service_role;
CREATE OR REPLACE FUNCTION private.omnex_retail(p_cost numeric,p_manual numeric,p_markup numeric) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT ceil(coalesce(p_manual,p_cost*(1+p_markup/100))*100)/100 $$;
REVOKE ALL ON FUNCTION private.omnex_retail(numeric,numeric,numeric) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_public_omnex_roblox_catalog() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',s.enabled,'products',CASE WHEN s.enabled THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.supplier_product_id,'name',p.name,'region',p.group_name,'price',private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent),'available',p.available AND p.wallet='libyana' AND p.supplier_cost>0 AND private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent)>=p.supplier_cost AND p.synced_at>now()-interval '15 minutes') ORDER BY p.group_name,p.supplier_cost) FROM private.omnex_roblox_catalog p WHERE p.published),'[]'::jsonb) ELSE '[]'::jsonb END) FROM private.omnex_settings s WHERE id;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_omnex_roblox_catalog() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_omnex_roblox_admin_catalog() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN jsonb_build_object('scope','roblox','purchasing_enabled',(SELECT enabled FROM private.omnex_settings WHERE id),'markup_percent',(SELECT markup_percent FROM private.omnex_settings WHERE id),'synced_at',(SELECT max(synced_at) FROM private.omnex_roblox_catalog),'products',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('retail_price',private.omnex_retail(p.supplier_cost,p.sale_price,s.markup_percent)) ORDER BY group_name,supplier_cost,name) FROM private.omnex_roblox_catalog p CROSS JOIN private.omnex_settings s WHERE s.id),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_omnex_settings(p_enabled boolean,p_markup numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF p_enabled IS NULL OR p_markup IS NULL OR p_markup<0 OR p_markup>100 THEN RAISE EXCEPTION 'invalid_settings'; END IF;
 UPDATE private.omnex_settings SET enabled=p_enabled,markup_percent=p_markup WHERE id;
END $$;
CREATE OR REPLACE FUNCTION public.admin_set_omnex_product(p_product text,p_published boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF p_published IS NULL THEN RAISE EXCEPTION 'invalid_settings'; END IF;
 UPDATE private.omnex_roblox_catalog SET published=p_published WHERE supplier_product_id=p_product;
END $$;
CREATE OR REPLACE FUNCTION public.omnex_rate_slot() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r private.omnex_rate%ROWTYPE; BEGIN
 SELECT * INTO r FROM private.omnex_rate WHERE id FOR UPDATE;
 IF r.window_at<date_trunc('minute',now()) THEN UPDATE private.omnex_rate SET window_at=date_trunc('minute',now()),used=1 WHERE id;RETURN true;END IF;
 IF r.used>=45 THEN RETURN false;END IF;UPDATE private.omnex_rate SET used=used+1 WHERE id;RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.omnex_worker_allowed(p_token text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT length(coalesce(p_token,''))=64 AND EXISTS(SELECT 1 FROM private.omnex_settings WHERE id AND worker_token=p_token) $$;
CREATE OR REPLACE FUNCTION public.make_omnex_quote(p_user uuid,p_product text,p_cost numeric,p_wallet text,p_stock integer,p_schema jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p private.omnex_roblox_catalog%ROWTYPE;q private.omnex_quotes%ROWTYPE;s private.omnex_settings%ROWTYPE;retail numeric;
BEGIN
 SELECT * INTO s FROM private.omnex_settings WHERE id;
 IF NOT s.enabled THEN RAISE EXCEPTION 'supplier_sales_paused';END IF;
 SELECT * INTO p FROM private.omnex_roblox_catalog WHERE supplier_product_id=p_product AND published FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'product_not_available';END IF;
 IF p_wallet<>'libyana' OR p_wallet IS NULL THEN RAISE EXCEPTION 'supplier_wallet_changed';END IF;
 IF p_cost IS NULL OR p_cost<=0 OR p_cost>100000 OR p_stock=0 THEN RAISE EXCEPTION 'supplier_out_of_stock';END IF;
 IF jsonb_typeof(p_schema)<>'array' OR jsonb_array_length(p_schema)>10 THEN RAISE EXCEPTION 'unsupported_product_fields';END IF;
 retail:=private.omnex_retail(p_cost,p.sale_price,s.markup_percent);
 IF retail<p_cost OR retail>100000 THEN RAISE EXCEPTION 'supplier_price_requires_review';END IF;
 IF (SELECT count(*) FROM private.omnex_quotes WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'quote_rate_limit';END IF;
 UPDATE private.omnex_roblox_catalog SET supplier_cost=p_cost,wallet=p_wallet,unit='LIBYANA',available=true,stock=p_stock,synced_at=now() WHERE supplier_product_id=p_product;
 INSERT INTO private.omnex_quotes(user_id,product_id,supplier_cost,wallet,retail_price,fields_schema) VALUES(p_user,p_product,p_cost,p_wallet,retail,p_schema) RETURNING * INTO q;
 RETURN jsonb_build_object('quote_id',q.id,'id',p_product,'name',p.name,'region',p.group_name,'price',q.retail_price,'fields',q.fields_schema,'expires_at',q.expires_at);
END $$;
CREATE OR REPLACE FUNCTION public.omnex_order_snapshot(p_user uuid,p_order uuid DEFAULT NULL,p_client uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('order_id',j.order_id,'product_name',o.product_name,'price',j.retail_price,'status',o.status,'state',j.state,'codes',CASE WHEN j.state='completed' THEN j.delivery_codes ELSE '[]'::jsonb END,'created_at',j.created_at) FROM private.omnex_jobs j JOIN public.purchase_orders o ON o.id=j.order_id WHERE j.user_id=p_user AND (j.order_id=p_order OR j.client_key=p_client) ORDER BY j.created_at DESC LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.reserve_omnex_purchase(p_user uuid,p_product text,p_quote uuid,p_client uuid,p_fields jsonb,p_terms boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 SELECT * INTO p FROM private.omnex_roblox_catalog WHERE supplier_product_id=p_product AND published FOR UPDATE;
 IF NOT FOUND OR NOT p.available THEN RAISE EXCEPTION 'product_not_available';END IF;
 IF (SELECT count(*) FROM private.omnex_jobs WHERE user_id=p_user AND state NOT IN ('completed','refunded'))>=3 THEN RAISE EXCEPTION 'too_many_pending_orders';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.wallet_accounts w JOIN public.resala_otp_sessions otp ON otp.user_id=w.user_id AND otp.verified_phone=w.libyana_phone AND otp.verified_at IS NOT NULL WHERE w.user_id=p_user) THEN RAISE EXCEPTION 'phone_verification_required_before_purchase';END IF;
 FOR f IN SELECT * FROM jsonb_array_elements(q.fields_schema) LOOP
  k:=coalesce(f->>'key',f->>'code');
  IF coalesce((f->>'required')::boolean,false) AND nullif(btrim(p_fields->>k),'') IS NULL THEN RAISE EXCEPTION 'missing_product_field';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_fields) e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>200 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.fields_schema) sf WHERE coalesce(sf->>'key',sf->>'code')=e.key)) THEN RAISE EXCEPTION 'invalid_product_fields';END IF;
 SELECT balance INTO v FROM public.wallet_accounts WHERE user_id=p_user FOR UPDATE;
 IF v IS NULL OR v<q.retail_price THEN RAISE EXCEPTION 'insufficient_balance';END IF;
 fname:=left('Roblox · '||p.name||' ('||p.group_name||')',160);
 INSERT INTO public.products(product_key,name,game,amount,price,active) VALUES('omnex-roblox-'||p_product,fname,'omnex-roblox',1,q.retail_price,false) ON CONFLICT(product_key) DO UPDATE SET price=excluded.price,active=false RETURNING id INTO pid;
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
END $$;
CREATE OR REPLACE FUNCTION public.claim_omnex_job(p_order uuid DEFAULT NULL,p_user uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE j private.omnex_jobs%ROWTYPE; BEGIN
 SELECT * INTO j FROM private.omnex_jobs WHERE state NOT IN ('completed','refunded') AND (state<>'review' OR remote_order_id IS NOT NULL) AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND (p_order IS NULL OR order_id=p_order) AND (p_user IS NULL OR user_id=p_user) ORDER BY next_attempt_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL;END IF;
 UPDATE private.omnex_jobs SET lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,state=CASE WHEN remote_order_id IS NULL THEN 'sending' ELSE 'processing' END,updated_at=now() WHERE order_id=j.order_id RETURNING * INTO j;
 RETURN to_jsonb(j);
END $$;
CREATE OR REPLACE FUNCTION public.finish_omnex_job(p_order uuid,p_lease uuid,p_state text,p_remote text DEFAULT NULL,p_codes jsonb DEFAULT '[]',p_error text DEFAULT NULL,p_retry integer DEFAULT 30) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j private.omnex_jobs%ROWTYPE;o public.purchase_orders%ROWTYPE;bal numeric;local_state text;
BEGIN
 IF p_state NOT IN ('processing','unknown','review','completed','refunded') OR p_state IS NULL THEN RAISE EXCEPTION 'invalid_supplier_state';END IF;
 SELECT * INTO j FROM private.omnex_jobs WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR j.state IN ('completed','refunded') OR j.lease_token IS DISTINCT FROM p_lease THEN RETURN false;END IF;
 IF p_remote IS NOT NULL AND (p_remote !~ '^[a-f0-9]{32}$' OR (j.remote_order_id IS NOT NULL AND j.remote_order_id<>p_remote)) THEN RAISE EXCEPTION 'supplier_order_mismatch';END IF;
 IF jsonb_typeof(p_codes)<>'array' OR octet_length(p_codes::text)>32768 THEN RAISE EXCEPTION 'invalid_delivery';END IF;
 SELECT * INTO o FROM public.purchase_orders WHERE id=p_order FOR UPDATE;
 IF p_state='completed' AND jsonb_array_length(p_codes)=0 AND j.fields='{}'::jsonb THEN p_state:='review';p_error:='missing_delivery';END IF;
 IF p_state='refunded' AND j.refunded_at IS NULL THEN
  UPDATE public.wallet_accounts SET balance=balance+j.retail_price,updated_at=now() WHERE user_id=j.user_id RETURNING balance INTO bal;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_missing';END IF;
  INSERT INTO public.wallet_transactions(user_id,amount,transaction_type,balance_after) VALUES(j.user_id,j.retail_price,'adjustment',bal);
 END IF;
 local_state:=CASE WHEN p_state='completed' THEN 'completed' WHEN p_state='refunded' THEN 'refunded' WHEN p_remote IS NOT NULL OR j.remote_order_id IS NOT NULL THEN 'processing' ELSE o.status END;
 UPDATE private.omnex_jobs SET state=p_state,remote_order_id=coalesce(p_remote,remote_order_id),delivery_codes=CASE WHEN p_state='completed' THEN p_codes ELSE delivery_codes END,last_error=left(p_error,120),next_attempt_at=now()+make_interval(secs=>greatest(15,least(coalesce(p_retry,30),3600))),lease_token=NULL,lease_until=NULL,updated_at=now(),refunded_at=CASE WHEN p_state='refunded' THEN now() ELSE refunded_at END WHERE order_id=p_order;
 PERFORM set_config('l1017n.omnex_write','on',true);
 UPDATE public.purchase_orders SET status=local_state,reviewed_at=CASE WHEN p_state IN ('completed','refunded') THEN now() ELSE reviewed_at END,admin_note=CASE p_state WHEN 'completed' THEN 'تم تسليم المنتج بنجاح.' WHEN 'refunded' THEN 'تم إرجاع المبلغ إلى محفظتك.' WHEN 'review' THEN 'طلبك قيد المراجعة لدى المورد. لا تعاود الشراء.' ELSE 'جارٍ التحقق من حالة الطلب لدى المورد.' END WHERE id=p_order;
 PERFORM set_config('l1017n.omnex_write','off',true);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.guard_omnex_purchase_state() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (NEW.supplier_managed OR (TG_OP='UPDATE' AND OLD.supplier_managed)) AND current_setting('l1017n.omnex_write',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'supplier_order_managed_automatically';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_omnex_purchase_state BEFORE INSERT OR UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.guard_omnex_purchase_state();
-- Customer reads keep supplier cost, request payload, credentials and other buyers' codes private.
CREATE OR REPLACE FUNCTION public.get_my_omnex_orders() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('order_id',j.order_id,'state',j.state,'created_at',j.created_at) ORDER BY j.created_at DESC),'[]'::jsonb) FROM private.omnex_jobs j WHERE j.user_id=auth.uid() AND j.state NOT IN ('completed','refunded') $$;
-- Reuse the existing order-history code viewer for supplier deliveries as well as local stock.
CREATE OR REPLACE FUNCTION public.get_my_purchased_codes() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid();v_codes jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('order_id',q.order_id,'code',q.code_value) ORDER BY q.delivered_at DESC),'[]'::jsonb) INTO v_codes FROM (SELECT * FROM (
 SELECT d.order_id,s.code_value,d.delivered_at FROM public.digital_code_deliveries d JOIN public.purchase_orders o ON o.id=d.order_id JOIN public.telegram_code_stock s ON s.id=d.stock_id WHERE d.user_id=v_uid AND o.user_id=v_uid AND o.status='completed' AND s.status='delivered'
 UNION ALL
 SELECT j.order_id,(SELECT string_agg(value#>>'{}',E'\n') FROM jsonb_array_elements(j.delivery_codes)),j.updated_at FROM private.omnex_jobs j JOIN public.purchase_orders o ON o.id=j.order_id WHERE j.user_id=v_uid AND o.user_id=v_uid AND j.state='completed' AND o.status='completed' AND jsonb_array_length(j.delivery_codes)>0
 ) combined ORDER BY delivered_at DESC LIMIT 100) q;
 RETURN v_codes;
END $$;
-- All privileged entry points below are only reachable through the authenticated Edge Function.
CREATE OR REPLACE FUNCTION public.omnex_product_for_service(p_product text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT to_jsonb(p) FROM private.omnex_roblox_catalog p WHERE supplier_product_id=p_product AND published $$;
CREATE OR REPLACE FUNCTION public.omnex_quote_for_service(p_user uuid,p_quote uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT to_jsonb(q) FROM private.omnex_quotes q WHERE id=p_quote AND user_id=p_user $$;
CREATE OR REPLACE FUNCTION public.admin_get_omnex_orders() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT j.order_id,o.product_name,j.state,j.remote_order_id,j.attempts,j.last_error,j.supplier_cost,j.retail_price,j.created_at FROM private.omnex_jobs j JOIN public.purchase_orders o ON o.id=j.order_id ORDER BY j.created_at DESC LIMIT 100)q),'[]'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.admin_retry_omnex_order(p_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized';END IF;
 UPDATE private.omnex_jobs SET state=CASE WHEN remote_order_id IS NULL THEN 'unknown' ELSE 'processing' END,next_attempt_at=now(),attempts=0 WHERE order_id=p_order AND state NOT IN ('completed','refunded') AND (lease_until IS NULL OR lease_until<now());
END $$;
REVOKE ALL ON FUNCTION public.make_omnex_quote(uuid,text,numeric,text,integer,jsonb),public.reserve_omnex_purchase(uuid,text,uuid,uuid,jsonb,boolean),public.claim_omnex_job(uuid,uuid),public.finish_omnex_job(uuid,uuid,text,text,jsonb,text,integer),public.omnex_worker_allowed(text),public.omnex_rate_slot(),public.omnex_order_snapshot(uuid,uuid,uuid),public.omnex_product_for_service(text),public.omnex_quote_for_service(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.make_omnex_quote(uuid,text,numeric,text,integer,jsonb),public.reserve_omnex_purchase(uuid,text,uuid,uuid,jsonb,boolean),public.claim_omnex_job(uuid,uuid),public.finish_omnex_job(uuid,uuid,text,text,jsonb,text,integer),public.omnex_worker_allowed(text),public.omnex_rate_slot(),public.omnex_order_snapshot(uuid,uuid,uuid),public.omnex_product_for_service(text),public.omnex_quote_for_service(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.guard_omnex_purchase_state(),public.admin_set_omnex_settings(boolean,numeric),public.admin_set_omnex_product(text,boolean),public.get_my_omnex_orders(),public.admin_get_omnex_orders(),public.admin_retry_omnex_order(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_omnex_settings(boolean,numeric),public.admin_set_omnex_product(text,boolean),public.get_my_omnex_orders(),public.admin_get_omnex_orders(),public.admin_retry_omnex_order(uuid) TO authenticated;
-- Keep backing products off the original manual/instant-code checkout paths.
CREATE OR REPLACE FUNCTION public.keep_omnex_product_internal() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.product_key LIKE 'omnex-roblox-%' THEN NEW.active:=false;END IF;RETURN NEW;
END $$;
CREATE TRIGGER keep_omnex_product_internal BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.keep_omnex_product_internal();
REVOKE ALL ON FUNCTION public.keep_omnex_product_internal() FROM PUBLIC,anon,authenticated;
-- Processing survives closed browser tabs. The worker credential never leaves the private database.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE OR REPLACE FUNCTION private.tick_omnex_orders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.omnex_settings WHERE id AND enabled) OR EXISTS(SELECT 1 FROM private.omnex_jobs WHERE state NOT IN ('completed','refunded') AND (state<>'review' OR remote_order_id IS NOT NULL)) THEN
 PERFORM net.http_post(url:='https://cmtxsjlehjworqypbxjz.supabase.co/functions/v1/l1017n-omnex',headers:=jsonb_build_object('Content-Type','application/json','x-omnex-worker',(SELECT worker_token FROM private.omnex_settings WHERE id)),body:='{"action":"worker"}'::jsonb,timeout_milliseconds:=10000);
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.tick_omnex_orders() FROM PUBLIC,anon,authenticated;
SELECT cron.schedule('l1017n-omnex-orders','* * * * *','select private.tick_omnex_orders()');
