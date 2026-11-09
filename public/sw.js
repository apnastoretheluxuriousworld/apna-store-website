/*
 * Service worker: native notifications for the admin (web push).
 * No offline caching: every request still goes to the network as before.
 * Served with no-cache headers (next.config.ts) so updates reach phones at once.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Apna Store";
  const href = data.href || "/admin/notifications";
  event.waitUntil(
    Promise.all([
      // Always show one: iOS/Chrome cancel the subscription after silent pushes.
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/brand/icon-192.png",
        badge: "/brand/badge-96.png",
        tag: data.tag || href,
        renotify: true, // same tag (e.g. one chat) still buzzes for each new message
        timestamp: Date.now(),
        data: { href },
      }),
      // Dot on the home-screen icon (where supported); the app clears it once all are read.
      self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null,
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.href || "/admin/notifications", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open admin window if there is one.
      const admin = windows.find((w) => new URL(w.url).pathname.startsWith("/admin"));
      if (admin) {
        await admin.focus();
        if ("navigate" in admin) {
          try {
            await admin.navigate(url);
            return;
          } catch {
            /* not controlled by this worker yet: open a new one below */
          }
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
