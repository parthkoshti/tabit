self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open("tabit-static-v1").then(function (cache) {
      return cache.addAll(["/"]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request);
    })
  );
});
