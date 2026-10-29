# Mandatory SMS verification before any purchase — L1017N

**Business rule:** a logged-in customer can purchase Robux or immediately fulfilled
digital codes only after their saved phone has been verified by the Resala SMS OTP
backend. Merely typing and saving a number is not sufficient.

## Server enforcement

The existing `check_saved_phone_before_customer_purchase` BEFORE INSERT trigger
on `public.purchase_orders` calls
`public.require_saved_phone_for_customer_purchase()`. The migration
`20261029_require_resala_sms_before_purchase.sql` updates this function to
require `wallet_accounts.libyana_phone` to match
`resala_otp_sessions.verified_phone` with non-null `verified_at`.
Failure raises `phone_verification_required_before_purchase`.

Both `create_purchase_order` (Robux) and `buy_instant_code` (digital codes)
insert purchase orders in the same Postgres transaction as wallet debit and
inventory/stock allocation; throwing an exception rolls back the whole
transaction. Backend administrative operations with no end-user auth context
retain their existing behavior.

## Customer experience

`ensurePurchasePhone()` now checks the server-side `status` action on the
protected `l1017n-resala-otp` Supabase Edge Function on **each checkout**.
It never trusts localStorage or a front-end flag.
When there is no registered phone, customers can register one but must still
complete SMS verification. When the number is saved but not verified, the
purchase modal closes, the account page opens, and they are told to request
their SMS code and return to purchase. If the OTP service is unavailable,
checkout fails closed.

Existing Google and email/password login, wallet top-ups, previous orders,
and administration are not changed. SMS verification is a one-time operation
for the currently saved number; any mismatch with the verified phone requires
verification again.

## Verification checklist

- Verified customer: the `status` endpoint reports `verified: true`;
  they can proceed through checkout as normal.
- Unverified customer: checkout opens the account verification screen and
  does not call a purchase RPC.
- Direct RPC call bypassing the website: trigger rejects unverified purchase
  and wallet/stock updates are rolled back.
- Network failure when querying the OTP status: purchase blocked.
- Phone changed or missing: verification no longer matches and purchases are blocked.

The Resala API secret remains only in Supabase Edge Function Secrets.
