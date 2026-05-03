const CACHE_NAME = "zyqen-store-cache-v1";
const RUNTIME_CACHE = "zyqen-store-runtime-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css?v=29",
  "./script.js?v=29",
  "./firebase.js",
  "./imagens/logo/logo.png",
  "./imagens/logo/favicon.png",
  "./imagens/icons/icon-192.png",
  "./imagens/icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .catch(function (error) {
        console.warn("Alguns arquivos não foram salvos no cache inicial:", error);
      })
  );

  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }

          return null;
        })
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const responseClone = response.clone();

          caches.open(RUNTIME_CACHE).then(function (cache) {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(function () {
          return caches.match("./index.html").then(function (cachedPage) {
            return cachedPage || caches.match("./");
          });
        })
    );

    return;
  }

  const ehArquivoEstatico =
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico");

  if (ehArquivoEstatico) {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(function (networkResponse) {
          const responseClone = networkResponse.clone();

          caches.open(RUNTIME_CACHE).then(function (cache) {
            cache.put(request, responseClone);
          });

          return networkResponse;
        });
      })
    );
  }
});