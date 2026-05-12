/**
 * Service Worker
 * キャッシュ戦略とオフライン対応
 */

const CACHE_NAME = 'english-cafe-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const IMAGE_CACHE = 'images-v1';

// キャッシュするリソース
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/images/logo.png',
  '/images/hero-bg.jpg',
];

// インストール時の処理
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// アクティベート時の処理
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== IMAGE_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// フェッチ時の処理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return;
  }
  
  // GET リクエストのみ処理
  if (request.method !== 'GET') {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  // 静的アセット（HTML、CSS、JS）
  if (isStaticAsset(url.pathname)) {
    return handleStaticAsset(request);
  }
  
  // 画像
  if (isImage(url.pathname)) {
    return handleImage(request);
  }
  
  // API リクエスト
  if (url.pathname.startsWith('/api/')) {
    return handleAPI(request);
  }
  
  // その他のリクエスト
  return handleDynamic(request);
}

// 静的アセットの処理（Cache First）
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Failed to fetch static asset:', error);
    return new Response('Offline', { status: 503 });
  }
}

// 画像の処理（Cache First with fallback）
async function handleImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // 画像は長期間キャッシュ
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.error('Failed to fetch image:', error);
    // フォールバック画像を返す
    return caches.match('/images/placeholder.jpg') || 
           new Response('Image not available', { status: 503 });
  }
}

// API リクエストの処理（Network First）
async function handleAPI(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // 成功したレスポンスをキャッシュ（短期間）
      const responseToCache = response.clone();
      cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    
    // キャッシュから取得を試行
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    return new Response(
      JSON.stringify({ error: 'Network unavailable' }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 動的コンテンツの処理（Stale While Revalidate）
async function handleDynamic(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  
  // バックグラウンドで更新
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.error('Failed to fetch dynamic content:', error);
      return null;
    });
  
  // キャッシュがあればすぐに返す
  if (cached) {
    return cached;
  }
  
  // キャッシュがなければネットワークを待つ
  const response = await fetchPromise;
  return response || new Response('Content not available', { status: 503 });
}

// ヘルパー関数
function isStaticAsset(pathname) {
  return pathname.match(/\.(js|css|html)$/) || 
         pathname === '/' ||
         pathname.startsWith('/_next/static/');
}

function isImage(pathname) {
  return pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/);
}

// バックグラウンド同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // オフライン時に蓄積されたデータを同期
  console.log('Background sync triggered');
}

// プッシュ通知
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/images/icon-192x192.png',
      badge: '/images/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      },
      actions: [
        {
          action: 'explore',
          title: '詳細を見る',
          icon: '/images/checkmark.png'
        },
        {
          action: 'close',
          title: '閉じる',
          icon: '/images/xmark.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/lessons')
    );
  }
});