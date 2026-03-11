// __CACHE_BUSTER__ is replaced at build time with VITE_QUERY_CACHE_BUSTER (default: v1)
self.addEventListener("install", function (event) {
  console.log("[SW] Installing new service worker");
  event.waitUntil(
    caches.open("tabit-static-__CACHE_BUSTER__").then(function (cache) {
      return cache.addAll(["/", "/favicon.ico"]);
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
          : data.type === "poke"
            ? "Poke them back!"
            : "You have a new notification");
    const url =
      decl?.navigate ||
      data.url ||
      new URL(
        data.type === "tab_invite" ? "/tabs" : "/friends",
        self.location.origin,
      ).href;
    const tag =
      data.type === "friend_request"
        ? "friend_request"
        : data.type === "tab_invite"
          ? "tab_invite"
          : data.type === "poke"
            ? "poke"
            : "default";
    const options = {
      body,
      icon: "/icon-192x192.png",
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
      requireInteraction:
        data.type === "friend_request" ||
        data.type === "tab_invite" ||
        data.type === "poke",
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
    event.notification.data?.url ||
    new URL("/friends", self.location.origin).href;
  const targetUrl = url.startsWith("http") ? url : new URL(url, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return Promise.resolve();
      }),
  );
});
