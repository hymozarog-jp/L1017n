-- L1017n reseller API. Secrets stay hashed in private storage; only the
-- authenticated owner manages keys. Service-only RPCs reuse existing checkout.
create table private.reseller_api_keys (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
 key_hint text not null,
 created_at timestamptz not null default now(),
 last_used_at timestamptz,
 revoked_at timestamptz,
 window_at timestamptz not null default now(),
 window_count integer not null default 0,
 request_count bigint not null default 0
);
create unique index reseller_one_live_key on private.reseller_api_keys(user_id) where revoked_at is null;
alter table private.reseller_api_keys enable row level security;
revoke all on private.reseller_api_keys from public,anon,authenticated;

create table private.reseller_api_orders (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 product text not null,
 fields jsonb not null,
 expected_price numeric not null,
 order_id uuid not null references public.purchase_orders(id),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
create index reseller_api_orders_owner on private.reseller_api_orders(user_id,order_id);
alter table private.reseller_api_orders enable row level security;
revoke all on private.reseller_api_orders from public,anon,authenticated;

create function public.my_reseller_api(p_action text default 'list',p_key_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); token text; k private.reseller_api_keys%rowtype;
begin
 if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null) then raise exception 'not_authenticated';end if;
 perform pg_advisory_xact_lock(7319,hashtext(uid::text));
 if p_action='create' then
  if exists(select 1 from private.reseller_api_keys where user_id=uid and revoked_at is null) then raise exception 'active_key_exists';end if;
  token:='l1017n_live_'||encode(extensions.gen_random_bytes(32),'hex');
  insert into private.reseller_api_keys(user_id,key_hash,key_hint) values(uid,encode(extensions.digest(token,'sha256'),'hex'),'l1017n_live_…'||right(token,6)) returning * into k;
  return jsonb_build_object('id',k.id,'key',token,'hint',k.key_hint,'created_at',k.created_at);
 elsif p_action='revoke' then
  update private.reseller_api_keys set revoked_at=now() where id=p_key_id and user_id=uid and revoked_at is null;
  if not found then raise exception 'key_not_found';end if;
  return jsonb_build_object('revoked',true);
 elsif p_action<>'list' then raise exception 'invalid_action';end if;
 return jsonb_build_object('keys',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'hint',a.key_hint,'created_at',a.created_at,'last_used_at',a.last_used_at,'requests',a.request_count) order by a.created_at desc) from private.reseller_api_keys a where a.user_id=uid and a.revoked_at is null),'[]'::jsonb));
end $$;
revoke all on function public.my_reseller_api(text,uuid) from public,anon,authenticated;
grant execute on function public.my_reseller_api(text,uuid) to authenticated;

create function public.reseller_api_dispatch(p_hash text,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
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
  foreach game_name in array array['roblox','pubg','psn'] loop
   group_catalog:=case game_name when 'roblox' then public.get_public_omnex_roblox_catalog() when 'pubg' then public.get_public_omnex_pubg_catalog() else public.get_public_omnex_psn_catalog() end;
   items:=items||coalesce((select jsonb_agg(jsonb_build_object('id','digital_'||(a->>'id'),'name',a->>'name','category',game_name,'region',a->>'region','price',a->'price','currency','LYD','delivery','digital','amount',1,'available',a->'available','fields_require_quote',true)) from jsonb_array_elements(coalesce(group_catalog->'products','[]')) a),'[]'::jsonb);
  end loop;
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
end $$;
revoke all on function public.reseller_api_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reseller_api_dispatch(text,text,jsonb) to service_role;
