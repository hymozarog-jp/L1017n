# Libya Cards bridge — SAFE SCAFFOLD (not live yet)

This is a **separate server-to-server bridge**, not a browser integration. It keeps
the public website at https://hymozarog-jp.github.io/L1017n/ unchanged and avoids
placing merchant credentials in public JavaScript. Nothing here has been deployed.

## Why separate VPS?

Libya Cards support requested a **fixed outbound IPv4 address** to allowlist.
GitHub Pages has no private backend with a fixed outbound IP. Railway's static
outbound IPs require the Pro plan. A small VPS with a dedicated public IPv4
should be enough for this bridge.

## Preconditions

1. Obtain Libya Cards' *actual* API docs in the merchant account and note:
   API base URL, authorization header/scheme, list-products route, create-order
   route and order-status route. **Do not assume another similar-looking company
   or domain has the same API**.
2. Rent a VPS with a dedicated/static outbound IPv4. Its IP must stay unchanged.
   Confirm the outbound IP from the VPS with `curl -4 https://api.ipify.org`.
3. Send **that outgoing IPv4 only** to Libya Cards support for allowlisting.
   Do not confuse the domain, the customer's IP or your GitHub Pages host with it.
4. Deploy this app **behind an HTTPS reverse proxy** and restrict traffic to the
   trusted backend; allow only SSH and HTTPS inbound, configure firewall and updates.
5. Set all environment variables on the server, NOT in GitHub or the site.
   Copy `.env.example` as a reference; never commit a filled .env.
6. Run `npm start` using Node.js >=20 under systemd/container restart policy.
   `GET /healthz` responds with a safe health check.

## Server-to-server API (the browser must NEVER call it)

* `GET /internal/products`: fetch products (supplier path still required).
* `GET /internal/orders/:id`: read order status (supplier path still required).
* `POST /internal/orders`: submit an order. Disabled unless
  `LIBYACARD_ENABLE_ORDERS=true` and the caller provides an
  `Idempotency-Key` request header.

All `/internal/*` calls require `X-Bridge-Secret` with
`BRIDGE_SHARED_SECRET` (32+ random characters). This shared secret belongs
ONLY in your trusted backend, not in browser JavaScript or localStorage.
No CORS permissions are exposed.

**CRITICAL:** This bridge does NOT authenticate end customers, check payment,
reserve wallet funds, or prevent someone with the bridge secret from creating
an expensive order. Do not enable `LIBYACARD_ENABLE_ORDERS` or give the
secret to a frontend. First add a trusted order processor that verifies each
paid, unfulfilled order from the database and enforces price, inventory,
eligibility and a stable idempotency key. Test with supplier sandbox first.

The merchant's actual endpoint names and auth scheme must be filled in after
their API documentation is available. This file is NOT proof of a live
Libya Cards connection, whitelisted IP, purchased VPS or completed order.

## Development

```sh
cd integrations/libyacard-bridge
npm test
npm start
```
