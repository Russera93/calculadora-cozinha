// sw.js — makes the app installable and usable offline.
//
// The site's own files: network first (a new deploy shows up right away,
// no "stuck on an old version"), falling back to the cache when offline.
// Pinned CDN files (the receipt reader, fonts): cache first, in a cache
// kept across app versions since their URLs never change content.
// Bump CACHE when the PRECACHE list changes.

const CACHE = 'calculadora-app-v6';
const CDN_CACHE = 'calculadora-cdn-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// PRECACHE-START (js/sw.test.js checks this list against the files)
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'data/taco.json',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon-maskable.svg',
  'icons/icon.svg',
  'js/app.js',
  'js/calculations.js',
  'js/costing.js',
  'js/format.js',
  'js/ingredient-match.js',
  'js/ingredientes-sugeridos.js',
  'js/ingredients-db.js',
  'js/instalar.js',
  'js/nutrition-table.js',
  'js/ocr.js',
  'js/protecao.js',
  'js/purchase.js',
  'js/receipt-match.js',
  'js/receipt-parser.js',
  'js/results.js',
  'js/router.js',
  'js/screens/ajustes.js',
  'js/screens/editor.js',
  'js/screens/editor/compra-resumo.js',
  'js/screens/editor/custos.js',
  'js/screens/editor/ingrediente-sheet.js',
  'js/screens/editor/ingredientes.js',
  'js/screens/editor/nota-sheet.js',
  'js/screens/editor/nutricao.js',
  'js/screens/editor/preco.js',
  'js/screens/instalar-passos.js',
  'js/screens/lista.js',
  'js/screens/result-bar.js',
  'js/screens/transferir.js',
  'js/session.js',
  'js/share.js',
  'js/storage.js',
  'js/store.js',
  'js/taxas.js',
  'js/taco-database.js',
  'js/taco-loader.js',
  'js/text-utils.js',
  'js/transferencia.js',
  'js/theme.js',
  'js/ui/confirm.js',
  'js/ui/dom.js',
  'js/ui/icons.js',
  'js/ui/menu.js',
  'js/ui/sheet.js',
  'js/ui/sugestoes.js',
  'js/ui/toast.js',
  'js/units.js'
];
// PRECACHE-END

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Any app URL (#/receita/… lives in the hash) opens the app shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Opaque: the Google Fonts stylesheet is loaded without CORS.
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (CDN_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request));
});
