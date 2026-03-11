// v1 is replaced at build time with VITE_QUERY_CACHE_BUSTER (default: v1)
self.addEventListener("install", function (event) {
  console.log("[SW] Installing new service worker");
  event.waitUntil(
    caches.open("tabit-static-v1").then(function (cache) {
      return cache.addAll(["/"]);
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("[SW] Service worker activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request).then(function (cached) {
        return (
          cached ||
          new Response("Offline - please check your connection", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        );
      });
    }),
  );
});

self.addEventListener("push", function (event) {
  const show = (function () {
    if (!event.data) return Promise.resolve();
    let data;
    try {
      data = event.data.json();
    } catch {
      return Promise.resolve();
    }
    const decl = data.notification;
    const title = decl?.title || data.title || "New notification";
    const body =
      decl?.body ||
      data.body ||
      (data.type === "friend_request"
        ? "New friend request"
        : data.type === "tab_invite"
          ? "New tab invite"
          : "You have a new notification");
    const url =
      decl?.navigate ||
      data.url ||
      new URL(
        data.type === "tab_invite" ? "/tabs" : "/friends",
        self.location.origin,
      ).href;
    const options = {
      body,
      icon: "/icon-192x192.png",
      tag:
        data.type === "friend_request"
          ? "friend_request"
          : data.type === "tab_invite"
            ? "tab_invite"
            : "default",
      renotify: true,
      data: { url, ...data },
    };
    return self.registration
      .showNotification(title, options)
      .catch(function (err) {
        console.error("[SW] showNotification failed:", err);
      });
  })();
  event.waitUntil(show);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url =
    event.notification.data?.url || new URL("/tabs", self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
