/*
 * Journs service worker — push notifications only.
 *
 * Deliberately has no `fetch` handler: no journal data is ever stored locally
 * (entries are refetched and decrypted into memory each session), so there is
 * nothing to cache and an offline shell would only serve a dead login screen.
 *
 * Plain JS on purpose — Vite copies public/ verbatim, so this file ships as-is
 * with no build step. Payloads are always generic copy; the server is E2EE-blind
 * and can never see entry content.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let body = 'Time to log.';
  let hour = 0;

  // Browsers may deliver a payload-less wake-up; an uncaught throw here would
  // fail the whole event and show the generic "site updated in background".
  try {
    const data = event.data.json();
    body = data.body || body;
    hour = data.hour || 0;
  } catch {
    /* keep the fallback copy */
  }

  event.waitUntil(
    self.registration.showNotification('JOURNS', {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `journs-reminder-${hour}`, // same slot replaces, never stacks
      data: { url: '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);

      if (open) {
        return open.focus();
      }

      return self.clients.openWindow('/');
    })(),
  );
});
