/* StructaViz service worker: lets the app, the landing page and the tools open with no signal.
   - Pages, CSS and JS: try the network first (so deployed updates show up straight away),
     and fall back to the saved copy when offline or when the network is very slow.
   - Fonts, the PDF library and images: served from the saved copy.
   - The AI Assistant (/api/...) always needs internet and is never saved.
   When you ADD a new page or file, add it to PRECACHE below and change VERSION. */
const VERSION = 'structaviz-v1';

const PRECACHE = [
  '/', '/app', '/hub',
  '/app.css', '/app.js', '/site.webmanifest',
  '/logo-mark.png', '/favicon-96x96.png', '/apple-touch-icon.png', '/web-app-manifest-192x192.png',
  '/fonts/fonts.css',
  '/fonts/space-mono-latin-400-normal.woff2', '/fonts/space-mono-latin-700-normal.woff2', '/fonts/space-mono-latin-400-italic.woff2',
  '/fonts/outfit-latin-wght-normal.woff2', '/fonts/syne-latin-wght-normal.woff2', '/fonts/inter-latin-wght-normal.woff2',
  '/vendor/jspdf.umd.min.js',
  '/tools/structaviz-tools.css', '/tools/structaviz-tools.js',
  '/tools/concrete', '/tools/member-checks', '/tools/soil', '/tools/retaining-wall', '/tools/hydrology',
  '/tools/survey', '/tools/highway', '/tools/earthworks', '/tools/scheduler', '/tools/unit-converter'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // One missing file must not stop the rest from being saved.
    await Promise.allSettled(PRECACHE.map(async u => {
      const r = await fetch(u, { cache: 'reload' });
      if (r.ok) await cache.put(u, r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const stable = /^\/(fonts|vendor)\//.test(url.pathname) || /\.(png|ico|svg|webp|jpe?g|woff2?)$/i.test(url.pathname);
  e.respondWith(stable ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

// "/tools/soil.html" and "/tools/soil" are the same page, "/index.html" is "/".
function alternatives(urlStr) {
  const u = new URL(urlStr);
  const p = u.pathname, out = [];
  if (p.endsWith('/index.html')) out.push(p.slice(0, -'index.html'.length));
  if (p.endsWith('.html')) out.push(p.slice(0, -5));
  if (!p.endsWith('/') && !p.endsWith('.html') && !/\.[a-z0-9]+$/i.test(p)) out.push(p + '.html');
  return out;
}

async function saved(cache, req) {
  let hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  for (const alt of alternatives(req.url)) {
    hit = await cache.match(alt);
    if (hit) return hit;
  }
  return null;
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await saved(cache, req);
  const net = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  if (!hit) {
    try { return await net; } catch (err) { return req.mode === 'navigate' ? offlinePage() : Response.error(); }
  }
  // We have a saved copy: use the network if it answers quickly, otherwise the saved copy.
  return Promise.race([
    net.then(res => (res.status >= 500 ? hit : res)).catch(() => hit),
    new Promise(resolve => setTimeout(() => resolve(hit), 3500))
  ]);
}

function offlinePage() {
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline | StructaViz</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07090d;color:#e2e8f0;font:16px/1.6 system-ui,sans-serif;padding:24px;text-align:center}' +
    'main{max-width:420px}h1{font-size:22px;margin:0 0 8px}p{color:#8a99b2;margin:0 0 20px}a{display:inline-block;margin:4px;padding:10px 18px;border-radius:8px;background:#4fa8ff;color:#071522;font-weight:600;text-decoration:none}' +
    'a.o{background:transparent;color:#e2e8f0;border:1px solid rgba(150,180,220,.3)}</style></head><body><main><h1>You are offline</h1>' +
    '<p>This page has not been saved on your device yet. Open it once while you have internet and it will work offline after that.</p>' +
    '<a href="/app">Open the app</a><a class="o" href="/hub">Tools</a></main></body></html>';
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
