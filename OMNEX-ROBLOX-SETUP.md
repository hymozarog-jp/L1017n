# OMNEX — Roblox supplier checkout

Store → Roblox → Codes shows the published Roblox products from OMNEX. The existing username delivery packs use their original workflow. In Admin → ربط OMNEX, operators can pause new purchases, set the markup (initially 10% over cost), override individual prices, and hide products.

The Edge Function keeps the supplier key in its server-side `OMNEX_API_KEY` secret and requests a fresh Libyana price before confirming. A verified phone, wallet balance, and accepted supplier terms are required. Each confirmed order records one wallet debit and a durable supplier request key. The scheduled worker checks pending orders and refreshes the catalog. A retry reuses the same supplier request. Uncertain outcomes are reviewed; confirmed supplier refunds return the original debit once. Delivered codes are available to the order owner in طلباتي.

The catalog connection was verified with supplier GET requests. Mock engine tests and database transactions rolled back after testing duplicate requests, delivery visibility, and refunds. No paid supplier order was placed during validation.
