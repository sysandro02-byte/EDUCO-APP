const CACHE_NAME = 'educo-shell-v6';
const APP_SHELL = [
  '/', '/index.html', '/manifest.json', '/educo-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

const isCacheable = (response) => response && (response.ok || response.type === 'opaque');
const isShellUrl = (url) => APP_SHELL.some((shellUrl) =>
  new URL(shellUrl, self.location.origin).href === url
);

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
    const request = url.startsWith('/')
      ? new Request(url, { cache: 'no-store' })
      : new Request(url, { mode: 'no-cors', cache: 'no-store' });
    const assetResponse = await fetch(request);
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

  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.origin !== self.location.origin && !isShellUrl(url.href)) return;
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = event.request.mode === 'navigate' ? '/' : event.request;
    const cached = await cache.match(cacheKey);

    // Prefer the current deployment whenever the network is available. This
    // prevents an installed PWA from showing an old shell after a deployment.
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (isCacheable(response)) await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      if (event.request.mode === 'navigate') return (await cache.match('/')) || Response.error();
      throw error;
    }
  })());
});
