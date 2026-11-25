// Service worker: guarda la app para que abra y funcione sin internet.
// Cambiá VERSION cada vez que publiques cambios, así los dispositivos descargan la versión nueva.

const VERSION = 'gondola-v2';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/datos.js',
  './js/logica.js',
  './js/ui.js',
  './js/demo.js',
  './js/vistas/ajustes.js',
  './js/vistas/bienvenida.js',
  './js/vistas/escaner.js',
  './js/vistas/hoy.js',
  './js/vistas/producto.js',
  './js/vistas/productos.js',
  './js/vistas/reponer.js',
  './js/vistas/stock-rapido.js',
  './js/vistas/vender.js',
  './js/vistas/ventas.js',
  './fonts/inter-display-semibold.woff',
  './fonts/inter-regular.woff',
  './fonts/inter-medium.woff',
  './fonts/inter-semibold.woff',
  './assets/icono.svg',
  './assets/icono-192.png',
  './assets/icono-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Primero la copia guardada (abre al instante y sin conexión); en segundo plano, se actualiza desde la red.
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  evento.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const guardada = await cache.match(request, { ignoreSearch: true });
      const red = fetch(request)
        .then((respuesta) => {
          if (respuesta.ok) cache.put(request, respuesta.clone());
          return respuesta;
        })
        .catch(() => guardada);
      return guardada ?? red;
    }),
  );
});
