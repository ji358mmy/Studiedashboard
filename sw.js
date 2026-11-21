/*
 * Service worker: zorgt dat het dashboard ook zonder internet opent
 * (alleen actief als de app via een webadres draait, zoals op de iPhone).
 * Verhoog VERSION na elke wijziging, dan haalt de app de nieuwe bestanden op.
 */
'use strict';
var VERSION = 'studiedashboard-v5';
var FILES = [
  './',
  'index.html',
  'Studiedashboard.html',
  'manifest.webmanifest',
  'app/core.js',
  'app/app.js',
  'app/lesstof.js',
  'app/styles.css',
  'app/icons/apple-touch-icon.png',
  'app/icons/icon-192.png',
  'app/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Eerst het netwerk (zodat updates binnenkomen), bij geen internet de opgeslagen kopie.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // De deadlinelijst altijd vers ophalen en niet bewaren (anders groeit de opslag bij elke keer openen)
  if (url.pathname.slice(-15) === '/deadlines.json') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok && url.origin === self.location.origin && !url.search) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('Studiedashboard.html');
      });
    })
  );
});
