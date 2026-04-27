// Push notification handler — imported by the generated service worker
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'RMS Portal';
  const options = {
    body: data.body ?? 'You have a new update.',
    icon: '/CSS_Favicon.png',
    badge: '/CSS_Favicon.png',
    tag: data.tag ?? 'rms-update',
    data: { url: data.url ?? '/' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});
