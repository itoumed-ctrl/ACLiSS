// ACLiSS Service Worker
// マスタデータ（/api/containers, /api/test-items）・画面・容器写真をキャッシュし、
// オフライン時や通信不安定時でも直近のデータで表示を続けられるようにする。
const CACHE_NAME = "acliss-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // ページ遷移（HTML）: ネットワーク優先、失敗したらキャッシュ
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // マスタデータAPI: ネットワーク優先、失敗したらキャッシュ
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 容器写真（Supabaseストレージ等、他オリジンの画像）: キャッシュ優先＋裏で更新
  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await fetchPromise);
}
