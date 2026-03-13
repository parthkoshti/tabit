/// <reference types="vite/client" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { NavigationRoute, registerRoute, setCatchHandler } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const allowlist = import.meta.env.DEV ? [/^\/$/] : undefined;
const handler = createHandlerBoundToURL("/index.html");
registerRoute(new NavigationRoute(handler, { allowlist }));

setCatchHandler(async () => {
  return (await caches.match("/offline.html")) ?? new Response("Offline", { status: 503 });
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
  const targetUrl = url.startsWith("http")
    ? url
    : new URL(url, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            await client.focus();
            return;
          }
        }
        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
      }),
  );
});
