CREATE OR REPLACE FUNCTION public.guard_omnex_purchase_state() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF (NEW.supplier_managed OR (TG_OP='UPDATE' AND OLD.supplier_managed)) AND current_setting('l1017n.omnex_write',true) IS DISTINCT FROM 'on' THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'supplier_order_managed_automatically'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.supplier_managed IS DISTINCT FROM OLD.supplier_managed OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.unit_price IS DISTINCT FROM OLD.unit_price OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.inventory_reserved IS DISTINCT FROM OLD.inventory_reserved OR NEW.roblox_username IS DISTINCT FROM OLD.roblox_username THEN RAISE EXCEPTION 'supplier_order_managed_automatically';END IF;
 END IF;
 RETURN NEW;
END $$;
