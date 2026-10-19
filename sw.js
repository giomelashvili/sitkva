const CACHE = 'sitkva-v8';
const FILES = ['./', './index.html', './styles.css', './app.js', './logic.js', './chiku.js', './manifest.webmanifest', './icon.svg',
  './fonts/noto-sans-georgian-400.woff2', './fonts/noto-sans-georgian-600.woff2', './fonts/noto-sans-georgian-700.woff2', './fonts/noto-sans-georgian-800.woff2', './seed-photos/manifest.json',
  './seed-photos/burti-1.jpg', './seed-photos/manqana-1.jpg', './seed-photos/manqana-2.jpg', './seed-photos/tsigni-1.jpg', './seed-photos/tsigni-2.jpg', './seed-photos/dzaghli-1.jpg', './seed-photos/kata-1.jpg', './seed-photos/kata-2.jpg', './seed-photos/kata-3.jpg', './seed-photos/tsqali-1.jpg', './seed-photos/tsqali-2.jpg', './seed-photos/puri-1.jpg', './seed-photos/puri-2.jpg', './seed-photos/puri-3.jpg', './seed-photos/pekhsatsmeli-1.jpg', './seed-photos/pekhsatsmeli-2.jpg', './seed-photos/pekhsatsmeli-3.jpg', './seed-photos/abano-1.jpg', './seed-photos/abano-2.jpg', './seed-photos/tvali-1.jpg', './seed-photos/tvali-2.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // YouTube, fonts: network only
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match('./index.html'))));
});
