// Bullet Journal service worker — offline app shell caching.
// Bump CACHE_VERSION whenever the cached app shell changes.
const CACHE_VERSION = 'bullet-journal-v1';

// Same-origin assets that make up the app shell. Paths are relative so the
// worker keeps working when the app is served from a subpath (e.g. GitHub Pages).
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './images/icons/icon-72x72.png',
    './images/icons/icon-144x144.png',
    './images/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            // Cache best-effort: a single missing asset shouldn't abort install.
            .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Only handle GET; let the browser deal with everything else.
    if (request.method !== 'GET') {
        return;
    }

    // Network-first for page navigations so users get fresh HTML when online,
    // falling back to the cached shell when offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
        );
        return;
    }

    // Cache-first with background refresh (stale-while-revalidate) for other
    // assets, including cross-origin CDN scripts.
    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && (response.ok || response.type === 'opaque')) {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
});
