create function public.delete_my_saved_contact_phone(p_phone text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  number_text text := public.normalize_store_phone(p_phone);
  removed boolean := false;
begin
  if uid is null then raise exception 'login_required' using errcode='28000'; end if;
  if number_text is null or number_text !~ '^9[1-4][0-9]{7}$' then
    raise exception 'invalid_phone' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(41301,hashtext(uid::text));
  perform pg_advisory_xact_lock(41302,hashtext(number_text));
  if exists(select 1 from public.topup_requests
     where user_id=uid and status='pending' and transfer_reference like 'ussd-intent:%'
       and right(regexp_replace(phone,'[^0-9]','','g'),9)=number_text
       and created_at>=now()-interval '60 minutes') then
    raise exception 'contact_phone_pending_topup';
  end if;
  delete from public.account_contact_phones where user_id=uid and phone=number_text;
  removed := found;
  update public.wallet_accounts set libyana_phone=null,updated_at=now() where user_id=uid and libyana_phone=number_text;
  removed := removed or found;
  delete from public.sms_sender_wallet_links where user_id=uid and transfer_phone=number_text;
  removed := removed or found;
  update public.resala_otp_sessions set verified_phone=null,verified_at=null,pin_hash=null,request_token=null,expires_at=null
    where user_id=uid and (phone=number_text or verified_phone=number_text);
  return removed;
end;
$$;
revoke all on function public.delete_my_saved_contact_phone(text) from public, anon;
grant execute on function public.delete_my_saved_contact_phone(text) to authenticated;
