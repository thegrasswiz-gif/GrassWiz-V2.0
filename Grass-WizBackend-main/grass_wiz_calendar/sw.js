// Tech Portal service worker — makes tech.html installable and able to open
// offline. Scope covers the whole site, so it ONLY intercepts the portal's
// own shell files and versioned CDN assets; every other request (the office
// app, Supabase API calls) passes straight through untouched.
const CACHE = 'gw-tech-v1';

const SHELL = [
    'tech.html',
    'js/tech-portal.js',
    'js/supabase-client.js',
    'js/utils.js',
    'js/auth.js',
    'js/db.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/apple-touch-icon.png',
];

const CDN_HOSTS = new Set([
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
]);

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    const path = url.pathname.replace(/^\//, '');

    if (url.origin === self.location.origin && SHELL.includes(path)) {
        // Our files: network-first so updates deploy instantly, cache as offline fallback
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
    } else if (CDN_HOSTS.has(url.host)) {
        // Versioned CDN assets: cache-first
        e.respondWith(
            caches.match(e.request).then(hit =>
                hit || fetch(e.request).then(res => {
                    if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    return res;
                })
            )
        );
    }
    // Everything else (office app, api.supabase.co, etc.): no respondWith, browser handles it
});
