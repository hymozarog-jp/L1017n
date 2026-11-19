-- Transactional fixtures: no retained users, keys, orders or balance changes.
begin;
do $$
declare u uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); k jsonb; k2 jsonb; h text; h2 text; o jsonb; again jsonb; b numeric; data jsonb; digital private.omnex_roblox_catalog%rowtype; quote jsonb; digital_order jsonb;
begin
 if has_function_privilege('anon','public.my_reseller_api(text,uuid)','EXECUTE') or has_function_privilege('authenticated','public.reseller_api_dispatch(text,text,jsonb)','EXECUTE') then raise exception 'FAIL exposed privileged functions';end if;
 insert into auth.users(id,email,is_anonymous) values(u,u::text||'@api-test.invalid',false),(u2,u2::text||'@api-test.invalid',false);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 k:=public.my_reseller_api('create');h:=encode(extensions.digest(k->>'key','sha256'),'hex');
 if (public.my_reseller_api('list'))::text like '%key_hash%' or (public.my_reseller_api('list'))::text like '%'||(k->>'key')||'%' then raise exception 'FAIL secret shown again';end if;
 begin perform public.my_reseller_api('create');raise exception 'FAIL duplicate active key';exception when others then if sqlerrm<>'active_key_exists' then raise;end if;end;
 update public.wallet_accounts set balance=10,libyana_phone='93'||lpad((floor(random()*9999999))::text,7,'0') where user_id=u;
 insert into public.products(id,product_key,name,game,amount,price,active) values(pid,'api-test-'||pid,'API transactional fixture','pubg',1,1,true);
 data:=jsonb_build_object('product_id','local_'||pid,'request_id',rid,'expected_price',1,'accepted_terms',true,'fields',jsonb_build_object('username','TestPlayer'));
 perform public.reseller_api_dispatch(h,'authorize');
 if public.reseller_api_dispatch(h,'balance')->>'currency'<>'LYD' then raise exception 'FAIL balance currency';end if;
 if jsonb_typeof(public.reseller_api_dispatch(h,'products')->'products')<>'array' then raise exception 'FAIL products list';end if;
 if (public.reseller_api_dispatch(h,'quote_local',jsonb_build_object('product_id','local_'||pid))->>'price')::numeric<>1 then raise exception 'FAIL local quote';end if;
 o:=public.reseller_api_dispatch(h,'purchase_local',data);
 again:=public.reseller_api_dispatch(h,'purchase_local',data);
 select balance into b from public.wallet_accounts where user_id=u;
 if o->>'order_id' is distinct from again->>'order_id' or b<>9 then raise exception 'FAIL idempotency or debit';end if;
 begin perform public.reseller_api_dispatch(h,'purchase_local',data||jsonb_build_object('fields',jsonb_build_object('username','OtherPlayer')));raise exception 'FAIL mismatched replay';exception when others then if sqlerrm<>'idempotency_conflict' then raise;end if;end;
 begin perform public.reseller_api_dispatch(h,'purchase_local',data||jsonb_build_object('request_id',gen_random_uuid(),'expected_price',2));raise exception 'FAIL price mismatch';exception when others then if sqlerrm<>'price_changed' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',u2::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u2,'role','authenticated')::text,true);
 k2:=public.my_reseller_api('create');h2:=encode(extensions.digest(k2->>'key','sha256'),'hex');
 begin perform public.reseller_api_dispatch(h2,'order',jsonb_build_object('order_id',o->>'order_id'));raise exception 'FAIL cross-account order';exception when others then if sqlerrm<>'order_not_found' then raise;end if;end;
 begin perform public.my_reseller_api('revoke',(k->>'id')::uuid);raise exception 'FAIL cross-account revoke';exception when others then if sqlerrm<>'key_not_found' then raise;end if;end;
 -- Use an existing catalog row only within this rolled-back transaction.
 select * into digital from private.omnex_roblox_catalog where published and available and supplier_cost>0 and wallet='libyana' limit 1;
 if found then
  update private.omnex_settings set enabled=true where id;
  update public.wallet_accounts set balance=100000 where user_id=u;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  quote:=public.reseller_api_dispatch(h,'quote_digital',jsonb_build_object('product_id','digital_'||digital.supplier_product_id,'cost',digital.supplier_cost,'wallet','libyana','stock',1,'schema','[]'::jsonb));
  digital_order:=public.reseller_api_dispatch(h,'purchase_digital',jsonb_build_object('product_id','digital_'||digital.supplier_product_id,'request_id',gen_random_uuid(),'quote_id',quote->>'quote_id','expected_price',quote->'price','accepted_terms',true,'fields','{}'::jsonb));
  if digital_order->>'order_id' is null or digital_order->'codes'<>'[]'::jsonb then raise exception 'FAIL digital reservation';end if;
 end if;
 update private.reseller_api_keys set window_at=now(),window_count=60 where key_hash=h2;
 begin perform public.reseller_api_dispatch(h2,'authorize');raise exception 'FAIL rate limit';exception when others then if sqlerrm<>'rate_limited' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 perform public.my_reseller_api('revoke',(k->>'id')::uuid);
 begin perform public.reseller_api_dispatch(h,'balance');raise exception 'FAIL revoked key';exception when others then if sqlerrm<>'unauthorized' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 begin perform public.my_reseller_api('create');raise exception 'FAIL anonymous key';exception when others then if sqlerrm<>'not_authenticated' then raise;end if;end;
end $$;
rollback;
select 'passed: key secrecy, owner isolation, revocation, price guard, atomic debit, idempotency, rate limit, digital reservation; fixtures rolled back' as result;
