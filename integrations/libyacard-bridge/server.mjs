/**
 * L1017n <-> Libya Cards: server-to-server only.
 *
 * DO NOT invoke these endpoints directly from GitHub Pages. The bridge secret
 * is for a trusted backend (e.g. a verified order worker), never a browser.
 * Purchase creation is DISABLED by default and requires a trusted payment check
 * in the calling backend. This service does NOT verify payments.
 *
 * Vendor API paths/auth scheme are unknown until their official docs are supplied.
 */
import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';

const env = process.env;
const maxBody = 32 * 1024;
const PORT = Number(env.PORT || 8080);

function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function validSecret(input) {
  const secret = env.BRIDGE_SHARED_SECRET || '';
  if (secret.length < 32 || !input || typeof input !== 'string') return false;
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}
function getVendorOrigin() {
  const input = env.LIBYACARD_API_BASE_URL;
  if (!input) throw new Error('supplier_not_configured');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('invalid_supplier_origin');
  }
  return url;
}
function supplierPath(path) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[?#\\]/.test(path)) {
    throw new Error('supplier_route_not_configured');
  }
  const sections = path.split('/');
  if (sections.includes('..') || sections.includes('.')) throw new Error('invalid_supplier_path');
  return path;
}
function vendorUrl(path) {
  const base = getVendorOrigin();
  const route = supplierPath(path);
  return new URL(route, base);
}
async function readBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('json_required');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBody) throw new Error('body_too_large');
  }
  const parsed = JSON.parse(body);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid_json_body');
  return parsed;
}
async function supplierRequest(method, path, body, idempotencyKey) {
  const url = vendorUrl(path);
  const token = env.LIBYACARD_API_TOKEN;
  if (!token) throw new Error('supplier_token_not_configured');
  const headerName = env.LIBYACARD_AUTH_HEADER || 'Authorization';
  if (!['Authorization', 'X-API-Key'].includes(headerName)) throw new Error('invalid_auth_header');
  const prefix = env.LIBYACARD_AUTH_PREFIX ?? 'Bearer';
  const headers = { Accept:'application/json' };
  headers[headerName] = prefix && headerName === 'Authorization' ? `${prefix} ${token}` : token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(url, {
    method, headers, redirect: 'error', signal: AbortSignal.timeout(12000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  // Only return structured JSON from supplier; never reflect arbitrary HTML.
  if (!contentType.includes('application/json')) throw new Error('supplier_non_json_response');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('supplier_invalid_json'); }
  return { status: response.status, data };
}
export function createHandler() {
  return async (req,res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method === 'GET' && pathname === '/healthz') {
      reply(res, 200, { ok: true, service: 'l1017n-libyacard-bridge' }); return;
    }
    if (!validSecret(req.headers['x-bridge-secret'])) {
      reply(res, 401, { error:'unauthorized' }); return;
    }
    try {
      let result;
      if (req.method === 'GET' && pathname === '/internal/products') {
        result = await supplierRequest('GET', env.LIBYACARD_PRODUCTS_PATH);
      } else if (req.method === 'POST' && pathname === '/internal/orders') {
        if (env.LIBYACARD_ENABLE_ORDERS !== 'true') {
          reply(res, 403, { error:'ordering_disabled' }); return;
        }
        const key = req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
          reply(res, 400, { error:'idempotency_key_required' }); return;
        }
        const payload = await readBody(req);
        // CALLER MUST authenticate the customer and verify payment server-side.
        result = await supplierRequest('POST', env.LIBYACARD_CREATE_ORDER_PATH, payload, key);
      } else if (req.method === 'GET' && /^\/internal\/orders\/[a-zA-Z0-9_-]{1,80}$/.test(pathname)) {
        const id = pathname.split('/').pop();
        const template = env.LIBYACARD_ORDER_STATUS_PATH_TEMPLATE || '';
        if (!template.includes('{id}')) throw new Error('supplier_route_not_configured');
        result = await supplierRequest('GET', template.replace('{id}', encodeURIComponent(id)));
      } else {
        reply(res, 404, { error:'not_found' }); return;
      }
      reply(res, result.status, result.data);
    } catch (err) {
      const known = new Set(['supplier_not_configured','invalid_supplier_origin','supplier_route_not_configured','invalid_supplier_path','supplier_token_not_configured','invalid_auth_header','json_required','body_too_large','invalid_json_body','supplier_non_json_response','supplier_invalid_json']);
      const code = err instanceof SyntaxError ? 'invalid_json_body' : known.has(err?.message) ? err.message : 'upstream_unavailable';
      const status = ['json_required','body_too_large','invalid_json_body'].includes(code) ? 400 : code === 'upstream_unavailable' ? 502 : 503;
      reply(res, status, { error: code });
    }
  };
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('invalid_PORT');
  if ((env.BRIDGE_SHARED_SECRET || '').length < 32) throw new Error('Set BRIDGE_SHARED_SECRET (32+ chars) before starting');
  const server = http.createServer(createHandler());
  server.listen(PORT, '0.0.0.0', () => console.log('Libya Cards bridge listening on port', PORT));
}
