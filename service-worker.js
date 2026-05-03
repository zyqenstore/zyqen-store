const CACHE_NAME = "zyqen-store-cache-v3";
const RUNTIME_CACHE = "zyqen-store-runtime-v3";

const BASE = "/zyqen-store/";

const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.json",
  BASE + "style.css?v=29",
  BASE + "script.js?v=29",
  BASE + "firebase.js",

  BASE + "imagens/logo/logo.png",
  BASE + "imagens/logo/favicon.png",

  BASE + "imagens/icons/icon11.png",
  BASE + "imagens/icons/icon12.png",
  BASE + "imagens/icons/icon13.png",

  BASE + "imagens/icones/search.svg",
  BASE + "imagens/icones/flame.svg",
  BASE + "imagens/icones/star.svg",
  BASE + "imagens/icones/share-2.svg",
  BASE + "imagens/icones/arrow-left.svg",
  BASE + "imagens/icones/message-square.svg",

  BASE + "imagens/redes/instagram.jpg",
  BASE + "imagens/redes/whatsapp.jpg"
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

  if (!url.pathname.startsWith(BASE)) {
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
          return caches.match(BASE + "index.html").then(function (cachedPage) {
            return cachedPage || caches.match(BASE);
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
      fetch(request)
        .then(function (networkResponse) {
          const responseClone = networkResponse.clone();

          caches.open(RUNTIME_CACHE).then(function (cache) {
            cache.put(request, responseClone);
          });

          return networkResponse;
        })
        .catch(function () {
          return caches.match(request);
        })
    );
  }
});