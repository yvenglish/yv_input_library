const CACHE_NAME = 'yv-input-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/data.js',
  '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Ignore API calls so we don't cache database responses
  if (event.request.url.includes('/api/')) return;
  // Ignore media files (mp3/mp4)
  if (event.request.url.endsWith('.mp3') || event.request.url.endsWith('.mp4')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse; // Return from cache
      }
      return fetch(event.request); // Fetch from network
    })
  );
});
