// LiftEngine · service worker: app shell sin conexión
const VER='liftengine-v5.2.2';
const SHELL=['./','index.html','styles.css?v=5.2.2','app.js?v=5.2.2','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VER).then(c=>Promise.all(SHELL.map(u=>fetch(u,{cache:'reload'}).then(r=>{if(r.ok)c.put(u,r.clone());}).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(u.pathname.startsWith('/__/')) return;
  if(u.origin!==self.location.origin) return; // Firebase/CDN siempre por red; no conservar módulos antiguos
  e.respondWith((async()=>{
    const c=await caches.open(VER);
    try{
      const res=await fetch(r,{cache:'no-store'});
      if(res&&res.ok) c.put(r,res.clone()).catch(()=>{});
      return res;
    }catch(_){
      const hit=await c.match(r);
      if(hit) return hit;
      if(r.mode==='navigate') return (await c.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
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
