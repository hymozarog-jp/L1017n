/* L1017n Admin PWA: no caches of credentials, financial data or API responses. */
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
