/* Junior Codex — offline-first service worker (app shell only).
   Firebase API calls (firestore.googleapis.com, *.googleapis.com) always
   bypass the cache and go straight to the network. */
const CACHE = 'junior-codex-v1';
const CORE = [
  './',
  'index.html',
  'admin.html',
  '404.html',
  'styles.css',
  'app.js',
  'admin.js',
  'firebase.js',
  'firebase-config.js',
  'data.js',
  'manifest.json',
  'logo.png',
  'logo1.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const BYPASS = /(firestore\.googleapis\.com|googleapis\.com|gstatic\.com|firebaseio\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com)/;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (BYPASS.test(url.hostname)) return; // live Firebase traffic: network only
  if (url.origin !== self.location.origin) return; // CDN fonts etc: leave alone

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(request)))
  );
});
