# Resala SMS — phone ownership verification in L1017N

This integration confirms the saved customer's Libyan phone number **after sign-in**. It does not replace Supabase's existing email/password/Google login, and it does **not** approve automatic wallet top-ups.

## What was prepared

- Public website: `resala-otp.js` is loaded by `index.html` and displayed inside the account page after `renderAccount`.
- Backend: `supabase/functions/l1017n-resala-otp/index.ts`, calls the Resala `POST /api/v1/pins` API.
- Database: the `resala_phone_otp_verification` migration creates `public.resala_otp_sessions` and service-role-only RPCs `resala_otp_reserve` and `resala_otp_check`.
- Security: phone comes from the **authenticated user's** `wallet_accounts.libyana_phone`, not request parameters. 6-digit PINs are HMAC-hashed and stored for 5 minutes, max 5 attempts, one SMS every 60 seconds, 4/hour and 10/day per user. OTP never appears in client responses or logs. There are no public RLS policies on the OTP table.
- The account page hides the verification widget until the provider secret is configured and the backend is reachable. Existing login and purchasing continue unchanged.

## Required private setup

1. Open **Supabase Dashboard → L1017n-store → Edge Functions → Secrets**:
   https://supabase.com/dashboard/project/cmtxsjlehjworqypbxjz/functions
2. Add `RESALA_API_KEY` with the actual key from **Resala Dashboard → الربط البرمجي**. Do **not** paste the key into ChatGPT, HTML, JavaScript, or GitHub.
3. Deploy the Edge Function `l1017n-resala-otp` from `supabase/functions/l1017n-resala-otp/index.ts`, with **Verify JWT enabled**.
4. Merge the website branch and publish the GitHub Pages site.
5. Test with a genuine signed-in customer: set your phone under the account page, send a code, receive a Resala SMS, enter the code, confirm the "رقم الهاتف موثّق" message.
6. Confirm that a wrong PIN is rejected, expires after 5 minutes, and resend limits work. Check Resala balance, subscription validity, and sender name if the provider rejects the request.

Resala endpoint: `https://dev.resala.ly/api/v1/pins?service_name=L1017N&len=6`.
The Resala document says it returns a PIN and places verification responsibility on the caller's server.

### Note about deployment

The database migration was applied to the existing Supabase project. The backend deployment must be verified separately; source committed in GitHub is not the same as a deployed function. No secret was configured by this integration.

### Scope and trust

SMS delivery only verifies access to a telephone number at that moment. It is not proof of a legitimate Libyana wallet transfer and must not automatically approve wallet balances.
