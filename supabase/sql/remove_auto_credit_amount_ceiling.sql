
ALTER TABLE public.sms_topup_receipts DROP CONSTRAINT sms_topup_receipts_amount_check;
ALTER TABLE public.sms_topup_receipts ADD CONSTRAINT sms_topup_receipts_amount_check CHECK(amount>0 AND amount<'Infinity'::numeric);
ALTER TABLE public.topup_requests DROP CONSTRAINT topup_requests_amount_check;
ALTER TABLE public.topup_requests ADD CONSTRAINT topup_requests_amount_check CHECK(amount>0 AND amount<'Infinity'::numeric);
DO $patch$
DECLARE def text; signature text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.sms_auto_credit_receipt(bigint)','public.sms_attach_verified_external_receipt(bigint)'] LOOP
 SELECT pg_get_functiondef(signature::regprocedure) INTO def;
 def:=replace(def,'r.amount < 1 or r.amount > 50 or r.amount<>trunc(r.amount)', 'r.amount <= 0 or r.amount >= ''Infinity''::numeric');
 def:=replace(def,'r.amount<1 OR r.amount>50 OR r.amount<>trunc(r.amount)', 'r.amount<=0 OR r.amount>=''Infinity''::numeric');
 IF position('r.amount>50' in def)>0 OR position('r.amount > 50' in def)>0 OR position('trunc(r.amount)' in def)>0 THEN RAISE EXCEPTION 'amount_patch_failed'; END IF;
 EXECUTE def;
 END LOOP;
END $patch$;
