// LiftEngine · arranque y eventos globales
'use strict';

// Orquestador neutral de UI. Los módulos de dominio exponen sus renderers,
// pero ninguno debe ser responsable de refrescar toda la aplicación.
function refreshAll(){
    applyTheme();
    populateExercises();
    loadDay();
    renderDashboard();
    renderCalendar();
    renderBodyWeights();
    // updateChart() ya refresca el detalle y Training Intelligence.
    updateChart();
    renderAnalytics();
    renderRoutines();
    renderTrainCTA();
    renderTrain();
}
let activeProgressView='performance';
window.setProgressView=function(view,btn=null){
    const allowed=['performance','intelligence','analytics','body'];
    activeProgressView=allowed.includes(view)?view:'performance';
    document.querySelectorAll('#progreso .progress-view').forEach(el=>el.classList.toggle('active',el.dataset.progressView===activeProgressView));
    document.querySelectorAll('#progreso .progress-nav-btn').forEach(el=>{
      const on=el.dataset.view===activeProgressView;
      el.classList.toggle('active',on);
      el.setAttribute('aria-selected',on?'true':'false');
    });
    requestAnimationFrame(()=>{
      if(activeProgressView==='performance'&&typeof updateChart==='function')updateChart();
      if(activeProgressView==='analytics'&&typeof renderAnalytics==='function')renderAnalytics();
      if(activeProgressView==='body'){
        if(typeof renderBodyWeights==='function')renderBodyWeights();
        if(typeof renderMeasurementChart==='function')renderMeasurementChart();
      }
    });
};
let themePreferenceBound=false;
function initThemePreferenceListener(){
    if(themePreferenceBound||typeof matchMedia!=='function')return;
    themePreferenceBound=true;
    const mq=matchMedia('(prefers-color-scheme: light)');
    const onChange=()=>{if(currentTheme==='auto'){applyTheme();refreshAll();}};
    if(typeof mq.addEventListener==='function')mq.addEventListener('change',onChange);
    else if(typeof mq.addListener==='function')mq.addListener(onChange);
}
async function initApp() {
    if(DOC_ID) setTimeout(()=>{ document.getElementById('loadingOverlay').style.display='none'; },4000);
    document.getElementById('routineDate').value=todayStr();
    await load();
    if(migrateNames()) await persistLocal();
    applyTheme();
    initThemePreferenceListener();
    setProgressView('performance');
    updateCategorySelect();
    addSet(); populateExercises(); loadDay(); renderDashboard(); renderCalendar(); renderRoutines();
    renderTrainCTA(); resumeTrainingIfAny();
    improveFormAccessibility(document);
    if(localRecoveryDetected) setTimeout(()=>toast('Se detectaron datos locales dañados y se conservó una copia de recuperación en este dispositivo.'),900);

    updateSyncStatus('Conectando…','saving');
    if(await connectFirebase()) {
        fb.onAuthStateChanged(fb.auth, async user => {
            if(user) {
                const prevUid=localStorage.getItem('gymLastUid');
                if(prevUid && prevUid!==user.uid){ await wipeLocalData(); train=null; DOC_ID=user.uid; localStorage.setItem('gymLastUid',user.uid); await load(); refreshAll(); }
                DOC_ID = user.uid;
                localStorage.setItem('gymLastUid', user.uid);
                document.getElementById('authOverlay').classList.add('hidden');
                if(!prevUid) document.getElementById('loadingOverlay').style.display='flex';
                updateSyncStatus('Conectando…','saving');
                syncFromCloudWithRetry(2).then(ok => {
                    document.getElementById('loadingOverlay').style.display='none';
                    if(!ok) updateSyncStatus('Guardado local · sin conexión','error');
                });
            } else {
                DOC_ID = null;
                document.getElementById('loadingOverlay').style.display='none';
                document.getElementById('authOverlay').classList.remove('hidden');
            }
        });
    } else {
        document.getElementById('loadingOverlay').style.display='none';
        if(!DOC_ID) document.getElementById('authOverlay').classList.remove('hidden');
        updateSyncStatus('Guardado local · sin conexión','error');
        // Un fallo de carga inicial de los módulos no debe dejar la app en local
        // hasta la siguiente recarga. Si ya conocíamos al usuario, reintentamos.
        if(DOC_ID && navigator.onLine) setTimeout(()=>retryCloudSync(),2500);
    }
}

window.addEventListener('online',()=>{ if(!saveInFlight && DOC_ID) syncFromCloudWithRetry(2).then(ok=>{ if(!ok) updateSyncStatus('Guardado local · sin conexión','error'); }); });
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) return;
  if(window.timerInt) tickTimer();
  if(DOC_ID && !syncing && !saveInFlight && navigator.onLine){
    const state=document.getElementById('syncStatus')?.dataset.state;
    if(state==='error') retryCloudSync();
    else if(Date.now()-lastCloudPullAt>45000) syncFromCloudWithRetry(1).then(ok=>{if(!ok) updateSyncStatus('Guardado local · sin conexión','error');});
  }
});

document.getElementById('routineDate').addEventListener('change',()=>loadDay());
document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && document.getElementById('modalBackdrop').classList.contains('show')) closeModal()});

const settingsBtn = document.getElementById('settingsBtn');
if(settingsBtn){
    settingsBtn.addEventListener('click', () => renderSettingsModal());
}
const summaryMore=document.getElementById('summaryMore');
if(summaryMore){
    summaryMore.addEventListener('toggle',()=>{if(summaryMore.open&&typeof renderDashboard==='function')requestAnimationFrame(()=>renderDashboard());});
}

const accessibilityObserver=new MutationObserver(()=>improveFormAccessibility(document));
accessibilityObserver.observe(document.body,{childList:true,subtree:true});

initApp();

// Instalable y con modo sin conexión (requiere https o localhost)
if('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',async()=>{ try{ const reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}); reg.update().catch(()=>{}); }catch(e){ console.warn('Service Worker no disponible:',e); } });
