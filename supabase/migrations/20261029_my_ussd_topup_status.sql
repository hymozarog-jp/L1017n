-- Read-only status for an authenticated customer's own USSD intent.
create or replace function public.get_my_ussd_topup_status(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path to ''
as $fn$
declare
 t public.topup_requests%rowtype;
 receipt_status text;
begin
 if (select auth.uid()) is null then
   raise exception 'login_required' using errcode='28000';
 end if;
 select * into t from public.topup_requests
 where id=p_request_id and user_id=(select auth.uid())
   and method='libyana' and transfer_reference like 'ussd-intent:%';
 if not found then
   return jsonb_build_object('status','not_found');
 end if;
 select r.status into receipt_status from public.sms_topup_receipts r
 where r.request_id=t.id order by r.received_at desc limit 1;
 return jsonb_build_object(
   'status', t.status,
   'sms_status',coalesce(receipt_status,'not_received'),
   'amount',t.amount,
   'created_at',t.created_at
 );
end;
$fn$;
revoke all on function public.get_my_ussd_topup_status(uuid) from public,anon;
grant execute on function public.get_my_ussd_topup_status(uuid) to authenticated,service_role;
