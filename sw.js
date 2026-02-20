const CACHE_NAME = 'slip-track-v74';

/* Don't pre-cache HTML — always fetch fresh on nav so "Inside" and others show latest */
const STATIC_ASSETS = [
  './styles.css?v=74',
  './app.js?v=74',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() =>
      caches.open(CACHE_NAME).then((cache) =>
        cache.keys().then((reqs) =>
          Promise.all(reqs.filter((r) => /config\.js(\?|$)/i.test(new URL(r.url).pathname)).map((r) => cache.delete(r)))
        ).then(() => {})
      ).catch(() => {})
    ).then(() => self.clients.claim())
  );
});

function isAppAsset(pathname) {
  return /\.(html|css|js|json|svg)$/i.test(pathname) ||
    pathname.endsWith('/') ||
    pathname === '' ||
    pathname.endsWith('/index.html');
}

function isHtmlRequest(pathname) {
  return pathname.endsWith('.html') || pathname === '' || pathname === '/' || pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache config.js — PWA must always load fresh Supabase config
  if (/config\.js(\?|$)/i.test(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (!isAppAsset(url.pathname)) return;

  // HTML: always network-first, no pre-cache — nav clicks get latest (no stale Inside)
  if (isHtmlRequest(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CSS, JS, etc.: cache-first (HTML already points to versioned URLs)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const clone = res.clone();
        if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    })
  );
});
