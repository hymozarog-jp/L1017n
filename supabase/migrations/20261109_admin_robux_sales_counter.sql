-- Admin-only Robux sold tracker.
-- Actual site sales come ONLY from completed Robux purchase orders.
-- Manual amount is recorded separately (initially 500) and never touches
-- inventory, transactions, customer wallets, prices, or sales revenue.
CREATE TABLE IF NOT EXISTS public.store_robux_sales_counter(
  id boolean NOT NULL DEFAULT true PRIMARY KEY CHECK (id=true),
  manual_robux_sold bigint NOT NULL DEFAULT 0
    CHECK (manual_robux_sold BETWEEN 0 AND 1000000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.store_robux_sales_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_robux_sales_counter FROM PUBLIC,anon,authenticated;
INSERT INTO public.store_robux_sales_counter(id,manual_robux_sold)
VALUES(true,500)
ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_set_manual_robux_sold(p_amount bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_store_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_amount IS NULL OR p_amount<0 OR p_amount>1000000000 THEN
    RAISE EXCEPTION 'invalid_manual_robux_amount' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.store_robux_sales_counter(id,manual_robux_sold,updated_by)
  VALUES(true,p_amount,(SELECT auth.uid()))
  ON CONFLICT(id) DO UPDATE
    SET manual_robux_sold=excluded.manual_robux_sold,
        updated_at=now(),
        updated_by=excluded.updated_by;
  RETURN public.get_admin_robux_sales_counter();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_robux_sales_counter()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_manual bigint;
  v_automatic bigint;
  v_complete_orders bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_store_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT c.manual_robux_sold INTO v_manual
  FROM public.store_robux_sales_counter c
  WHERE c.id=true;
  SELECT coalesce(sum(o.amount),0)::bigint,count(*)::bigint
  INTO v_automatic,v_complete_orders
  FROM public.purchase_orders o
  LEFT JOIN public.products p ON p.id=o.product_id
  WHERE o.status='completed'
    AND o.amount>0
    AND (
      o.product_name ~* '(robux|روبوكس)'
      OR p.product_key LIKE 'robux-%'
    );
  RETURN jsonb_build_object(
    'manual_sold',coalesce(v_manual,0),
    'website_sold',coalesce(v_automatic,0),
    'website_completed_orders',coalesce(v_complete_orders,0),
    'total_sold',coalesce(v_manual,0)+coalesce(v_automatic,0),
    'source','completed_site_orders_plus_manual'
  );
END;
$function$;


REVOKE ALL ON FUNCTION public.get_admin_robux_sales_counter() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_set_manual_robux_sold(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_robux_sales_counter() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_manual_robux_sold(bigint) TO authenticated;
