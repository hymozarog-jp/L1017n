-- Create a pending Almadar request. Approval remains in the existing admin workflow.
create or replace function public.submit_madar_topup(p_request_id uuid, p_amount numeric, p_sender_phone text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  customer uuid := auth.uid();
  sender text := public.normalize_store_phone(p_sender_phone);
  saved uuid;
begin
  if customer is null then raise exception 'login_required' using errcode='28000'; end if;
  if p_request_id is null or p_amount is null or p_amount not between 1 and 20 or p_amount <> trunc(p_amount)
     or sender is null or sender !~ '^9[13][0-9]{7}$' or sender = '910005566' then
    raise exception 'invalid_madar_topup' using errcode='22023';
  end if;

  select id into saved from public.topup_requests
   where id=p_request_id and user_id=customer and method='almadar' and amount=p_amount and phone=sender;
  if found then return saved; end if;

  if not exists (select 1 from public.wallet_accounts where user_id=customer and libyana_phone=sender)
     and not exists (select 1 from public.account_contact_phones where user_id=customer and phone=sender) then
    raise exception 'madar_sender_not_saved' using errcode='22023';
  end if;

  insert into public.topup_requests(id,user_id,amount,method,phone,transfer_reference)
   values(p_request_id,customer,p_amount,'almadar',sender,'madar-manual:'||p_request_id)
   on conflict (id) do nothing;
  select id into saved from public.topup_requests
   where id=p_request_id and user_id=customer and method='almadar' and amount=p_amount and phone=sender;
  if not found then raise exception 'madar_request_conflict' using errcode='22023'; end if;
  return saved;
end
$$;

revoke all on function public.submit_madar_topup(uuid,numeric,text) from public, anon;
grant execute on function public.submit_madar_topup(uuid,numeric,text) to authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_topup(p_request_id uuid, p_decision text, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_request public.topup_requests%rowtype; v_balance numeric;
begin
 if not public.is_store_admin() then raise exception 'not_authorized'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
 select * into v_request from public.topup_requests where id=p_request_id for update;
 if not found then raise exception 'topup_not_found'; end if;
 if v_request.status <> 'pending' then raise exception 'topup_already_reviewed'; end if;
 if p_decision='approved' then
  -- Shared payer numbers must NEVER be credited without a distinct,
  -- matched incoming SMS receipt and explicit administrator review.
  if v_request.transfer_reference like 'ussd-intent:external:shared:%'
     and not exists (
       select 1 from public.sms_topup_receipts r
       where r.request_id=v_request.id and r.status='matched'
         and r.provider=v_request.method and r.amount=v_request.amount
         and right(regexp_replace(v_request.phone,'[^0-9]','','g'),9)=r.transfer_phone
         and v_request.created_at between r.sms_received_at-interval '30 minutes'
                                      and r.sms_received_at+interval '2 minutes'
     ) then
     raise exception 'shared_sender_receipt_not_verified' using errcode='22023';
  end if;
  if v_request.method='almadar' then
   insert into public.wallet_accounts(user_id,madar_balance,updated_at) values(v_request.user_id,v_request.amount,now())
   on conflict(user_id) do update set madar_balance=public.wallet_accounts.madar_balance+excluded.madar_balance,updated_at=now()
   returning madar_balance into v_balance;
  else
   insert into public.wallet_accounts(user_id,balance,updated_at) values(v_request.user_id,v_request.amount,now())
   on conflict(user_id) do update set balance=public.wallet_accounts.balance+excluded.balance,updated_at=now()
   returning balance into v_balance;
  end if;
  insert into public.wallet_transactions(user_id,topup_request_id,amount,transaction_type,balance_after,created_by)
  values(v_request.user_id,v_request.id,v_request.amount,'topup',v_balance,(select auth.uid()));
 end if;
 update public.topup_requests set status=p_decision,reviewed_at=now(),reviewed_by=(select auth.uid()),admin_note=nullif(left(coalesce(p_admin_note,''),1000),'') where id=v_request.id;
 if p_decision='approved' and v_request.transfer_reference like 'ussd-intent:external:shared:%' then
   update public.sms_topup_receipts set status='approved',reviewed_at=now(),
     note='مراجعة إدارية لتحويل من رقم مرتبط بحساب آخر'
   where request_id=v_request.id and status='matched';
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.review_topup_request(p_request_id uuid, p_status text, p_admin_email text, p_admin_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.topup_requests%rowtype; new_balance numeric(12,3);
begin
 if lower(coalesce(p_admin_email,'')) not in (select lower(email) from private.wallet_admins) then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_status not in ('approved','rejected') then raise exception 'invalid_status' using errcode='22023'; end if;
 select * into r from public.topup_requests where id=p_request_id for update;
 if not found then raise exception 'request_not_found' using errcode='P0002'; end if;
 if r.status<>'pending' then raise exception 'request_already_reviewed' using errcode='22023'; end if;
 update public.topup_requests set status=p_status,reviewed_at=now(),admin_note=left(p_admin_note,500) where id=r.id;
 if p_status='approved' then
  if r.transfer_reference like 'ussd-intent:external:shared:%'
     and not exists (
       select 1 from public.sms_topup_receipts sr
       where sr.request_id=r.id and sr.status='matched'
         and sr.provider=r.method and sr.amount=r.amount
         and right(regexp_replace(r.phone,'[^0-9]','','g'),9)=sr.transfer_phone
         and r.created_at between sr.sms_received_at-interval '30 minutes'
                                 and sr.sms_received_at+interval '2 minutes'
     ) then
     raise exception 'shared_sender_receipt_not_verified' using errcode='22023';
  end if;
  if r.method='almadar' then
   insert into public.wallet_accounts(user_id,madar_balance) values(r.user_id,r.amount)
   on conflict(user_id) do update set madar_balance=public.wallet_accounts.madar_balance+excluded.madar_balance,updated_at=now()
   returning madar_balance into new_balance;
  else
   insert into public.wallet_accounts(user_id,balance) values(r.user_id,r.amount)
   on conflict(user_id) do update set balance=public.wallet_accounts.balance+excluded.balance,updated_at=now()
   returning balance into new_balance;
  end if;
  insert into public.wallet_transactions(user_id,topup_request_id,amount,transaction_type,balance_after)
  values(r.user_id,r.id,r.amount,'topup',new_balance);
 end if;
 if p_status='approved' and r.transfer_reference like 'ussd-intent:external:shared:%' then
   update public.sms_topup_receipts set status='approved',reviewed_at=now(),
     note='اعتماد إداري لتحويل من رقم ليبيانا مشترك'
   where request_id=r.id and status='matched';
 end if;
 return jsonb_build_object('request_id',r.id,'status',p_status,'amount',r.amount,'balance_after',new_balance);
end $function$;
