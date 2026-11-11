# OMNEX — Roblox supplier connection

The connection reads the server-side `OMNEX_API_KEY` secret. The key must never be put in browser assets or committed to Git.

## Available now

- Admin → ربط OMNEX opens the authenticated supplier dashboard.
- The `l1017n-omnex` Edge Function validates the user with Supabase Auth and checks `is_store_admin()` before every operation.
- `status`, `catalog`, and `sync` are the only supported operations. All OMNEX calls are GET requests.
- Only the verified Roblox category `cd40561b622c4fa9ed9984c31f0c697f` is imported. Other supplier categories cannot be imported through the sync RPC.
- Supplier costs and draft sale prices are stored in `private.omnex_roblox_catalog`. Customers cannot read the table or call the privileged sync RPC.
- An administrator can filter products and save individual draft sale prices. The server rejects prices below the current supplier cost; drafts do not activate products.
- Supplier sync preserves saved draft prices. A 30-second refresh interval avoids repeated supplier calls.

## Activation still needed

This is a connected supplier catalog, not an enabled supplier checkout. The owner must choose sale prices or a markup, then review the exact products, regions, delivery types and customer-facing terms before purchasing is implemented and enabled. Current 25/50/100 Robux packs remain on their original fulfillment path; supplier products must not be silently substituted for them.

There is currently no OMNEX purchase call, customer wallet debit, supplier debit, automatic order retry, or supplier delivery processing in this integration. Do not claim automated delivery is active.

When adding checkout later, require fresh product pricing, exact wallet/currency matching, one saved supplier request_key per local purchase, and a durable order ledger. An unknown supplier response must retain the same request body and key on retry, and never create a second local debit. A real supplier purchase requires explicit owner authorization for the test product and spend.

## Validation

- The stored API key authenticated successfully with the supplier catalog and selected product-detail endpoints.
- Initial snapshot on 2026-11-11: 65 Roblox products, 43 marked available by OMNEX. These counts change over time.
- Database rollback tests verified admin-only reads, below-cost rejection, saving a draft, and rejection of non-Roblox imports. No test prices were retained.
- Anonymous requests to the Edge Function return 401. Temporary bootstrap access was removed before committing production source.
- Mobile preview checked the below-cost error, available-product filtering, and no horizontal overflow at a 390px iframe size.
- No paid order was sent to OMNEX.
