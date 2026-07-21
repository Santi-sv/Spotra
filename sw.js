/* SPOTRA · Service Worker
   - Habilita la instalación como app y las notificaciones push.
   - No cachea nada (la app siempre carga fresca desde el server). */
const VERSION = 'spotra-sw-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'SPOTRA';
  const options = {
    body: data.body || '',
    icon: 'assets/logo/app-icon-192.png',
    badge: 'assets/logo/app-icon-192.png',
    tag: data.tag || 'spotra',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
