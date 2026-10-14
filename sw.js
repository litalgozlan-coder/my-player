/* Service worker מינימלי: נדרש כדי שכרום יציע התקנה כאפליקציה. לא שומר עותקים של הדף. */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => new Response('אין חיבור לאינטרנט כרגע', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});
