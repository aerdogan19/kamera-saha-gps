/* Saha GPS service worker: sürümlü önbellek, cache-first, yalnız kendi dosyaları.
   Sürümün TEK kaynağı mantik.js içindeki UYGULAMA_SURUMU'dur; elle ikinci bir sürüm tutulmaz. */
importScripts('mantik.js');

var SURUM = 'saha-gps-' + self.SahaMantik.UYGULAMA_SURUMU;
var DOSYALAR = [
  './', 'index.html', 'style.css', 'mantik.js', 'depo.js', 'app.js',
  'manifest.webmanifest', 'ikon-192.png', 'ikon-512.png'
];

self.addEventListener('install', function (e) {
  // cache: 'reload' -> tarayıcının HTTP önbelleğindeki eski dosyalar yeni önbelleğe girmesin
  e.waitUntil(caches.open(SURUM).then(function (c) {
    return c.addAll(DOSYALAR.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (anahtarlar) {
    return Promise.all(anahtarlar.filter(function (k) { return k !== SURUM; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var istek = e.request;
  if (istek.method !== 'GET') return;
  var url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(istek).then(function (hit) {
    if (hit) return hit;
    return fetch(istek).then(function (yanit) {
      if (yanit && yanit.ok && yanit.type === 'basic' && url.pathname.indexOf('/test/') === -1) {
        var kopya = yanit.clone();
        caches.open(SURUM).then(function (c) { c.put(istek, kopya); });
      }
      return yanit;
    });
  }));
});
