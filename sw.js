// LiftEngine · service worker: app shell sin conexión (cambia VER al publicar una versión nueva)
const VER='liftengine-v5.0.0';
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

// ===== Avisos de descanso: el service worker muestra la notificación aunque la página esté pausada =====
let restTimer=null, restDone=null;
function restClear(){ clearTimeout(restTimer); restTimer=null; if(restDone){ restDone(); restDone=null; } }
self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='rest-cancel'){ restClear(); return; }
  if(d.type!=='rest-start') return;
  restClear();
  const ms=Math.max(0,(Number(d.endAt)||0)-Date.now());
  e.waitUntil(new Promise(res=>{
    restDone=res;
    restTimer=setTimeout(async()=>{
      restTimer=null; restDone=null;
      try{
        const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
        if(!cs.some(c=>c.visibilityState==='visible')){          // si la app está a la vista, ella misma avisa (sonido + vibración)
          await self.registration.showNotification(d.title||'Descanso terminado',{
            body:d.body||'Hora de tu siguiente serie',tag:'liftengine-rest',renotify:true,
            vibrate:[200,100,200,100,200],icon:'icons/icon-192.png',badge:'icons/icon-192.png'});
        }
      }catch(_){}
      res();
    },Math.min(ms,280000));                                       // ~4.5 min: límite que el navegador permite mantener vivo al worker
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('./')));
});
