// LiftEngine v5.4.0 · cargador de compatibilidad.
// El index actual carga /js/*.js directamente; este archivo evita romper una pestaña con HTML antiguo en caché.
(async function(){
  if(window.__liftEngineCompatLoading) return;
  window.__liftEngineCompatLoading=true;
  const files=['version','config','core','logbook','dashboard','tools','routines','notifications','training','bootstrap'];
  for(const name of files){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=`js/${name}.js?v=5.4.0`;
      s.onload=resolve; s.onerror=()=>reject(new Error(`No se pudo cargar ${name}.js`));
      document.head.appendChild(s);
    });
  }
})().catch(e=>console.error('LiftEngine no pudo iniciar:',e));
