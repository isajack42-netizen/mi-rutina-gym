// LiftEngine · núcleo: estado, persistencia, Firebase, unidades y tema
'use strict';
let DOC_ID = localStorage.getItem('gymLastUid') || null;
const PENDING_KEY='gymPendingSync', SYNCED_KEY='gymSyncedAt', UPDATED_KEY='gymUpdatedAt';
let fb=null, cloudReady=false, syncing=false, updatedAt=Number(localStorage.getItem(UPDATED_KEY))||0, lastSyncError='', lastCloudPullAt=0;
let cloudMode='unknown', cloudMeta={days:{},settings:{revision:0,hash:''}};
const CLOUD_META_PREFIX='gymCloudMetaV2:';

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

function wipeLocalData(){
    [KEY,CAT,WEIGHT,MEASURE,'trackGym_notes',ROUTINES_KEY,'gymAliases','gymMuscles','gymExerciseNotes',PENDING_KEY,SYNCED_KEY,UPDATED_KEY,'gymTrainState','gymBackupBeforeRename','gymBackupBeforeImport','gymBackupBeforeCSVImport','gymBackupBeforeCloudV2','gymRecoveryBackup','gymLastUid']
      .forEach(k=>{ try{localStorage.removeItem(k)}catch(e){} });
    try{ for(let i=localStorage.length-1;i>=0;i--){ const k=localStorage.key(i); if(k&&k.startsWith(CLOUD_META_PREFIX)) localStorage.removeItem(k); } }catch(e){}
    cloudMeta={days:{},settings:{revision:0,hash:''}}; cloudMode='unknown'; updatedAt=0;
}

window.logout = async function() {
    if(!fb) return;
    if(localStorage.getItem(PENDING_KEY)==='1' && !(await appConfirm(`Hay cambios que aún NO se han sincronizado con la nube y se perderían al cerrar sesión.\n\n¿Cerrar sesión de todos modos?`,{title:'Cambios pendientes',confirmText:'Cerrar sesión',danger:true}))) return;
    if(await appConfirm('¿Estás seguro de cerrar sesión? Solo podrás ver y sincronizar tus rutinas al volver a entrar.',{title:'Cerrar sesión',confirmText:'Cerrar sesión',danger:true})) {
        await fb.signOut(fb.auth);
        wipeLocalData();
        location.reload();
    }
};

const KEY='trackGymDataV2', CAT='gymCategories', WEIGHT='gymBodyWeight', MEASURE='gymBodyMeasurements', UNIT_KEY='gymUnitSystem', THEME_KEY='gymTheme', ROUTINES_KEY='gymCustomRoutines', EX_NOTES_KEY='gymExerciseNotes';

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
let data={}, categories={}, weights=[], measurements=[], notes={}, exerciseNotes={}, customRoutines={}, currentUnit='kg', currentTheme='default', setCounter=0, currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear(), selectedDate='', logType='pesas', chart=null, muscleChart=null, bodyWeightChart=null, measurementChart=null, saveInFlight=false, saveQueued=false;
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
function finiteNumber(v,min=0){ const n=Number(v); return Number.isFinite(n)&&n>=min ? n : null; }
function validDateKey(v){
  const s=String(v); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d=new Date(s+'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s;
}


let dialogResolve=null;
function closeAppDialog(value=false){
  const back=document.getElementById('dialogBackdrop');
  if(!back) return;
  back.classList.remove('show'); back.setAttribute('aria-hidden','true');
  const r=dialogResolve; dialogResolve=null; if(r) r(value);
}
function appDialog({title='LiftEngine',message='',confirmText='Aceptar',cancelText='',danger=false}={}){
  const back=document.getElementById('dialogBackdrop'), box=document.getElementById('appDialog');
  if(!back||!box){ console.warn('Diálogo no disponible:',title,message); return Promise.resolve(cancelText?false:true); }
  if(dialogResolve){ const prev=dialogResolve; dialogResolve=null; try{prev(false);}catch(e){} }
  box.innerHTML=`<h2 id="appDialogTitle">${escapeHtml(title)}</h2><div class="dialog-message">${escapeHtml(message)}</div><div class="dialog-actions">${cancelText?`<button class="btn btn-secondary" id="appDialogCancel">${escapeHtml(cancelText)}</button>`:''}<button class="btn ${danger?'btn-danger':'btn-primary'}" id="appDialogConfirm">${escapeHtml(confirmText)}</button></div>`;
  back.classList.add('show'); back.setAttribute('aria-hidden','false');
  return new Promise(resolve=>{
    dialogResolve=resolve;
    box.querySelector('#appDialogConfirm')?.addEventListener('click',()=>closeAppDialog(true),{once:true});
    box.querySelector('#appDialogCancel')?.addEventListener('click',()=>closeAppDialog(false),{once:true});
    setTimeout(()=>box.querySelector('#appDialogConfirm')?.focus(),20);
  });
}
function appAlert(message,title='Aviso'){ return appDialog({title,message,confirmText:'Entendido'}); }
function appConfirm(message,{title='Confirmar',confirmText='Continuar',cancelText='Cancelar',danger=false}={}){ return appDialog({title,message,confirmText,cancelText,danger}); }
window.appAlert=appAlert; window.appConfirm=appConfirm;

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
  const weight=finiteNumber(set.weight,0);
  const restUsed=finiteNumber(set.restUsed,0);
  const reps=cleanString(set.reps,'-') || '-';
  // El estado completado es explícito. Para datos históricos sin
  // `done`, una serie con reps válidas se migra una sola vez como completada.
  const done=typeof set.done==='boolean' ? set.done : ((parseFloat(reps)||0)>0);
  return {
    setNumber: Math.max(1, Number(set.setNumber)||index+1),
    reps,
    weight: weight===null ? 0 : weight,
    rir: cleanString(set.rir,'-') || '-',
    rest: normalizeRestLabel(cleanString(set.rest,'-') || '-'),
    type: normalizeSetType(set.type||set.setType),
    done,
    ...(restUsed!==null ? {restUsed} : {})
  };
}

function sanitizeEntry(entry){
  if(!isPlainObject(entry)) return null;
  const id=entry.id!=null ? entry.id : Date.now()+Math.random();
  const name=cleanString(entry.name,'Registro');
  if(entry.isCardio){
    return {id,isCardio:true,name,time:cleanString(entry.time,'-')||'-',distance:cleanString(entry.distance,'-')||'-'};
  }
  const sets=Array.isArray(entry.sets) ? entry.sets.map(sanitizeSet).filter(Boolean) : [];
  if(!name || !sets.length) return null;
  sets.forEach((s,i)=>s.setNumber=i+1);
  const substitutedFrom=cleanString(entry.substitutedFrom,'');
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
  const out={};
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([date,value])=>{ if(safeKey(date)&&validDateKey(date)&&typeof value==='string'&&value.trim()) out[date]=value.trim(); });
  return out;
}

function sanitizeNotes(raw){
  const out={};
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([date,value])=>{ if(safeKey(date)&&validDateKey(date)&&typeof value==='string'&&value.trim()) out[date]=value.trim(); });
  return out;
}


function sanitizeExerciseNotes(raw){
  const out={};
  if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([name,value])=>{
    if(!safeKey(name)||typeof value!=='string') return;
    const n=cleanString(name),v=value.trim();
    if(n&&v) out[n]=v.slice(0,1200);
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
    const fixed = {};
    if(!isPlainObject(routines)) return fixed;
    for (const [k,rows] of Object.entries(routines)) {
        if(!safeKey(k)||!Array.isArray(rows)) continue;
        fixed[k.trim()] = rows.map((ex,index) => {
            if (Array.isArray(ex)) return { name: cleanString(ex[0]), sets: Math.max(0,Number(ex[1])||0), reps: cleanString(ex[2]), rir: cleanString(ex[3]), rest: normalizeRestLabel(cleanString(ex[4])) };
            if(!isPlainObject(ex)) return null;
            return { name: cleanString(ex.name), sets: Math.max(0,Number(ex.sets)||0), reps: cleanString(ex.reps), rir: cleanString(ex.rir), rest: normalizeRestLabel(cleanString(ex.rest)) };
        }).filter(ex=>ex&&ex.name);
    }
    return fixed;
}

function sanitizeAliases(raw){
  const out={}; if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([k,v])=>{ if(safeKey(k)&&typeof v==='string'&&v.trim()) out[k.trim().toLowerCase()]=v.trim(); });
  return out;
}
function sanitizeMuscles(raw){
  const out={}; if(!isPlainObject(raw)) return out;
  Object.entries(raw).forEach(([k,v])=>{ if(safeKey(k)&&Array.isArray(v)) out[k]=v.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()); });
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

function load(){
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
  currentTheme=cleanString(localStorage.getItem(THEME_KEY),'default')||'default';
  customAliases = aliasesStored ? sanitizeAliases(readLocal('gymAliases', {}, x=>x)) : JSON.parse(JSON.stringify(defaultAliases));
  customMuscles = musclesStored ? sanitizeMuscles(readLocal('gymMuscles', {}, x=>x)) : JSON.parse(JSON.stringify(defaultMuscles));
  document.getElementById('unitBtn').innerText = currentUnit.toUpperCase();
  document.documentElement.setAttribute('data-theme', currentTheme);
  if(localNormalizationDetected){
    try{ persistLocal(); localNormalizationDetected=false; }catch(e){ console.warn('No se pudo persistir la normalización local:',e); }
  }
}

function persistLocal(){
  localStorage.setItem(KEY,JSON.stringify(data));
  localStorage.setItem(CAT,JSON.stringify(categories));
  localStorage.setItem(WEIGHT,JSON.stringify(weights));
  localStorage.setItem(MEASURE,JSON.stringify(measurements));
  localStorage.setItem('trackGym_notes',JSON.stringify(notes));
  localStorage.setItem(EX_NOTES_KEY,JSON.stringify(exerciseNotes));
  localStorage.setItem(ROUTINES_KEY,JSON.stringify(customRoutines));
  localStorage.setItem('gymAliases',JSON.stringify(customAliases)); // Fase 3
  localStorage.setItem('gymMuscles',JSON.stringify(customMuscles)); // Fase 3
  localStorage.setItem(UNIT_KEY, currentUnit);
  localStorage.setItem(THEME_KEY, currentTheme);
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
  cloudMeta=isPlainObject(raw)?raw:{days:{},settings:{revision:0,hash:''}};
  if(!isPlainObject(cloudMeta.days)) cloudMeta.days={};
  if(!isPlainObject(cloudMeta.settings)) cloudMeta.settings={revision:0,hash:''};
}
function saveCloudMeta(){ try{localStorage.setItem(cloudMetaKey(),JSON.stringify(cloudMeta));}catch(e){console.warn('No se pudo guardar metadata de nube',e);} }
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
  if(c.deleted) return;
  if(c.entries.length) data[date]=c.entries;
  if(c.category) categories[date]=c.category;
  if(c.note) notes[date]=c.note;
  if(c.bodyWeight) weights.push({date,weight:c.bodyWeight});
  if(c.measurement&&Object.keys(c.measurement).length) measurements.push({date,...c.measurement});
  weights.sort((a,b)=>a.date.localeCompare(b.date)); measurements.sort((a,b)=>a.date.localeCompare(b.date));
}
function buildSettingsContent(){
  return {
    exerciseNotes:sanitizeExerciseNotes(exerciseNotes),
    customRoutines:sanitizeRoutines(customRoutines),
    customAliases:sanitizeAliases(customAliases),
    customMuscles:sanitizeMuscles(customMuscles),
    currentUnit:currentUnit==='lbs'?'lbs':'kg',
    currentTheme:cleanString(currentTheme,'default')||'default'
  };
}
function settingsHash(){ return fingerprint(buildSettingsContent()); }
function applyCloudSettings(cloud){
  const has=(k)=>Object.prototype.hasOwnProperty.call(cloud||{},k);
  exerciseNotes=sanitizeExerciseNotes(cloud.exerciseNotes||{});
  customRoutines=has('customRoutines')?sanitizeRoutines(cloud.customRoutines):JSON.parse(JSON.stringify(defaultPPL));
  customAliases=has('customAliases')?sanitizeAliases(cloud.customAliases):JSON.parse(JSON.stringify(defaultAliases));
  customMuscles=has('customMuscles')?sanitizeMuscles(cloud.customMuscles):JSON.parse(JSON.stringify(defaultMuscles));
  currentUnit=cloud.currentUnit==='lbs'?'lbs':'kg'; currentTheme=cleanString(cloud.currentTheme,'default')||'default';
  document.getElementById('unitBtn').innerText=currentUnit.toUpperCase(); document.documentElement.setAttribute('data-theme',currentTheme);
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
  try{ localStorage.setItem('gymBackupBeforeCloudV2',JSON.stringify({savedAt:new Date().toISOString(),data,categories,weights,measurements,notes,exerciseNotes,customRoutines,customAliases,customMuscles,currentUnit,currentTheme})); }catch(e){console.warn('No se pudo crear backup de migración',e);}
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
        batch.set(fb.doc(fb.db,'userData',DOC_ID,'days',date),{date,...content,revision,updatedAt:Date.now()});
        nextDays[date]={revision,hash:fingerprint(content)};
      }
      await withTimeout(batch.commit(),15000);
    }
    const settings=buildSettingsContent();
    await withTimeout(fb.setDoc(fb.doc(fb.db,'userData',DOC_ID),{cloudSchemaVersion:CLOUD_SCHEMA_VERSION,revision:1,updatedAt:Date.now(),...settings}),10000);
    cloudMode='v2'; cloudMeta={days:nextDays,settings:{revision:1,hash:fingerprint(settings)}}; saveCloudMeta();
    try{localStorage.removeItem(PENDING_KEY);}catch(e){} updateSyncStatus('Sincronizado','ok');
    return true;
  }catch(e){ console.error('Migración nube v2 falló:',e); lastSyncError=e?.message||String(e); cloudMode='legacy'; return false; }
}

async function saveCloudLegacy(){
  const stamp=updatedAt, cloudData=compactDataForCloud(data);
  await withTimeout(fb.setDoc(fb.doc(fb.db,'userData',DOC_ID),{ data:cloudData,categories,weights,measurements,notes,exerciseNotes,customRoutines,customAliases,customMuscles,currentUnit,currentTheme,updatedAt:stamp }),10000);
}
function applyLegacyCloud(cloud,stamp){
  const protectedDate=(typeof train!=='undefined'&&train&&validDateKey(train.date))?train.date:null;
  const protectedContent=protectedDate?buildDayContent(protectedDate):null;
  data=sanitizeData(cloud.data); categories=sanitizeCategories(cloud.categories); weights=sanitizeWeights(cloud.weights); measurements=sanitizeMeasurements(cloud.measurements); notes=sanitizeNotes(cloud.notes); exerciseNotes=sanitizeExerciseNotes(cloud.exerciseNotes||readLocal(EX_NOTES_KEY,{},x=>x));
  const hasCfg=(k)=>Object.prototype.hasOwnProperty.call(cloud||{},k);
  customRoutines=hasCfg('customRoutines')?sanitizeRoutines(cloud.customRoutines):JSON.parse(JSON.stringify(defaultPPL));
  customAliases=hasCfg('customAliases')?sanitizeAliases(cloud.customAliases):JSON.parse(JSON.stringify(defaultAliases));
  customMuscles=hasCfg('customMuscles')?sanitizeMuscles(cloud.customMuscles):JSON.parse(JSON.stringify(defaultMuscles));
  currentUnit=cloud.currentUnit==='lbs'?'lbs':'kg';currentTheme=cleanString(cloud.currentTheme,'default')||'default';document.getElementById('unitBtn').innerText=currentUnit.toUpperCase();
  if(protectedDate&&protectedContent) applyLocalDayContent(protectedDate,protectedContent);
  persistLocal();updatedAt=stamp;try{localStorage.removeItem(PENDING_KEY);localStorage.setItem(SYNCED_KEY,String(stamp));localStorage.setItem(UPDATED_KEY,String(stamp));}catch(e){}
  const changed=migrateNames();refreshAll();return changed;
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
        nextRev=current+1; tx.set(ref,{date,...content,revision:nextRev,updatedAt:Date.now()});
      }),10000);
      cloudMeta.days[date]={revision:nextRev,hash:fingerprint(content)}; return true;
    }catch(e){
      if(!String(e?.message||'').includes('LIFTENGINE_DAY_CONFLICT'))throw e;
      const snap=await fb.getDoc(ref), cloudDoc=snap.exists()?snap.data():{date,deleted:true,revision:0};
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
        nextRev=current+1;tx.set(ref,{cloudSchemaVersion:CLOUD_SCHEMA_VERSION,revision:nextRev,updatedAt:Date.now(),...content});
      }),10000);
      cloudMeta.settings={revision:nextRev,hash:fingerprint(content)};return true;
    }catch(e){
      if(!String(e?.message||'').includes('LIFTENGINE_SETTINGS_CONFLICT'))throw e;
      const snap=await fb.getDoc(ref), cloud=snap.exists()?snap.data():{};
      const keepLocal=await appConfirm('La configuración (rutinas, alias, tema o notas de ejercicios) cambió en otro dispositivo.\\n\\n¿Conservar la configuración de este dispositivo?',{title:'Conflicto de configuración',confirmText:'Conservar este dispositivo',cancelText:'Usar nube'});
      if(!keepLocal){applyCloudSettings(cloud);const renamed=(typeof migrateNames==='function')?migrateNames():false;cloudMeta.settings={revision:Number(cloud.revision)||0,hash:fingerprint(buildSettingsContent())};persistLocal();if(renamed)saveQueued=true;return true;}
      expected=Number(cloud.revision)||0;
    }
  }
  return false;
}
async function saveCloudV2Changes(){
  loadCloudMeta(); const dates=new Set([...allLocalDates(),...Object.keys(cloudMeta.days||{})]);
  for(const date of [...dates].sort()){
    const hash=dayHash(date), meta=cloudMeta.days[date];
    if(!meta&&buildDayContent(date).deleted)continue;
    if(!meta||meta.hash!==hash){
      const ok=await writeDayV2(date);
      if(!ok) throw new Error(`No se pudo confirmar la escritura del día ${date}.`);
    }
  }
  if((cloudMeta.settings?.hash||'')!==settingsHash()){
    const ok=await writeSettingsV2();
    if(!ok) throw new Error('No se pudo confirmar la escritura de la configuración.');
  }
  saveCloudMeta();
}

async function saveToFirebase(){
  updatedAt=Date.now();try{localStorage.setItem(PENDING_KEY,'1');localStorage.setItem(UPDATED_KEY,String(updatedAt));}catch(e){}persistLocal();
  if(!cloudReady||!fb||!DOC_ID){updateSyncStatus('Pendiente de sincronizar','saving');return false;}
  if(saveInFlight){saveQueued=true;return false;}saveInFlight=true;updateSyncStatus('Guardando…','saving');let ok=true;
  try{
    do{
      saveQueued=false;persistLocal();
      if(cloudMode==='v2') await saveCloudV2Changes();
      else{
        try{ await saveCloudLegacy(); }
        catch(e){
          if(e?.code==='permission-denied' && await cloudV2PermissionsAvailable()){
            if(!(await migrateLocalToCloudV2())) throw e;
          }else throw e;
        }
      }
    }while(saveQueued);
    try{localStorage.removeItem(PENDING_KEY);localStorage.setItem(SYNCED_KEY,String(updatedAt));}catch(e){} updateSyncStatus('Sincronizado','ok');
  }catch(e){console.error('LiftEngine · error sincronizando:',e);lastSyncError=e?.message||String(e);updateSyncStatus('Guardado local · sin conexión','error');ok=false;}
  finally{saveInFlight=false;if(saveQueued&&ok)saveToFirebase();}return ok;
}

async function syncCloudV2(rootCloud){
  cloudMode='v2'; loadCloudMeta();
  const query=await withTimeout(fb.getDocs(fb.collection(fb.db,'userData',DOC_ID,'days')),15000), remote=new Map();
  query.forEach(snap=>remote.set(snap.id,snap.data()));
  const pending=localStorage.getItem(PENDING_KEY)==='1';
  const protectedDate=(typeof train!=='undefined'&&train&&validDateKey(train.date))?train.date:null;
  const localDrafts=captureDraftEntries();
  if(!pending){
    data={};categories={};weights=[];measurements=[];notes={}; applyCloudSettings(rootCloud);
    cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};
    cloudMeta.days={};
    remote.forEach((doc,date)=>{applyCloudDay(date,doc);cloudMeta.days[date]={revision:Number(doc.revision)||0,hash:fingerprint(cloudDayContent({...doc,date}))};});
  }else{
    const dates=new Set([...remote.keys(),...allLocalDates(),...Object.keys(cloudMeta.days||{})]);
    for(const date of [...dates].sort()){
      const rd=remote.get(date), meta=cloudMeta.days[date]||{revision:0,hash:fingerprint({deleted:true})}; const localHash=dayHash(date);
      const localChanged=localHash!==meta.hash; const remoteRev=rd?Number(rd.revision)||0:0; const remoteChanged=remoteRev!==Number(meta.revision||0);
      if(remoteChanged&&!localChanged&&rd){applyCloudDay(date,rd);cloudMeta.days[date]={revision:remoteRev,hash:fingerprint(cloudDayContent({...rd,date}))};}
      else if(remoteChanged&&localChanged&&rd){const choice=await resolveDayConflict(date,rd);if(choice==='local')cloudMeta.days[date]={revision:remoteRev,hash:meta.hash};}
    }
    const localSettingsChanged=settingsHash()!==(cloudMeta.settings?.hash||''); const remoteSettingsChanged=(Number(rootCloud.revision)||0)!==(Number(cloudMeta.settings?.revision)||0);
    if(remoteSettingsChanged&&!localSettingsChanged){applyCloudSettings(rootCloud);cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};}
    else if(remoteSettingsChanged&&localSettingsChanged){
      const keep=await appConfirm('La configuración también cambió en otro dispositivo. ¿Conservar la configuración local?',{title:'Conflicto de configuración',confirmText:'Conservar local',cancelText:'Usar nube'});
      if(keep)cloudMeta.settings.revision=Number(rootCloud.revision)||0;else{applyCloudSettings(rootCloud);cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};}
    }
  }
  // Los borradores son locales y no forman parte de estadísticas ni de Firestore.
  // Se restauran después de aplicar la nube para que una reconexión no borre una
  // rutina cargada, una sesión copiada o las series pendientes del entrenamiento activo.
  mergeDraftEntries(localDrafts);
  const namesChanged=(typeof migrateNames==='function')?migrateNames():false;
  if(!cloudMeta.settings?.revision)cloudMeta.settings={revision:Number(rootCloud.revision)||0,hash:settingsHash()};
  persistLocal(); saveCloudMeta(); updatedAt=Number(rootCloud.updatedAt)||Date.now(); refreshAll();
  if(pending || namesChanged || (protectedDate&&dayHash(protectedDate)!==(cloudMeta.days[protectedDate]?.hash||fingerprint({deleted:true})))) await saveCloudV2Changes();
  try{localStorage.removeItem(PENDING_KEY);localStorage.setItem(SYNCED_KEY,String(updatedAt));localStorage.setItem(UPDATED_KEY,String(updatedAt));}catch(e){}
  saveCloudMeta(); updateSyncStatus('Sincronizado','ok'); return true;
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
    else legacyChanged=!!applyLegacyCloud(cloud,cloudStamp);
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
    saveToFirebase(); refreshAll(); toast('Cambiado a ' + currentUnit.toUpperCase());
}

window.setTheme = function(t) {
    currentTheme = t;
    document.documentElement.setAttribute('data-theme', currentTheme);
    saveToFirebase();
    renderSettingsModal();
    refreshAll();
    toast('Tema visual actualizado');
}

