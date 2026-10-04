// LiftEngine · service worker: app shell sin conexión
const VER='liftengine-v5.2.3';
const SHELL=['./','index.html','styles.css?v=5.2.3','app.js?v=5.2.3','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'];
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

  // Los módulos versionados de Firebase y Chart.js son seguros de cachear y
  // mejoran mucho la fiabilidad en iPhone cuando la red tarda al recargar.
  const stableCdn=u.host==='cdn.jsdelivr.net'||(u.host==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/'));
  if(u.origin!==self.location.origin){
    if(!stableCdn) return; // Firestore/Auth/API: siempre red
    e.respondWith((async()=>{
      const c=await caches.open(VER);
      const hit=await c.match(r);
      if(hit){ fetch(r).then(res=>{ if(res&&(res.ok||res.type==='opaque')) c.put(r,res.clone()); }).catch(()=>{}); return hit; }
      try{ const res=await fetch(r); if(res&&(res.ok||res.type==='opaque')) c.put(r,res.clone()); return res; }
      catch(_){ return Response.error(); }
    })());
    return;
  }

  // Archivos propios: red primero para no quedar atrapados en una versión vieja.
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

// ===== Avisos de descanso =====
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
        if(!cs.some(c=>c.visibilityState==='visible')){
          await self.registration.showNotification(d.title||'Descanso terminado',{
            body:d.body||'Hora de tu siguiente serie',tag:'liftengine-rest',renotify:true,
            vibrate:[200,100,200,100,200],icon:'icons/icon-192.png',badge:'icons/icon-192.png'});
        }
      }catch(_){}
      res();
    },Math.min(ms,280000));
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('./')));
});
