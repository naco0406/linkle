// 링클 서비스 워커. 홈 화면에서 연 앱이 연결이 약해도 바로 뜨게 하는 것까지만 맡는다.
//   화면(HTML)    네트워크 먼저, 안 되면 마지막으로 받은 화면
//   /assets/*     해시가 붙어 바뀌지 않는 파일(JS, CSS, 유사도 모델): 한 번 받으면 캐시에서
//   글꼴          캐시에서 바로 주고 뒤에서 새로 받는다
//   /api/*, 위키백과   손대지 않는다. 문제와 기록은 늘 서버에서 받는다
const SHELL = 'linkle-shell-v1'
const ASSETS = 'linkle-assets-v1'
const FONTS = 'linkle-fonts-v1'
const KEEP = [SHELL, ASSETS, FONTS]
/** 배포가 쌓여도 캐시가 끝없이 커지지 않게, 오래된 것부터 지운다 */
const MAX_ASSETS = 40
const FONT_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', event => {
  event.waitUntil(
    fetch('/', { cache: 'no-cache' })
      .then(res => (res.ok ? remember(res) : undefined))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

/**
 * 받은 화면을 '/'로 두고, 그 화면이 부르는 JS와 CSS도 함께 받아 둔다.
 * 처음 방문한 화면의 CSS는 서비스 워커가 생기기 전에 받아져 캐시에 없기 때문이다.
 */
async function remember(res) {
  const html = await res.clone().text()
  await (await caches.open(SHELL)).put('/', res)
  const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
  const cache = await caches.open(ASSETS)
  await Promise.all(urls.map(async u => ((await cache.match(u)) ? undefined : cache.add(u).catch(() => {}))))
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('linkle-') && !KEEP.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return
    if (req.mode === 'navigate') return event.respondWith(shell(event))
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(req))
    return
  }
  if (FONT_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(req))
})

/** 모든 주소가 같은 index.html이라 '/' 하나로 둔다 */
async function shell(event) {
  const cache = await caches.open(SHELL)
  try {
    const res = await fetch(event.request)
    // 화면은 바로 돌려주고, 캐시에 담는 일은 뒤에서 한다
    if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) event.waitUntil(remember(res.clone()).catch(() => {}))
    return res
  } catch {
    return (await cache.match('/')) ?? Response.error()
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) {
    await cache.put(req, res.clone())
    const keys = await cache.keys()
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(old)
  }
  return res
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONTS)
  const hit = await cache.match(req)
  const fresh = fetch(req)
    .then(res => {
      if (res.ok || res.type === 'opaque') void cache.put(req, res.clone())
      return res
    })
    .catch(() => hit ?? Response.error())
  return hit ?? fresh
}
