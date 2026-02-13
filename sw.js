const CACHE_NAME = 'slip-track-v6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './landing.html',
  './inside.html',
  './privacy.html',
  './terms.html',
  './refund.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg'
];

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

  // HTML: network-first so phones get updates without waiting for SW bump
  if (isHtmlRequest(url.pathname)) {
    event.respondWith(
      fetch(event.request)
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
