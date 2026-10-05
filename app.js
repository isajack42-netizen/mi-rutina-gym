// LiftEngine · cargador estable. La versión vive únicamente en js/version.js.
(async function(){
  if(window.__liftEngineCompatLoading) return;
  window.__liftEngineCompatLoading=true;
  try{ await import(`./js/version.js?ts=${Date.now()}`); }
  catch(_){ await import('./js/version.js'); }
  const version=globalThis.LIFTENGINE_VERSION || 'dev';
  const css=document.querySelector('link[rel="stylesheet"][href^="styles.css"]'); if(css) css.href=`styles.css?v=${encodeURIComponent(version)}`;
  const files=['config','storage','core','settings','logbook','metrics','dashboard','analytics','intelligence','tools','routines','notifications','training','bootstrap'];
  for(const name of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=`js/${name}.js?v=${encodeURIComponent(version)}`;
      s.onload=resolve; s.onerror=()=>reject(new Error(`No se pudo cargar ${name}.js`));
      document.head.appendChild(s);
    });
  }
})().catch(e=>{
  console.error('LiftEngine no pudo iniciar:',e);
  const el=document.getElementById('loadingOverlay');
  if(el) el.innerHTML='<div style="padding:24px;text-align:center"><b>No se pudo iniciar LiftEngine.</b><br><span style="opacity:.7">Recarga la página o revisa tu conexión.</span></div>';
});
