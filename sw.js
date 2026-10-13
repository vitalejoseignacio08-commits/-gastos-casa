'use strict';

// Subir este número fuerza a los dispositivos a descartar la cache vieja
// y volver a descargar todos los archivos la próxima vez que abran la app.
const CACHE_VERSION = 'v6';
const NOMBRE_CACHE = 'mis-gastos-' + CACHE_VERSION;

const ARCHIVOS_PARA_CACHEAR = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(ARCHIVOS_PARA_CACHEAR))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre.startsWith('mis-gastos-') && nombre !== NOMBRE_CACHE)
            .map((nombre) => caches.delete(nombre))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  if (!evento.request.url.startsWith('http')) return; // ignora chrome-extension:// y similares

  evento.respondWith(
    caches.match(evento.request).then((respuestaCacheada) => {
      if (respuestaCacheada) return respuestaCacheada;

      return fetch(evento.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.ok) {
            const copia = respuestaRed.clone();
            caches.open(NOMBRE_CACHE).then((cache) => cache.put(evento.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
