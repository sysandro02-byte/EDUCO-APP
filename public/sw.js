const CACHE_NAME = 'educo-shell-v7';
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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'Vous avez une nouvelle notification EDUCO.' };
  }

  const title = String(payload.title || 'EDUCO');
  const body = String(payload.body || payload.message || 'Vous avez une nouvelle notification EDUCO.');
  const url = typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/';
  const tag = String(payload.tag || `educo-${Date.now()}`);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: 'EDUCO_PUSH_RECEIVED', payload }));

    await self.registration.showNotification(title, {
      body,
      icon: '/educo-icon.png',
      badge: '/educo-icon.png',
      tag,
      renotify: true,
      silent: false,
      timestamp: Number(payload.timestamp || Date.now()),
      data: { url, type: payload.type || 'info' },
      actions: [{ action: 'open', title: 'Ouvrir EDUCO' }],
      vibrate: [180, 80, 180],
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = typeof event.notification.data?.url === 'string'
    && event.notification.data.url.startsWith('/')
    ? event.notification.data.url
    : '/';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client && client.url !== targetUrl) await client.navigate(targetUrl);
        client.postMessage({ type: 'EDUCO_NOTIFICATION_OPENED', url: targetPath });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
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
