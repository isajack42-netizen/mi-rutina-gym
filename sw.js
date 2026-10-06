// LiftEngine · service worker: app shell sin conexión
importScripts('js/version.js');
const APPV=self.LIFTENGINE_VERSION || 'dev';
const VER=`liftengine-v${APPV}`;
const q=u=>`${u}?v=${APPV}`;
const SHELL=[
  './','index.html','app.js',q('styles.css'),'js/version.js',
  ...['version','config','storage','core','settings','logbook','metrics','dashboard','analytics','history','planning','schedule','intelligence','tools','routines','notifications','training','bootstrap'].map(n=>q(`js/${n}.js`)),
  'manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png'
];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VER);
    try{
      await Promise.all(SHELL.map(async u=>{
        const r=await fetch(u,{cache:'reload'});
        if(!r.ok)throw new Error('No se pudo precachear '+u+' · '+r.status);
        await c.put(u,r.clone());
      }));
      await self.skipWaiting();
    }catch(err){
      await caches.delete(VER);
      throw err;
    }
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('liftengine-')&&k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
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

  // Archivos propios: red primero, pero con timeout corto. En mala señal
  // usamos la copia local en vez de esperar indefinidamente.
  e.respondWith((async()=>{
    const c=await caches.open(VER), controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),2200);
    try{
      const res=await fetch(r,{cache:'no-store',signal:controller.signal});
      clearTimeout(timeout);
      if(res&&res.ok&&!u.pathname.endsWith('/js/version.js')) c.put(r,res.clone()).catch(()=>{});
      return res;
    }catch(_){
      clearTimeout(timeout);
      const hit=(await c.match(r,{ignoreSearch:true})) || (await c.match(u.pathname.replace(/^\//,''),{ignoreSearch:true})) || (await c.match(u.pathname.replace(/^\//,'')+u.search,{ignoreSearch:true}));
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
    },ms);
  }));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('./')));
});


// ===== Web Push =====
// Receptor listo para un backend Push/VAPID. GitHub Pages no puede enviar
// notificaciones por sí solo; un servidor externo debe programar y enviar el push.
self.addEventListener('push',e=>{
  let d={};
  try{ d=e.data?e.data.json():{}; }catch(_){ d={body:e.data?e.data.text():''}; }
  e.waitUntil(self.registration.showNotification(d.title||'LiftEngine · Descanso terminado',{
    body:d.body||'Hora de tu siguiente serie',tag:d.tag||'liftengine-rest-push',renotify:true,
    vibrate:[200,100,200,100,200],icon:'icons/icon-192.png',badge:'icons/icon-192.png',
    data:d.data||{}
  }));
});
