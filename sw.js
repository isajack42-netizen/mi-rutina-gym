// LiftEngine · service worker: app shell sin conexión (cambia VER al publicar una versión nueva)
const VER='liftengine-v4.9.1';
const SHELL=['./','index.html','styles.css','app.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VER).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(u.pathname.startsWith('/__/')) return;                                   // login de Firebase Hosting
  const cdn=u.host==='cdn.jsdelivr.net'||(u.host==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/'));
  if(u.origin!==location.origin&&!cdn) return;                                // Firestore/Auth: siempre red
  e.respondWith(caches.open(VER).then(async c=>{
    const hit=await c.match(r,{ignoreSearch:true});
    const net=fetch(r).then(res=>{ if(res&&(res.ok||res.type==='opaque')) c.put(r,res.clone()); return res; }).catch(()=>hit||Response.error());
    return hit||net;                                                          // rápido desde caché y se actualiza en segundo plano
  }));
});
