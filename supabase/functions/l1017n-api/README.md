# L1017n Supplier API

POST `/functions/v1/l1017n-api` with JSON and `Authorization: Bearer <account API key>`.
Account owners create/revoke their key through `public.my_reseller_api` using their
normal Supabase Auth session. One live key per account; raw key shown once.

## Operations

- `products`: current published catalog, retail prices, delivery type, availability.
- `balance`: account's Libyana wallet in LYD.
- `quote` + `product_id`: fields and accepted price; digital products also return
  `quote_id` and `expires_at` after checking the upstream product live.
- `purchase` + `product_id`, `request_id` (UUID), `expected_price`,
  `accepted_terms: true`, `fields`; digital orders additionally need `quote_id`.
- `order` + `order_id`: only API orders belonging to this account; delivered codes
  are returned only after completion.

IDs are `local_<UUID>` and `digital_<32 hex>`. Each call buys one advertised pack
or one item. For local fulfillment, fields are `{ "username": "PlayerName" }`.
For digital fulfillment, follow the field schema from the quote.
Use the SAME request UUID and payload for uncertain retries. A new UUID means a
new purchase. Current prices are retail store prices; no wholesale discount is
implied. Existing upstream pending-order limits and refund rules remain in force.

## Security and fulfillment

- `verify_jwt=false` is intentional for external API credentials, not anonymous
  access: the handler requires a 256-bit account key and the service-only SQL
  dispatcher verifies its SHA-256 hash and owner on every operation.
- `private.reseller_api_keys` and `private.reseller_api_orders` have RLS enabled,
  no client table grants, and no client policies. Keys never appear in logs,
  URLs, lists, browser storage, or source code.
- The authenticated key-management RPC is SECURITY DEFINER intentionally; it
  checks `auth.uid()`, a nonanonymous, nondeleted, nonbanned user and filters every
  operation by that owner. The DB advisor's private-table/no-policy INFO and
  authenticated-definer warning are expected for these restricted interfaces.
  See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Revocation is checked again in the purchase transaction. Row locking,
  account-level serialization, immutable request data, and existing atomic
  wallet checkout prevent duplicate charges on retries.
- 60 authenticated requests/minute/account and 10 new API purchase requests/minute.
- No account identity supplied by the caller is trusted. Keys cannot change
  wallet balances or examine another account's orders.
- The digital worker and supplier validation helpers are copied from deployed
  `l1017n-omnex` v15. Update these deliberately when changing the upstream API.
  New digital jobs use the existing leased worker and recurring reconciliation.
- Manual orders enter existing order management. This endpoint does not bypass
  stock, saved-phone, balance, price, or fulfillment checks.
- No new price markup, provider credentials or webhooks are configured here.

## Verification

`node --test tests/reseller-api.test.mjs` covers HTTP auth, malformed/oversized
requests, caller-identity rejection, origin/method restrictions, errors, purchase
consent and retail quote output.

`supabase/supplier-api-checks.sql` runs transaction-scoped fixtures and ROLLS BACK:
owner-isolated management, one-time key visibility, revoked keys, request limits,
catalog/balance/quotes, local debit/replay/price conflict, cross-account order
access, and digital reservation. It never sends an upstream purchase request.

Mobile UI was checked with a local mock account and fake key. Live HTTP checks
confirmed GET=405 and invalid/missing keys=401. No customer balance was spent;
real paid fulfillment was not exercised during verification.
