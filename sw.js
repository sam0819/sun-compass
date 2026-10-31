// 離線快取：野外沒訊號也要能開。改版時把 VER 往上加一號。
const VER = 'sun-compass-v4';
const FILES = ['./index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const SHELL = new Set(FILES.map(f => new URL(f, self.location).href));
const INDEX = new URL('./index.html', self.location).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨網域（天氣 API）完全不碰，否則回應會被快取住，天氣永遠停在第一次抓到的值。
  if (url.origin !== self.location.origin) return;

  const isNav = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  if (isNav) {
    // 網路優先，而且一律去要 index.html：
    // GitHub Pages 的 CDN 會把 `/dir/` 和 `/dir/index.html` 當成兩筆快取，
    // 部署後目錄網址可能仍是舊版。固定走 index.html 才拿得到當前版本。
    e.respondWith(
      fetch(INDEX, { cache: 'no-cache' })
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VER).then(c => c.put(INDEX, copy)); }
          return res;
        })
        .catch(() => caches.match(INDEX).then(r => r || Response.error()))
    );
    return;
  }

  // 其餘只服務清單內的檔案；未列管的請求（含帶查詢字串的）直接放行，避免快取無限長大。
  const key = url.origin + url.pathname;
  if (!SHELL.has(key)) return;
  e.respondWith(
    caches.match(key).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VER).then(c => c.put(key, copy)); }
      return res;
    }))
  );
});
