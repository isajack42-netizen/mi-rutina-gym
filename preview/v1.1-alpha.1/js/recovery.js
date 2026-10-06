// LiftEngine · recovery journal. Local only; never uploaded as workout history.
'use strict';
let recoveryItems=[], recoveryBusy=false, appOwnsStorage=false, reliabilityLoaded=false;
const RECOVERY_KEY='gymRecoveryJournalV1', LOCAL_ATOMIC_KEY='gymAtomicSnapshotV1';
const copyRecovery=value=>JSON.parse(JSON.stringify(value));
function trainingSnapshot(){
  return train?copyRecovery({...train,__restCtx:restCtx||null,__timerEndAt:Number(window.timerEndAt)||0,__timerAlarmed:!!window.timerAlarmed}):null;
}
function restoreTrainingSnapshot(value){
  if(train) discardTrainingForDate(train.date,{silent:true});
  train=value?copyRecovery(value):null;
  restCtx=train?.__restCtx||null;
  window.timerEndAt=Number(train?.__timerEndAt)||0; window.timerAlarmed=!!train?.__timerAlarmed;
  if(train){delete train.__restCtx;delete train.__timerEndAt;delete train.__timerAlarmed;}
  saveTrain();
}
function recoveryScopeSnapshot(scope){
  const dates=scope.allDays?allLocalDates():scope.days||[];
  const out={days:Object.fromEntries(dates.filter(validDateKey).sort().map(d=>[d,buildLocalDayRecord(d)]))};
  if(scope.settings)out.settings=buildSettingsSnapshot();
  if(scope.training)out.training=trainingSnapshot();
  return copyRecovery(out);
}
function applyRecoverySnapshot(snapshot,scope){
  const dates=new Set([...Object.keys(snapshot.days),...(scope.allDays?allLocalDates():[])]);
  dates.forEach(d=>{applyLocalDayRecord(d,snapshot.days[d]);markDayDirty(d);});
  if(snapshot.settings){applySettingsSnapshot(snapshot.settings);markSettingsDirty();}
  if(scope.training)restoreTrainingSnapshot(snapshot.training);
}
async function writeRecoveryJournal(){
  await localPersistChain;
  if(localStoreReady)await LiftLocalDB.setMeta(RECOVERY_KEY,copyRecovery({uid:DOC_ID,items:recoveryItems}));
  else PreviewLocalStorage.setItem(RECOVERY_KEY,JSON.stringify({uid:DOC_ID,items:recoveryItems}));
}
function validTrainingSnapshot(value){
  return isPlainObject(value)&&validDateKey(value.date)&&Array.isArray(value.order)&&value.order.every(id=>Number.isFinite(id))&&Number.isFinite(value.startedAt)&&Number.isFinite(value.idx);
}
window.importRecoveryFile=async function(file){
  const scope=file.scope,before=file.before;
  if(!isPlainObject(scope)||!isPlainObject(before)||!isPlainObject(before.days)||Object.keys(before.days).some(d=>!validDateKey(d))||
    (scope.days!=null&&(!Array.isArray(scope.days)||scope.days.some(d=>!validDateKey(d))))||
    (before.settings&&!isPlainObject(before.settings))||(before.training&&!validTrainingSnapshot(before.training)))throw new Error('Copia de recuperación no válida.');
  const safeScope={allDays:scope.allDays===true,days:Object.keys(before.days),settings:!!before.settings,training:scope.training===true};
  if(!(await appConfirm('Se restaurarán los datos incluidos en esta copia. Se protegerá primero la versión actual. La restauración también se sincronizará con la nube.',{title:'Restaurar recuperación',confirmText:'Restaurar',danger:true})))return;
  if(await recoverableChange('Restaurar copia de recuperación',safeScope,()=>applyRecoverySnapshot(before,safeScope))){refreshAll();closeModal();toast('Copia recuperada en este dispositivo');}
};
async function loadRecoveryJournal(){
  try{
    const value=localStoreReady?await LiftLocalDB.getMeta(RECOVERY_KEY):safeParse(PreviewLocalStorage.getItem(RECOVERY_KEY),null);
    const atomic=localStoreReady?null:safeParse(PreviewLocalStorage.getItem(LOCAL_ATOMIC_KEY),null);
    const items=atomic?.uid===DOC_ID?atomic.recovery:value?.uid===DOC_ID?value.items:[];
    recoveryItems=Array.isArray(items)?items.filter(x=>x?.before&&x?.scope).slice(-10):[];
  }catch(e){recoveryItems=[];console.warn('No se pudo leer la recuperación:',e);}
}
async function prepareRecovery(label,scope){
  const item={id:Date.now()+'-'+Math.random().toString(36).slice(2),label,at:new Date().toISOString(),scope:copyRecovery(scope),before:recoveryScopeSnapshot(scope),after:null};
  const previous=recoveryItems;
  recoveryItems=[...recoveryItems.slice(-9),item];
  try{await writeRecoveryJournal();return item;}
  catch(e){recoveryItems=previous;await appAlert('No se pudo crear la copia de recuperación. Libera espacio o exporta tus datos antes de volver a intentarlo. No se realizó el cambio.','Cambio detenido');return null;}
}
async function recoverableChange(label,scope,change){
  if(recoveryBusy){toast('Espera a que termine el cambio anterior');return false;}
  recoveryBusy=true;
  try{
    const item=await prepareRecovery(label,scope);if(!item)return false;
    // Never overwrite edits made while the checkpoint was being written.
    if(JSON.stringify(recoveryScopeSnapshot(scope))!==JSON.stringify(item.before)){toast('Los datos cambiaron. Vuelve a intentarlo.');return false;}
    change();
    item.after=recoveryScopeSnapshot(scope);
    applySaveScope(scope);
    const saved=await persistLocal({forceAll:!!scope.allDays,replaceDays:!!scope.allDays,settings:!!scope.settings});
    if(!saved){
      applyRecoverySnapshot(item.before,scope);item.after=null;
      await persistLocal({forceAll:!!scope.allDays,replaceDays:!!scope.allDays,settings:!!scope.settings});
      refreshAll();toast('Cambio cancelado: no se pudo guardar. Se recuperó la versión anterior.');return false;
    }
    showUndo(item.id);
    void saveToFirebase();
    return true;
  }finally{recoveryBusy=false;}
}
async function saveLocalThenSync(scope){
  applySaveScope(scope);
  if(!(await persistLocal()))return false;
  updateSyncStatus('Guardado en este dispositivo · pendiente de nube','saving');
  void saveToFirebase();return true;
}
function showUndo(id){
  let el=document.getElementById('recoveryNotice');
  if(!el){el=document.createElement('div');el.id='recoveryNotice';el.className='recovery-notice';document.body.appendChild(el);}
  el.innerHTML='<span role="status">Cambio guardado</span><button class="btn btn-secondary" type="button">Deshacer</button><button class="btn btn-secondary" type="button" aria-label="Cerrar aviso">×</button>';
  el.querySelectorAll('button')[0].onclick=()=>undoRecovery(id);
  el.querySelectorAll('button')[1].onclick=()=>el.remove();
}
window.undoRecovery=async function(id){
  const item=recoveryItems.find(x=>x.id===id);
  if(!item?.after){toast('Esta copia está disponible para descargar');return;}
  if(JSON.stringify(recoveryScopeSnapshot(item.scope))!==JSON.stringify(item.after)){
    await appAlert('Hay cambios posteriores en estos datos. No se sobrescribieron. Puedes descargar la copia anterior desde Recuperación.','No se puede deshacer directamente');return;
  }
  if(await recoverableChange('Deshacer: '+item.label,item.scope,()=>applyRecoverySnapshot(item.before,item.scope))){refreshAll();toast('Cambio deshecho');}
};
window.openRecovery=function(){
  const modal=document.getElementById('modal');
  modal.innerHTML='<h2>Recuperación</h2><p class="muted">Últimos 10 cambios protegidos en este dispositivo. Deshacer solo está disponible si esos datos no cambiaron después. Descarga una copia antes de borrar datos del navegador.</p>'+
    (recoveryItems.length?recoveryItems.slice().reverse().map(x=>`<div class="recovery-item"><b>${escapeHtml(x.label)}</b><small>${escapeHtml(new Date(x.at).toLocaleString('es-MX'))}</small><div class="actions">${x.after?`<button class="btn btn-secondary" data-recovery-id="${escapeHtml(x.id)}" onclick="undoRecovery(this.dataset.recoveryId)">Deshacer</button>`:''}<button class="btn btn-secondary" data-recovery-id="${escapeHtml(x.id)}" onclick="downloadRecovery(this.dataset.recoveryId)">Descargar copia anterior</button></div></div>`).join(''):'<p>Aún no hay cambios protegidos.</p>')+
    '<div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cerrar</button></div>';
  openEl();
};
window.downloadRecovery=function(id){
  const item=recoveryItems.find(x=>x.id===id);if(!item)return;
  // A scoped journal is deliberately not disguised as a full backup.
  const blob=new Blob([JSON.stringify({appVersion:APP_VERSION,type:'liftengine-recovery',...item},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='liftengine-recuperacion-'+item.at.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);
};
function localPersistenceMeta(){
  return {uid:DOC_ID,days:[...cloudDirtyDays.keys()],settings:!!cloudSettingsDirty,training:trainingSnapshot()};
}
async function restoreLocalReliability(value){
  if(!value||value.uid!==DOC_ID)return;
  (value.days||[]).filter(validDateKey).forEach(d=>{if(!cloudDirtyDays.has(d))cloudDirtyDays.set(d,++mutationSeq);});
  if(value.settings&&!cloudSettingsDirty)cloudSettingsDirty=++mutationSeq;
  // IndexedDB and its session metadata are authoritative together.
  restoreTrainingSnapshot(value.training||null);
  persistCloudDirtyMarkers();
}
function localSaveFailure(error){
  localSaveError=error?.message||'No se pudo guardar';
  updateSyncStatus('No guardado en este dispositivo','error');
  let el=document.getElementById('localSaveWarning');
  if(!el){el=document.createElement('div');el.id='localSaveWarning';el.className='local-save-warning';el.setAttribute('role','alert');document.body.appendChild(el);}
  el.innerHTML='<b>No se pudo guardar en este dispositivo.</b><span>No cierres la app. Reintenta o descarga una copia de tus datos.</span><button class="btn btn-secondary" onclick="retryLocalSave()">Reintentar</button><button class="btn btn-secondary" onclick="exportData()">Descargar copia</button>';
}
function localSaveSuccess(){localSaveError='';document.getElementById('localSaveWarning')?.remove();}
window.retryLocalSave=async function(){if(await persistLocal({forceAll:true,settings:true})){toast('Datos guardados en este dispositivo');void saveToFirebase();}};
async function chooseCloudConflict(message){
  const answer=appDialog({title:'Conflicto de sincronización',message:message+'\n\nSe conservará una copia local antes de usar la nube.',confirmText:'Conservar este dispositivo',cancelText:'Cancelar'});
  const row=document.querySelector('#appDialog .dialog-actions');
  const button=document.createElement('button');button.className='btn btn-secondary';button.textContent='Usar nube';button.onclick=()=>closeAppDialog('cloud');row?.prepend(button);
  const choice=await answer;
  if(choice!==true&&choice!=='cloud'){cloudSyncPaused=true;throw new Error('Sincronización cancelada; cambios pendientes conservados.');}
  return choice===true;
}
// Web Locks serializes tabs before either loads shared IndexedDB. The waiting
// tab reads fresh state only after the owner closes; no stale snapshot can win.
async function startWithStorageLock(start){
  if(!navigator.locks?.request){appOwnsStorage=true;await start();toast('Este navegador no protege varias pestañas. Usa solo una ventana de LiftEngine.');return;}
  const loading=document.getElementById('loadingOverlay'), original=loading.innerHTML;
  loading.innerHTML='<div style="padding:24px;text-align:center"><b>Abre LiftEngine en una sola ventana.</b><p>Cierra la otra pestaña o ventana de la app para continuar aquí.</p></div>';
  return navigator.locks.request('liftengine-local-writer',async()=>{
    appOwnsStorage=true;DOC_ID=PreviewLocalStorage.getItem('gymLastUid')||null;loading.innerHTML=original;
    // training.js loads before the lock. Refresh its state after acquiring it.
    train=safeParse(PreviewLocalStorage.getItem(TRAIN_KEY),null);
    if(train){restCtx=train.__restCtx||null;window.timerEndAt=Number(train.__timerEndAt)||0;window.timerAlarmed=!!train.__timerAlarmed;delete train.__restCtx;delete train.__timerEndAt;delete train.__timerAlarmed;}
    await start();await new Promise(()=>{});
  });
}
window.reloadApp=function(){location.reload();};
function flushLocalOnHide(){
  if(!appOwnsStorage||!reliabilityLoaded)return;
  trainFlushInputs();saveTrain();void persistLocal();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushLocalOnHide();});
window.addEventListener('pagehide',flushLocalOnHide);
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
window.addEventListener('beforeunload',event=>{if(appOwnsStorage&&(localSaveError||localDirtyDays.size||localSettingsDirty)){event.preventDefault();event.returnValue='';}});
