const CACHE_NAME = 'educo-shell-v4';
const APP_SHELL = [
  '/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

const isCacheable = (response) => response && (response.ok || response.type === 'opaque');

async function cacheCurrentBuild() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch('/', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Application shell unavailable (${response.status})`);

  await cache.put('/', response.clone());
  await cache.put('/index.html', response.clone());
  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((asset) => asset.startsWith('/assets/') || asset === '/index.css');
  const urls = [...new Set([...APP_SHELL, ...assetPaths])];

  await Promise.allSettled(urls.map(async (url) => {
    const assetResponse = await fetch(url, { cache: 'no-store' });
    if (isCacheable(assetResponse)) await cache.put(url, assetResponse);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheCurrentBuild().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('educo-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = event.request.mode === 'navigate' ? '/' : event.request;
    const cached = await cache.match(cacheKey);

    if (cached) {
      event.waitUntil(fetch(event.request).then(async (response) => {
        if (isCacheable(response)) await cache.put(cacheKey, response.clone());
      }).catch(() => undefined));
      return cached;
    }

    try {
      const response = await fetch(event.request);
      if (isCacheable(response)) await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') return (await cache.match('/')) || Response.error();
      throw error;
    }
  })());
});
