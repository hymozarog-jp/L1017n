CREATE OR REPLACE FUNCTION public.admin_list_code_deliveries()
RETURNS TABLE (
  order_id uuid, product_name text, customer_name text, total_amount numeric,
  created_at timestamptz, delivery_state text, can_accept boolean, can_cancel boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT o.id, o.product_name::text,
         coalesce(nullif(u.raw_user_meta_data->>'full_name',''),
                  nullif(u.raw_user_meta_data->>'name',''), 'زبون'),
         o.total_amount, o.created_at,
         CASE WHEN j.state='refunded' AND j.last_error='admin_cancelled' THEN 'cancelled'
              ELSE coalesce(j.state,o.status::text) END,
         coalesce(o.supplier_managed AND o.status IN ('paid_pending_fulfillment','processing')
                   AND j.fields='{}'::jsonb
                   AND ((j.state='queued' AND j.attempts=0 AND j.remote_order_id IS NULL)
                   OR (j.state='review' AND j.remote_order_id IS NOT NULL))
                   AND j.refunded_at IS NULL
                   AND (j.lease_until IS NULL OR j.lease_until<now()),false),
         coalesce(o.supplier_managed AND j.fields='{}'::jsonb AND j.delivery_codes='[]'::jsonb
                   AND j.state='queued' AND j.attempts=0 AND j.remote_order_id IS NULL
                   AND j.lease_token IS NULL AND j.lease_until IS NULL
                   AND j.refunded_at IS NULL AND j.wallet='libyana' AND o.wallet_carrier='libyana'
                   AND o.status='paid_pending_fulfillment',false)
    FROM public.purchase_orders o
    LEFT JOIN private.omnex_jobs j ON j.order_id=o.id
    LEFT JOIN auth.users u ON u.id=o.user_id
   WHERE o.roblox_username='DIGITAL_CODE'
     AND (j.order_id IS NULL OR j.fields='{}'::jsonb OR j.delivery_codes<>'[]'::jsonb)
   ORDER BY o.created_at DESC,o.id DESC LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_code_delivery(p_order_id uuid,p_decision text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  job private.omnex_jobs%rowtype;
  purchase public.purchase_orders%rowtype;
  cancellation_lease uuid;
BEGIN
  IF NOT public.is_store_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('accept','cancel') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  -- Use the same lock order as the supplier worker and recheck eligibility
  -- after locking, since the worker may have sent the order after it was listed.
  SELECT * INTO job FROM private.omnex_jobs WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR job.fields<>'{}'::jsonb OR job.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'code_delivery_state_changed';
  END IF;
  SELECT * INTO purchase FROM public.purchase_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR purchase.roblox_username IS DISTINCT FROM 'DIGITAL_CODE'
     OR NOT purchase.supplier_managed OR purchase.status NOT IN ('paid_pending_fulfillment','processing') THEN
    RAISE EXCEPTION 'code_delivery_state_changed';
  END IF;

  IF p_decision='accept' THEN
    IF (job.lease_until IS NOT NULL AND job.lease_until>=now())
       OR NOT ((job.state='queued' AND job.attempts=0 AND job.remote_order_id IS NULL)
            OR (job.state='review' AND job.remote_order_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'code_delivery_state_changed';
    END IF;
    UPDATE private.omnex_jobs
       SET next_attempt_at=now(),updated_at=now() WHERE order_id=p_order_id;
    RETURN;
  END IF;

  IF job.state<>'queued' OR job.delivery_codes<>'[]'::jsonb OR job.attempts<>0 OR job.remote_order_id IS NOT NULL
     OR job.lease_token IS NOT NULL OR job.lease_until IS NOT NULL
     OR job.wallet IS DISTINCT FROM 'libyana' OR purchase.wallet_carrier IS DISTINCT FROM 'libyana'
     OR purchase.status<>'paid_pending_fulfillment' THEN
    RAISE EXCEPTION 'code_delivery_state_changed';
  END IF;
  cancellation_lease:=gen_random_uuid();
  UPDATE private.omnex_jobs SET lease_token=cancellation_lease WHERE order_id=p_order_id;
  IF NOT public.finish_omnex_job(p_order_id,cancellation_lease,'refunded',p_error=>'admin_cancelled') THEN
    RAISE EXCEPTION 'code_delivery_state_changed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_code_deliveries(),public.admin_review_code_delivery(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_code_deliveries(),public.admin_review_code_delivery(uuid,text)
  TO authenticated;
