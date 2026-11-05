const CACHE_NAME = 'bunny-fox-static-v1';
const ASSETS = [
  './',
  './index.html',
  './game.html',
  './assets/css/theme.css',
  './assets/css/site.css',
  './assets/css/game.css',
  './assets/js/core.js',
  './assets/js/art.js',
  './assets/js/data.js',
  './assets/js/site.js',
  './assets/js/minigames.js',
  './assets/js/game.js',
  './assets/icons/favicon.svg',
  './assets/images/og-share.jpg',
  './assets/images/og-share.svg',
];

// 安装：预缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

// 拦截请求：HTML 走网络优先，静态资源走缓存优先
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // HTML 页面：网络优先，离线时回退到缓存
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // CSS / JS / 图片 / 图标：stale-while-revalidate
  // 先返回缓存（即使已过期），同时在后台从网络获取并更新缓存，供下次使用
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});
