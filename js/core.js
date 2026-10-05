// LiftEngine · núcleo: estado, persistencia, Firebase, unidades y tema
'use strict';
let DOC_ID = localStorage.getItem('gymLastUid') || null;
const PENDING_KEY='gymPendingSync', SYNCED_KEY='gymSyncedAt', UPDATED_KEY='gymUpdatedAt';
let fb=null, cloudReady=false, syncing=false, updatedAt=Number(localStorage.getItem(UPDATED_KEY))||0, lastSyncError='';

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
        db:fsMod.getFirestore(app), doc:fsMod.doc, setDoc:fsMod.setDoc, getDoc:fsMod.getDoc,
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
    if(!(await connectFirebase())) { alert("Revisa tu conexión a internet."); return; }
    try {
        await fb.signInWithPopup(fb.auth, fb.provider);
    } catch(e) {
        if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported'].includes(e.code)){
            try{ await fb.signInWithRedirect(fb.auth, fb.provider); return; }catch(e2){ e=e2; }
        }
        if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request') return;
        alert("Error al iniciar sesión: " + e.message);
    }
};

function wipeLocalData(){
    [KEY,CAT,WEIGHT,MEASURE,'trackGym_notes',ROUTINES_KEY,'gymAliases','gymMuscles','gymExerciseNotes',PENDING_KEY,SYNCED_KEY,UPDATED_KEY,'gymTrainState','gymBackupBeforeRename','gymBackupBeforeImport','gymRecoveryBackup','gymLastUid']
      .forEach(k=>{ try{localStorage.removeItem(k)}catch(e){} });
    updatedAt=0;
}

window.logout = async function() {
    if(!fb) return;
    if(localStorage.getItem(PENDING_KEY)==='1' && !confirm('Hay cambios que aún NO se han sincronizado con la nube y se perderían al cerrar sesión.\n\n¿Cerrar sesión de todos modos?')) return;
    if(confirm("¿Estás seguro de cerrar sesión? Solo podrás ver y sincronizar tus rutinas al volver a entrar.")) {
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
function validDateKey(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v)); }

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
  return {
    setNumber: Math.max(1, Number(set.setNumber)||index+1),
    reps: cleanString(set.reps,'-') || '-',
    weight: weight===null ? 0 : weight,
    rir: cleanString(set.rir,'-') || '-',
    rest: normalizeRestLabel(cleanString(set.rest,'-') || '-'),
    type: normalizeSetType(set.type||set.setType),
    ...(set.done===true?{done:true}:{}),
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
  return {id,isCardio:false,name,sets,...(substitutedFrom?{substitutedFrom}:{})};
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
    const out={date:x.date},has=false;
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
  customRoutines = sanitizeRoutines(readLocal(ROUTINES_KEY, defaultPPL, x=>x));
  currentUnit=localStorage.getItem(UNIT_KEY)==='lbs'?'lbs':'kg';
  currentTheme=cleanString(localStorage.getItem(THEME_KEY),'default')||'default';
  
  customAliases = sanitizeAliases(readLocal('gymAliases', {}, x=>x));
  customMuscles = sanitizeMuscles(readLocal('gymMuscles', {}, x=>x));
  if(Object.keys(customAliases).length===0) customAliases = JSON.parse(JSON.stringify(defaultAliases));
  if(Object.keys(customMuscles).length===0) customMuscles = JSON.parse(JSON.stringify(defaultMuscles));

  if(Object.keys(customRoutines).length===0) customRoutines = JSON.parse(JSON.stringify(defaultPPL));
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

async function saveToFirebase() {
  updatedAt=Date.now();
  try{ localStorage.setItem(PENDING_KEY,'1'); localStorage.setItem(UPDATED_KEY,String(updatedAt)); }catch(e){}
  persistLocal();
  if(!cloudReady||!fb||!DOC_ID){ updateSyncStatus('Pendiente de sincronizar','saving'); return false; }
  if(saveInFlight){ saveQueued=true; return false; }
  saveInFlight=true;
  updateSyncStatus('Guardando…','saving');
  let ok=true;
  try {
    do {
      saveQueued=false;
      persistLocal();
      const stamp=updatedAt;
      // Añadimos customAliases y customMuscles a Firebase (Fase 3)
      await withTimeout(fb.setDoc(fb.doc(fb.db,"userData",DOC_ID),{ data, categories, weights, measurements, notes, exerciseNotes, customRoutines, customAliases, customMuscles, currentUnit, currentTheme, updatedAt:stamp }),10000);
      if(!saveQueued){ try{ localStorage.removeItem(PENDING_KEY); localStorage.setItem(SYNCED_KEY,String(stamp)); }catch(e){} }
    } while(saveQueued);
    updateSyncStatus('Sincronizado','ok');
  } catch (e) {
    console.error('LiftEngine · error sincronizando:', e);
    updateSyncStatus('Guardado local · sin conexión','error');
    ok=false;
  } finally {
    saveInFlight=false;
    if(saveQueued && ok) saveToFirebase();
  }
  return ok;
}

function applyCloud(cloud,stamp){
  data=sanitizeData(cloud.data); categories=sanitizeCategories(cloud.categories); weights=sanitizeWeights(cloud.weights); measurements=sanitizeMeasurements(cloud.measurements); notes=sanitizeNotes(cloud.notes); exerciseNotes=sanitizeExerciseNotes(cloud.exerciseNotes||readLocal(EX_NOTES_KEY,{},x=>x));
  const cr=cloud.customRoutines&&Object.keys(cloud.customRoutines).length?cloud.customRoutines:null;
  customRoutines=sanitizeRoutines(cr||readLocal(ROUTINES_KEY,defaultPPL,x=>x));
  if(!Object.keys(customRoutines).length) customRoutines=JSON.parse(JSON.stringify(defaultPPL));
  
  customAliases = sanitizeAliases(cloud.customAliases || readLocal('gymAliases', defaultAliases, x=>x));
  customMuscles = sanitizeMuscles(cloud.customMuscles || readLocal('gymMuscles', defaultMuscles, x=>x));
  if(!Object.keys(customAliases).length) customAliases=JSON.parse(JSON.stringify(defaultAliases));
  if(!Object.keys(customMuscles).length) customMuscles=JSON.parse(JSON.stringify(defaultMuscles));

  currentUnit=cloud.currentUnit==='lbs'?'lbs':'kg'; currentTheme=cleanString(cloud.currentTheme,'default')||'default';
  document.getElementById('unitBtn').innerText=currentUnit.toUpperCase();
  persistLocal();
  updatedAt=stamp;
  try{ localStorage.removeItem(PENDING_KEY); localStorage.setItem(SYNCED_KEY,String(stamp)); localStorage.setItem(UPDATED_KEY,String(stamp)); }catch(e){}
  const changed=migrateNames();
  refreshAll();
  if(changed) saveToFirebase();
}

async function syncFromCloud(){
  if(syncing || !DOC_ID) return false;
  syncing=true;
  try{
    if(!(await connectFirebase())) return false;
    const snap=await withTimeout(fb.getDoc(fb.doc(fb.db,"userData",DOC_ID)),10000);
    cloudReady=true;
    const pending=localStorage.getItem(PENDING_KEY)==='1';
    const hasLocal=Object.keys(data).length>0||Object.keys(categories).length>0||weights.length>0||measurements.length>0||Object.keys(exerciseNotes).length>0;
    if(!snap.exists()){
      if(hasLocal) await saveToFirebase(); else updateSyncStatus('Sincronizado','ok');
      return true;
    }
    const cloud=snap.data(), cloudStamp=Number(cloud.updatedAt)||0;
    let useLocal=false;
    if(pending){
      const synced=Number(localStorage.getItem(SYNCED_KEY))||0;
      useLocal = cloudStamp>synced
        ? confirm('Tienes cambios sin sincronizar en este dispositivo y la nube también cambió desde otro dispositivo.\n\nAceptar = conservar lo de ESTE dispositivo.\nCancelar = usar lo que está en la NUBE.')
        : true;
    }
    if(useLocal) await saveToFirebase();
    else { applyCloud(cloud,cloudStamp); updateSyncStatus('Sincronizado','ok'); }
    return true;
  }catch(e){
    lastSyncError=(e&&((e.code?e.code+': ':'')+(e.message||'')))||String(e||'Error de sincronización');
    console.error('Error de sincronización:',e);
    return false;
  }
  finally{ syncing=false; }
}

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function syncFromCloudWithRetry(attempts=2){
  let ok=false;
  for(let i=0;i<attempts;i++){
    ok=await syncFromCloud();
    if(ok) return true;
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

