/*
  ATLAS 起動高速化用 Service Worker
  ------------------------------------------------------------
  役割: このHTML自体(アプリの外枠)だけをキャッシュし、
        ホーム画面から2回目以降に開いたとき、ネットワークの
        応答を待たずに即座に画面を出す(=起動時の白画面/待ち時間を短縮)。
        Firestoreなどのデータ通信はこのSWの対象外で、従来通り毎回最新を取得する。

  更新時の注意:
    index.html やアイコンを更新したら、下の CACHE_NAME の数字を
    必ず1つ上げること。上げないと利用者の端末に古いキャッシュが
    残り続け、更新が反映されない。
*/
const CACHE_NAME = 'atlas-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './icons/favicon-32.png',
  './icons/apple-touch-icon-180.png',
  './icons/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 画面本体(ナビゲーション)とアプリの外枠ファイルのみ対象。
  // Firestore等の外部API通信はそのまま素通しする。
  const url = new URL(req.url);
  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')));
  const isNavigation = req.mode === 'navigate';

  if (!isNavigation && !isShellFile) return;

  event.respondWith(
    caches.match(isNavigation ? './index.html' : req).then((cached) => {
      // stale-while-revalidate: キャッシュがあれば即返し、裏で最新を取りに行って更新しておく
      const fetchPromise = fetch(req).then((fresh) => {
        if (fresh && fresh.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(isNavigation ? './index.html' : req, fresh.clone()));
        }
        return fresh;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
