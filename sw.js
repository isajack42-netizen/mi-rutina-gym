// LiftEngine · service worker: app shell sin conexión
importScripts('js/version.js');
const APPV=self.LIFTENGINE_VERSION || 'dev';
const VER=`liftengine-v${APPV}`;
const q=u=>`${u}?v=${APPV}`;
const SHELL=[
  './','index.html','app.js',q('styles.css'),'js/version.js',
  ...['version','config','storage','core','settings','logbook','metrics','dashboard','analytics','history','planning','schedule','review','intelligence','tools','exercise-library','routines','notifications','training','recovery','bootstrap'].map(n=>q(`js/${n}.js`)),
  q('exercise-library/index.json'),q('exercise-library/taxonomy.json'),
  ...["exercise-library/planned-exercises.json","exercise-library/exercises/bench-press-barbell.json","assets/exercise-library/bench-press-barbell/thumbnail.svg","assets/exercise-library/bench-press-barbell/hero.svg","assets/exercise-library/bench-press-barbell/muscle-map-front.svg","assets/exercise-library/bench-press-barbell/step-01-setup.svg","assets/exercise-library/bench-press-barbell/step-02-unrack.svg","assets/exercise-library/bench-press-barbell/step-03-descent.svg","assets/exercise-library/bench-press-barbell/step-04-bottom.svg","assets/exercise-library/bench-press-barbell/step-05-press.svg","assets/exercise-library/bench-press-barbell/step-06-finish.svg","assets/exercise-library/bench-press-barbell/mistake-excessive-elbow-flare.svg","assets/exercise-library/bench-press-barbell/mistake-touch-too-high.svg","assets/exercise-library/bench-press-barbell/mistake-lose-foot-pressure.svg","assets/exercise-library/bench-press-barbell/mistake-bounce-bar.svg","exercise-library/exercises/incline-dumbbell-press.json","assets/exercise-library/incline-dumbbell-press/thumbnail.svg","assets/exercise-library/incline-dumbbell-press/hero.svg","assets/exercise-library/incline-dumbbell-press/muscle-map-front.svg","assets/exercise-library/incline-dumbbell-press/step-01.svg","assets/exercise-library/incline-dumbbell-press/step-02.svg","assets/exercise-library/incline-dumbbell-press/step-03.svg","assets/exercise-library/incline-dumbbell-press/step-04.svg","assets/exercise-library/incline-dumbbell-press/step-05.svg","assets/exercise-library/incline-dumbbell-press/mistake-bench-too-steep.svg","assets/exercise-library/incline-dumbbell-press/mistake-uneven-press.svg","assets/exercise-library/incline-dumbbell-press/mistake-dumbbells-collide.svg","exercise-library/exercises/cable-fly.json","assets/exercise-library/cable-fly/thumbnail.svg","assets/exercise-library/cable-fly/hero.svg","assets/exercise-library/cable-fly/muscle-map-front.svg","assets/exercise-library/cable-fly/step-01.svg","assets/exercise-library/cable-fly/step-02.svg","assets/exercise-library/cable-fly/step-03.svg","assets/exercise-library/cable-fly/step-04.svg","assets/exercise-library/cable-fly/step-05.svg","assets/exercise-library/cable-fly/mistake-too-much-elbow-bend.svg","assets/exercise-library/cable-fly/mistake-shoulders-forward.svg","assets/exercise-library/cable-fly/mistake-using-momentum.svg","exercise-library/exercises/overhead-press-barbell.json","assets/exercise-library/overhead-press-barbell/thumbnail.svg","assets/exercise-library/overhead-press-barbell/hero.svg","assets/exercise-library/overhead-press-barbell/muscle-map-front.svg","assets/exercise-library/overhead-press-barbell/step-01.svg","assets/exercise-library/overhead-press-barbell/step-02.svg","assets/exercise-library/overhead-press-barbell/step-03.svg","assets/exercise-library/overhead-press-barbell/step-04.svg","assets/exercise-library/overhead-press-barbell/step-05.svg","assets/exercise-library/overhead-press-barbell/mistake-excessive-lean.svg","assets/exercise-library/overhead-press-barbell/mistake-bar-forward.svg","assets/exercise-library/overhead-press-barbell/mistake-wide-elbows.svg","exercise-library/exercises/lateral-raise-dumbbell.json","assets/exercise-library/lateral-raise-dumbbell/thumbnail.svg","assets/exercise-library/lateral-raise-dumbbell/hero.svg","assets/exercise-library/lateral-raise-dumbbell/muscle-map-front.svg","assets/exercise-library/lateral-raise-dumbbell/step-01.svg","assets/exercise-library/lateral-raise-dumbbell/step-02.svg","assets/exercise-library/lateral-raise-dumbbell/step-03.svg","assets/exercise-library/lateral-raise-dumbbell/step-04.svg","assets/exercise-library/lateral-raise-dumbbell/step-05.svg","assets/exercise-library/lateral-raise-dumbbell/mistake-swinging.svg","assets/exercise-library/lateral-raise-dumbbell/mistake-shrugging.svg","assets/exercise-library/lateral-raise-dumbbell/mistake-too-heavy.svg","exercise-library/exercises/lat-pulldown.json","assets/exercise-library/lat-pulldown/thumbnail.svg","assets/exercise-library/lat-pulldown/hero.svg","assets/exercise-library/lat-pulldown/muscle-map-front.svg","assets/exercise-library/lat-pulldown/step-01.svg","assets/exercise-library/lat-pulldown/step-02.svg","assets/exercise-library/lat-pulldown/step-03.svg","assets/exercise-library/lat-pulldown/step-04.svg","assets/exercise-library/lat-pulldown/step-05.svg","assets/exercise-library/lat-pulldown/mistake-behind-neck.svg","assets/exercise-library/lat-pulldown/mistake-leaning-back.svg","assets/exercise-library/lat-pulldown/mistake-half-range.svg"].map(q),
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
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('liftengine-')&&k!==VER).slice(0,-1).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
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
    const c=await caches.open(VER), requestedVersion=u.searchParams.get('v');
    // Versioned assets are immutable once cached. Never substitute another
    // release when offline; retain one previous shell for an already open tab.
    if(requestedVersion){
      const versionCache=await caches.open(`liftengine-v${requestedVersion}`);
      const exact=await versionCache.match(r);if(exact)return exact;
    }
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),2200);
    try{
      const res=await fetch(r,{cache:'no-store',signal:controller.signal});
      clearTimeout(timeout);
      if(res&&res.ok&&!u.pathname.endsWith('/js/version.js')) c.put(r,res.clone()).catch(()=>{});
      return res;
    }catch(_){
      clearTimeout(timeout);
      if(requestedVersion)return Response.error();
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
