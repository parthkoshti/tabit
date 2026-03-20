/// <reference types="vite/client" />

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import {
  NavigationRoute,
  registerRoute,
  setCatchHandler,
} from "workbox-routing";
import { dequeue, putBack, remove } from "../lib/offline-queue";
import { getLastCheckTime, setLastCheckTime } from "../lib/periodic-sync-store";

declare let self: ServiceWorkerGlobalScope;

const API_BASE = import.meta.env.VITE_BACKEND_URL
  ? `${import.meta.env.VITE_BACKEND_URL}/v1`
  : "/api";
const PERIODIC_SYNC_TAG = "check-notifications";

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
  return (
    (await caches.match("/offline.html")) ??
    new Response("Offline", { status: 503 })
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

    const actions =
      data.type === "friend_request" || data.type === "tab_invite"
        ? [
            { action: "accept", title: "Accept" },
            { action: "reject", title: "Reject" },
          ]
        : undefined;

    const options: NotificationOptions & {
      renotify?: boolean;
      vibrate?: number[];
    } = {
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
      ...(actions && { actions }),
    };
    return self.registration
      .showNotification(title, options)
      .catch(function (err) {
        console.error("[SW] showNotification failed:", err);
      });
  })();
  event.waitUntil(show);
});

async function processSyncQueue(): Promise<void> {
  let action = await dequeue();
  while (action) {
    const path =
      action.type === "accept_friend_request"
        ? `${API_BASE}/friends/requests/${action.payload.requestId}/accept`
        : action.type === "reject_friend_request"
          ? `${API_BASE}/friends/requests/${action.payload.requestId}/reject`
          : action.type === "accept_tab_invite"
            ? `${API_BASE}/tab-invites/requests/${action.payload.requestId}/accept`
            : `${API_BASE}/tab-invites/requests/${action.payload.requestId}/reject`;

    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await remove(action.id);
      } else {
        await putBack(action);
      }
    } catch {
      await putBack(action);
    }
    action = await dequeue();
  }
}

self.addEventListener("sync", (event: Event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === "sync-notifications") {
    e.waitUntil(processSyncQueue());
  }
});

async function processPeriodicSync(): Promise<void> {
  const lastCheck = await getLastCheckTime();
  const since = lastCheck || Date.now() - 24 * 60 * 60 * 1000;

  try {
    const res = await fetch(`${API_BASE}/notifications/missed?since=${since}`, {
      credentials: "include",
    });
    if (!res.ok) return;

    const data = await res.json();
    if (!data.success) return;

    const friendRequests = data.friendRequests ?? [];
    const tabInvites = data.tabInvites ?? [];

    for (const r of friendRequests) {
      await self.registration.showNotification("New friend request", {
        body: r.fromUserName
          ? `${r.fromUserName} wants to be your friend`
          : "Someone wants to be your friend",
        icon: "/icon-192x192.png",
        tag: `friend_request_${r.id}`,
        data: {
          url: new URL("/friends", self.location.origin).href,
          type: "friend_request",
          requestId: r.id,
        },
      });
    }

    for (const r of tabInvites) {
      await self.registration.showNotification("Tab invite", {
        body: r.fromUserName
          ? `${r.fromUserName} invited you to ${r.tabName}`
          : `You were invited to ${r.tabName}`,
        icon: "/icon-192x192.png",
        tag: `tab_invite_${r.id}`,
        data: {
          url: new URL("/tabs", self.location.origin).href,
          type: "tab_invite",
          requestId: r.id,
        },
      });
    }

    await setLastCheckTime(Date.now());
  } catch {
    // Ignore fetch errors
  }
}

self.addEventListener("periodicsync", (event: Event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === PERIODIC_SYNC_TAG) {
    e.waitUntil(processPeriodicSync());
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const data = event.notification.data ?? {};
  const action = event.action;
  const requestId = data.requestId;

  if (
    requestId &&
    (action === "accept" || action === "reject") &&
    (data.type === "friend_request" || data.type === "tab_invite")
  ) {
    const isFriend = data.type === "friend_request";
    const path = isFriend
      ? `${API_BASE}/friends/requests/${requestId}/${action}`
      : `${API_BASE}/tab-invites/requests/${requestId}/${action}`;
    const queueType =
      data.type === "friend_request"
        ? action === "accept"
          ? "accept_friend_request"
          : "reject_friend_request"
        : action === "accept"
          ? "accept_tab_invite"
          : "reject_tab_invite";

    event.waitUntil(
      (async () => {
        let executed = false;
        if (navigator.onLine) {
          try {
            const res = await fetch(path, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            });
            executed = res.ok;
          } catch {
            // Fall through to queue
          }
        }

        if (!executed) {
          const { enqueue } = await import("../lib/offline-queue");
          await enqueue({
            type: queueType,
            payload: { requestId },
          });
          if ("sync" in self.registration) {
            await (
              self.registration as ServiceWorkerRegistration & {
                sync: { register: (tag: string) => Promise<void> };
              }
            ).sync.register("sync-notifications");
          }
        }

        const title =
          action === "accept" ? "Request accepted" : "Request rejected";
        const body = executed
          ? "Done."
          : "Your response will sync when you're back online.";
        await self.registration.showNotification(title, {
          body,
          icon: "/icon-192x192.png",
          tag: "action-feedback",
        });

        const url = data.url || new URL("/friends", self.location.origin).href;
        const targetUrl = url.startsWith("http")
          ? url
          : new URL(url, self.location.origin).href;
        const clientList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            await client.navigate(targetUrl);
            await client.focus();
            return;
          }
        }
        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
      })(),
    );
    return;
  }

  const url = data.url || new URL("/friends", self.location.origin).href;
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
