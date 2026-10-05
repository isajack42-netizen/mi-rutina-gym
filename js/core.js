// LiftEngine · núcleo: estado, persistencia, Firebase, unidades y tema
'use strict';
let DOC_ID = localStorage.getItem('gymLastUid') || null;
const PENDING_KEY='gymPendingSync', SYNCED_KEY='gymSyncedAt', UPDATED_KEY='gymUpdatedAt';
const DIRTY_DAYS_PREFIX='gymDirtyDaysV1:', DIRTY_SETTINGS_PREFIX='gymDirtySettingsV1:';
const FULL_PULL_INTERVAL_MS=24*60*60*1000;
let forceNextFullPull=false;
let fb=null, cloudReady=false, syncing=false, updatedAt=Number(localStorage.getItem(UPDATED_KEY))||0, lastSyncError='', lastCloudPullAt=0;
let cloudMode='unknown', cloudMeta={days:{},settings:{revision:0,hash:''},pull:{incrementalReady:false,cursor:null,lastFullAt:0}};
const CLOUD_META_PREFIX='gymCloudMetaV2:';
let mutationSeq=0, localDirtyDays=new Map(), cloudDirtyDays=new Map(), localSettingsDirty=0, cloudSettingsDirty=0;
let localStoreMode='legacy', localStoreReady=false, localPersistChain=Promise.resolve();

function ic(n){return `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))])}

async function connectFirebase(){
  if(fb) return true;
  try{
    // En móvil una carga en frío de los módulos ESM puede superar 8 s.
    // Damos margen suficiente y reutilizamos una app ya inicializada si existiera.
    const [appMod,fsMod,authMod]=await withTimeout(Promise.all([import(FB_APP_URL),import(FB_FS_URL),import(FB_AUTH_URL)]),20000);
    const apps=typeof appMod.getApps==='function' ? appMod.getApps() : [];
    const app=apps.length && typeof appMod.getApp==='function' ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    fb={
        db:fsMod.getFirestore(app), doc:fsMod.doc, setDoc:fsMod.setDoc, getDoc:fsMod.getDoc, deleteDoc:fsMod.deleteDoc,
        collection:fsMod.collection, getDocs:fsMod.getDocs, writeBatch:fsMod.writeBatch, runTransaction:fsMod.runTransaction,
        query:fsMod.query, where:fsMod.where, serverTimestamp:fsMod.serverTimestamp, Timestamp:fsMod.Timestamp,
        auth: authMod.getAuth(app), provider: new authMod.GoogleAuthProvider(),
        signInWithPopup: authMod.signInWithPopup, signInWithRedirect: authMod.signInWithRedirect, signOut: authMod.signOut, onAuthStateChanged: authMod.onAuthStateChanged
    };
    lastSyncError='';
    return true;
  }catch(e){
    lastSyncError=(e&&e.message)||String(e||'Firebase no disponible');
    console.error('Firebase no disponible:',e);
    return false;
  }
}

window.loginConGoogle = async function() {
    if(!(await connectFirebase())) { await appAlert('Revisa tu conexión a internet.','Sin conexión'); return; }
    try {
        await fb.signInWithPopup(fb.auth, fb.provider);
    } catch(e) {
        if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported'].includes(e.code)){
            try{ await fb.signInWithRedirect(fb.auth, fb.provider); return; }catch(e2){ e=e2; }
        }
        if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request') return;
        await appAlert('Error al iniciar sesión: ' + e.message,'No se pudo iniciar sesión');
    }
};

async function wipeLocalData(){
    [KEY,CAT,WEIGHT,MEASURE,'trackGym_notes',ROUTINES_KEY,'gymAliases','gymMuscles','gymExerciseNotes',ANALYTICS_TARGET_KEY,BODY_GOAL_KEY,PENDING_KEY,SYNCED_KEY,UPDATED_KEY,'gymTrainState','gymBackupBeforeRename','gymBackupBeforeImport','gymBackupBeforeCSVImport','gymBackupBeforeCloudV2','gymRecoveryBackup','gymLastUid']
      .forEach(k=>{ try{localStorage.removeItem(k)}catch(e){} });
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const k=localStorage.key(i);
        if(k&&(k.startsWith(CLOUD_META_PREFIX)||k.startsWith(DIRTY_DAYS_PREFIX)||k.startsWith(DIRTY_SETTINGS_PREFIX))) localStorage.removeItem(k);
      }
    }catch(e){}
    try{ await globalThis.LiftLocalDB?.clearAll?.(); }catch(e){ console.warn('No se pudo limpiar IndexedDB:',e); }
    cloudMeta={days:{},settings:{revision:0,hash:''},pull:{incrementalReady:false,cursor:null,lastFullAt:0}};
    cloudDirtyDays=new Map(); localDirtyDays=new Map(); cloudSettingsDirty=0; localSettingsDirty=0;
    cloudMode='unknown'; updatedAt=0;
}

window.logout = async function() {
    if(!fb) return;
    if(localStorage.getItem(PENDING_KEY)==='1' && !(await appConfirm(`Hay cambios que aún NO se han sincronizado con la nube y se perderían al cerrar sesión.\n\n¿Cerrar sesión de todos modos?`,{title:'Cambios pendientes',confirmText:'Cerrar sesión',danger:true}))) return;
    if(await appConfirm('¿Estás seguro de cerrar sesión? Solo podrás ver y sincronizar tus rutinas al volver a entrar.',{title:'Cerrar sesión',confirmText:'Cerrar sesión',danger:true})) {
        await fb.signOut(fb.auth);
        await wipeLocalData();
        location.reload();
    }
};

const KEY='trackGymDataV2', CAT='gymCategories', WEIGHT='gymBodyWeight', MEASURE='gymBodyMeasurements', UNIT_KEY='gymUnitSystem', THEME_KEY='gymTheme', ROUTINES_KEY='gymCustomRoutines', EX_NOTES_KEY='gymExerciseNotes', ANALYTICS_TARGET_KEY='gymWeeklySessionTarget', BODY_GOAL_KEY='gymBodyGoalV1';
const THEME_VALUES=['auto','light','default','ocean','forest','coffee'];
function normalizeTheme(v){ const t=cleanString(v,'auto'); return THEME_VALUES.includes(t)?t:'auto'; }
function systemPrefersLight(){ return typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: light)').matches; }
function applyTheme(){
  currentTheme=normalizeTheme(currentTheme);
  const resolved=currentTheme==='auto'?(systemPrefersLight()?'light':'dark'):(currentTheme==='light'?'light':'dark');
  document.documentElement.setAttribute('data-theme',currentTheme);
  document.documentElement.setAttribute('data-resolved-theme',resolved);
  document.documentElement.style.colorScheme=resolved;
  requestAnimationFrame(()=>{
    const meta=document.querySelector('meta[name="theme-color"]');
    const bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if(meta&&bg)meta.setAttribute('content',bg);
  });
}
window.applyTheme=applyTheme;

const defaultPPL = {
    "Push": [
        { name: "Press inclinado con mancuernas", sets: 3, reps: "6–10", rir: "2", rest: "120–180 s" },
        { name: "Press de pecho en máquina", sets: 3, reps: "8–12", rir: "1–2", rest: "120 s" },
        { name: "Press de hombros en máquina", sets: 3, reps: "6–10", rir: "2", rest: "120–180 s" },
        { name: "Elevaciones laterales con mancuernas", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" },
        { name: "Extensión de tríceps en polea con cuerda", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" }
    ],
    "Pull": [
        { name: "Jalón al pecho", sets: 3, reps: "6–10", rir: "2", rest: "120–180 s" },
        { name: "Remo con pecho apoyado", sets: 3, reps: "8–12", rir: "1–2", rest: "120 s" },
        { name: "Remo unilateral en máquina", sets: 2, reps: "8–12", rir: "1–2", rest: "90–120 s" },
        { name: "Reverse pec deck", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" },
        { name: "Curl de bíceps con mancuernas", sets: 3, reps: "8–12", rir: "1–2", rest: "90 s" },
        { name: "Curl martillo", sets: 2, reps: "10–15", rir: "1–2", rest: "60–90 s" }
    ],
    "Legs": [
        { name: "Sentadilla hack", sets: 3, reps: "6–10", rir: "2", rest: "120–180 s" },
        { name: "Prensa de piernas", sets: 3, reps: "8–12", rir: "1–2", rest: "120–180 s" },
        { name: "Curl femoral sentado", sets: 3, reps: "8–12", rir: "1–2", rest: "120 s" },
        { name: "Extensión de cuádriceps", sets: 2, reps: "10–15", rir: "1–2", rest: "60–90 s" },
        { name: "Elevación de pantorrillas", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" },
        { name: "Abdominales en máquina", sets: 2, reps: "10–15", rir: "1–2", rest: "60–90 s" }
    ]
};

const routineExercises=[
"Press banca con barra","Press inclinado con mancuernas","Press de pecho en máquina","Press de hombro en máquina","Elevaciones laterales","Pushdown de tríceps con cuerda",
"Jalón al pecho agarre neutro","Remo con pecho apoyado","Remo unilateral con mancuerna","Reverse pec deck","Curl con barra EZ","Curl inclinado con mancuernas",
"Sentadilla con barra","Prensa 45°","Extensión de cuádriceps","Curl femoral sentado","Pantorrilla de pie","Crunch en máquina",
"Press inclinado con barra","Press de pecho convergente","Aperturas en máquina","Press de hombro con mancuernas","Elevaciones laterales en máquina","Extensión unilateral de tríceps en polea",
"Dominadas / dominadas asistidas","Remo sentado en máquina","Jalón unilateral en polea","Curl predicador","Curl martillo con mancuernas","Hack squat","Curl femoral acostado","Extensión de cadera en máquina","Pantorrilla sentado", "Jalón al pecho", "Remo unilateral en máquina", "Curl martillo", "Sentadilla hack", "Prensa de piernas", "Elevación de pantorrillas", "Abdominales en máquina"];

// FASE 3: Catálogos por defecto (ahora son la base, pero el usuario puede editar)
const defaultAliases = {
  "hack squat":"Sentadilla hack",
  "press de hombro en máquina":"Press de hombros en máquina",
  "curl martillo con mancuernas":"Curl martillo",
  "crunch en máquina":"Abdominales en máquina",
  "pushdown de tríceps con cuerda":"Extensión de tríceps en polea con cuerda"
};

const defaultMuscles = {
    "Pecho": ["Press banca con barra", "Press inclinado con mancuernas", "Press de pecho en máquina", "Press inclinado con barra", "Press de pecho convergente", "Aperturas en máquina"],
    "Espalda": ["Jalón al pecho agarre neutro", "Jalón al pecho", "Remo con pecho apoyado", "Remo unilateral con mancuerna", "Remo unilateral en máquina", "Dominadas / dominadas asistidas", "Remo sentado en máquina", "Jalón unilateral en polea"],
    "Piernas": ["Sentadilla con barra", "Sentadilla hack", "Prensa 45°", "Prensa de piernas", "Extensión de cuádriceps", "Curl femoral sentado", "Pantorrilla de pie", "Elevación de pantorrillas", "Curl femoral acostado", "Extensión de cadera en máquina", "Pantorrilla sentado"],
    "Hombros": ["Press de hombro en máquina", "Press de hombros en máquina", "Elevaciones laterales", "Elevaciones laterales con mancuernas", "Reverse pec deck", "Press de hombro con mancuernas", "Elevaciones laterales en máquina"],
    "Brazos": ["Pushdown de tríceps con cuerda", "Extensión de tríceps en polea con cuerda", "Curl con barra EZ", "Curl de bíceps con mancuernas", "Curl inclinado con mancuernas", "Extensión unilateral de tríceps en polea", "Curl predicador", "Curl martillo con mancuernas", "Curl martillo"],
    "Core": ["Crunch en máquina", "Abdominales en máquina"]
};

// Variables globales del sistema
let data={}, categories={}, weights=[], measurements=[], notes={}, exerciseNotes={}, customRoutines={}, currentUnit='kg', currentTheme='auto', weeklySessionTarget=6, bodyGoal={mode:'neutral',targetWeightKg:null,targetWaistCm:null}, setCounter=0, currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear(), selectedDate='', logType='pesas', chart=null, muscleChart=null, bodyWeightChart=null, measurementChart=null, analyticsWeeklyChart=null, saveInFlight=false, saveQueued=false;
let customAliases={}, customMuscles={};
let localRecoveryDetected=false; // Solo para corrupción real (JSON ilegible o pérdida estructural grave)
let localNormalizationDetected=false; // Migraciones/normalizaciones compatibles, sin alarmar al usuario
window.editingId = null;
window.timerInt = null;
window.timerEndAt = 0;
window.timerAlarmed = false;

function cssVar(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
function makeChart(canvas,cfg){
  if(typeof Chart==='undefined'||!canvas) return null; 
  try{return new Chart(canvas,cfg)}catch(e){console.error(e);return null}
}

function isPlainObject(v){ return !!v && typeof v==='object' && !Array.isArray(v); }
function safeKey(k){ return !['__proto__','prototype','constructor'].includes(String(k)); }
function cleanString(v,fallback=''){ return typeof v==='string' ? v.trim() : (v==null ? fallback : String(v).trim()); }
function boundedString(v,max=500,fallback=''){ return cleanString(v,fallback).slice(0,Math.max(0,Number(max)||0)); }
function finiteNumber(v,min=0){ const n=Number(v); return Number.isFinite(n)&&n>=min ? n : null; }
function sanitizeRecordId(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>0&&n<Number.MAX_SAFE_INTEGER?n:Date.now()+Math.random();
}
function validDateKey(v){
  const s=String(v); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d=new Date(s+'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;
}


let dialogResolve=null;
let dialogPreviousFocus=null;
function closeAppDialog(value=false){
  const back=document.getElementById('dialogBackdrop'),box=document.getElementById('appDialog');
  if(!back) return;
  back.classList.remove('show');
  back.hidden=true;
  back.setAttribute('aria-hidden','true');
  document.documentElement.classList.remove('dialog-open');
  document.body.classList.remove('dialog-open');
  const r=dialogResolve; dialogResolve=null;
  const previous=dialogPreviousFocus; dialogPreviousFocus=null;
  if(box) box.innerHTML='';
  if(previous&&previous.isConnected&&typeof previous.focus==='function'){
    try{previous.focus({preventScroll:true});}catch(e){}
  }
  if(r) r(value);
}
function appDialog({title='LiftEngine',message='',confirmText='Aceptar',cancelText='',danger=false}={}){
  const back=document.getElementById('dialogBackdrop'), box=document.getElementById('appDialog');
  if(!back||!box){ console.warn('Diálogo no disponible:',title,message); return Promise.resolve(cancelText?false:true); }
  if(dialogResolve) closeAppDialog(false);
  dialogPreviousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  box.innerHTML=`<h2 id="appDialogTitle">${escapeHtml(title)}</h2><div class="dialog-message">${escapeHtml(message)}</div><div class="dialog-actions">${cancelText?`<button class="btn btn-secondary" id="appDialogCancel">${escapeHtml(cancelText)}</button>`:''}<button class="btn ${danger?'btn-danger':'btn-primary'}" id="appDialogConfirm">${escapeHtml(confirmText)}</button></div>`;
  back.hidden=false;
  back.classList.add('show'); back.setAttribute('aria-hidden','false');
  document.documentElement.classList.add('dialog-open');
  document.body.classList.add('dialog-open');
  return new Promise(resolve=>{
    dialogResolve=resolve;
    box.querySelector('#appDialogConfirm')?.addEventListener('click',()=>closeAppDialog(true),{once:true});
    box.querySelector('#appDialogCancel')?.addEventListener('click',()=>closeAppDialog(false),{once:true});
    requestAnimationFrame(()=>{
      const target=box.querySelector('#appDialogCancel')||box.querySelector('#appDialogConfirm');
      try{target?.focus({preventScroll:true});}catch(e){try{target?.focus();}catch(_){} }
    });
  });
}
function initAppDialogDismiss(){
  const back=document.getElementById('dialogBackdrop');
  if(!back||back.dataset.dismissBound==='1') return;
  back.dataset.dismissBound='1';
  back.addEventListener('pointerdown',ev=>{ if(ev.target===back) closeAppDialog(false); });
  document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&back.classList.contains('show')){ev.preventDefault();closeAppDialog(false);} });
}
function appAlert(message,title='Aviso'){ return appDialog({title,message,confirmText:'Entendido'}); }
function appConfirm(message,{title='Confirmar',confirmText='Continuar',cancelText='Cancelar',danger=false}={}){ return appDialog({title,message,confirmText,cancelText,danger}); }
window.appAlert=appAlert; window.appConfirm=appConfirm;
window.closeAppDialog=closeAppDialog; initAppDialogDismiss();

let a11yIdCounter=0;
function improveFormAccessibility(root=document){
  root.querySelectorAll?.('label:not([for])').forEach(label=>{
    const host=label.parentElement; if(!host) return;
    let control=label.nextElementSibling;
    if(!(control&&control.matches&&control.matches('input,select,textarea'))){
      const direct=[...host.children].filter(el=>el.matches&&el.matches('input,select,textarea'));
      control=direct.length===1?direct[0]:null;
    }
    if(!control) return; // labels de sección (p. ej. "Tema visual") no se fuerzan a un campo incorrecto
    if(!control.id) control.id=`le-field-${++a11yIdCounter}`;
    label.htmlFor=control.id;
  });
  root.querySelectorAll?.('input,select,textarea').forEach(el=>{
    if(el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')) return;
    if(el.id){ const sel=`label[for="${el.id}"]`; const lab=root.querySelector?.(sel)||document.querySelector(sel); if(lab) return; }
    const ph=el.getAttribute('placeholder'); if(ph) el.setAttribute('aria-label',ph);
  });
}

function normalizeSetType(value){
  const v=cleanString(value,'normal').toLowerCase();
  if(['warmup','calentamiento','calentar'].includes(v)) return 'warmup';
  if(['failure','fallo','al fallo'].includes(v)) return 'failure';
  return 'normal';
}
function setTypeLabel(type){ return ({warmup:'Calentamiento',failure:'Al fallo',normal:'Normal'})[normalizeSetType(type)]||'Normal'; }
function isWarmupSet(s){ return normalizeSetType(s&&s.type)==='warmup'; }
function isFailureSet(s){ return normalizeSetType(s&&s.type)==='failure'; }
function setCountsForWork(s){ return setHasData(s)&&!isWarmupSet(s); }

function sanitizeSet(set,index=0){
  if(!isPlainObject(set)) return null;
  const rawWeight=finiteNumber(set.weight,0);
  const weight=rawWeight!==null&&rawWeight<=5000?rawWeight:0;
  const rawRestUsed=finiteNumber(set.restUsed,0);
  const restUsed=rawRestUsed!==null&&rawRestUsed<=86400?rawRestUsed:null;
  const reps=boundedString(set.reps,16,'-') || '-';
  const done=typeof set.done==='boolean' ? set.done : ((parseFloat(reps)||0)>0);
  return {
    setNumber: Math.max(1,Math.min(30,Math.round(Number(set.setNumber)||index+1))),
    reps,
    weight,
    rir: boundedString(set.rir,16,'-') || '-',
    rest: normalizeRestLabel(boundedString(set.rest,40,'-') || '-'),
    type: normalizeSetType(set.type||set.setType),
    done,
    ...(restUsed!==null ? {restUsed,...(set.restEstimated===true?{restEstimated:true}:{})} : {})
  };
}

function sanitizeEntry(entry){
  if(!isPlainObject(entry)) return null;
  const id=sanitizeRecordId(entry.id);
  const name=boundedString(entry.name,160,'Registro');
  if(entry.isCardio){
    const time=boundedString(entry.time,24,'-')||'-',distance=boundedString(entry.distance,24,'-')||'-';
    return {id,isCardio:true,name,time,distance};
  }
  const sets=Array.isArray(entry.sets) ? entry.sets.slice(0,30).map(sanitizeSet).filter(Boolean) : [];
  if(!name || !sets.length) return null;
  sets.forEach((s,i)=>s.setNumber=i+1);
  const substitutedFrom=boundedString(entry.substitutedFrom,160,'');
  return {id,isCardio:false,name,sets,...(substitutedFrom?{substitutedFrom}:{}),...(entry.trainingDraft===true?{trainingDraft:true}:{})};
}

function sanitizeData(raw){
  const out={};
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([date,entries])=>{
    if(!safeKey(date)||!validDateKey(date)||!Array.isArray(entries)) return;
    const clean=entries.map(sanitizeEntry).filter(Boolean);
    if(clean.length) out[date]=clean;
  });
  return out;
}

function sanitizeCategories(raw){
  const out=Object.create(null);
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([date,value])=>{ const v=boundedString(value,120,''); if(safeKey(date)&&validDateKey(date)&&v) out[date]=v; });
  return out;
}

function sanitizeNotes(raw){
  const out=Object.create(null);
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([date,value])=>{ const v=boundedString(value,5000,''); if(safeKey(date)&&validDateKey(date)&&v) out[date]=v; });
  return out;
}


function sanitizeExerciseNotes(raw){
  const out=Object.create(null);
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([name,value])=>{
    const n=boundedString(name,160,''),v=boundedString(value,1200,'');
    if(!n||!safeKey(n)||!v) return;
    out[n]=v;
  });
  return out;
}

function sanitizeWeights(raw){
  if(!Array.isArray(raw)) return [];
  return raw.map(x=>{
    if(!isPlainObject(x)||!validDateKey(x.date)) return null;
    const weight=finiteNumber(x.weight,0);
    return weight===null||weight<=0 ? null : {date:x.date,weight};
  }).filter(Boolean);
}

function sanitizeMeasurements(raw){
  if(!Array.isArray(raw)) return [];
  const keys=['waist','chest','arm','thigh','hip'];
  return raw.map(x=>{
    if(!isPlainObject(x)||!validDateKey(x.date)) return null;
    const out={date:x.date}; let has=false;
    keys.forEach(k=>{ const n=finiteNumber(x[k],0); if(n!==null&&n>0){out[k]=Math.round(n*10)/10;has=true;} });
    return has?out:null;
  }).filter(Boolean);
}

function sanitizeRoutines(routines) {
    const fixed = Object.create(null);
    if(!isPlainObject(routines)) return fixed;
    for (const [rawKey,rows] of Object.entries(routines)) {
        const key=boundedString(rawKey,80,'');
        if(!key||!safeKey(key)||!Array.isArray(rows)) continue;
        fixed[key] = rows.slice(0,50).map(ex => {
            let name,sets,reps,rir,rest;
            if(Array.isArray(ex)){ [name,sets,reps,rir,rest]=ex; }
            else if(isPlainObject(ex)){ ({name,sets,reps,rir,rest}=ex); }
            else return null;
            const n=boundedString(name,160,'');
            const count=Math.round(Number(sets)||0);
            if(!n||count<1||count>20)return null;
            return { name:n, sets:count, reps:boundedString(reps,32,''), rir:boundedString(rir,24,''), rest:normalizeRestLabel(boundedString(rest,40,'')) };
        }).filter(Boolean);
    }
    return fixed;
}

function sanitizeAliases(raw){
  const out=Object.create(null); if(!isPlainObject(raw)) return out;
  Object.entries(raw).slice(0,500).forEach(([k,v])=>{
    const key=boundedString(k,160,'').toLowerCase(),value=boundedString(v,160,'');
    if(key&&safeKey(key)&&value) out[key]=value;
  });
  return out;
}
function sanitizeMuscles(raw){
  const out=Object.create(null); if(!isPlainObject(raw)) return out;
  Object.entries(raw).slice(0,100).forEach(([k,v])=>{
    const key=boundedString(k,80,'');
    if(!key||!safeKey(key)||!Array.isArray(v))return;
    out[key]=v.slice(0,500).map(x=>boundedString(x,160,'')).filter(Boolean);
  });
  return out;
}

function backupCorruptLocal(key,raw){
  if(raw==null) return;
  try{
    const existing=safeParse(localStorage.getItem('gymRecoveryBackup'),{});
    if(!existing[key]) existing[key]={savedAt:new Date().toISOString(),raw};
    localRecoveryDetected=true;
    localStorage.setItem('gymRecoveryBackup',JSON.stringify(existing));
  }catch(e){ console.warn('No se pudo guardar recuperación local:',key,e); }
}

function sameContainerType(value,fallback){
  return Array.isArray(fallback) ? Array.isArray(value) : (isPlainObject(fallback) ? isPlainObject(value) : true);
}
function itemCount(value){
  if(Array.isArray(value)) return value.length;
  if(isPlainObject(value)) return Object.keys(value).length;
  return value==null ? 0 : 1;
}
function readLocal(key,fallback,sanitizer){
  const raw=localStorage.getItem(key);
  if(raw===null) return fallback;
  try{
    const parsed=JSON.parse(raw);
    // Un cambio de formato compatible (p. ej. "2 min" -> "120 s" o añadir
    // isCardio:false) NO significa que los datos estén dañados. La v5.2.2
    // confundía cualquier normalización con corrupción y mostraba una falsa alarma.
    if(!sameContainerType(parsed,fallback)){
      backupCorruptLocal(key,raw);
      return fallback;
    }
    const clean=sanitizer(parsed);
    const before=itemCount(parsed), after=itemCount(clean);
    if(before>0 && after===0){
      backupCorruptLocal(key,raw);
      return fallback;
    }
    try{
      if(JSON.stringify(parsed)!==JSON.stringify(clean)) localNormalizationDetected=true;
    }catch(e){ localNormalizationDetected=true; }
    return clean;
  }catch(e){
    backupCorruptLocal(key,raw);
    return fallback;
  }
}

function safeParse(raw, fallback){ try { const v=JSON.parse(raw); return v ?? fallback; } catch(e){ return fallback; } }

function loadLegacyLocal(){
  data=readLocal(KEY,{},sanitizeData);
  categories=readLocal(CAT,{},sanitizeCategories);
  weights=readLocal(WEIGHT,[],sanitizeWeights);
  measurements=readLocal(MEASURE,[],sanitizeMeasurements);
  notes=readLocal('trackGym_notes',{},sanitizeNotes);
  exerciseNotes=readLocal(EX_NOTES_KEY,{},sanitizeExerciseNotes);
  const routinesStored=localStorage.getItem(ROUTINES_KEY)!==null;
  const aliasesStored=localStorage.getItem('gymAliases')!==null;
  const musclesStored=localStorage.getItem('gymMuscles')!==null;
  customRoutines = routinesStored ? sanitizeRoutines(readLocal(ROUTINES_KEY, {}, x=>x)) : JSON.parse(JSON.stringify(defaultPPL));
  currentUnit=localStorage.getItem(UNIT_KEY)==='lbs'?'lbs':'kg';
  currentTheme=normalizeTheme(localStorage.getItem(THEME_KEY));
  weeklySessionTarget=Math.min(7,Math.max(1,parseInt(localStorage.getItem(ANALYTICS_TARGET_KEY),10)||6));
  bodyGoal=sanitizeBodyGoal(safeParse(localStorage.getItem(BODY_GOAL_KEY),{}));
  customAliases = aliasesStored ? sanitizeAliases(readLocal('gymAliases', {}, x=>x)) : JSON.parse(JSON.stringify(defaultAliases));
  customMuscles = musclesStored ? sanitizeMuscles(readLocal('gymMuscles', {}, x=>x)) : JSON.parse(JSON.stringify(defaultMuscles));
}

function persistLegacySnapshot(){
  localStorage.setItem(KEY,JSON.stringify(data));
  localStorage.setItem(CAT,JSON.stringify(categories));
  localStorage.setItem(WEIGHT,JSON.stringify(weights));
  localStorage.setItem(MEASURE,JSON.stringify(measurements));
  localStorage.setItem('trackGym_notes',JSON.stringify(notes));
  localStorage.setItem(EX_NOTES_KEY,JSON.stringify(exerciseNotes));
  localStorage.setItem(ROUTINES_KEY,JSON.stringify(customRoutines));
  localStorage.setItem('gymAliases',JSON.stringify(customAliases));
  localStorage.setItem('gymMuscles',JSON.stringify(customMuscles));
  localStorage.setItem(UNIT_KEY,currentUnit);
  localStorage.setItem(THEME_KEY,currentTheme);
  localStorage.setItem(ANALYTICS_TARGET_KEY,String(weeklySessionTarget));
  localStorage.setItem(BODY_GOAL_KEY,JSON.stringify(sanitizeBodyGoal(bodyGoal)));
}

function dirtyDaysKey(){ return DIRTY_DAYS_PREFIX+(DOC_ID||'anonymous'); }
function dirtySettingsKey(){ return DIRTY_SETTINGS_PREFIX+(DOC_ID||'anonymous'); }
function persistCloudDirtyMarkers(){
  try{
    const days=[...cloudDirtyDays.keys()].filter(validDateKey).sort();
    if(days.length) localStorage.setItem(dirtyDaysKey(),JSON.stringify(days)); else localStorage.removeItem(dirtyDaysKey());
    if(cloudSettingsDirty) localStorage.setItem(dirtySettingsKey(),'1'); else localStorage.removeItem(dirtySettingsKey());
    if(days.length||cloudSettingsDirty) localStorage.setItem(PENDING_KEY,'1');
  }catch(e){ console.warn('No se pudieron guardar marcadores de cambios:',e); }
}
function loadCloudDirtyMarkers(){
  cloudDirtyDays=new Map(); cloudSettingsDirty=0;
  const days=safeParse(localStorage.getItem(dirtyDaysKey()),[]);
  if(Array.isArray(days)) days.filter(validDateKey).forEach(d=>cloudDirtyDays.set(d,++mutationSeq));
  if(localStorage.getItem(dirtySettingsKey())==='1') cloudSettingsDirty=++mutationSeq;
}
function markDayDirty(date,{cloud=true,local=true}={}){
  if(!validDateKey(date)) return;
  const v=++mutationSeq;
  if(local) localDirtyDays.set(date,v);
  if(cloud){ cloudDirtyDays.set(date,v); persistCloudDirtyMarkers(); }
}
function markSettingsDirty({cloud=true,local=true}={}){
  const v=++mutationSeq;
  if(local) localSettingsDirty=v;
  if(cloud){ cloudSettingsDirty=v; persistCloudDirtyMarkers(); }
}
function markAllDaysDirty({cloud=true,local=true}={}){ allLocalDates().forEach(d=>markDayDirty(d,{cloud,local})); }
function localStoreLabel(){ return localStoreMode==='indexeddb'?'IndexedDB · por día':'Compatibilidad local'; }
window.localStoreLabel=localStoreLabel;

function buildLocalDayRecord(date){
  if(!validDateKey(date)) return null;
  const body=weights.find(x=>x.date===date), measurement=measurements.find(x=>x.date===date);
  const entries=sanitizeData({[date]:data[date]||[]})[date]||[];
  const record={
    date,
    entries,
    category:categories[date]||'',
    note:notes[date]||'',
    bodyWeight:body?Number(body.weight):null,
    measurement:measurement?(()=>{const {date:_d,...x}=measurement;return x})():null
  };
  const has=record.entries.length||record.category||record.note||record.bodyWeight||(record.measurement&&Object.keys(record.measurement).length);
  return has?record:null;
}
function buildLocalSettingsRecord(){
  return {schemaVersion:DATA_SCHEMA_VERSION,...buildSettingsSnapshot()};
}
function applyLocalDayRecord(date,raw){
  delete data[date]; delete categories[date]; delete notes[date];
  weights=weights.filter(x=>x.date!==date); measurements=measurements.filter(x=>x.date!==date);
  if(!raw) return;
  const entries=sanitizeData({[date]:raw.entries||[]})[date]||[];
  if(entries.length) data[date]=entries;
  const category=cleanString(raw.category,''); if(category) categories[date]=category;
  const note=cleanString(raw.note,''); if(note) notes[date]=note;
  const body=finiteNumber(raw.bodyWeight,0); if(body&&body>0) weights.push({date,weight:body});
  if(isPlainObject(raw.measurement)){
    const m=sanitizeMeasurements([{date,...raw.measurement}])[0]; if(m) measurements.push(m);
  }
}
function applyLocalSettingsRecord(raw){
  if(!isPlainObject(raw)) return;
  applySettingsSnapshot(raw);
}

async function load(){
  // Compatibilidad: primero se carga el snapshot histórico de localStorage. En la
  // primera ejecución v5.6 se migra a IndexedDB y se conserva ese snapshot como
  // red de seguridad para poder volver a una versión anterior si fuera necesario.
  loadLegacyLocal();
  loadCloudDirtyMarkers();
  localDirtyDays=new Map(); localSettingsDirty=0;
  try{
    if(!globalThis.LiftLocalDB?.supported()) throw new Error('IndexedDB no disponible');
    await LiftLocalDB.open();
    const migrated=await LiftLocalDB.getMeta('migration-v1');
    if(!migrated){
      const records=allLocalDates().map(buildLocalDayRecord).filter(Boolean);
      await LiftLocalDB.replaceDays(records);
      await LiftLocalDB.putSettings(buildLocalSettingsRecord());
      await LiftLocalDB.setMeta('migration-v1',{at:Date.now(),from:'localStorage'});
    }else{
      const [records,settings]=await Promise.all([LiftLocalDB.getAllDays(),LiftLocalDB.getSettings()]);
      data={}; categories={}; weights=[]; measurements=[]; notes={};
      (records||[]).forEach(r=>{ if(r&&validDateKey(r.date)) applyLocalDayRecord(r.date,r); });
      if(settings) applyLocalSettingsRecord(settings);
    }
    localStoreReady=true; localStoreMode='indexeddb';
    localNormalizationDetected=false;
  }catch(e){
    localStoreReady=false; localStoreMode='legacy';
    console.warn('LiftEngine · IndexedDB no disponible, usando compatibilidad localStorage:',e);
  }
  document.getElementById('unitBtn').innerText=currentUnit.toUpperCase();
  applyTheme();
  if(localNormalizationDetected){
    try{
      if(localStoreReady){ markAllDaysDirty({cloud:false,local:true}); markSettingsDirty({cloud:false,local:true}); await persistLocal(); }
      else persistLegacySnapshot();
      localNormalizationDetected=false;
    }catch(e){ console.warn('No se pudo persistir la normalización local:',e); }
  }
}

function persistLocal({forceAll=false,replaceDays=false,settings=false}={}){
  if(localPersistTimer){clearTimeout(localPersistTimer);localPersistTimer=null;}
  try{ localStorage.setItem(UNIT_KEY,currentUnit); localStorage.setItem(THEME_KEY,currentTheme); localStorage.setItem(ANALYTICS_TARGET_KEY,String(weeklySessionTarget)); localStorage.setItem(BODY_GOAL_KEY,JSON.stringify(sanitizeBodyGoal(bodyGoal))); }catch(e){}
  if(!localStoreReady||!globalThis.LiftLocalDB){
    try{persistLegacySnapshot();}catch(e){console.warn('No se pudo guardar localmente:',e);}
    return Promise.resolve(false);
  }
  const dayVersions=new Map();
  const dates=forceAll?[...new Set([...allLocalDates(),...localDirtyDays.keys()])]:[...localDirtyDays.keys()];
  dates.forEach(d=>dayVersions.set(d,localDirtyDays.get(d)||mutationSeq));
  const records=[],deleted=[];
  dates.forEach(d=>{const r=buildLocalDayRecord(d); if(r)records.push(r); else deleted.push(d);});
  const settingsVersion=settings||forceAll||localSettingsDirty ? (localSettingsDirty||mutationSeq||1) : 0;
  const settingsSnapshot=settingsVersion?buildLocalSettingsRecord():null;
  localPersistChain=localPersistChain.then(async()=>{
    if(replaceDays) await LiftLocalDB.replaceDays(records);
    else{
      if(records.length) await LiftLocalDB.putDays(records);
      if(deleted.length) await LiftLocalDB.deleteDays(deleted);
    }
    if(settingsSnapshot) await LiftLocalDB.putSettings(settingsSnapshot);
    dayVersions.forEach((version,date)=>{ if(localDirtyDays.get(date)===version) localDirtyDays.delete(date); });
    if(settingsVersion&&localSettingsDirty===settingsVersion) localSettingsDirty=0;
    return true;
  }).catch(e=>{ console.error('LiftEngine · error guardando IndexedDB:',e); return false; });
  return localPersistChain;
}
let localPersistTimer=null;
function queuePersistLocal(delay=60){
  clearTimeout(localPersistTimer);
  localPersistTimer=setTimeout(()=>{localPersistTimer=null;persistLocal();},Math.max(0,Number(delay)||0));
}


function compactDataForCloud(raw){
  const clean=sanitizeData(raw), out={};
  Object.entries(clean).forEach(([date,entries])=>{
    const kept=[];
    entries.forEach(entry=>{
      if(entry.isCardio){
        const hasCardio=(parseFloat(entry.time)||0)>0||(parseFloat(entry.distance)||0)>0;
        if(hasCardio) kept.push(entry);
        return;
      }
      const sets=(entry.sets||[]).filter(s=>s.done===true&&(parseFloat(s.reps)||0)>0).map((s,i)=>({...s,setNumber:i+1}));
      if(sets.length){ const copy={...entry,sets}; delete copy.trainingDraft; kept.push(copy); }
    });
    if(kept.length) out[date]=kept;
  });
  return out;
}
function compactEntriesForDate(date){ return compactDataForCloud({[date]:data[date]||[]})[date]||[]; }
function cloudMetaKey(){ return CLOUD_META_PREFIX+(DOC_ID||'anonymous'); }
function loadCloudMeta(){
  const raw=safeParse(localStorage.getItem(cloudMetaKey()),null);
  cloudMeta=isPlainObject(raw)?raw:{days:{},settings:{revision:0,hash:''},pull:{incrementalReady:false,cursor:null,lastFullAt:0}};
  if(!isPlainObject(cloudMeta.days)) cloudMeta.days={};
  if(!isPlainObject(cloudMeta.settings)) cloudMeta.settings={revision:0,hash:''};
  if(!isPlainObject(cloudMeta.pull)) cloudMeta.pull={incrementalReady:false,cursor:null,lastFullAt:0};
  cloudMeta.pull.incrementalReady=!!cloudMeta.pull.incrementalReady;
  cloudMeta.pull.lastFullAt=Number(cloudMeta.pull.lastFullAt)||0;
  if(cloudMeta.pull.cursor&&!isPlainObject(cloudMeta.pull.cursor)) cloudMeta.pull.cursor=null;
}
function saveCloudMeta(){ try{localStorage.setItem(cloudMetaKey(),JSON.stringify(cloudMeta));}catch(e){console.warn('No se pudo guardar metadata de nube',e);} }
function cursorFromTimestamp(ts){
  if(!ts||typeof ts.seconds!=='number') return null;
  return {seconds:Number(ts.seconds)||0,nanoseconds:Number(ts.nanoseconds)||0};
}
function compareCursor(a,b){
  if(!a)return b? -1:0; if(!b)return 1;
  return a.seconds!==b.seconds?a.seconds-b.seconds:(a.nanoseconds||0)-(b.nanoseconds||0);
}
function maxCursor(a,b){ return compareCursor(a,b)>=0?a:b; }
function firestoreCursor(c){
  if(!fb?.Timestamp) return null;
  return c&&typeof c.seconds==='number' ? new fb.Timestamp(Number(c.seconds)||0,Number(c.nanoseconds)||0) : new fb.Timestamp(0,0);
}
async function fetchCloudDaysV2(){
  const col=fb.collection(fb.db,'userData',DOC_ID,'days');
  const full=forceNextFullPull || !cloudMeta.pull.incrementalReady || !cloudMeta.pull.lastFullAt || (Date.now()-cloudMeta.pull.lastFullAt)>=FULL_PULL_INTERVAL_MS;
  forceNextFullPull=false;
  let snap;
  if(full){
    snap=await withTimeout(fb.getDocs(col),15000);
  }else{
    const cursor=firestoreCursor(cloudMeta.pull.cursor);
    const q=fb.query(col,fb.where('serverUpdatedAt','>=',cursor));
    snap=await withTimeout(fb.getDocs(q),15000);
  }
  const remote=new Map(); let cursor=cloudMeta.pull.cursor||null;
  snap.forEach(doc=>{
    const value=doc.data(); remote.set(doc.id,value);
    cursor=maxCursor(cursor,cursorFromTimestamp(value.serverUpdatedAt));
  });
  cloudMeta.pull.cursor=cursor;
  cloudMeta.pull.incrementalReady=true;
  if(full) cloudMeta.pull.lastFullAt=Date.now();
  return {remote,full};
}
function fingerprint(value){
  const str=JSON.stringify(value??null); let h=2166136261;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(16).padStart(8,'0');
}
function allLocalDates(){
  const s=new Set([...Object.keys(data),...Object.keys(categories),...Object.keys(notes),...weights.map(x=>x.date),...measurements.map(x=>x.date)]);
  return [...s].filter(validDateKey).sort();
}
function measurementContent(date){ const m=measurements.find(x=>x.date===date); if(!m)return null; const {date:_d,...rest}=m; return rest; }
function buildDayContent(date){
  const body=weights.find(x=>x.date===date);
  const content={
    entries:compactEntriesForDate(date),
    category:categories[date]||'',
    note:notes[date]||'',
    bodyWeight:body?Number(body.weight):null,
    measurement:measurementContent(date)
  };
  const has=content.entries.length||content.category||content.note||content.bodyWeight||(content.measurement&&Object.keys(content.measurement).length);
  return has?{deleted:false,...content}:{deleted:true};
}
function dayHash(date){ return fingerprint(buildDayContent(date)); }
function cloneEntries(entries){
  try{return JSON.parse(JSON.stringify(entries||[]));}catch(_){return [];}
}
function captureDraftEntries(){
  const out={};
  Object.entries(data).forEach(([date,entries])=>{
    const drafts=(entries||[]).filter(e=>!e.isCardio&&(e.trainingDraft===true||(e.sets||[]).some(st=>st.done===false)));
    if(drafts.length) out[date]=cloneEntries(drafts);
  });
  return out;
}
function mergeDraftEntries(snapshot){
  Object.entries(snapshot||{}).forEach(([date,drafts])=>{
    if(!validDateKey(date)) return;
    if(!data[date]) data[date]=[];
    const byId=new Map((data[date]||[]).map((e,i)=>[String(e.id),i]));
    drafts.forEach(d=>{
      const k=String(d.id), clean=sanitizeEntry(d); if(!clean) return;
      if(byId.has(k)){
        const idx=byId.get(k), remote=data[date][idx];
        if(!remote?.isCardio&&!clean.isCardio){
          const max=Math.max(remote.sets?.length||0,clean.sets?.length||0), sets=[];
          for(let i=0;i<max;i++){
            const ls=clean.sets?.[i], rs=remote.sets?.[i];
            // Lo pendiente/borrador es local; una serie ya completada en nube
            // prevalece para no pisar cambios remotos al recuperar el borrador.
            if(ls&&ls.done===false) sets.push(ls);
            else if(rs&&rs.done===true) sets.push(rs);
            else if(ls) sets.push(ls);
            else if(rs) sets.push(rs);
          }
          data[date][idx]={...remote,...clean,sets:sets.map((x,i)=>({...x,setNumber:i+1})),trainingDraft:true};
        }else data[date][idx]=clean;
      }else data[date].push(clean);
    });
  });
}
function cloudDayContent(raw){
  if(!raw||raw.deleted===true) return {deleted:true};
  const date=cleanString(raw.date,'');
  const entries=date&&validDateKey(date)?(sanitizeData({[date]:raw.entries||[]})[date]||[]):[];
  const category=typeof raw.category==='string'?raw.category.trim():'';
  const note=typeof raw.note==='string'?raw.note.trim():'';
  const bodyWeight=finiteNumber(raw.bodyWeight,0); const m=isPlainObject(raw.measurement)?raw.measurement:null;
  const measurement=m?sanitizeMeasurements([{date:date||todayStr(),...m}])[0]:null;
  const mc=measurement?(()=>{const {date:_d,...x}=measurement;return x})():null;
  return {deleted:false,entries,category,note,bodyWeight:bodyWeight&&bodyWeight>0?bodyWeight:null,measurement:mc};
}
function applyCloudDay(date,raw){
  const c=cloudDayContent({...raw,date});
  delete data[date]; delete categories[date]; delete notes[date];
  weights=weights.filter(x=>x.date!==date); measurements=measurements.filter(x=>x.date!==date);
  if(!c.deleted){
    if(c.entries.length) data[date]=c.entries;
    if(c.category) categories[date]=c.category;
    if(c.note) notes[date]=c.note;
    if(c.bodyWeight) weights.push({date,weight:c.bodyWeight});
    if(c.measurement&&Object.keys(c.measurement).length) measurements.push({date,...c.measurement});
    weights.sort((a,b)=>a.date.localeCompare(b.date)); measurements.sort((a,b)=>a.date.localeCompare(b.date));
  }
  markDayDirty(date,{cloud:false,local:true});
}
function buildSettingsContent(){
  return buildSettingsSnapshot();
}
function settingsHash(){ return fingerprint(buildSettingsContent()); }
function applyCloudSettings(cloud){
  const needsSeed=settingsNeedSeed(cloud);
  applySettingsSnapshot(cloud);
  // Campos introducidos en versiones posteriores se siembran una sola vez
  // para que todos los dispositivos converjan al mismo contrato de settings.
  markSettingsDirty({cloud:needsSeed,local:true});
}
function cloudModeLabel(){ return cloudMode==='v2'?'Nube v2 · datos por día':cloudMode==='legacy'?'Nube heredada · documento único':'Conectando'; }
window.cloudModeLabel=cloudModeLabel;

async function cloudV2PermissionsAvailable(){
  if(!fb||!DOC_ID)return false;
  const ref=fb.doc(fb.db,'userData',DOC_ID,'meta','permissionProbe');
  try{ await withTimeout(fb.setDoc(ref,{probe:true,at:Date.now()}),6000); await withTimeout(fb.deleteDoc(ref),6000); return true; }
  catch(e){ if(e?.code==='permission-denied') lastSyncError='Las reglas de Firestore aún no permiten la nube v2. Publica firestore.rules de esta versión.'; return false; }
}
function localCloudMigrationBackup(){
  try{ localStorage.setItem('gymBackupBeforeCloudV2',JSON.stringify({savedAt:new Date().toISOString(),data,categories,weights,measurements,notes,...buildSettingsSnapshot()})); }catch(e){console.warn('No se pudo crear backup de migración',e);}
}
async function migrateLocalToCloudV2(){
  if(!(await cloudV2PermissionsAvailable())) return false;
  localCloudMigrationBackup(); loadCloudMeta();
  const dates=allLocalDates(); const nextDays={};
  try{
    for(let i=0;i<dates.length;i+=400){
      const batch=fb.writeBatch(fb.db);
      for(const date of dates.slice(i,i+400)){
        const content=buildDayContent(date); const revision=1;
        batch.set(fb.doc(fb.db,'userData',DOC_ID,'days',date),{date,...content,revision,updatedAt:Date.now(),serverUpdatedAt:fb.serverTimestamp()});
        nextDays[date]={revision,hash:fingerprint(content)};
      }
      await withTimeout(batch.commit(),15000);
    }
    const settings=buildSettingsContent();
    await withTimeout(fb.setDoc(fb.doc(fb.db,'userData',DOC_ID),{cloudSchemaVersion:CLOUD_SCHEMA_VERSION,revision:1,updatedAt:Date.now(),serverUpdatedAt:fb.serverTimestamp(),...settings}),10000);
    cloudMode='v2'; cloudMeta={days:nextDays,settings:{revision:1,hash:fingerprint(settings)},pull:{incrementalReady:false,cursor:null,lastFullAt:0}};
    cloudDirtyDays.clear(); cloudSettingsDirty=0; persistCloudDirtyMarkers(); saveCloudMeta();
    try{localStorage.removeItem(PENDING_KEY);}catch(e){} updateSyncStatus('Sincronizado','ok');
    return true;
  }catch(e){ console.error('Migración nube v2 falló:',e); lastSyncError=e?.message||String(e); cloudMode='legacy'; return false; }
}

async function saveCloudLegacy(){
  const stamp=updatedAt, cloudData=compactDataForCloud(data);
  await withTimeout(fb.setDoc(fb.doc(fb.db,'userData',DOC_ID),{ data:cloudData,categories,weights,measurements,notes,...buildSettingsSnapshot(),updatedAt:stamp }),10000);
}
async function applyLegacyCloud(cloud,stamp){
  const protectedDate=(typeof train!=='undefined'&&train&&validDateKey(train.date))?train.date:null;
  const protectedContent=protectedDate?buildDayContent(protectedDate):null;
  data=sanitizeData(cloud.data); categories=sanitizeCategories(cloud.categories); weights=sanitizeWeights(cloud.weights); measurements=sanitizeMeasurements(cloud.measurements); notes=sanitizeNotes(cloud.notes);
  applySettingsSnapshot({...cloud,exerciseNotes:cloud.exerciseNotes||readLocal(EX_NOTES_KEY,{},x=>x)});
  if(protectedDate&&protectedContent) applyLocalDayContent(protectedDate,protectedContent);
  const changed=migrateNames();
  markAllDaysDirty({cloud:false,local:true}); markSettingsDirty({cloud:false,local:true});
  await persistLocal({forceAll:true,replaceDays:true,settings:true});
  updatedAt=stamp;try{localStorage.removeItem(PENDING_KEY);localStorage.setItem(SYNCED_KEY,String(stamp));localStorage.setItem(UPDATED_KEY,String(stamp));}catch(e){}
  refreshAll();return changed;
}
function applyLocalDayContent(date,c){
  delete data[date];delete categories[date];delete notes[date];weights=weights.filter(x=>x.date!==date);measurements=measurements.filter(x=>x.date!==date);
  if(!c||c.deleted)return;
  if(c.entries?.length)data[date]=sanitizeData({[date]:c.entries})[date]||[];if(c.category)categories[date]=c.category;if(c.note)notes[date]=c.note;
  if(c.bodyWeight)weights.push({date,weight:c.bodyWeight});if(c.measurement)measurements.push({date,...c.measurement});
}

async function resolveDayConflict(date,cloudDoc){
  const keepLocal=await appConfirm(`La fecha ${date} cambió también en otro dispositivo.\\n\\nPuedes conservar lo de este dispositivo o usar la versión de la nube.`,{title:'Conflicto de sincronización',confirmText:'Conservar este dispositivo',cancelText:'Usar nube'});
  if(!keepLocal){ applyCloudDay(date,cloudDoc); cloudMeta.days[date]={revision:Number(cloudDoc.revision)||0,hash:fingerprint(cloudDayContent({...cloudDoc,date}))}; persistLocal(); return 'cloud'; }
  return 'local';
}
async function writeDayV2(date){
  let content=buildDayContent(date), expected=Number(cloudMeta.days[date]?.revision)||0;
  const ref=fb.doc(fb.db,'userData',DOC_ID,'days',date);
  for(let attempt=0;attempt<2;attempt++){
    try{
      let nextRev=expected+1;
      await withTimeout(fb.runTransaction(fb.db,async tx=>{
        const snap=await tx.get(ref), current=snap.exists()?(Number(snap.data().revision)||0):0;
        if(current!==expected) throw new Error('LIFTENGINE_DAY_CONFLICT');
        nextRev=current+1; tx.set(ref,{date,...content,revision:nextRev,updatedAt:Date.now(),serverUpdatedAt:fb.serverTimestamp()});
      }),10000);
      cloudMeta.days[date]={revision:nextRev,hash:fingerprint(content)}; return true;
    }catch(e){
      if(!String(e?.message||'').includes('LIFTENGINE_DAY_CONFLICT'))throw e;
      const snap=await fb.getDoc(ref), cloudDoc=snap.exists()?snap.data():{date,deleted:true,revision:0};
      const remoteContent=cloudDayContent({...cloudDoc,date});
      if(fingerprint(remoteContent)===fingerprint(content)){
        cloudMeta.days[date]={revision:Number(cloudDoc.revision)||0,hash:fingerprint(content)};
        return true;
      }
      const choice=await resolveDayConflict(date,cloudDoc); if(choice==='cloud')return true;
      expected=Number(cloudDoc.revision)||0; content=buildDayContent(date);
    }
  }
  return false;
}
async function writeSettingsV2(){
  const content=buildSettingsContent(); let expected=Number(cloudMeta.settings?.revision)||0; const ref=fb.doc(fb.db,'userData',DOC_ID);
  for(let attempt=0;attempt<2;attempt++){
    try{
      let nextRev=expected+1;
      await withTimeout(fb.runTransaction(fb.db,async tx=>{
        const snap=await tx.get(ref), current=snap.exists()?(Number(snap.data().revision)||0):0;
        if(current!==expected) throw new Error('LIFTENGINE_SETTINGS_CONFLICT');
        nextRev=current+1;tx.set(ref,{cloudSchemaVersion:CLOUD_SCHEMA_VERSION,revision:nextRev,updatedAt:Date.now(),serverUpdatedAt:fb.serverTimestamp(),...content});
      }),10000);
      cloudMeta.settings={revision:nextRev,hash:fingerprint(content)};return true;
    }catch(e){
      if(!String(e?.message||'').includes('LIFTENGINE_SETTINGS_CONFLICT'))throw e;
      const snap=await fb.getDoc(ref), cloud=snap.exists()?snap.data():{};
      const remoteSettings=sanitizeSettingsSnapshot(cloud);
      if(fingerprint(remoteSettings)===fingerprint(content)){
        cloudMeta.settings={revision:Number(cloud.revision)||0,hash:fingerprint(content)};
        return true;
      }
      const keepLocal=await appConfirm('La configuración (rutinas, alias, tema o notas de ejercicios) cambió en otro dispositivo.\\n\\n¿Conservar la configuración de este dispositivo?',{title:'Conflicto de configuración',confirmText:'Conservar este dispositivo',cancelText:'Usar nube'});
      if(!keepLocal){applyCloudSettings(cloud);const renamed=(typeof migrateNames==='function')?migrateNames():false;cloudMeta.settings={revision:Number(cloud.revision)||0,hash:fingerprint(buildSettingsContent())};persistLocal();if(renamed)saveQueued=true;return true;}
      expected=Number(cloud.revision)||0;
    }
  }
  return false;
}
function hasCloudDirty(){ return cloudDirtyDays.size>0 || !!cloudSettingsDirty; }
function markFallbackDirtyFromState(){
  const dates=new Set([...allLocalDates(),...Object.keys(cloudMeta.days||{})]);
  dates.forEach(d=>{
    const meta=cloudMeta.days[d];
    if(!meta||meta.hash!==dayHash(d)) markDayDirty(d,{cloud:true,local:false});
  });
  if((cloudMeta.settings?.hash||'')!==settingsHash()) markSettingsDirty({cloud:true,local:false});
}
function applySaveScope(scope){
  if(!scope) return;
  if(scope.allDays){
    const dates=new Set([...allLocalDates(),...Object.keys(cloudMeta.days||{})]);
    dates.forEach(d=>markDayDirty(d,{cloud:true,local:true}));
  }
  (scope.days||[]).forEach(d=>markDayDirty(d,{cloud:true,local:true}));
  if(scope.settings) markSettingsDirty({cloud:true,local:true});
}
function clearPendingIfClean(){
  persistCloudDirtyMarkers();
  if(!hasCloudDirty()){
    try{localStorage.removeItem(PENDING_KEY);localStorage.setItem(SYNCED_KEY,String(updatedAt));}catch(e){}
  }
}
async function saveCloudV2Changes(){
  loadCloudMeta();
  // Compatibilidad con cambios pendientes creados por v5.5.x: si existe la
  // bandera global pero todavía no había dirtyDays, reconstruimos el conjunto
  // una única vez comparando hashes. Las operaciones normales v5.6 no hacen
  // este barrido completo.
  if(localStorage.getItem(PENDING_KEY)==='1'&&!hasCloudDirty()) markFallbackDirtyFromState();

  for(const [date,version] of [...cloudDirtyDays.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
    const hash=dayHash(date), meta=cloudMeta.days[date];
    if(meta&&meta.hash===hash){
      if(cloudDirtyDays.get(date)===version) cloudDirtyDays.delete(date);
      continue;
    }
    if(!meta&&buildDayContent(date).deleted){
      if(cloudDirtyDays.get(date)===version) cloudDirtyDays.delete(date);
      continue;
    }
    const ok=await writeDayV2(date);
    if(!ok) throw new Error(`No se pudo confirmar la escritura del día ${date}.`);
    if(cloudDirtyDays.get(date)===version) cloudDirtyDays.delete(date);
  }

  if(cloudSettingsDirty){
    const version=cloudSettingsDirty;
    if((cloudMeta.settings?.hash||'')===settingsHash()){
      if(cloudSettingsDirty===version) cloudSettingsDirty=0;
    }else{
      const ok=await writeSettingsV2();
      if(!ok) throw new Error('No se pudo confirmar la escritura de la configuración.');
      if(cloudSettingsDirty===version) cloudSettingsDirty=0;
    }
  }
  persistCloudDirtyMarkers(); saveCloudMeta();
}

async function saveToFirebase(scope=null){
  applySaveScope(scope);
  // Llamadas antiguas sin ámbito se mantienen seguras: solo como fallback se
  // detectan diferencias por hash. Los flujos normales v5.6 pasan days/settings.
  if(!scope&&!hasCloudDirty()) markFallbackDirtyFromState();
  updatedAt=Date.now();
  try{localStorage.setItem(UPDATED_KEY,String(updatedAt)); if(hasCloudDirty())localStorage.setItem(PENDING_KEY,'1');}catch(e){}
  await persistLocal();
  if(!hasCloudDirty()) { updateSyncStatus('Sincronizado','ok'); return true; }
  if(!cloudReady||!fb||!DOC_ID){updateSyncStatus('Pendiente de sincronizar','saving');return false;}
  if(saveInFlight){saveQueued=true;return false;}saveInFlight=true;updateSyncStatus('Guardando…','saving');let ok=true;
  try{
    do{
      saveQueued=false;await persistLocal();
      if(cloudMode==='v2') await saveCloudV2Changes();
      else{
        try{ await saveCloudLegacy(); cloudDirtyDays.clear(); cloudSettingsDirty=0; persistCloudDirtyMarkers(); }
        catch(e){
          if(e?.code==='permission-denied' && await cloudV2PermissionsAvailable()){
            if(!(await migrateLocalToCloudV2())) throw e;
            cloudDirtyDays.clear(); cloudSettingsDirty=0; persistCloudDirtyMarkers();
          }else throw e;
        }
      }
    }while(saveQueued||hasCloudDirty());
    clearPendingIfClean(); updateSyncStatus('Sincronizado','ok');
  }catch(e){console.error('LiftEngine · error sincronizando:',e);lastSyncError=e?.message||String(e);persistCloudDirtyMarkers();updateSyncStatus('Guardado local · sin conexión','error');ok=false;}
  finally{saveInFlight=false;if((saveQueued||hasCloudDirty())&&ok)saveToFirebase();}return ok;
}

async function syncCloudV2(rootCloud){
  cloudMode='v2'; loadCloudMeta(); loadCloudDirtyMarkers();
  const {remote,full}=await fetchCloudDaysV2();
  const pending=localStorage.getItem(PENDING_KEY)==='1'||hasCloudDirty();
  const protectedDate=(typeof train!=='undefined'&&train&&validDateKey(train.date))?train.date:null;
  const localDrafts=captureDraftEntries();

  if(full&&!pending){
    // Pull completo de referencia: reconstruimos la memoria desde la nube, pero
    // conservamos después los borradores locales (que nunca cuentan como historial).
    data={};categories={};weights=[];measurements=[];notes={};
    applyCloudSettings(rootCloud);
    cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};
    cloudMeta.days={};
    remote.forEach((doc,date)=>{
      applyCloudDay(date,doc);
      cloudMeta.days[date]={revision:Number(doc.revision)||0,hash:fingerprint(cloudDayContent({...doc,date}))};
    });
  }else{
    // En pulls incrementales solo se inspeccionan los documentos que Firestore
    // reporta como modificados desde el cursor. Un pull completo periódico sigue
    // actuando como red de seguridad para clientes v5.5.x sin serverUpdatedAt.
    const dates=full
      ? new Set([...remote.keys(),...allLocalDates(),...Object.keys(cloudMeta.days||{})])
      : new Set(remote.keys());
    for(const date of [...dates].sort()){
      const rd=remote.get(date);
      if(!rd) continue;
      const meta=cloudMeta.days[date]||{revision:0,hash:fingerprint({deleted:true})};
      const localHash=dayHash(date);
      const localChanged=cloudDirtyDays.has(date)||localHash!==meta.hash;
      const remoteRev=Number(rd.revision)||0;
      const remoteChanged=remoteRev!==Number(meta.revision||0);
      if(remoteChanged&&!localChanged){
        applyCloudDay(date,rd);
        cloudMeta.days[date]={revision:remoteRev,hash:fingerprint(cloudDayContent({...rd,date}))};
      }else if(remoteChanged&&localChanged){
        const choice=await resolveDayConflict(date,rd);
        if(choice==='local') cloudMeta.days[date]={revision:remoteRev,hash:meta.hash};
        else cloudDirtyDays.delete(date);
      }else if(!cloudMeta.days[date]){
        cloudMeta.days[date]={revision:remoteRev,hash:fingerprint(cloudDayContent({...rd,date}))};
      }
    }

    const localSettingsChanged=!!cloudSettingsDirty || settingsHash()!==(cloudMeta.settings?.hash||'');
    const remoteSettingsChanged=(Number(rootCloud.revision)||0)!==(Number(cloudMeta.settings?.revision)||0);
    if(remoteSettingsChanged&&!localSettingsChanged){
      applyCloudSettings(rootCloud); cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};
    }else if(remoteSettingsChanged&&localSettingsChanged){
      const keep=await appConfirm('La configuración también cambió en otro dispositivo. ¿Conservar la configuración local?',{title:'Conflicto de configuración',confirmText:'Conservar local',cancelText:'Usar nube'});
      if(keep) cloudMeta.settings.revision=Number(rootCloud.revision)||0;
      else{
        applyCloudSettings(rootCloud);
        cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};
        cloudSettingsDirty=0;
      }
    }
  }

  mergeDraftEntries(localDrafts);
  const namesChanged=(typeof migrateNames==='function')?migrateNames():false;
  if(!cloudMeta.settings?.revision) cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};

  // Un pull completo sustituye la colección local de días de IndexedDB. Un pull
  // incremental solo escribe las fechas efectivamente aplicadas/marcadas.
  if(full) await persistLocal({forceAll:true,replaceDays:true,settings:true});
  else await persistLocal({settings:localSettingsDirty>0});
  saveCloudMeta(); updatedAt=Number(rootCloud.updatedAt)||Date.now(); refreshAll();

  if(pending||namesChanged||hasCloudDirty()||(protectedDate&&dayHash(protectedDate)!==(cloudMeta.days[protectedDate]?.hash||fingerprint({deleted:true})))){
    await saveCloudV2Changes();
  }
  clearPendingIfClean();
  try{localStorage.setItem(UPDATED_KEY,String(updatedAt));}catch(e){}
  saveCloudMeta(); updateSyncStatus(hasCloudDirty()?'Pendiente de sincronizar':'Sincronizado',hasCloudDirty()?'saving':'ok');
  return !hasCloudDirty();
}

async function syncFromCloud(){
  if(syncing||!DOC_ID)return false;syncing=true;
  try{
    if(!(await connectFirebase()))return false;loadCloudMeta();
    const ref=fb.doc(fb.db,'userData',DOC_ID),snap=await withTimeout(fb.getDoc(ref),10000);cloudReady=true;
    const hasLocal=allLocalDates().length>0||Object.keys(exerciseNotes).length>0||Object.keys(customRoutines).length>0;
    if(!snap.exists()){
      if(await cloudV2PermissionsAvailable()){cloudMode='v2';await migrateLocalToCloudV2();if(!hasLocal)await saveCloudV2Changes();return true;}
      cloudMode='legacy';if(hasLocal)await saveToFirebase();else updateSyncStatus('Sincronizado','ok');return true;
    }
    const cloud=snap.data();
    if(Number(cloud.cloudSchemaVersion)>=CLOUD_SCHEMA_VERSION)return await syncCloudV2(cloud);
    cloudMode='legacy';const cloudStamp=Number(cloud.updatedAt)||0,pending=localStorage.getItem(PENDING_KEY)==='1';let useLocal=false;
    if(pending){const synced=Number(localStorage.getItem(SYNCED_KEY))||0;useLocal=cloudStamp>synced?await appConfirm('Tienes cambios sin sincronizar en este dispositivo y la nube también cambió.\\n\\n¿Conservar lo de este dispositivo?',{title:'Conflicto de sincronización',confirmText:'Conservar local',cancelText:'Usar nube'}):true;}
    let legacyChanged=false;
    if(useLocal) await saveCloudLegacy();
    else legacyChanged=!!(await applyLegacyCloud(cloud,cloudStamp));
    // Migración automática solo cuando las reglas publicadas permiten subcolecciones.
    // Evitamos disparar un guardado heredado en paralelo con la migración v2.
    if(await cloudV2PermissionsAvailable()) await migrateLocalToCloudV2();
    else{
      if(legacyChanged) await saveCloudLegacy();
      updateSyncStatus('Sincronizado · nube heredada','ok');
    }
    return true;
  }catch(e){lastSyncError=(e&&((e.code?e.code+': ':'')+(e.message||'')))||String(e||'Error de sincronización');console.error('Error de sincronización:',e);return false;}
  finally{syncing=false;}
}


window.tryMigrateCloudV2=async function(){
  if(cloudMode==='v2'){toast('Ya estás usando la nube v2');return true;}
  updateSyncStatus('Preparando nube v2…','saving');
  if(!(await connectFirebase())||!DOC_ID){await appAlert('No hay una sesión de Firebase disponible.','Nube v2');return false;}
  if(!(await cloudV2PermissionsAvailable())){
    updateSyncStatus('Sincronizado · nube heredada','ok');
    await appAlert(`La migración aún no puede activarse porque las reglas de Firestore publicadas no permiten la subcolección de días. Publica el archivo firestore.rules incluido en LiftEngine v${APP_VERSION} y vuelve a intentarlo.`,'Falta actualizar Firestore');
    return false;
  }
  const ok=await migrateLocalToCloudV2();
  if(ok){renderSettingsModal();toast('Nube v2 activada');}
  else await appAlert('No se pudo completar la migración. Tus datos locales y la nube heredada se conservaron.','Migración no completada');
  return ok;
};

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function syncFromCloudWithRetry(attempts=2){
  let ok=false;
  for(let i=0;i<attempts;i++){
    ok=await syncFromCloud();
    if(ok){ lastCloudPullAt=Date.now(); return true; }
    if(i<attempts-1){
      updateSyncStatus('Reintentando sincronización…','saving');
      await delay(1200*(i+1));
    }
  }
  return false;
}

function waitForAuthState(timeoutMs=8000){
  return new Promise(resolve=>{
    if(!fb||!fb.auth) return resolve(null);
    if(fb.auth.currentUser) return resolve(fb.auth.currentUser);
    let done=false, unsub=()=>{};
    const finish=user=>{ if(done) return; done=true; try{unsub();}catch(e){} resolve(user||null); };
    unsub=fb.onAuthStateChanged(fb.auth,user=>finish(user));
    setTimeout(()=>finish(fb.auth.currentUser),timeoutMs);
  });
}

window.retryCloudSync = async function(){
  // Una sincronización manual fuerza un pull completo. Además de ser más
  // intuitivo para el usuario, sirve como red de compatibilidad con clientes
  // antiguos que todavía no escriben serverUpdatedAt.
  forceNextFullPull=true;
  updateSyncStatus('Conectando…','saving');
  try{
    if(!(await connectFirebase())){ updateSyncStatus('Guardado local · sin conexión','error'); toast('No se pudo conectar con Firebase'); return false; }
    const user=fb.auth.currentUser || await waitForAuthState(8000);
    if(!user){ updateSyncStatus('Sesión no disponible','error'); toast('Vuelve a iniciar sesión con Google'); return false; }
    DOC_ID=user.uid;
    localStorage.setItem('gymLastUid',user.uid);
    const ok=await syncFromCloudWithRetry(2);
    if(!ok){ updateSyncStatus('Guardado local · sin conexión','error'); toast('No se pudo sincronizar. Tus datos siguen guardados en este dispositivo.'); }
    else toast('Sincronización actualizada');
    return ok;
  }catch(e){
    console.error('Error al reintentar sincronización:',e);
    updateSyncStatus('Guardado local · sin conexión','error');
    toast('No se pudo sincronizar');
    return false;
  }
};

function updateCategorySelect() {
    const sel = document.getElementById('dayCategory');
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Sin etiqueta --</option>' + Object.keys(customRoutines).map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('') + '<option value="Descanso">Descanso</option>';
    if(Object.keys(customRoutines).includes(current) || current === 'Descanso') sel.value = current;
}

function updateSyncStatus(text,state){
  const el=document.getElementById('syncStatus');
  if(!el) return;
  el.innerHTML=ic('cloud')+' '+escapeHtml(text);
  el.dataset.state=state||'';
  el.title=(state==='error'&&lastSyncError) ? lastSyncError : '';
}

function toKg(val) { let num = parseFloat(val) || 0; return currentUnit === 'lbs' ? num / 2.20462 : num; }
function fromKg(val) { let num = parseFloat(val) || 0; return currentUnit === 'lbs' ? num * 2.20462 : num; }
function unitLabel() { return currentUnit.toUpperCase(); }

window.toggleUnit = function() {
    const rows=[...document.querySelectorAll('.set-row')].map(r=>({
        reps:r.querySelector('.set-reps').value,
        kg:toKg(r.querySelector('.set-weight').value),  
        rir:r.querySelector('.set-rir').value,
        rest:r.querySelector('.set-rest').value,
        type:normalizeSetType(r.querySelector('.set-type')?.value)
    }));
    currentUnit = currentUnit === 'kg' ? 'lbs' : 'kg';
    document.getElementById('unitBtn').innerText = currentUnit.toUpperCase();
    document.getElementById('setsContainer').innerHTML=''; setCounter=0;
    if(rows.length) rows.forEach(r=>addSet({reps:r.reps,weight:r.kg?Math.round(fromKg(r.kg)*10)/10:'',rir:r.rir,rest:r.rest,type:r.type})); else addSet();
    saveToFirebase({settings:true}); refreshAll(); toast('Cambiado a ' + currentUnit.toUpperCase());
}

window.setTheme = function(t) {
    currentTheme=normalizeTheme(t);
    applyTheme();
    markSettingsDirty({cloud:true,local:true});
    persistLocal({settings:true});
    saveToFirebase({settings:true});
    renderSettingsModal();
    refreshAll();
    const label=({auto:'Automático',light:'Claro',default:'Oscuro',ocean:'Océano',forest:'Bosque',coffee:'Café'})[currentTheme]||'Visual';
    toast('Tema: '+label);
}

