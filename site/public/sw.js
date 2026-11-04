// Capital Kranti's service worker: the website keeps working on a weak or lost
// connection. Pages: the network first, else the copy from the last visit, else
// a small offline page listing the stories this phone can still open.
// Site files: kept once fetched (their names change with each release).
// Photos: kept once fetched, the last 120. Stories the reader saves: kept until taken off (components/ArticleTools.tsx).
const V = "ck-v1";
const PAGES = `${V}-pages`, FILES = `${V}-files`, PHOTOS = `${V}-photos`, SAVED = `${V}-saved`;
const MAX_PAGES = 40, MAX_PHOTOS = 120, WAIT = 4000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(V)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

async function keep(name, req, res, max) {
  if (!res.ok || res.type === "opaque") return;
  const c = await caches.open(name);
  await c.put(req, res);
  await trim(name, max);
}

const unesc = (s) => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, c) =>
  c[0] === "#" ? String.fromCodePoint(parseInt(c[1].toLowerCase() === "x" ? c.slice(2) : c.slice(1), c[1].toLowerCase() === "x" ? 16 : 10))
    : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[c.toLowerCase()]);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function offlinePage() {
  // the saved stories first, then the last ones read
  const links = [], seen = new Set();
  const all = [];
  for (const name of [SAVED, PAGES]) { const c = await caches.open(name); for (const req of (await c.keys()).reverse()) all.push([c, req]); }
  for (const [c, req] of all) {
    const u = new URL(req.url);
    if (!/\/news\//.test(u.pathname) || seen.has(u.pathname)) continue;
    seen.add(u.pathname);
    const html = await (await c.match(req)).text();
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (title) links.push(`<li><a href="${esc(u.pathname)}">${esc(unesc(title).replace(/ [|·–-] [^|·–-]+$/, ""))}</a></li>`);
    if (links.length >= 15) break;
  }
  const body = `<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ઇન્ટરનેટ નથી · કેપિટલ ક્રાંતિ</title><style>
body{margin:0;font-family:system-ui,sans-serif;background:#fff;color:#111114;line-height:1.6}
main{max-width:640px;margin:0 auto;padding:40px 16px}h1{font-size:26px;margin:0 0 8px;color:#7f3894}
p{margin:0 0 16px}button{font:inherit;font-weight:700;padding:12px 20px;border-radius:999px;border:0;background:#2e3192;color:#fff;min-height:44px}
ul{padding-left:20px}li{margin-bottom:10px}a{color:#7f3894;font-weight:600}small{color:#77757d}
</style></head><body><main><h1>ઇન્ટરનેટ નથી</h1>
<p>જોડાણ પાછું આવે એટલે પાનું ફરી ખોલો.<br><small>No internet. इंटरनेट नहीं है।</small></p>
<p><button onclick="location.reload()">ફરી પ્રયાસ કરો</button></p>
${links.length ? `<h2 style="font-size:18px">આ સમાચાર ઇન્ટરનેટ વગર પણ ખૂલશે</h2><ul>${links.join("")}</ul>` : ""}
</main></body></html>`;
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    const net = fetch(req).then((res) => { e.waitUntil(keep(PAGES, req, res.clone(), MAX_PAGES)); return res; });
    e.waitUntil(net.catch(() => {}));
    e.respondWith((async () => {
      const copy = (await caches.match(req, { cacheName: PAGES })) || (await caches.match(req, { cacheName: SAVED }));
      if (!copy) return net.catch(offlinePage);
      const late = new Promise((r) => setTimeout(r, WAIT, null));
      return (await Promise.race([net.catch(() => null), late])) || copy;
    })());
    return;
  }
  const kind = url.pathname.startsWith("/_next/static/") ? FILES
    : url.pathname.startsWith("/media/") || /\.(png|jpe?g|webp|avif)$/.test(url.pathname) ? PHOTOS : null;
  if (!kind) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { cacheName: kind });
    if (hit) return hit;
    const res = await fetch(req);
    e.waitUntil(keep(kind, req, res.clone(), kind === PHOTOS ? MAX_PHOTOS : 400));
    return res;
  })());
});

// A story the reader saves is kept whole for reading without internet; taken off, it goes (any language's copy)
self.addEventListener("message", (e) => {
  const m = e.data || {};
  if (!m.id || !/^[a-z][a-z0-9-]{1,40}$/.test(m.id)) return;
  e.waitUntil((async () => {
    const c = await caches.open(SAVED);
    if (m.type === "save" && typeof m.path === "string" && m.path.startsWith("/")) {
      const res = await fetch(m.path, { credentials: "same-origin" }).catch(() => null);
      if (res && res.ok) await c.put(new Request(new URL(m.path, self.location.origin).href), res);
    }
    if (m.type === "unsave") for (const k of await c.keys()) if (new URL(k.url).pathname.endsWith(`/news/${m.id}`)) await c.delete(k);
  })());
});

// Breaking-news alerts (lib/push.ts): shown as they come; a tap opens the story (in a window of the site already open,
// if there is one)
self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(m.title || "કેપિટલ ક્રાંતિ", {
    body: m.body || "", tag: m.tag, data: { url: m.url || "/" }, icon: "/icon-192.png", badge: "/favicon-32.png", lang: "gu",
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if ("navigate" in c) { await c.focus(); return c.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
