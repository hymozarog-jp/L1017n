-- Public ordering only: no customer data, revenue, or individual orders.
CREATE OR REPLACE FUNCTION public.get_public_game_sales_order()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
WITH sold AS (
 SELECT CASE
  WHEN p.game IN ('roblox','mm2','steal-a-brainrot','omnex-roblox') THEN 'roblox'
  WHEN p.game IN ('pubg','omnex-pubg') THEN 'pubg'
  WHEN c.category_section='games' THEN c.supplier_category_id
  ELSE NULL END AS game_key
 FROM public.purchase_orders o
 JOIN public.products p ON p.id=o.product_id
 LEFT JOIN private.omnex_jobs j ON j.order_id=o.id
 LEFT JOIN private.omnex_roblox_catalog c ON c.supplier_product_id=j.product_id
 WHERE o.status='completed' AND o.total_amount>0
), totals AS (
 SELECT game_key,count(*) AS sales FROM sold WHERE game_key IS NOT NULL GROUP BY game_key
)
SELECT jsonb_build_object('keys',coalesce((SELECT jsonb_agg(game_key ORDER BY sales DESC,game_key) FROM totals),'[]'::jsonb),'basis','completed_orders')
$fn$;
REVOKE ALL ON FUNCTION public.get_public_game_sales_order() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_game_sales_order() TO anon,authenticated,service_role;
