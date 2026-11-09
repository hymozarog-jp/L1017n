-- Allow the admin to SET the displayed Robux count to any nonnegative
-- number. Keep factual website sales separate. Future completed Robux orders
-- increase this displayed count without editing historical orders or wallets.
ALTER TABLE public.store_robux_sales_counter
  ADD COLUMN IF NOT EXISTS display_base_total bigint
  CHECK(display_base_total BETWEEN 0 AND 1000000000);
ALTER TABLE public.store_robux_sales_counter
  ADD COLUMN IF NOT EXISTS website_sold_at_base bigint NOT NULL DEFAULT 0
  CHECK(website_sold_at_base >= 0);

-- Backward-compatible initialization from the prior manual-additive counter;
-- never reset a number which the owner already adjusted.
WITH current_sales AS (
  SELECT coalesce(sum(o.amount),0)::bigint AS total
  FROM public.purchase_orders o
  LEFT JOIN public.products p ON p.id=o.product_id
  WHERE o.status='completed' AND o.amount>0
    AND (o.product_name ~* '(robux|روبوكس)' OR p.product_key LIKE 'robux-%')
)
UPDATE public.store_robux_sales_counter c
SET display_base_total=c.manual_robux_sold+current_sales.total,
    website_sold_at_base=current_sales.total
FROM current_sales
WHERE c.id=true AND c.display_base_total IS NULL;

CREATE OR REPLACE FUNCTION public.admin_set_robux_sales_display(p_total bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_store_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_total IS NULL OR p_total<0 OR p_total>1000000000 THEN
    RAISE EXCEPTION 'invalid_display_total' USING ERRCODE='22023';
  END IF;

  SELECT coalesce(sum(o.amount),0)::bigint INTO v_current
  FROM public.purchase_orders o
  LEFT JOIN public.products p ON p.id=o.product_id
  WHERE o.status='completed' AND o.amount>0
    AND (o.product_name ~* '(robux|روبوكس)' OR p.product_key LIKE 'robux-%');

  INSERT INTO public.store_robux_sales_counter
    (id,display_base_total,website_sold_at_base,updated_by,updated_at)
  VALUES(true,p_total,v_current,(SELECT auth.uid()),now())
  ON CONFLICT(id) DO UPDATE
    SET display_base_total=excluded.display_base_total,
        website_sold_at_base=excluded.website_sold_at_base,
        updated_at=now(),
        updated_by=excluded.updated_by;

  RETURN public.get_admin_robux_sales_display();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_robux_sales_display()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current bigint;
  v_orders bigint;
  v_base bigint;
  v_at_base bigint;
  v_increment bigint;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_store_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;

  SELECT coalesce(sum(o.amount),0)::bigint,count(*)::bigint
  INTO v_current,v_orders
  FROM public.purchase_orders o
  LEFT JOIN public.products p ON p.id=o.product_id
  WHERE o.status='completed' AND o.amount>0
    AND (o.product_name ~* '(robux|روبوكس)' OR p.product_key LIKE 'robux-%');

  SELECT c.display_base_total,c.website_sold_at_base
  INTO v_base,v_at_base
  FROM public.store_robux_sales_counter c WHERE c.id=true;

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'sales_counter_not_initialized' USING ERRCODE='22023';
  END IF;
  v_increment:=greatest(0,v_current-v_at_base);
  RETURN jsonb_build_object(
    'total_sold',v_base+v_increment,
    'display_base_total',v_base,
    'website_sold',v_current,
    'website_completed_orders',v_orders,
    'website_sold_at_base',v_at_base,
    'new_site_sales_since_edit',v_increment,
    'source','owner_adjusted_counter_plus_new_completed_site_sales'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_robux_sales_display() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_set_robux_sales_display(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_robux_sales_display() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_robux_sales_display(bigint) TO authenticated;
