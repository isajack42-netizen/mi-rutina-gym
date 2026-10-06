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
    if(typeof renderReview==='function')renderReview();
    if(typeof renderHistory==='function')renderHistory();
    renderRoutines();
    renderTrainCTA();
    renderTrain();
}
let activeProgressView='performance';
window.setProgressView=function(view,btn=null){
    const allowed=['performance','intelligence','analytics','review','history','body'];
    activeProgressView=allowed.includes(view)?view:'performance';
    const root=document.getElementById('progreso');
    if(root)root.dataset.progressMode=['performance','intelligence'].includes(activeProgressView)?'exercise':'overview';
    document.querySelectorAll('#progreso .progress-view').forEach(el=>el.classList.toggle('active',el.dataset.progressView===activeProgressView));
    document.querySelectorAll('#progreso .progress-nav-btn').forEach(el=>{
      const on=el.dataset.view===activeProgressView;
      el.classList.toggle('active',on);
      el.setAttribute('aria-selected',on?'true':'false');
      el.tabIndex=on?0:-1;
    });
    requestAnimationFrame(()=>{
      if(activeProgressView==='performance'&&typeof updateChart==='function')updateChart();
      if(activeProgressView==='intelligence'){
        if(typeof ensureProgressExerciseSelection==='function')ensureProgressExerciseSelection();
        if(typeof renderDesktopExerciseBrowser==='function')renderDesktopExerciseBrowser();
        const name=document.getElementById('chartExercise')?.value||'';
        if(typeof renderDesktopExerciseContext==='function')renderDesktopExerciseContext(name);
        if(typeof renderProgressionPanel==='function')renderProgressionPanel();
      }
      if(activeProgressView==='analytics'&&typeof renderAnalytics==='function')renderAnalytics();
      if(activeProgressView==='review'&&typeof renderReview==='function')renderReview();
      if(activeProgressView==='history'&&typeof renderHistory==='function')renderHistory();
      if(activeProgressView==='body'){
        if(typeof renderBodyWeights==='function')renderBodyWeights();
        if(typeof renderMeasurementChart==='function')renderMeasurementChart();
      }
    });
};
function bindRovingTablist(root,selector){
    if(!root||root.dataset.keyboardBound==='1')return;
    root.dataset.keyboardBound='1';
    root.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      const tabs=[...root.querySelectorAll(selector)].filter(x=>!x.disabled&&x.offsetParent!==null);
      if(!tabs.length)return;
      const cur=Math.max(0,tabs.indexOf(document.activeElement));
      let next=cur;
      if(e.key==='ArrowRight')next=(cur+1)%tabs.length;
      if(e.key==='ArrowLeft')next=(cur-1+tabs.length)%tabs.length;
      if(e.key==='Home')next=0;
      if(e.key==='End')next=tabs.length-1;
      e.preventDefault();
      tabs[next].click();
      try{tabs[next].focus({preventScroll:true});}catch(_){tabs[next].focus();}
    });
}
function initTabKeyboard(){
    bindRovingTablist(document.querySelector('.tabs'),'.tab-btn');
    bindRovingTablist(document.querySelector('.progress-nav'),'.progress-nav-btn');
}

let modalReturnFocus=null, modalWasOpen=false;
function focusableIn(root){
  return [...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.hidden&&el.offsetParent!==null);
}
function labelModalDialog(box){
  if(!box)return;
  const heading=box.querySelector('h1,h2,h3');
  if(heading){
    if(!heading.id)heading.id='liftengineModalTitle';
    box.setAttribute('aria-labelledby',heading.id);
    box.removeAttribute('aria-label');
  }else{
    box.removeAttribute('aria-labelledby');
    box.setAttribute('aria-label','LiftEngine');
  }
}
function initModalFocusManagement(){
  const back=document.getElementById('modalBackdrop'), box=document.getElementById('modal');
  if(!back||!box||back.dataset.focusManaged==='1')return;
  back.dataset.focusManaged='1';
  const sync=()=>{
    const open=back.classList.contains('show');
    if(open&&!modalWasOpen){
      labelModalDialog(box);
      modalReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      requestAnimationFrame(()=>{
        const target=focusableIn(box)[0]||box;
        if(target===box&&!box.hasAttribute('tabindex'))box.setAttribute('tabindex','-1');
        try{target.focus({preventScroll:true});}catch(_){try{target.focus();}catch(__){}}
      });
    }else if(!open&&modalWasOpen){
      const previous=modalReturnFocus;modalReturnFocus=null;
      if(previous&&previous.isConnected&&previous.getClientRects().length&&typeof previous.focus==='function'){
        requestAnimationFrame(()=>{try{previous.focus({preventScroll:true});}catch(_){}});
      }
    }
    modalWasOpen=open;
  };
  new MutationObserver(sync).observe(back,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>labelModalDialog(box)).observe(box,{childList:true,subtree:true});
  labelModalDialog(box);
  sync();
}

let desktopExperienceBound=false;
function initDesktopExperience(){
  if(desktopExperienceBound||typeof matchMedia!=='function')return;
  desktopExperienceBound=true;
  const mq=matchMedia('(min-width:1200px)');
  const apply=()=>{
    const details=document.getElementById('summaryMore');
    if(!mq.matches&&['review','history'].includes(activeProgressView)){
      const analyticsBtn=document.getElementById('progress-tab-analytics');
      if(analyticsBtn)setProgressView('analytics',analyticsBtn);
    }
    if(!details)return;
    if(mq.matches){
      if(!details.open){details.open=true;details.dataset.desktopOpened='1';}
    }else if(details.dataset.desktopOpened==='1'){
      details.open=false;
      delete details.dataset.desktopOpened;
    }
  };
  if(typeof mq.addEventListener==='function')mq.addEventListener('change',apply);
  else if(typeof mq.addListener==='function')mq.addListener(apply);
  apply();
}

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

    document.getElementById('routineDate').value=todayStr();
    await load();
    await loadRecoveryJournal();reliabilityLoaded=true;
    if(migrateNames()) await persistLocal();
    applyTheme();
    const versionLabel=document.getElementById('summaryVersionLabel');
    if(versionLabel)versionLabel.textContent=`LiftEngine v${globalThis.LIFTENGINE_VERSION||''}`.trim();
    initThemePreferenceListener();
    initTabKeyboard();
    initModalFocusManagement();
    initDesktopExperience();
    setProgressView('performance');
    updateCategorySelect();
    addSet(); populateExercises(); loadDay(); renderDashboard(); renderCalendar(); renderRoutines();
    renderTrainCTA(); resumeTrainingIfAny();
    improveFormAccessibility(document);
    if(localRecoveryDetected) setTimeout(()=>toast('Se detectaron datos locales dañados y se conservó una copia de recuperación en este dispositivo.'),900);

    if(DOC_ID)document.getElementById('loadingOverlay').style.display='none';
    updateSyncStatus('Conectando…','saving');
    if(await connectFirebase()) {
        fb.onAuthStateChanged(fb.auth, async user => {
            if(user) {
                const prevUid=PreviewLocalStorage.getItem('gymLastUid');
                if(prevUid && prevUid!==user.uid){ reliabilityLoaded=false;await wipeLocalData(); train=null; DOC_ID=user.uid; PreviewLocalStorage.setItem('gymLastUid',user.uid); await load();await loadRecoveryJournal();reliabilityLoaded=true;refreshAll(); }
                DOC_ID = user.uid;
                PreviewLocalStorage.setItem('gymLastUid', user.uid);
                document.getElementById('authOverlay').classList.add('hidden');
                if(!prevUid) document.getElementById('loadingOverlay').style.display='flex';
                updateSyncStatus('Conectando…','saving');
                syncFromCloudWithRetry(2).then(ok => {
                    document.getElementById('loadingOverlay').style.display='none';
                    if(!ok) updateSyncStatus('Preview local · nube desactivada','error');
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
        updateSyncStatus('Preview local · nube desactivada','error');
        // Un fallo de carga inicial de los módulos no debe dejar la app en local
        // hasta la siguiente recarga. Si ya conocíamos al usuario, reintentamos.
        if(DOC_ID && navigator.onLine) setTimeout(()=>retryCloudSync(),2500);
    }
}

window.addEventListener('online',()=>{ if(appOwnsStorage&&reliabilityLoaded&&!saveInFlight && DOC_ID) syncFromCloudWithRetry(2).then(ok=>{ if(!ok) updateSyncStatus('Preview local · nube desactivada','error'); }); });
document.addEventListener('visibilitychange',()=>{
  if(document.hidden||!appOwnsStorage||!reliabilityLoaded) return;
  if(window.timerInt) tickTimer();
  if(DOC_ID && !syncing && !saveInFlight && navigator.onLine){
    const state=document.getElementById('syncStatus')?.dataset.state;
    if(state==='error') retryCloudSync();
    else if(Date.now()-lastCloudPullAt>45000) syncFromCloudWithRetry(1).then(ok=>{if(!ok) updateSyncStatus('Preview local · nube desactivada','error');});
  }
});

document.getElementById('routineDate').addEventListener('change',()=>loadDay());
document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.addEventListener('keydown',e=>{
  const back=document.getElementById('modalBackdrop'), box=document.getElementById('modal');
  if(!back.classList.contains('show'))return;
  if(e.key==='Escape'){e.preventDefault();closeModal();return;}
  if(e.key==='Tab'){
    const items=focusableIn(box);if(!items.length){e.preventDefault();box.focus();return;}
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

const settingsBtn = document.getElementById('settingsBtn');
if(settingsBtn){
    settingsBtn.addEventListener('click', () => renderSettingsModal());
}
const summaryMore=document.getElementById('summaryMore');
if(summaryMore){
    summaryMore.addEventListener('toggle',()=>{if(summaryMore.open&&typeof renderDashboard==='function')requestAnimationFrame(()=>renderDashboard());});
}

const accessibilityObserver=new MutationObserver(()=>{improveFormAccessibility(document);labelModalDialog(document.getElementById('modal'));});
accessibilityObserver.observe(document.body,{childList:true,subtree:true});

startWithStorageLock(initApp).catch(e=>{appOwnsStorage=false;reliabilityLoaded=false;console.error('No se pudo iniciar de forma segura:',e);document.getElementById('loadingOverlay').style.display='flex';document.getElementById('loadingOverlay').innerHTML='<div style="padding:24px"><b>No se pudo abrir el almacenamiento.</b><p>Cierra las otras ventanas de LiftEngine y vuelve a cargar. No borres los datos del navegador.</p><button class="btn btn-secondary" onclick="reloadApp()">Reintentar</button></div>';});

// Instalable y con modo sin conexión (requiere https o localhost)
if('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',async()=>{ try{ const reg=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}); reg.update().catch(()=>{}); }catch(e){ console.warn('Service Worker no disponible:',e); } });
