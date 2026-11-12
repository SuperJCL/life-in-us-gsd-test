// 离线外壳 Service Worker（OPS-04、D-07）：只缓存同源的应用外壳（页面和 SDK），让云端版打开过一次之后断网也能打开。
// 它不碰 /api/ 和 /_/：令牌、账号数据和后台页面都不能进缓存，也不能被离线外壳顶替；/sw.js 自己也不被代答。
//
// 版本占位见下面 V 的取值（整个文件里恰好出现一次）：构建脚本（13-04）换成外壳哈希前 12 位；测试静态服务器换成 test。
// 缓存名是 usj-shell-<版本>；外壳变了版本就变，旧缓存在 activate 时删掉。
//
// 为什么既不在 install 里 skipWaiting()，也不在 activate 里接管已打开的页面：
//  - 首次安装时，新 worker 不接管已经打开的页面，页面没有 controller，所以不会触发 controllerchange，
//    应用里“控制器变了就刷新”的处理不会在首次安装时误刷新；
//  - 新版本装好后进入等待，只有用户点击更新、页面发来 SKIP_WAITING 消息才生效，
//    所以已经打开的旧页面始终配着旧缓存，不会新旧混用。
const V = '__BUILD_VERSION__', CACHE = 'usj-shell-' + V;
const SHELL = ['/', '/vendor/pocketbase.iife.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon-180.png'];

self.addEventListener('install', (e) => e.waitUntil(
  caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    // cache:'reload' 绕过 HTTP 缓存，缓存里放的是服务器上当下的真文件；任何一个取不到就抛错，安装失败，不留半套缓存
    fetch(u, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error(u); return c.put(u, r); }))))));

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));

self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  // 导航只在路径是 / 时回缓存里的外壳；/_/（后台）和 /api/ 不被接管
  if (e.request.mode === 'navigate' && u.pathname === '/') {
    e.respondWith(caches.open(CACHE).then((c) => c.match('/')).then((r) => r || fetch(e.request)));
    return;
  }
  if (SHELL.includes(u.pathname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(u.pathname)).then((r) => r || fetch(e.request)));
  }
  // 其余（/api/、/_/、/sw.js）一律不调用 respondWith，交给浏览器走网络
});
