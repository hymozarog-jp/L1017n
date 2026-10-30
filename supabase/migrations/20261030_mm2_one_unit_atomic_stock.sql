-- L1017n: one stock unit per MM2 product (not one product globally).
-- All manual purchases still use the existing wallet checkout and phone verification.
-- The trigger runs in the SAME transaction as the order and wallet deduction;
-- a rejected/failed checkout reverts the stock update, preventing overselling.
-- Inventory becomes available again only when the owner deliberately restocks it.

CREATE OR REPLACE FUNCTION public.reserve_single_mm2_on_purchase()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_mm2 boolean;
BEGIN
  SELECT lower(btrim(coalesce(p.game,'')))='mm2'
         OR p.product_key LIKE 'mm2-%'
  INTO v_mm2
  FROM public.products p
  WHERE p.id=NEW.product_id;

  IF coalesce(v_mm2,false) THEN
    UPDATE public.products p
       SET active=false,updated_at=now()
     WHERE p.id=NEW.product_id AND p.active=true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_available' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reserve_single_mm2_on_purchase ON public.purchase_orders;
CREATE TRIGGER reserve_single_mm2_on_purchase
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.reserve_single_mm2_on_purchase();

-- Public storefront gets stock status for MM2 only; no other hidden products
-- are disclosed by the status function. Users' personal data isn't returned.
CREATE OR REPLACE FUNCTION public.get_mm2_product_stock()
RETURNS TABLE(
  id uuid,product_key text,name text,price numeric,
  amount integer,active boolean,sort_order integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
SELECT p.id,p.product_key,p.name,p.price,p.amount,p.active,p.sort_order
FROM public.products p
WHERE lower(btrim(coalesce(p.game,'')))='mm2'
   OR p.product_key LIKE 'mm2-%'
ORDER BY p.sort_order,p.name,p.id;
$$;

REVOKE ALL ON FUNCTION public.get_mm2_product_stock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mm2_product_stock() TO anon, authenticated;

-- Initial synchronization: existing paid MM2 orders were sold before the
-- single-unit trigger was installed; their product must be sold out as well.
UPDATE public.products p
   SET active=false,updated_at=now()
 WHERE (lower(btrim(coalesce(p.game,'')))='mm2'
         OR p.product_key LIKE 'mm2-%')
   AND p.active=true
   AND EXISTS(
     SELECT 1 FROM public.purchase_orders o
     WHERE o.product_id=p.id
       AND o.status IN('paid_pending_fulfillment','completed')
   );
