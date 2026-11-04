import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createHandler } from './server.mjs';

test('bridge is private and purchase creation is disabled by default', async () => {
  const oldSecret = process.env.BRIDGE_SHARED_SECRET;
  const oldOrders = process.env.LIBYACARD_ENABLE_ORDERS;
  process.env.BRIDGE_SHARED_SECRET = 'test-secret-for-internal-server-access-123456';
  process.env.LIBYACARD_ENABLE_ORDERS = 'false';
  const server = http.createServer(createHandler());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const health = await fetch(base + '/healthz');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const unauth = await fetch(base + '/internal/products');
    assert.equal(unauth.status, 401);
    assert.equal((await unauth.json()).error, 'unauthorized');

    const orders = await fetch(base + '/internal/orders', {
      method: 'POST',
      headers: { 'x-bridge-secret': process.env.BRIDGE_SHARED_SECRET },
    });
    assert.equal(orders.status, 403);
    assert.equal((await orders.json()).error, 'ordering_disabled');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (oldSecret === undefined) delete process.env.BRIDGE_SHARED_SECRET;
    else process.env.BRIDGE_SHARED_SECRET = oldSecret;
    if (oldOrders === undefined) delete process.env.LIBYACARD_ENABLE_ORDERS;
    else process.env.LIBYACARD_ENABLE_ORDERS = oldOrders;
  }
});
