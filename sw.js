// Service Worker — Condominio Bosques del Sur 4
const CACHE_NAME = 'cbs4-v7';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/logo-voucher.js',
  '/core.js',
  '/vistas.js',
  '/vistas2.js',
  '/multas.js',
  '/mantenciones.js',
  '/auditoria.js',
  '/respaldos.js',
  '/proveedores.js',
  '/certificados.js',
  '/novedades.js',
  '/bosques_del_sur_4.png',
  '/icon-192-v2.png',
  '/icon-512-v2.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

// Instalar y cachear recursos
self.addEventListener('install', e => {
  e.waitUntil(
    // Se cachea recurso por recurso: cache.addAll() es todo-o-nada y un solo
    // 404 dejaba la app sin precache (y por lo tanto sin modo offline real).
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(u => cache.add(u).catch(e => {
        console.warn('[SW] no se pudo cachear:', u); throw e;
      })))
    )
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, cache fallback
self.addEventListener('fetch', e => {
  // Firebase y APIs siempre van a la red
  if (e.request.url.includes('firebase') || 
      e.request.url.includes('googleapis') ||
      e.request.url.includes('firebaseio')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
