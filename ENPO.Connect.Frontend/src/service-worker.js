const LOG_PREFIX = '[Connect SW]';

self.addEventListener('install', () => {
  console.log(`${LOG_PREFIX} installed`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`${LOG_PREFIX} activated`);
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_error) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'Test Push';
  const options = {
    body: payload.body || 'Push received successfully',
    icon: payload.icon || 'assets/imges/Online.jpg',
    badge: payload.badge || payload.icon || 'assets/imges/Online.jpg',
    data: payload.data || {}
  };

  console.log(`${LOG_PREFIX} push event received`, payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') {
    return;
  }

  const payload = event.data.payload || {};
  const title = payload.title || 'Connect Notification';
  const options = {
    body: payload.body || 'You have a new notification',
    icon: payload.icon || 'assets/imges/Corresponding.png',
    badge: payload.badge || payload.icon || 'assets/imges/Corresponding.png',
    tag: payload.tag,
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
    data: payload.data || {}
  };

  console.log(`${LOG_PREFIX} message event handled`, payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (typeof client.focus === 'function') {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
