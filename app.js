// ===== FIREBASE Y MODULOS (AUTH INCLUIDO) =====
const FB_APP_URL="https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
const FB_FS_URL="https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
const FB_AUTH_URL="https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
const APP_VERSION='5.1.0';
const DATA_SCHEMA_VERSION=1;

const firebaseConfig = {
  apiKey: "AIzaSyB01Yx5QD_9i89i1CX3SpFyD6W3MzKmxUE",
  authDomain: "mirutinagym-b7ac2.firebaseapp.com",
  projectId: "mirutinagym-b7ac2",
  storageBucket: "mirutinagym-b7ac2.firebasestorage.app",
  messagingSenderId: "98341278094",
  appId: "1:98341278094:web:e2ef6ac56d0dd279fd14df"
};

let DOC_ID = localStorage.getItem('gymLastUid') || null;
const PENDING_KEY='gymPendingSync', SYNCED_KEY='gymSyncedAt', UPDATED_KEY='gymUpdatedAt';
let fb=null, cloudReady=false, syncing=false, updatedAt=Number(localStorage.getItem(UPDATED_KEY))||0;

function ic(n){return `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))])}

async function connectFirebase(){
  if(fb) return true;
  try{
    const [appMod,fsMod,authMod]=await withTimeout(Promise.all([import(FB_APP_URL),import(FB_FS_URL),import(FB_AUTH_URL)]),8000);
    const app=appMod.initializeApp(firebaseConfig);
    fb={
        db:fsMod.getFirestore(app), doc:fsMod.doc, setDoc:fsMod.setDoc, getDoc:fsMod.getDoc,
        auth: authMod.getAuth(app), provider: new authMod.GoogleAuthProvider(),
        signInWithPopup: authMod.signInWithPopup, signInWithRedirect: authMod.signInWithRedirect, signOut: authMod.signOut, onAuthStateChanged: authMod.onAuthStateChanged
    };
    return true;
  }catch(e){ console.error('Firebase no disponible:',e); return false; }
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
    [KEY,CAT,WEIGHT,MEASURE,'trackGym_notes',ROUTINES_KEY,'gymAliases','gymMuscles',PENDING_KEY,SYNCED_KEY,UPDATED_KEY,'gymTrainState','gymBackupBeforeRename','gymBackupBeforeImport','gymRecoveryBackup','gymLastUid']
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

const KEY='trackGymDataV2', CAT='gymCategories', WEIGHT='gymBodyWeight', MEASURE='gymBodyMeasurements', UNIT_KEY='gymUnitSystem', THEME_KEY='gymTheme', ROUTINES_KEY='gymCustomRoutines';

const defaultPPL = {
    "Push": [
        { name: "Press inclinado con mancuernas", sets: 3, reps: "6–10", rir: "2", rest: "2–3 min" },
        { name: "Press de pecho en máquina", sets: 3, reps: "8–12", rir: "1–2", rest: "2 min" },
        { name: "Press de hombros en máquina", sets: 3, reps: "6–10", rir: "2", rest: "2–3 min" },
        { name: "Elevaciones laterales con mancuernas", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" },
        { name: "Extensión de tríceps en polea con cuerda", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" }
    ],
    "Pull": [
        { name: "Jalón al pecho", sets: 3, reps: "6–10", rir: "2", rest: "2–3 min" },
        { name: "Remo con pecho apoyado", sets: 3, reps: "8–12", rir: "1–2", rest: "2 min" },
        { name: "Remo unilateral en máquina", sets: 2, reps: "8–12", rir: "1–2", rest: "90–120 s" },
        { name: "Reverse pec deck", sets: 3, reps: "10–15", rir: "1–2", rest: "60–90 s" },
        { name: "Curl de bíceps con mancuernas", sets: 3, reps: "8–12", rir: "1–2", rest: "90 s" },
        { name: "Curl martillo", sets: 2, reps: "10–15", rir: "1–2", rest: "60–90 s" }
    ],
    "Legs": [
        { name: "Sentadilla hack", sets: 3, reps: "6–10", rir: "2", rest: "2–3 min" },
        { name: "Prensa de piernas", sets: 3, reps: "8–12", rir: "1–2", rest: "2–3 min" },
        { name: "Curl femoral sentado", sets: 3, reps: "8–12", rir: "1–2", rest: "2 min" },
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
let data={}, categories={}, weights=[], measurements=[], notes={}, customRoutines={}, currentUnit='kg', currentTheme='default', setCounter=0, currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear(), selectedDate='', logType='pesas', chart=null, muscleChart=null, bodyWeightChart=null, measurementChart=null, saveInFlight=false, saveQueued=false;
let customAliases={}, customMuscles={};
let localRecoveryDetected=false; // Fase 1: indica si se recuperó una estructura local dañada
window.editingId = null;
window.timerInt = null;
window.timerEndAt = 0;

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

function sanitizeSet(set,index=0){
  if(!isPlainObject(set)) return null;
  const weight=finiteNumber(set.weight,0);
  const restUsed=finiteNumber(set.restUsed,0);
  return {
    setNumber: Math.max(1, Number(set.setNumber)||index+1),
    reps: cleanString(set.reps,'-') || '-',
    weight: weight===null ? 0 : weight,
    rir: cleanString(set.rir,'-') || '-',
    rest: cleanString(set.rest,'-') || '-',
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
  return {id,isCardio:false,name,sets};
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
            if (Array.isArray(ex)) return { name: cleanString(ex[0]), sets: Math.max(0,Number(ex[1])||0), reps: cleanString(ex[2]), rir: cleanString(ex[3]), rest: cleanString(ex[4]) };
            if(!isPlainObject(ex)) return null;
            return { name: cleanString(ex.name), sets: Math.max(0,Number(ex.sets)||0), reps: cleanString(ex.reps), rir: cleanString(ex.rir), rest: cleanString(ex.rest) };
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

function readLocal(key,fallback,sanitizer){
  const raw=localStorage.getItem(key);
  if(raw===null) return fallback;
  try{
    const parsed=JSON.parse(raw);
    const clean=sanitizer(parsed);
    let suspicious=false;
    try{ suspicious=JSON.stringify(parsed)!==JSON.stringify(clean); }catch(e){ suspicious=true; }
    if(suspicious) backupCorruptLocal(key,raw);
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
}

function persistLocal(){
  localStorage.setItem(KEY,JSON.stringify(data));
  localStorage.setItem(CAT,JSON.stringify(categories));
  localStorage.setItem(WEIGHT,JSON.stringify(weights));
  localStorage.setItem(MEASURE,JSON.stringify(measurements));
  localStorage.setItem('trackGym_notes',JSON.stringify(notes));
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
  if(!cloudReady||!fb||!DOC_ID){ updateSyncStatus('Guardado local','error'); return false; }
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
      await withTimeout(fb.setDoc(fb.doc(fb.db,"userData",DOC_ID),{ data, categories, weights, measurements, notes, customRoutines, customAliases, customMuscles, currentUnit, currentTheme, updatedAt:stamp }),10000);
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
  data=sanitizeData(cloud.data); categories=sanitizeCategories(cloud.categories); weights=sanitizeWeights(cloud.weights); measurements=sanitizeMeasurements(cloud.measurements); notes=sanitizeNotes(cloud.notes);
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
    const hasLocal=Object.keys(data).length>0||Object.keys(categories).length>0||weights.length>0||measurements.length>0;
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
  }catch(e){ console.error('Error de sincronización:',e); return false; }
  finally{ syncing=false; }
}

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
}

function toKg(val) { let num = parseFloat(val) || 0; return currentUnit === 'lbs' ? num / 2.20462 : num; }
function fromKg(val) { let num = parseFloat(val) || 0; return currentUnit === 'lbs' ? num * 2.20462 : num; }
function unitLabel() { return currentUnit.toUpperCase(); }

window.toggleUnit = function() {
    const rows=[...document.querySelectorAll('.set-row')].map(r=>({
        reps:r.querySelector('.set-reps').value,
        kg:toKg(r.querySelector('.set-weight').value),  
        rir:r.querySelector('.set-rir').value,
        rest:r.querySelector('.set-rest').value
    }));
    currentUnit = currentUnit === 'kg' ? 'lbs' : 'kg';
    document.getElementById('unitBtn').innerText = currentUnit.toUpperCase();
    document.getElementById('setsContainer').innerHTML=''; setCounter=0;
    if(rows.length) rows.forEach(r=>addSet({reps:r.reps,weight:r.kg?Math.round(fromKg(r.kg)*10)/10:'',rir:r.rir,rest:r.rest})); else addSet();
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

function todayStr(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function fmtDate(s){return new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>el.style.display='none',2200)}

window.switchTab = function(id,btn){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');
  if(id==='resumen')renderDashboard();
  if(id==='calendario')renderCalendar();
  if(id==='progreso'){populateExercises();updateChart();renderBodyWeights();renderProgressionPanel()}
  if(id==='rutinas'){renderRoutines();}
}

window.setLogType = function(type){
  logType=type;document.getElementById('weightsForm').style.display=type==='pesas'?'block':'none';document.getElementById('cardioForm').style.display=type==='cardio'?'block':'none';
  document.getElementById('weightMode').classList.toggle('active',type==='pesas');document.getElementById('cardioMode').classList.toggle('active',type==='cardio')
}

window.addSet = function(values=null){
  let v = values || {};
  if (!values && setCounter > 0) {
      const rows = document.querySelectorAll('.set-row');
      if (rows.length > 0) {
          const lastRow = rows[rows.length - 1];
          v.reps = lastRow.querySelector('.set-reps').value;
          v.weight = lastRow.querySelector('.set-weight').value;
          v.rir = lastRow.querySelector('.set-rir').value;
          v.rest = lastRow.querySelector('.set-rest').value;
      }
  }

  setCounter++;const d=document.createElement('div');d.className='set-row';d.id=`set-${setCounter}`; if(v.restUsed) d.dataset.restused=v.restUsed;
  d.innerHTML=`
    <div class="set-main">
        <div class="set-num">${setCounter}</div>
        <div><label>Reps</label><input class="set-reps" type="number" min="0" value="${escapeHtml(v.reps||'')}"></div>
        <div><label>Peso (${unitLabel()})</label><input class="set-weight" type="number" min="0" step="0.5" value="${escapeHtml(v.weight||'')}"></div>
        <div><label>RIR</label><input class="set-rir" type="number" min="0" max="10" value="${escapeHtml(v.rir||'')}"></div>
    </div>
    <div class="set-sub">
        <div><label>Descanso</label><input class="set-rest" value="${escapeHtml(v.rest||'')}" placeholder="2m"></div>
        <button class="timer-btn" onclick="quickStartTimer(this)" title="Iniciar Cronómetro" aria-label="Iniciar cronómetro"><svg class="ic" aria-hidden="true"><use href="#i-timer"/></svg></button>
        <button class="remove-set" aria-label="Quitar serie" onclick="removeSet(this)"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
    </div>`;
  document.getElementById('setsContainer').appendChild(d);
}

window.removeSet = function(b){b.closest('.set-row').remove();renumberSets()}
function renumberSets(){document.querySelectorAll('.set-row').forEach((r,i)=>r.querySelector('.set-num').textContent=i+1);setCounter=document.querySelectorAll('.set-row').length}

window.clearEntry = function(){
  document.getElementById('exerciseName').value='';document.getElementById('setsContainer').innerHTML='';setCounter=0;addSet();
  document.getElementById('cardioTime').value='';document.getElementById('cardioDist').value='';
  window.editingId = null;
  document.getElementById('saveEntryBtn').innerText = 'Guardar registro';
}

window.saveCategory = function(){const d=document.getElementById('routineDate').value,c=document.getElementById('dayCategory').value;if(c)categories[d]=c;else delete categories[d];saveToFirebase();renderCalendar()}

window.saveNote = function(){
  const d=document.getElementById('routineDate').value; if(!d) return;
  const t=document.getElementById('sessionNote').value.trim();
  if(t) notes[d]=t; else delete notes[d];
  try{ localStorage.setItem(PENDING_KEY,'1'); }catch(e){}
  persistLocal();
  clearTimeout(window.noteT); window.noteT=setTimeout(saveToFirebase,900);
}

window.loadTemplate = function() {
    const date = document.getElementById('routineDate').value;
    const cat = document.getElementById('dayCategory').value;
    if (!cat || !customRoutines[cat]) { toast('Selecciona una rutina de tu lista.'); return; }
    if (!data[date]) data[date] = [];
    if (data[date].length > 0 && !confirm('¿Añadir rutina completa de todos modos?')) return;

    customRoutines[cat].forEach(exInfo => {
        const name = exInfo.name;
        const setsCount = exInfo.sets;
        const rir = exInfo.rir;
        const rest = exInfo.rest;
        
        const sets = [];
        for(let i=1; i<=setsCount; i++) {
            sets.push({setNumber: i, reps: '-', weight: 0, rir: rir, rest: rest});
        }
        data[date].push({id: Date.now() + Math.random(), isCardio: false, name: name, sets: sets});
    });
    saveToFirebase(); loadDay(); renderDashboard(); populateExercises(); updateChart();
    toast('Rutina cargada con éxito.');
}

window.saveEntry = function(){
  const date=document.getElementById('routineDate').value;if(!date)return;
  if(!data[date])data[date]=[];
  
  let newEntry = null;
  if(logType==='pesas'){
    let name=document.getElementById('exerciseName').value.trim();if(!name){alert('Ingresa el nombre del ejercicio.');return}
    const sets=[...document.querySelectorAll('.set-row')].map((r,i)=>({
        setNumber:i+1,
        reps:r.querySelector('.set-reps').value||'-',
        weight:toKg(r.querySelector('.set-weight').value),
        rir:r.querySelector('.set-rir').value||'-',
        rest:r.querySelector('.set-rest').value||'-',...(r.dataset.restused?{restUsed:Number(r.dataset.restused)}:{})
    })).filter(s=>s.reps!=='-'||s.weight!==0);
    if(!sets.length){alert('Registra al menos una serie.');return}
    newEntry = {id: window.editingId || Date.now(), isCardio:false, name:normalizeName(name), sets:sets};
  }else{
    const time=document.getElementById('cardioTime').value,dist=document.getElementById('cardioDist').value;
    if(!time&&!dist){alert('Registra tiempo o distancia.');return}
    newEntry = {id: window.editingId || Date.now(), isCardio:true, name:document.getElementById('cardioType').value, time:time||'-', distance:dist||'-'};
  }
  
  if(window.editingId) {
      const idx = data[date].findIndex(x => x.id === window.editingId);
      if(idx !== -1) data[date][idx] = newEntry; else data[date].push(newEntry);
  } else {
      data[date].push(newEntry);
  }

  const sessionNote=document.getElementById('sessionNote').value.trim(); if(sessionNote) notes[date]=sessionNote; else delete notes[date];
  
  const wasEditing=!!window.editingId; saveToFirebase(); clearEntry(); loadDay(); renderDashboard(); populateExercises(); updateChart(); toast(wasEditing ? 'Registro actualizado' : 'Guardado OK');
}

window.editEntry = function(date, id) {
    const entry = data[date].find(x => x.id === id);
    if(!entry) return;
    
    if(entry.isCardio) {
        setLogType('cardio');
        document.getElementById('cardioType').value = entry.name;
        document.getElementById('cardioTime').value = entry.time !== '-' ? entry.time : '';
        document.getElementById('cardioDist').value = entry.distance !== '-' ? entry.distance : '';
    } else {
        setLogType('pesas');
        document.getElementById('exerciseName').value = entry.name;
        document.getElementById('setsContainer').innerHTML = '';
        setCounter = 0;
        entry.sets.forEach(s => addSet({
            reps: s.reps!=='-'?s.reps:'', 
            weight: fromKg(s.weight) ? Math.round(fromKg(s.weight)*10)/10 : '', 
            rir: s.rir, 
            rest: s.rest, restUsed: s.restUsed
        }));
    }
    window.editingId = id;
    document.getElementById('saveEntryBtn').innerText = 'Actualizar registro';
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function normalizeName(n){
  const clean=String(n).replace(/\s+/g,' ').trim();
  const key=clean.toLowerCase();
  // Usa el diccionario dinámico de alias (Fase 3)
  if(customAliases[key]) return customAliases[key];
  const found=getAllExercises().find(x=>x.toLowerCase()===key);
  return found||clean.charAt(0).toUpperCase()+clean.slice(1);
}
function getAllExercises(){
  const s=new Set(routineExercises.filter(n=>!customAliases[n.toLowerCase()]));
  Object.values(customRoutines).forEach(rows=>(rows||[]).forEach(r=>{if(r&&r.name)s.add(r.name)}));
  Object.values(data).forEach(arr=>(arr||[]).forEach(e=>{if(!e.isCardio)s.add(e.name)}));
  return [...s].sort();
}
function migrateNames(){
  const snap=JSON.stringify({data,customRoutines});
  let changed=false;
  const fix=o=>{const a=customAliases[String(o.name||'').trim().toLowerCase()];if(a&&a!==o.name){o.name=a;changed=true}};
  Object.values(data).forEach(arr=>(arr||[]).forEach(e=>{if(e&&!e.isCardio)fix(e)}));
  Object.values(customRoutines).forEach(rows=>(rows||[]).forEach(r=>{if(r)fix(r)}));
  if(changed){ try{ if(!localStorage.getItem('gymBackupBeforeRename')) localStorage.setItem('gymBackupBeforeRename',snap); }catch(e){} }
  return changed;
}
function populateExercises(){const all=getAllExercises();document.getElementById('exerciseList').innerHTML=all.map(x=>`<option value="${escapeHtml(x)}">`).join('');const sel=document.getElementById('chartExercise');const cur=sel.value;sel.innerHTML='<option value="">-- Elige un ejercicio --</option>'+all.map(x=>`<option>${escapeHtml(x)}</option>`).join('');if(all.includes(cur))sel.value=cur}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function loadDay(){
  const date=document.getElementById('routineDate').value;
  updateCategorySelect();
  document.getElementById('dayCategory').value=categories[date]||'';
  document.getElementById('sessionNote').value=notes[date]||'';
  const arr=data[date]||[];const box=document.getElementById('dailyLog');
  if(!arr.length){box.innerHTML='<div class="empty">No hay registros para este día.</div>';return}
  box.innerHTML=arr.map(e=>renderExerciseCard(e,date)).join('')
}

function renderExerciseCard(e,date){
  if(e.isCardio)return `<div class="exercise-card"><div class="exercise-title"><span>${ic('pulse')} ${escapeHtml(e.name)}</span><span class="badge">Cardio</span></div><div class="muted">Tiempo ${escapeHtml(e.time)} min &nbsp; · &nbsp; Distancia ${escapeHtml(e.distance)} km</div><div class="action-group"><button class="btn-edit-sm" onclick="editEntry('${date}',${e.id})">${ic('edit')} Editar</button><button class="btn-delete-sm" onclick="deleteEntry('${date}',${e.id})">${ic('trash')}</button></div></div>`;
  const volDisplay = Math.round(fromKg(sessionVolume(e))*10)/10;
  return `<div class="exercise-card"><div class="exercise-title"><span>${ic('dumbbell')} ${escapeHtml(e.name)}</span><span class="badge">${volDisplay} ${unitLabel()}</span></div>${e.sets.map((s,i)=>`<div class="set-log"><span>S${i+1}</span><span><b>${escapeHtml(s.reps)}</b> reps</span><span><b>${Math.round(fromKg(s.weight)*10)/10}</b>${unitLabel()}</span><span>RIR ${escapeHtml(s.rir)}</span><span>${escapeHtml(restLabel(s))}</span></div>`).join('')}<div class="action-group"><button class="btn-edit-sm" onclick="editEntry('${date}',${e.id})">${ic('edit')} Editar</button><button class="btn-delete-sm" onclick="deleteEntry('${date}',${e.id})">${ic('trash')}</button></div></div>`
}

window.deleteEntry = function(date,id){if(!confirm('¿Eliminar este registro?'))return;data[date]=(data[date]||[]).filter(x=>x.id!==id);if(!data[date].length)delete data[date];saveToFirebase();loadDay();renderDashboard();populateExercises();updateChart();toast('Registro eliminado')}
function sessionVolume(e){return (e.sets||[]).reduce((a,s)=>a+(parseFloat(s.reps)||0)*(parseFloat(s.weight)||0),0)}
function setHasData(s){return (parseFloat(s.reps)||0)>0||(parseFloat(s.weight)||0)>0}
function entryHasData(e){return e.isCardio?true:(e.sets||[]).some(setHasData)}
function allWeightEntries(name){const out=[];Object.keys(data).sort().forEach(date=>(data[date]||[]).forEach(e=>{if(!e.isCardio&&e.name===name)out.push({date,e})}));return out}
function e1rm(weight,reps){weight=parseFloat(weight);reps=parseFloat(reps);if(!weight||!reps||reps<=0)return 0;return weight*(1+reps/30)} // Epley
function bestForDate(name,date,metric){
  const es=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name);if(!es.length)return 0;
  if(metric==='weight')return Math.max(...es.flatMap(e=>e.sets.map(s=>parseFloat(s.weight)||0)));
  if(metric==='volume')return es.reduce((a,e)=>a+sessionVolume(e),0);
  return Math.max(...es.flatMap(e=>e.sets.map(s=>e1rm(s.weight,s.reps))))
}

window.updateChart = function(){
  const name=document.getElementById('chartExercise').value;if(!name){if(chart){chart.destroy();chart=null};document.getElementById('exerciseDetail').innerHTML='<div class="empty">Selecciona un ejercicio.</div>';return}
  const metric=document.getElementById('chartMetric').value, entries=allWeightEntries(name), labels=[],vals=[];
  entries.forEach(x=>{const v=bestForDate(name,x.date,metric);if(v){labels.push(fmtDate(x.date));vals.push(Math.round(fromKg(v)*10)/10)}});
  if(chart)chart.destroy();
  
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  
  chart=makeChart(document.getElementById('progressChart'),{type:'line',data:{labels,datasets:[{label:`${metric==='weight'?'Peso máximo':metric==='volume'?'Volumen':'e1RM estimado'} (${unitLabel()})`,data:vals,borderColor:accentColor,backgroundColor:accentColor+'20',fill:true,tension:.28,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false,grid:{color:cssVar('--line')}},x:{grid:{color:cssVar('--line')}}}}});
  renderExerciseDetail(name);
  renderProgressionPanel();
}

function parseRepRange(range){
  const nums=String(range||'').match(/\d+/g)||[];
  if(!nums.length)return null;
  const min=parseInt(nums[0],10), max=parseInt(nums[nums.length-1],10);
  return {min,max:Math.max(min,max)};
}
function routineTargetFor(name){
  for(const rows of Object.values(customRoutines)){
    const row=rows.find(r=>r.name===name);
    if(row){
      const rr=parseRepRange(row.reps);
      return {sets:row.sets,repRange:rr,rir:String(row.rir),rest:row.rest};
    }
  }
  return null;
}
function getExerciseSessions(name){
  const out=[];
  Object.keys(data).sort().forEach(date=>{
    const entries=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name);
    entries.forEach(e=>{
      const sets=(e.sets||[]).map(s=>({
        reps:parseFloat(s.reps)||0,
        weight:parseFloat(s.weight)||0,
        rir:s.rir==='-'||s.rir===''?null:parseFloat(s.rir),
        rest:s.rest
      })).filter(s=>s.reps>0||s.weight>0);
      if(sets.length) out.push({date,sets});
    });
  });
  return out;
}
function summarizeSession(session){
  const valid=session.sets.filter(s=>s.reps>0&&s.weight>0);
  const bestWeight=valid.length?Math.max(...valid.map(s=>s.weight)):0;
  const bestReps=valid.length?Math.max(...valid.map(s=>s.reps)):0;
  const volume=valid.reduce((a,s)=>a+s.reps*s.weight,0);
  const bestSet=valid.slice().sort((a,b)=>((b.weight*b.reps)-(a.weight*a.reps)))[0]||null;
  const e1=valid.reduce((best,s)=>Math.max(best,e1rm(s.weight,s.reps)),0);
  const rirVals=valid.filter(s=>s.rir!==null).map(s=>s.rir);
  const avgRir=rirVals.length?rirVals.reduce((a,b)=>a+b,0)/rirVals.length:null;
  return {bestWeight,bestReps,volume,e1rm:e1,avgRir,sets:valid.length};
}
function formatKgValue(v, signed=false){
  if(v==null || v==='' || Number.isNaN(Number(v))) return '—';
  const n=Math.round(fromKg(Number(v))*10)/10;
  const prefix=signed && n>0?'+':'';
  return `${prefix}${n} ${unitLabel()}`;
}
function parseRirRange(value){
  const nums=String(value||'').match(/\d+(?:\.\d+)?/g)||[];
  if(!nums.length)return null;
  const a=parseFloat(nums[0]),b=nums.length>1?parseFloat(nums[nums.length-1]):a;
  return {min:Math.min(a,b),max:Math.max(a,b),target:(a+b)/2};
}
function progressionIncrementKg(weight){
  const w=Math.abs(parseFloat(weight)||0);
  if(w<=10)return 1.25;
  if(w<=40)return 2.5;
  if(w<=80)return 2.5;
  return 5;
}
function progressionRecommendation(name,sessions,target){
  const last=sessions[sessions.length-1];
  if(!last)return {title:'Sin historial suficiente',text:'Registra al menos una sesión para empezar a recibir una referencia de progresión.',className:'progression-neutral',action:'reference'};
  const sum=summarizeSession(last);
  const valid=last.sets.filter(s=>s.weight>0&&s.reps>0);
  if(!valid.length)return {title:'Completa al menos una serie',text:'No hay una serie con peso y repeticiones suficientes para evaluar la progresión.',className:'progression-neutral',action:'hold'};
  if(!target||!target.repRange){
    const prev=sessions.length>1?summarizeSession(sessions[sessions.length-2]):null;
    const e1Trend=prev&&prev.e1rm?sum.e1rm-prev.e1rm:0;
    if(e1Trend>0)return {title:'Rendimiento en mejora',text:`Tu e1RM subió ${formatKgValue(e1Trend,true)} respecto a la sesión anterior. Mantén la carga y busca repetir o superar ligeramente el rendimiento.`,className:'progression-positive',action:'hold'};
    return {title:'Usa la última sesión como referencia',text:`Tu último registro fue ${sum.bestWeight?formatKgValue(sum.bestWeight):'sin peso'} con hasta ${sum.bestReps||'—'} reps. Intenta igualar o superar ligeramente el rendimiento manteniendo una técnica sólida.`,className:'progression-neutral',action:'hold'};
  }
  const min=target.repRange.min,max=target.repRange.max;
  const rirRange=parseRirRange(target.rir), avgRir=sum.avgRir;
  const allAtTop=valid.every(s=>s.reps>=max);
  const allAtLeastMin=valid.every(s=>s.reps>=min);
  const avgReps=valid.reduce((a,s)=>a+s.reps,0)/valid.length;
  const belowMin=valid.filter(s=>s.reps<min).length;
  const topWeight=sum.bestWeight;
  const inc=progressionIncrementKg(topWeight);
  const rirTooLow=rirRange&&avgRir!==null&&avgRir<Math.max(0,rirRange.min-0.5);
  const rirComfortable=rirRange&&avgRir!==null&&avgRir>=rirRange.target-0.25;
  if(allAtTop&&!rirTooLow&&(!rirRange||avgRir===null||rirComfortable)){
    return {title:'Siguiente paso: subir el peso',text:`Completaste ${max} reps en todas las series${avgRir!==null?` con RIR promedio ${avgRir.toFixed(1)}`:''}. Prueba +${formatKgValue(inc)} y vuelve hacia ${min}–${max} reps.`,className:'progression-positive',action:'increase',increment:inc};
  }
  if(allAtTop&&rirTooLow){
    return {title:'Mantén el peso: el esfuerzo fue alto',text:`Llegaste al máximo del rango, pero el RIR promedio (${avgRir.toFixed(1)}) quedó por debajo del objetivo. Repite la carga y prioriza una ejecución sólida antes de subir.`,className:'progression-neutral',action:'hold'};
  }
  if(allAtLeastMin){
    const weak=valid.filter(s=>s.reps<max).length;
    const rirText=avgRir!==null?` RIR promedio ${avgRir.toFixed(1)}.`:'';
    return {title:'Siguiente paso: sumar repeticiones',text:`Ya estás dentro del rango en todas las series. Mantén ${formatKgValue(topWeight)} y busca +1 repetición en ${weak===1?'la serie que falta para llegar al máximo':'alguna de las series'}.${rirText}`,className:'progression-neutral',action:'reps'};
  }
  if(belowMin>0&&avgRir!==null&&rirTooLow){
    return {title:'Reduce ligeramente la carga',text:`Hay ${belowMin} serie${belowMin>1?'s':''} por debajo del mínimo y el RIR promedio fue bajo. Considera reducir aproximadamente 5% y vuelve a construir dentro de ${min}–${max} reps.`,className:'progression-warning',action:'decrease',decrease:0.05};
  }
  return {title:'Siguiente paso: consolidar el peso',text:`Aún faltan repeticiones para completar el rango en todas las series. Mantén ${formatKgValue(topWeight)} y busca acercarte a ${min} reps con buena ejecución.`,className:'progression-neutral',action:'hold'};
}
function renderProgressionPanel(){
  const box=document.getElementById('progressionPanel');
  const sel=document.getElementById('chartExercise');
  if(!box||!sel)return;
  const name=sel.value;
  if(!name){box.innerHTML='<div class="empty">Selecciona un ejercicio para ver su progresión.</div>';return}
  const sessions=getExerciseSessions(name);
  if(!sessions.length){box.innerHTML='<div class="empty">Todavía no hay registros para este ejercicio.</div>';return}
  const target=routineTargetFor(name);
  const last=sessions[sessions.length-1];
  const lastSum=summarizeSession(last);
  const prev=sessions.length>1?summarizeSession(sessions[sessions.length-2]):null;
  const rec=progressionRecommendation(name,sessions,target);
  const targetText=target&&target.repRange?`${target.repRange.min}–${target.repRange.max} reps · RIR ${escapeHtml(target.rir)}`:'Sin rango definido en rutina';
  const allRecords=getExerciseRecords(name);
  const recordCards=[
    {label:'PR de peso',value:allRecords.weight?formatKgValue(allRecords.weight):'—',date:allRecords.weightDate},
    {label:'PR de reps',value:allRecords.reps?`${allRecords.reps} reps`:'—',date:allRecords.repsDate},
    {label:'PR de e1RM',value:allRecords.e1rm?formatKgValue(allRecords.e1rm):'—',date:allRecords.e1rmDate}
  ].map(r=>`<div class="record-mini"><div class="label">${r.label}</div><div class="value">${r.value}</div><small>${r.date?fmtDate(r.date):'Sin registro'}</small></div>`).join('');
  const weightDelta=prev&&lastSum.bestWeight&&prev.bestWeight?lastSum.bestWeight-prev.bestWeight:0;
  const e1Delta=prev&&lastSum.e1rm&&prev.e1rm?lastSum.e1rm-prev.e1rm:0;
  const deltaText=prev&&weightDelta!==0?`${weightDelta>0?'+':''}${Math.round(fromKg(weightDelta)*10)/10} ${unitLabel()}`:'—';
  const e1DeltaText=prev&&e1Delta!==0?`${e1Delta>0?'+':''}${Math.round(fromKg(e1Delta)*10)/10} ${unitLabel()}`:'—';
  const rows=sessions.slice(-5).reverse().map((session)=>{
    const sum=summarizeSession(session);
    return `<tr><td>${fmtDate(session.date)}</td><td>${sum.sets}</td><td>${sum.bestWeight?formatKgValue(sum.bestWeight):'—'}</td><td>${sum.bestReps||'—'}</td><td>${sum.e1rm?formatKgValue(sum.e1rm):'—'}</td></tr>`;
  }).join('');
  box.innerHTML=`
    <div class="progression-grid">
      <div class="progression-stat"><div class="label">Última sesión</div><div class="value">${fmtDate(last.date)}</div></div>
      <div class="progression-stat"><div class="label">Mejor peso</div><div class="value">${formatKgValue(lastSum.bestWeight)}</div></div>
      <div class="progression-stat"><div class="label">Mejor e1RM</div><div class="value">${formatKgValue(lastSum.e1rm)}</div></div>
      <div class="progression-stat"><div class="label">Reps máximas</div><div class="value">${lastSum.bestReps||'—'}</div></div>
      <div class="progression-stat"><div class="label">Cambio de peso</div><div class="value">${deltaText}</div></div>
      <div class="progression-stat"><div class="label">Cambio e1RM</div><div class="value">${e1DeltaText}</div></div>
    </div>
    <div class="record-grid">${recordCards}</div>
    <div class="progression-message"><strong class="${rec.className}">${escapeHtml(rec.title)}</strong><span>${escapeHtml(rec.text)}</span></div>
    <div class="muted" style="font-size:.78rem;margin-bottom:8px"><b>Objetivo de rutina:</b> ${targetText}${target?` · ${target.sets} series · descanso ${escapeHtml(target.rest)}`:''}</div>
    <div style="overflow:auto"><table class="progression-table"><thead><tr><th>Fecha</th><th>Series</th><th>Mejor peso</th><th>Máx. reps</th><th>e1RM</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderExerciseDetail(name){
  const es=allWeightEntries(name);if(!es.length){document.getElementById('exerciseDetail').innerHTML='<div class="empty">Sin registros.</div>';return}
  let maxW=0,bestE=0,totalVol=0;es.forEach(x=>x.e.sets.forEach(s=>{maxW=Math.max(maxW,parseFloat(s.weight)||0);bestE=Math.max(bestE,e1rm(s.weight,s.reps));}));es.forEach(x=>totalVol+=sessionVolume(x.e));
  const last=es[es.length-1],prev=es.length>1?es[es.length-2]:null;let delta='—';
  if(prev){const a=fromKg(bestForDate(name,last.date,'weight')),b=fromKg(bestForDate(name,prev.date,'weight'));delta=(a-b>=0?'+':'')+(a-b).toFixed(1)+' '+unitLabel()}
  document.getElementById('exerciseDetail').innerHTML=`<div class="stat-grid"><div class="stat"><div class="label">Peso máximo</div><div class="value">${Math.round(fromKg(maxW)*10)/10} ${unitLabel()}</div></div><div class="stat"><div class="label">e1RM máximo</div><div class="value">${Math.round(fromKg(bestE)*10)/10} ${unitLabel()}</div></div><div class="stat"><div class="label">Sesiones</div><div class="value">${es.length}</div></div><div class="stat"><div class="label">Cambio vs anterior</div><div class="value">${delta}</div></div></div><p class="muted" style="margin-bottom:0">Volumen acumulado: <b style="color:var(--accent)">${Math.round(fromKg(totalVol)).toLocaleString()} ${unitLabel()}</b>.</p>`
}

// Fase 3: Consulta el diccionario dinámico de músculos
function getMuscleGroup(name) {
    for(const [group, exercises] of Object.entries(customMuscles)) {
        if(exercises.includes(name)) return group;
    }
    return 'Otros';
}

function weekStart(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function ymd(x){return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function renderWeek(){
  const box=document.getElementById('weekBody'); if(!box) return;
  const ws=weekStart(), days=[...Array(7)].map((_,i)=>{const x=new Date(ws);x.setDate(ws.getDate()+i);return ymd(x)});
  const lifted=d=>(data[d]||[]).some(e=>!e.isCardio&&entryHasData(e));
  const trained=days.filter(lifted), sets={};
  days.forEach(d=>(data[d]||[]).forEach(e=>{ if(e.isCardio) return; const n=e.sets.filter(setHasData).length; if(n){const m=getMuscleGroup(e.name); sets[m]=(sets[m]||0)+n;} }));
  const wk=new Set(Object.keys(data).filter(lifted).map(d=>ymd(weekStart(new Date(d+'T12:00:00')))));
  let streak=0, cur=new Date(ws); if(!wk.has(ymd(cur))) cur.setDate(cur.getDate()-7);
  while(wk.has(ymd(cur))){ streak++; cur.setDate(cur.getDate()-7); }
  document.getElementById('weekBadge').textContent=streak?`Racha ${streak} sem`:'Sin racha';
  const rows=Object.entries(sets).sort((a,b)=>b[1]-a[1]), mx=Math.max(10,...rows.map(r=>r[1]));
  box.innerHTML=`<div class="week-days">${days.map((d,i)=>`<div class="wd ${trained.includes(d)?'on':''} ${d===todayStr()?'today':''}">${'LMXJVSD'[i]}</div>`).join('')}</div>
    <div class="muted" style="font-size:var(--fs-sm)"><b style="color:var(--text)">${trained.length}</b> entrenamientos esta semana · series por músculo:</div>
    ${rows.length?rows.map(([m,n])=>`<div class="mbar"><span>${escapeHtml(m)}</span><i><b style="width:${Math.round(n/mx*100)}%"></b></i><span>${n}</span></div>`).join(''):'<div class="empty" style="padding:12px">Aún no hay series esta semana.</div>'}`;
}
function renderDashboard(){
  renderWeek();
  const dates=Object.keys(data).filter(d=>(data[d]||[]).some(entryHasData)).sort(),workouts=dates.filter(d=>(data[d]||[]).some(e=>!e.isCardio&&entryHasData(e))).length;
  const allSets=dates.reduce((a,d)=>a+(data[d]||[]).reduce((b,e)=>b+(e.isCardio?0:e.sets.filter(setHasData).length),0),0);
  const totalVolKg=dates.reduce((a,d)=>a+(data[d]||[]).reduce((b,e)=>b+(e.isCardio?0:sessionVolume(e)),0),0);
  const displayVol = currentUnit === 'lbs' ? totalVolKg * 2.20462 : totalVolKg;
  
  document.getElementById('stats').innerHTML=`<div class="stat"><div class="label">Días registrados</div><div class="value">${dates.length}</div></div><div class="stat"><div class="label">Entrenamientos</div><div class="value">${workouts}</div></div><div class="stat"><div class="label">Series</div><div class="value">${allSets}</div></div><div class="stat"><div class="label">Volumen total</div><div class="value">${currentUnit==='lbs' ? Math.round(displayVol).toLocaleString()+' lb' : Math.round(displayVol).toLocaleString()+' kg'}</div></div>`;
  
  const recent=dates.slice(-6).reverse();
  document.getElementById('recentWorkouts').innerHTML=recent.length?recent.map(d=>{
      const vol = Math.round(fromKg((data[d]||[]).reduce((a,e)=>a+(e.isCardio?0:sessionVolume(e)),0))).toLocaleString();
      return `<div class="progress-item" onclick="goToDate('${d}')" style="cursor:pointer"><div><b>${fmtDate(d)}</b><br><small>${escapeHtml(categories[d]||'Sin etiqueta')} · ${(data[d]||[]).filter(e=>!e.isCardio&&entryHasData(e)).length} ejercicios</small></div><b>${vol} ${unitLabel()}</b></div>`;
  }).join(''):'<div class="empty">Todavía no hay entrenamientos.</div>';
  
  const prs=findPRs();
  document.getElementById('recentPRs').innerHTML=prs.slice(-9).reverse().map(p=>{
    const value=p.type==='reps'?`${p.value} reps`:formatKgValue(p.value);
    const detail=p.previous?(p.type==='reps'?`antes ${p.previous} reps`:`antes ${formatKgValue(p.previous)}`):'';
    return `<div class="progress-item"><div><b>${escapeHtml(p.name)}</b><br><small>${fmtDate(p.date)} · ${escapeHtml(p.label)}${detail?' · '+detail:''}</small></div><span class="pr">PR ${value}</span></div>`;
  }).join('')||'<div class="empty">Tus PR aparecerán aquí.</div>'

  let volByMuscle = {};
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  dates.forEach(d => {
      if(new Date(d+'T12:00:00') >= thirtyDaysAgo) {
          (data[d]||[]).forEach(e => {
              if(!e.isCardio) {
                  const m = getMuscleGroup(e.name);
                  volByMuscle[m] = (volByMuscle[m]||0) + sessionVolume(e);
              }
          });
      }
  });

  if(muscleChart) muscleChart.destroy();
  if(Object.keys(volByMuscle).length > 0) {
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      muscleChart = makeChart(document.getElementById('musclePieChart'), {
          type: 'doughnut',
          data: { labels: Object.keys(volByMuscle), datasets: [{ data: Object.values(volByMuscle).map(v=>Math.round(fromKg(v))), backgroundColor: [accentColor, '#78a9ff', '#f2c96d', '#ff7272', '#67d391', '#8f98a5', '#c792ea'], borderWidth:0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: cssVar('--text') } } } }
      });
  }
}

function getExerciseRecords(name,beforeDate=null){
  const best={weight:0,reps:0,e1rm:0,weightDate:'',repsDate:'',e1rmDate:''};
  Object.keys(data).sort().forEach(date=>{
    if(beforeDate&&date>=beforeDate)return;
    (data[date]||[]).filter(e=>!e.isCardio&&e.name===name).forEach(e=>(e.sets||[]).forEach(s=>{
      const w=parseFloat(s.weight)||0, r=parseFloat(s.reps)||0;
      if(w>best.weight){best.weight=w;best.weightDate=date}
      if(r>best.reps){best.reps=r;best.repsDate=date}
      const e1=e1rm(w,r);
      if(e1>best.e1rm){best.e1rm=e1;best.e1rmDate=date}
    }));
  });
  return best;
}
function sessionExerciseBest(e){
  const out={weight:0,reps:0,e1rm:0,weightSet:null,repsSet:null,e1rmSet:null};
  (e.sets||[]).forEach(s=>{
    const w=parseFloat(s.weight)||0,r=parseFloat(s.reps)||0;
    if(w>out.weight){out.weight=w;out.weightSet=s}
    if(r>out.reps){out.reps=r;out.repsSet=s}
    const e1=e1rm(w,r);
    if(e1>out.e1rm){out.e1rm=e1;out.e1rmSet=s}
  });
  return out;
}
function findPRs(){
  const out=[];
  Object.keys(data).sort().forEach(date=>{
    const names=[...new Set((data[date]||[]).filter(e=>!e.isCardio&&entryHasData(e)).map(e=>e.name))];
    names.forEach(name=>{
      const current=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name).reduce((acc,e)=>{
        const b=sessionExerciseBest(e);
        return {weight:Math.max(acc.weight,b.weight),reps:Math.max(acc.reps,b.reps),e1rm:Math.max(acc.e1rm,b.e1rm)};
      },{weight:0,reps:0,e1rm:0});
      const prev=getExerciseRecords(name,date);
      if(prev.weight>0&&current.weight>prev.weight) out.push({name,date,type:'weight',label:'Peso',value:current.weight,previous:prev.weight});
      if(prev.reps>0&&current.reps>prev.reps) out.push({name,date,type:'reps',label:'Reps',value:current.reps,previous:prev.reps});
      if(prev.e1rm>0&&current.e1rm>prev.e1rm) out.push({name,date,type:'e1RM',label:'e1RM',value:current.e1rm,previous:prev.e1rm});
    });
  });
  return out;
}
function latestPRsByExercise(name){
  return findPRs().filter(p=>p.name===name).slice(-20);
}

window.goToDate = function(d){document.getElementById('routineDate').value=d;loadDay();switchTab('registro',document.querySelectorAll('.tab-btn')[1])}
window.copyLastWorkout = function(){
  const date=document.getElementById('routineDate').value;
  if(!date){toast('Selecciona una fecha');return}
  const dates=Object.keys(data).filter(d=>d<date&&data[d]&&data[d].some(e=>!e.isCardio&&entryHasData(e))).sort();
  const last=dates[dates.length-1];
  if(!last){toast('No hay sesión anterior');return}
  const source=(data[last]||[]).filter(e=>!e.isCardio&&entryHasData(e));
  if(!source.length){toast('La última sesión no tiene ejercicios válidos');return}
  if(data[date]?.length && !confirm(`El día ${fmtDate(date)} ya tiene registros.\n\nSe añadirán ${source.length} ejercicios de ${fmtDate(last)} sin borrar lo existente.\n\n¿Continuar?`)) return;
  if(!data[date]) data[date]=[];
  source.forEach((e,exerciseIndex)=>{
    const cloned={
      id:Date.now()+Math.random()+exerciseIndex,
      isCardio:false,
      name:e.name,
      sets:(e.sets||[]).map((s,i)=>({
        setNumber:i+1,
        reps:'-',
        weight:Math.max(0,Number(s.weight)||0),
        rir:s.rir||'-',
        rest:s.rest||'-',
        ...(Number.isFinite(Number(s.restUsed))?{restUsed:Number(s.restUsed)}:{})
      }))
    };
    if(cloned.sets.length) data[date].push(cloned);
  });
  saveToFirebase();
  clearEntry();
  loadDay(); renderDashboard(); populateExercises(); updateChart();
  toast(`Copiados ${source.length} ejercicios de la última sesión`);
}
window.loadLastPerformance = function(){
  const name=normalizeName(document.getElementById('exerciseName').value);if(!name)return;
  const entries=allWeightEntries(name);if(!entries.length){toast('No hay sesión anterior');return}
  const e=entries[entries.length-1].e;document.getElementById('setsContainer').innerHTML='';setCounter=0;e.sets.forEach(s=>addSet({reps:s.reps==='-'?'':s.reps,weight:Math.round(fromKg(s.weight)*10)/10,rir:s.rir==='-'?'':s.rir,rest:s.rest==='-'?'':s.rest}));
  toast('Series cargadas')
}
window.offerLastPerformance = function(){
  const raw=document.getElementById('exerciseName').value.trim();
  if(!raw) return;
  const name=normalizeName(raw);
  document.getElementById('exerciseName').value=name;
  const entries=allWeightEntries(name);
  if(!entries.length) return;
  const rows=document.querySelectorAll('.set-row');
  const empty=[...rows].every(r=>!r.querySelector('.set-reps').value && !r.querySelector('.set-weight').value);
  if(empty) loadLastPerformance();
  else {
    const last=entries[entries.length-1];
    toast('Última vez: '+fmtDate(last.date)+' · usa “Cargar anterior” para copiar');
  }
}

window.renderCalendar = function(){
  const grid=document.getElementById('calendarGrid'),name=document.getElementById('monthYear');grid.innerHTML='';name.textContent=new Date(currentYear,currentMonth,1).toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(x=>grid.innerHTML+=`<div class="day-name">${x}</div>`);
  const first=new Date(currentYear,currentMonth,1).getDay(),days=new Date(currentYear,currentMonth+1,0).getDate();for(let i=0;i<first;i++)grid.innerHTML+='<div class="cal-day empty"></div>';
  for(let i=1;i<=days;i++){const d=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`,has=!!(data[d]||categories[d]);const el=document.createElement('div');el.className='cal-day '+(has?'has-workout ':'')+(d===selectedDate?'selected ':'')+(d===todayStr()?'today':'');el.innerHTML=`<div class="cal-num">${i}</div><div class="cal-cat">${escapeHtml(categories[d]||((data[d]||[]).length?' Entreno':''))}</div>`;el.onclick=()=>{selectedDate=d;renderCalendar();showDaySummary(d)};grid.appendChild(el)}
  if(selectedDate)showDaySummary(selectedDate)
}

function showDaySummary(d){
  const box=document.getElementById('calendarSummary'),arr=data[d]||[];if(!arr.length&&!categories[d]){box.innerHTML='<div class="empty">Selecciona un día.</div>';return}
  box.innerHTML=`<div class="card"><div class="section-title"><h2>${fmtDate(d)}</h2><button class="btn btn-secondary" onclick="goToDate('${d}')">Abrir registro</button></div><p class="muted">${escapeHtml(categories[d]||'')} ${notes[d]?'<br>Nota '+escapeHtml(notes[d]):''}</p>${arr.map(e=>e.isCardio?`<div class="progress-item">${ic('pulse')} ${escapeHtml(e.name)} ·${escapeHtml(e.time)} min</div>`:`<div class="progress-item"><b>${ic('dumbbell')} ${escapeHtml(e.name)}</b><span>${Math.round(fromKg(sessionVolume(e)))} ${unitLabel()} ·${e.sets.length} series</span></div>`).join('')}</div>`
}
window.changeMonth = function(n){currentMonth+=n;if(currentMonth<0){currentMonth=11;currentYear--}if(currentMonth>11){currentMonth=0;currentYear++}renderCalendar()}
function avgWeight(days){
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-days);
    const vals=weights.filter(x=>new Date(x.date+'T00:00:00')>=cutoff).map(x=>x.weight);
    if(!vals.length)return null;
    return vals.reduce((a,b)=>a+b,0)/vals.length;
}
function weightChangeDays(days){
    const arr=[...weights].sort((a,b)=>a.date.localeCompare(b.date));
    if(arr.length<2)return null;
    const latest=arr[arr.length-1];
    const cutoff=new Date(latest.date+'T00:00:00');cutoff.setDate(cutoff.getDate()-days);
    let base=arr.find(x=>new Date(x.date+'T00:00:00')>=cutoff);
    if(!base)base=arr[0];
    return latest.weight-base.weight;
}
function latestMeasurement(){return [...measurements].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||null}
function firstMeasurement(){return [...measurements].sort((a,b)=>a.date.localeCompare(b.date))[0]||null}
function measurementDelta(key){const a=firstMeasurement(),b=latestMeasurement();if(!a||!b||a[key]==null||b[key]==null)return null;return b[key]-a[key]}
function trendClass(v){return v==null||Math.abs(v)<0.01?'trend-neutral':v<0?'trend-positive':'trend-negative'}
function formatDelta(v,unit='cm'){if(v==null)return '—';return `${v>0?'+':''}${v.toFixed(1)} ${unit}`}
function renderBodyCompSummary(){
    const box=document.getElementById('bodyCompSummary');if(!box)return;
    const arr=[...weights].sort((a,b)=>a.date.localeCompare(b.date));const latest=arr.at(-1);const avg7=avgWeight(7);const d30=weightChangeDays(30);const waist=measurementDelta('waist');
    const cards=[];
    cards.push(`<div class="bodycomp-stat"><div class="label">Peso actual</div><div class="value">${latest?formatKgValue(latest.weight):'—'}</div><div class="sub">${latest?fmtDate(latest.date):'Sin registro'}</div></div>`);
    cards.push(`<div class="bodycomp-stat"><div class="label">Promedio 7 días</div><div class="value">${avg7!=null?formatKgValue(avg7):'—'}</div><div class="sub">Promedio de mediciones disponibles</div></div>`);
    cards.push(`<div class="bodycomp-stat"><div class="label">Cambio 30 días</div><div class="value ${trendClass(d30)}">${d30!=null?formatKgValue(d30,true):'—'}</div><div class="sub">Respecto a una medición de referencia</div></div>`);
    cards.push(`<div class="bodycomp-stat"><div class="label">Cambio de cintura</div><div class="value ${trendClass(waist)}">${formatDelta(waist)}</div><div class="sub">Desde la primera medición</div></div>`);
    box.innerHTML=`<div class="bodycomp-grid">${cards.join('')}</div>`;
}
function renderBodyWeights(){
    const box=document.getElementById('bodyWeightList');const arr=[...weights].sort((a,b)=>a.date.localeCompare(b.date));
    box.innerHTML=arr.slice(-10).reverse().map(x=>`<div class="progress-item"><span>${fmtDate(x.date)}</span><span style="display:flex;align-items:center;gap:10px"><b style="color:var(--accent)">${Math.round(fromKg(x.weight)*10)/10} ${unitLabel()}</b><button class="btn-delete-sm" aria-label="Eliminar peso" onclick="deleteBodyWeight('${x.date}')">${ic('trash')}</button></span></div>`).join('')||'<div class="empty">Sin peso corporal registrado.</div>';
    if(bodyWeightChart) bodyWeightChart.destroy();
    const canvas=document.getElementById('bodyWeightChart');
    if(canvas && arr.length){
      const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      bodyWeightChart=makeChart(canvas,{type:'line',data:{labels:arr.map(x=>fmtDate(x.date)),datasets:[{label:`Peso (${unitLabel()})`,data:arr.map(x=>Math.round(fromKg(x.weight)*10)/10),borderColor:accent,backgroundColor:accent,fill:false,tension:.25,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}},y:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}}},plugins:{legend:{labels:{color:cssVar('--text')}}}}});
    }
    renderBodyCompSummary();renderMeasurementChart();renderBodyMeasurements();
}
function renderMeasurementChart(){
    const canvas=document.getElementById('measurementChart'),sel=document.getElementById('measurementMetric');if(!canvas||!sel)return;
    if(measurementChart)measurementChart.destroy();
    const key=sel.value||'waist';const arr=[...measurements].filter(x=>x[key]!=null).sort((a,b)=>a.date.localeCompare(b.date));
    if(!arr.length)return;
    const labels={waist:'Cintura',chest:'Pecho',arm:'Brazo',thigh:'Muslo',hip:'Cadera'};const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    measurementChart=makeChart(canvas,{type:'line',data:{labels:arr.map(x=>fmtDate(x.date)),datasets:[{label:`${labels[key]} (cm)`,data:arr.map(x=>x[key]),borderColor:accent,backgroundColor:accent,fill:false,tension:.25,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}},y:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}}},plugins:{legend:{labels:{color:cssVar('--text')}}}}});
}
function renderBodyMeasurements(){
    const box=document.getElementById('bodyMeasurementList');if(!box)return;const arr=[...measurements].sort((a,b)=>b.date.localeCompare(a.date));
    if(!arr.length){box.innerHTML='<div class="empty">Sin medidas corporales registradas.</div>';return}
    box.innerHTML=`<div class="bodycomp-history"><table class="measurement-table"><thead><tr><th>Fecha</th><th>Cintura</th><th>Pecho</th><th>Brazo</th><th>Muslo</th><th>Cadera</th><th></th></tr></thead><tbody>${arr.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${x.waist!=null?x.waist.toFixed(1)+' cm':'—'}</td><td>${x.chest!=null?x.chest.toFixed(1)+' cm':'—'}</td><td>${x.arm!=null?x.arm.toFixed(1)+' cm':'—'}</td><td>${x.thigh!=null?x.thigh.toFixed(1)+' cm':'—'}</td><td>${x.hip!=null?x.hip.toFixed(1)+' cm':'—'}</td><td><button class="btn btn-secondary" style="padding:5px 8px" onclick="openMeasurementModal('${x.date}')">Editar</button> <button class="btn btn-secondary" style="padding:5px 8px" onclick="deleteMeasurement('${x.date}')">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`;
}
window.openMeasurementModal=function(existingDate=''){
  const existing=measurements.find(x=>x.date===existingDate)||{};const date=existing.date||todayStr();
  document.getElementById('modal').innerHTML=`<h2>${existingDate?'Editar':'Registrar'} medidas corporales</h2><p class="muted">Mide en condiciones similares cada vez. Deja en blanco lo que no quieras registrar.</p><div class="grid grid-2"><div><label>Fecha</label><input id="mmDate" type="date" value="${date}"></div><div><label>Unidad</label><div class="muted" style="padding-top:10px">Centímetros (cm)</div></div></div><div class="measurement-grid" style="margin-top:12px"><div><label>Cintura</label><input id="mmWaist" type="number" step="0.1" min="0" value="${existing.waist??''}"></div><div><label>Pecho</label><input id="mmChest" type="number" step="0.1" min="0" value="${existing.chest??''}"></div><div><label>Brazo</label><input id="mmArm" type="number" step="0.1" min="0" value="${existing.arm??''}"></div><div><label>Muslo</label><input id="mmThigh" type="number" step="0.1" min="0" value="${existing.thigh??''}"></div><div><label>Cadera</label><input id="mmHip" type="number" step="0.1" min="0" value="${existing.hip??''}"></div></div><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveMeasurements()">Guardar</button></div>`;
  document.getElementById('modalBackdrop').classList.add('show');document.body.classList.add('modal-open');document.getElementById('modal').scrollTop=0;
}
window.saveMeasurements=function(){
  const date=document.getElementById('mmDate').value;if(!date)return;
  const vals={waist:'mmWaist',chest:'mmChest',arm:'mmArm',thigh:'mmThigh',hip:'mmHip'};const entry={date};let has=false;
  Object.entries(vals).forEach(([k,id])=>{const v=parseFloat(document.getElementById(id).value);if(Number.isFinite(v)&&v>0){entry[k]=Math.round(v*10)/10;has=true;}});
  if(!has){toast('Registra al menos una medida');return;}
  measurements=measurements.filter(x=>x.date!==date);measurements.push(entry);saveToFirebase();closeModal();renderBodyWeights();toast('Medidas guardadas OK');
}
window.deleteMeasurement=function(date){if(!confirm('¿Eliminar las medidas del '+fmtDate(date)+'?'))return;measurements=measurements.filter(x=>x.date!==date);saveToFirebase();renderBodyWeights();toast('Medición eliminada')}

window.openWeightModal = function(){
    const modalEl=document.getElementById('modal');
    modalEl.innerHTML=`<h2>Registrar peso corporal</h2><div class="grid grid-2"><div><label>Fecha</label><input id="mwDate" type="date" value="${todayStr()}"></div><div><label>Peso (${unitLabel()})</label><input id="mwWeight" type="number" step="0.1" min="0"></div></div><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveBodyWeight()">Guardar</button></div>`;
    modalEl.scrollTop = 0;
    modalEl.scrollLeft = 0;
    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => { modalEl.scrollTop = 0; modalEl.scrollLeft = 0; });
}
window.saveBodyWeight = function(){
    const date=document.getElementById('mwDate').value,w=parseFloat(document.getElementById('mwWeight').value);if(!date||!w)return;
    weights=weights.filter(x=>x.date!==date);weights.push({date,weight:toKg(w)});
    saveToFirebase(); closeModal(); renderBodyWeights(); toast('Peso guardado OK');
}

window.deleteBodyWeight = function(date){
    if(!confirm('¿Eliminar el peso del '+fmtDate(date)+'?')) return;
    weights=weights.filter(x=>x.date!==date);
    saveToFirebase(); renderBodyWeights(); toast('Peso eliminado');
}

window.openPlateCalc = function() {
    const defaultTarget = currentUnit === 'lbs' ? '135' : '60';
    const defaultBar = currentUnit === 'lbs' ? '45' : '20';
    document.getElementById('modal').innerHTML = `
        <h2>Calculadora de Discos (${unitLabel()})</h2>
        <p class="muted">Discos necesarios por cada lado de la barra.</p>
        <div class="grid grid-2">
            <div><label>Peso Objetivo (${unitLabel()})</label><input type="number" id="calcTarget" value="${defaultTarget}"></div>
            <div><label>Peso Barra (${unitLabel()})</label><input type="number" id="calcBar" value="${defaultBar}"></div>
        </div>
        <button class="btn btn-primary full" style="margin-top:14px" onclick="calculatePlates()">Calcular Discos</button>
        <div id="calcResult" style="margin-top:15px; text-align:center; font-size:1.1rem; line-height:1.5;"></div>
        <div class="actions"><button class="btn btn-secondary full" onclick="closeModal()">Cerrar</button></div>
    `;
    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
}

window.calculatePlates = function() {
    const target = parseFloat(document.getElementById('calcTarget').value) || 0;
    const bar = parseFloat(document.getElementById('calcBar').value) || 0;
    if(target <= bar) { document.getElementById('calcResult').innerHTML = "<span class='muted'>El objetivo debe ser mayor a la barra.</span>"; return; }
    
    let perSide = (target - bar) / 2;
    const plates = currentUnit === 'lbs' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
    let res = [];
    plates.forEach(p => {
        let count = Math.floor(perSide / p);
        if(count > 0) { res.push(`<b>${count}</b> de <b>${p} ${unitLabel()}</b>`); perSide -= count * p; }
    });
    
    document.getElementById('calcResult').innerHTML = `<span style="color:var(--accent)">Por cada lado pon:</span><br>${res.join('<br>')}<br><small class="muted" style="font-size:0.8rem; display:block; margin-top:8px;">(Restante: ${perSide.toFixed(2)} ${unitLabel()})</small>`;
}

function parseRestSeconds(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/–/g,'-');
  if(!s) return 90;
  const nums=s.match(/\d+(?:\.\d+)?/g);
  if(!nums) return 90;
  const n=parseFloat(nums[0]);
  if(!Number.isFinite(n) || n<=0) return 90;
  if(/min/.test(s)) return Math.round(n*60);
  if(/s|seg/.test(s)) return Math.round(n);
  if(/m/.test(s)) return Math.round(n*60);
  return n<=10 ? Math.round(n*60) : Math.round(n);
}

function timerRemaining(){ return Math.max(0, Math.ceil((window.timerEndAt - Date.now())/1000)); }
function ensureTimerRunning(){
    document.getElementById('floatingTimer').style.display = 'flex';
    if(!window.timerInt) window.timerInt = setInterval(tickTimer, 500);
    notifSchedule();
    updateTimerUI();
}
window.quickStartTimer = function(btn) {
    const restInput = btn && btn.closest ? btn.closest('.set-row')?.querySelector('.set-rest') : null;
    const secs = parseRestSeconds(restInput?.value);
    window.timerEndAt = Date.now() + secs*1000;
    ensureTimerRunning();
    toast('Cronómetro iniciado ('+secs+'s)');
}
window.addTimer = function(secs) {
    const base = timerRemaining()>0 ? window.timerEndAt : Date.now();
    window.timerEndAt = base + secs*1000;
    ensureTimerRunning();
}
window.stopTimer = function() {
    trainRestEnded(); notifCancel();
    clearInterval(window.timerInt); window.timerInt = null; window.timerEndAt = 0;
    document.getElementById('floatingTimer').style.display = 'none';
    const ov=document.getElementById('trainOverlay'); if(ov) ov.classList.remove('resting');
}
function tickTimer() {
    if(timerRemaining() > 0) { updateTimerUI(); return; }
    stopTimer();
    if(document.hidden && notifState()==='on') notifShow('Descanso terminado', notifBody());
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
    toast('¡Tiempo terminado!');
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); osc.connect(ctx.destination);
        osc.frequency.value = 800; osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch(e){}
}
function updateTimerUI() {
    const left = timerRemaining();
    const m = Math.floor(left / 60).toString().padStart(2, '0');
    const s = (left % 60).toString().padStart(2, '0');
    document.getElementById('timerDisplay').innerText = `${m}:${s}`;
    const tr=document.getElementById('trainRestTime'); if(tr) tr.textContent=`${m}:${s}`;
    const ov=document.getElementById('trainOverlay'); if(ov) ov.classList.toggle('resting',left>0);
}

window.exportCSV = function() {
    const csvEscape = value => { const v=String(value ?? ''); return /[",\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
    const addRow = row => { csv += row.map(csvEscape).join(',') + '\n'; };
    let csv = "Fecha,Rutina,Tipo,Ejercicio,Serie,Reps,Peso,Unidad,RIR,Descanso,Tiempo_min,Distancia_km,Notas,Peso_corporal,Unidad_peso,Cintura_cm,Pecho_cm,Brazo_cm,Muslo_cm,Cadera_cm,Descanso_real_seg\n";
    let allDates = new Set([...Object.keys(data), ...Object.keys(categories), ...weights.map(w=>w.date), ...measurements.map(m=>m.date)]);
    let sortedDates = Array.from(allDates).sort();

    sortedDates.forEach(date => {
        const cat = categories[date] || "";
        const note = notes[date] || "";
        const dayUnit = currentUnit.toUpperCase();
        const wEntry = weights.find(w => w.date === date);
        const mEntry = measurements.find(m => m.date === date);

        if(wEntry) {
            let wVal = currentUnit === 'lbs' ? wEntry.weight * 2.20462 : wEntry.weight;
            addRow([date,cat,"Peso Corporal","Peso Corporal","-","-",Math.round(wVal*10)/10,dayUnit,"-","-","-","-",note,wVal,dayUnit,mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??""]);
        }

        const arr = data[date] || [];
        arr.forEach(ex => {
            const exName = ex.name.replace(/,/g, " ");
            if (ex.isCardio) {
                addRow([date,cat,"Cardio",exName,"-","-","-","-","-","-",ex.time,ex.distance,note,"","",mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??""]);
            } else {
                ex.sets.forEach(s => {
                    let wVal = currentUnit === 'lbs' ? s.weight * 2.20462 : s.weight;
                    addRow([date,cat,"Pesas",exName,s.setNumber,s.reps,Math.round(wVal*10)/10,dayUnit,s.rir,s.rest,"-","-",note,"","",mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??"",s.restUsed??""]);
                });
            }
        });

        if(!wEntry && arr.length === 0 && (cat || note)) {
            addRow([date,cat,"Info","-","-","-","-","-","-","-","-","-",note,"","",mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??""]);
        }
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LiftEngine_Historial_${todayStr()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Exportado a Excel OK');
}

function renderSettingsModal(){
    const modal = document.getElementById('modal');
    if(!modal) return;
    modal.innerHTML=`
        <div class="modal-content-wrapper">
            <h2>Ajustes</h2>
            
            <label>Tema visual (Paleta de Colores)</label>
            <div class="theme-grid">
                <button class="btn-theme ${currentTheme==='default'?'active':''}" onclick="setTheme('default')" style="border-left-color:#d8dde5">Gris Clásico</button>
                <button class="btn-theme ${currentTheme==='ocean'?'active':''}" onclick="setTheme('ocean')" style="border-left-color:#60a5fa">Océano Profundo</button>
                <button class="btn-theme ${currentTheme==='forest'?'active':''}" onclick="setTheme('forest')" style="border-left-color:#4ade80">Verde Bosque</button>
                <button class="btn-theme ${currentTheme==='coffee'?'active':''}" onclick="setTheme('coffee')" style="border-left-color:#fbbf24">Café/Ámbar</button>
            </div>
            
            <hr style="border-color:var(--line);border-width:1px 0 0;margin:16px 0">
            <!-- FASE 3: Botón para gestionar Músculos y Alias -->
            <button class="btn btn-secondary full" style="margin-bottom:12px; border-style:dashed;" onclick="openCatalogsModal('musculos')">${ic('list')} Gestionar Músculos y Alias</button>
            <button class="btn btn-secondary full" style="margin-bottom:12px;" onclick="toggleNotifications()">${ic('bell')} Avisos de descanso: ${({on:'Activados',off:'Desactivados',denied:'Bloqueados','needs-install':'Instala la app',unsupported:'No disponibles'})[notifState()]}</button>
            
            <p class="muted">Sesión: <b>${escapeHtml((fb&&fb.auth&&fb.auth.currentUser&&fb.auth.currentUser.email)||'sin conexión')}</b><br>Tus datos se sincronizan con tu cuenta de Google.</p>
            <button class="btn full" style="background:#1d6f42; color:#fff; margin-bottom:12px;" onclick="exportCSV()">${ic('table')} Exportar a Excel (CSV)</button>
            <div class="actions">
                <button class="btn btn-primary" onclick="exportData()">Respaldo JSON</button>
                <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">Importar JSON</button>
            </div>
            <input id="importFile" type="file" accept=".json" style="display:none" onchange="importData(event)">
            
            <button class="btn btn-danger full" style="margin-top:12px;" onclick="logout()">Cerrar sesión</button>
            <p class="muted" style="font-size:.75rem;text-align:center;margin:14px 0 0">LiftEngine v${APP_VERSION} · Creada y diseñada por <b style="color:var(--text)">Isaias Cruz</b><br><a href="mailto:isajack42@gmail.com" style="color:var(--accent);text-decoration:none">isajack42@gmail.com</a></p>
            
            <div class="actions" style="margin-top:12px;">
                <button class="btn btn-secondary full" onclick="closeModal()">Cerrar</button>
            </div>
        </div>`;
    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
}
window.openDataModal = function(){
    renderSettingsModal();
};

// ==========================================
// NUEVAS FUNCIONES FASE 3: GESTOR DE CATÁLOGOS
// ==========================================
window.openCatalogsModal = function(tab = 'musculos') {
    let isM = tab === 'musculos';
    let html = `<h2 style="margin-top:0">Catálogos y Mapeos</h2>
    <div class="type-toggle" style="margin-bottom:10px;">
        <button class="${isM?'active':''}" onclick="openCatalogsModal('musculos')">Músculos</button>
        <button class="${!isM?'active':''}" onclick="openCatalogsModal('alias')">Corrector (Alias)</button>
    </div>
    <div id="catContent" style="max-height: 50vh; overflow: auto; margin-bottom: 12px; padding-right:5px;"></div>
    <div class="actions">
        <button class="btn btn-primary full" onclick="renderSettingsModal()">Volver a Ajustes</button>
    </div>`;
    document.getElementById('modal').innerHTML = html;

    if(isM) {
        let allEx = getAllExercises();
        let list = allEx.map(ex => {
            let currentMuscle = getMuscleGroup(ex);
            return `<div class="routine-edit-row" style="padding:8px">
                <div style="font-size:0.85rem; font-weight:bold; margin-bottom:4px;">${escapeHtml(ex)}</div>
                <select data-ex="${escapeHtml(ex)}" onchange="updateExerciseMuscle(this.dataset.ex, this.value)" style="min-height:36px; height:36px; padding:4px 8px; font-size:14px;">
                    <option value="Otros">Otros</option>
                    ${Object.keys(customMuscles).concat(['Pecho','Espalda','Piernas','Hombros','Brazos','Core']).filter((v,i,a)=>a.indexOf(v)===i).sort().map(m => `<option value="${m}" ${currentMuscle===m?'selected':''}>${m}</option>`).join('')}
                </select>
            </div>`;
        }).join('');
        document.getElementById('catContent').innerHTML = list || '<div class="empty">No hay ejercicios registrados.</div>';
    } else {
        let list = Object.entries(customAliases).map(([alias, real]) => {
            return `<div class="routine-edit-row" style="padding:8px; display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center;">
                <div style="font-size:0.8rem; color:var(--muted)">Si escribo: <br><b style="color:var(--text)">${escapeHtml(alias)}</b></div>
                <div style="font-size:0.8rem; color:var(--muted)">Se guarda como: <br><b style="color:var(--text)">${escapeHtml(real)}</b></div>
                <button class="btn-delete-sm" data-alias="${escapeHtml(alias)}" onclick="deleteAlias(this.dataset.alias)">${ic('trash')}</button>
            </div>`;
        }).join('');
        let form = `<div class="routine-edit-row" style="padding:10px; margin-bottom:15px; border-color:var(--accent);">
            <div style="font-size:0.85rem; font-weight:bold; margin-bottom:8px;">Añadir Nuevo Alias</div>
            <input id="newAliasFrom" placeholder="Escribes... (ej. pull up)" style="margin-bottom:6px; min-height:36px; height:36px; font-size:14px;">
            <input id="newAliasTo" placeholder="Se guarda... (ej. Dominadas)" style="margin-bottom:8px; min-height:36px; height:36px; font-size:14px;" list="exerciseList">
            <button class="btn btn-primary full" style="min-height:36px;" onclick="addAlias()">Añadir Regla</button>
        </div>`;
        document.getElementById('catContent').innerHTML = form + (list || '<div class="empty">No hay alias configurados.</div>');
    }
}

window.updateExerciseMuscle = function(ex, newMuscle) {
    for(let m in customMuscles) {
        customMuscles[m] = customMuscles[m].filter(x => x !== ex);
    }
    if(newMuscle && newMuscle !== 'Otros') {
        if(!customMuscles[newMuscle]) customMuscles[newMuscle] = [];
        if(!customMuscles[newMuscle].includes(ex)) customMuscles[newMuscle].push(ex);
    }
    saveToFirebase();
    refreshAll();
}

window.addAlias = function() {
    let from = document.getElementById('newAliasFrom').value.trim().toLowerCase();
    let to = document.getElementById('newAliasTo').value.trim();
    if(!from || !to) { toast('Llena ambos campos'); return; }
    customAliases[from] = to;
    saveToFirebase();
    openCatalogsModal('alias');
    toast('Regla de alias añadida');
}

window.deleteAlias = function(alias) {
    if(!confirm('¿Eliminar esta regla de alias?')) return;
    delete customAliases[alias];
    saveToFirebase();
    openCatalogsModal('alias');
    toast('Regla eliminada');
}
// ==========================================

window.closeModal = function(){const b=document.getElementById('modalBackdrop');b.classList.remove('show');document.body.classList.remove('modal-open');document.getElementById('modal').scrollTop=0;document.getElementById('modal').scrollLeft=0}
function buildBackupPayload(){
  return {
    appVersion:APP_VERSION,
    schemaVersion:DATA_SCHEMA_VERSION,
    exportedAt:new Date().toISOString(),
    data:sanitizeData(data),
    categories:sanitizeCategories(categories),
    weights:sanitizeWeights(weights),
    measurements:sanitizeMeasurements(measurements),
    notes:sanitizeNotes(notes),
    customRoutines:sanitizeRoutines(customRoutines),
    customAliases:sanitizeAliases(customAliases),
    customMuscles:sanitizeMuscles(customMuscles),
    currentUnit:currentUnit==='lbs'?'lbs':'kg',
    currentTheme:cleanString(currentTheme,'default')||'default'
  };
}

function validateBackupPayload(x){
  if(!isPlainObject(x)) return {ok:false,reason:'El archivo no contiene un objeto JSON válido.'};
  if(!isPlainObject(x.data)) return {ok:false,reason:'Falta o es inválida la sección de registros.'};
  if(x.categories!=null&&!isPlainObject(x.categories)) return {ok:false,reason:'La sección de categorías no es válida.'};
  if(x.weights!=null&&!Array.isArray(x.weights)) return {ok:false,reason:'La sección de peso corporal no es válida.'};
  if(x.measurements!=null&&!Array.isArray(x.measurements)) return {ok:false,reason:'La sección de medidas corporales no es válida.'};
  if(x.notes!=null&&!isPlainObject(x.notes)) return {ok:false,reason:'La sección de notas no es válida.'};
  if(x.customRoutines!=null&&!isPlainObject(x.customRoutines)) return {ok:false,reason:'La sección de rutinas no es válida.'};
  if(x.customAliases!=null&&!isPlainObject(x.customAliases)) return {ok:false,reason:'La sección de alias no es válida.'};
  if(x.customMuscles!=null&&!isPlainObject(x.customMuscles)) return {ok:false,reason:'La sección de músculos no es válida.'};
  if(x.currentUnit!=null&&!['kg','lbs'].includes(x.currentUnit)) return {ok:false,reason:'La unidad del archivo no es válida.'};
  const cleanData=sanitizeData(x.data);
  const sourceDays=Object.keys(x.data).length,cleanDays=Object.keys(cleanData).length;
  if(sourceDays>0&&cleanDays===0) return {ok:false,reason:'Los registros no tienen una estructura reconocible.'};
  return {ok:true,cleanDays};
}

window.exportData = function(){
  const payload=buildBackupPayload();
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`liftengine-backup-v${APP_VERSION}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href),0);
  toast('Respaldo JSON OK');
}

window.importData = function(ev){
  const file=ev.target.files[0]; if(!file) return;
  if(file.size>10*1024*1024){ alert('El archivo es demasiado grande (máximo 10 MB).'); ev.target.value=''; return; }
  const r=new FileReader();
  r.onload=async()=>{
    try{
      const x=JSON.parse(r.result);
      const validation=validateBackupPayload(x);
      if(!validation.ok) throw new Error(validation.reason);
      const clean={
        data:sanitizeData(x.data),
        categories:sanitizeCategories(x.categories||{}),
        weights:sanitizeWeights(x.weights||[]),
        measurements:sanitizeMeasurements(x.measurements||[]),
        notes:sanitizeNotes(x.notes||{}),
        customRoutines:sanitizeRoutines(x.customRoutines||defaultPPL),
        customAliases:sanitizeAliases(x.customAliases||defaultAliases),
        customMuscles:sanitizeMuscles(x.customMuscles||defaultMuscles),
        currentUnit:x.currentUnit==='lbs'?'lbs':'kg',
        currentTheme:cleanString(x.currentTheme,'default')||'default'
      };
      const days=Object.keys(clean.data).length;
      const sourceDays=Object.keys(x.data).length;
      const warning=sourceDays!==days?`\n\nAviso: ${sourceDays-days} día(s) con estructura inválida serán omitidos.`:'';
      if(!confirm(`Este respaldo contiene ${days} días de registros.${warning}\n\nImportarlo REEMPLAZARÁ todos tus datos actuales (también en la nube). Se guardará antes una copia de seguridad local.\n\n¿Continuar?`)) return;
      try{ localStorage.setItem('gymBackupBeforeImport',JSON.stringify(buildBackupPayload())); }catch(e){ console.warn('No se pudo guardar el backup previo a importación:',e); }
      data=clean.data; categories=clean.categories; weights=clean.weights; measurements=clean.measurements; notes=clean.notes;
      customRoutines=Object.keys(clean.customRoutines).length?clean.customRoutines:JSON.parse(JSON.stringify(defaultPPL));
      customAliases=Object.keys(clean.customAliases).length?clean.customAliases:JSON.parse(JSON.stringify(defaultAliases));
      customMuscles=Object.keys(clean.customMuscles).length?clean.customMuscles:JSON.parse(JSON.stringify(defaultMuscles));
      currentUnit=clean.currentUnit; currentTheme=clean.currentTheme;
      persistLocal();
      migrateNames();
      await saveToFirebase();
      closeModal(); refreshAll();
      toast('Importado y validado correctamente');
    }catch(e){ alert('Archivo no válido.\n\n'+(e.message||'No se pudo validar la estructura.')); }
    finally{ ev.target.value=''; }
  };
  r.readAsText(file);
}

// --- FUNCIONES DEL CREADOR DE RUTINAS ---
window.openRoutineEditor = function(origName = '') {
    const isEdit = !!origName;
    const rName = isEdit ? origName : '';
    const exercises = isEdit && customRoutines[origName] ? customRoutines[origName] : [];

    let html = `
    <div class="modal-content-wrapper">
        <h2 style="margin-top:0">${isEdit ? 'Editar Rutina' : 'Crear Rutina'}</h2>
        <label>Nombre de la rutina</label>
        <input type="text" id="editRoutineName" value="${escapeHtml(rName)}" placeholder="Ej. Push, Pull, Pierna..." style="margin-bottom: 12px;" ${isEdit ? 'data-orig="'+escapeHtml(origName)+'"' : ''}>

        <label>Ejercicios</label>
        <div id="editRoutineExercises" style="max-height: 45vh; overflow-y: auto; padding-right: 5px; margin-bottom:10px;"></div>

        <button class="add-set" onclick="addRoutineExerciseRow()">+ Añadir Ejercicio</button>

        <div class="actions" style="margin-top:16px;">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveRoutine()">Guardar</button>
        </div>
        ${isEdit ? `<div style="margin-top:10px;"><button class="btn btn-danger full" data-name="${escapeHtml(origName)}" onclick="deleteRoutine(this.dataset.name)">Eliminar Rutina</button></div>` : ''}
    </div>`;

    const modal = document.getElementById('modal');
    modal.innerHTML = html;
    
    if(exercises.length === 0) {
        addRoutineExerciseRow();
    } else {
        exercises.forEach(ex => addRoutineExerciseRow(ex));
    }

    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
}

window.addRoutineExerciseRow = function(ex = null) {
    const name = ex ? ex.name : '';
    const sets = ex ? ex.sets : '';
    const reps = ex ? ex.reps : '';
    const rir = ex ? ex.rir : '';
    const rest = ex ? ex.rest : '';

    const div = document.createElement('div');
    div.className = 'routine-edit-row';
    div.innerHTML = `
        <div class="re-head">
            <input class="re-name" placeholder="Nombre del ejercicio" value="${escapeHtml(name)}" list="exerciseList">
            <button class="remove-set" aria-label="Quitar ejercicio" onclick="this.closest('.routine-edit-row').remove()"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
        </div>
        <div class="re-subgrid">
            <div><label>Series</label><input class="re-sets" type="number" value="${sets}"></div>
            <div><label>Reps</label><input class="re-reps" placeholder="8-12" value="${escapeHtml(reps)}"></div>
            <div><label>RIR</label><input class="re-rir" placeholder="1-2" value="${escapeHtml(rir)}"></div>
            <div><label>Descanso</label><input class="re-rest" placeholder="90 s" value="${escapeHtml(rest)}"></div>
        </div>
    `;
    document.getElementById('editRoutineExercises').appendChild(div);
}

window.saveRoutine = function() {
    const nameInput = document.getElementById('editRoutineName');
    const newName = nameInput.value.trim();
    const origName = nameInput.getAttribute('data-orig');

    if(!newName) { alert('Ingresa un nombre para la rutina.'); return; }

    if(origName && origName !== newName) {
        if(customRoutines[newName] && !confirm('Ya existe una rutina llamada "'+newName+'". ¿Quieres reemplazarla?')) return;
        delete customRoutines[origName];
    } else if(!origName && customRoutines[newName]) {
        if(!confirm('Ya existe una rutina llamada "'+newName+'". ¿Quieres reemplazarla?')) return;
    }

    const rows = document.querySelectorAll('.routine-edit-row');
    const newExercises = [];
    rows.forEach(r => {
        const eName = r.querySelector('.re-name').value.trim();
        const eSets = parseInt(r.querySelector('.re-sets').value) || 0;
        const eReps = r.querySelector('.re-reps').value.trim();
        const eRir = r.querySelector('.re-rir').value.trim();
        const eRest = r.querySelector('.re-rest').value.trim();

        if(eName && eSets > 0) {
            newExercises.push({ name: eName, sets: eSets, reps: eReps, rir: eRir, rest: eRest });
        }
    });

    if(newExercises.length === 0) { alert('Agrega al menos un ejercicio con series válidas.'); return; }

    customRoutines[newName] = newExercises;
    saveToFirebase();
    updateCategorySelect();
    renderRoutines();
    closeModal();
    toast('Rutina guardada');
}

window.deleteRoutine = function(name) {
    if(!confirm(`¿Estás seguro de eliminar la rutina "${name}"?`)) return;
    delete customRoutines[name];
    saveToFirebase();
    updateCategorySelect();
    renderRoutines();
    closeModal();
    toast('Rutina eliminada');
}

function renderRoutines(){
  document.getElementById('routineContent').innerHTML=Object.entries(customRoutines).map(([name,rows])=>`
    <details>
        <summary>
            <span>${escapeHtml(name)}</span>
            <button class="btn-edit-sm" data-name="${escapeHtml(name)}" onclick="event.preventDefault(); openRoutineEditor(this.dataset.name)">${ic('edit')} Editar</button>
        </summary>
        <div class="routine-content">
            <table>
                <thead><tr><th>Ejercicio</th><th>Series</th><th>Reps</th><th>RIR</th><th>Descanso</th></tr></thead>
                <tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.name)}</td><td>${r.sets}</td><td>${escapeHtml(r.reps)}</td><td>${escapeHtml(r.rir)}</td><td>${escapeHtml(r.rest)}</td></tr>`).join('')}</tbody>
            </table>
        </div>
    </details>`).join('') || '<div class="empty">No tienes rutinas creadas. Toca "+ Nueva Rutina" para empezar.</div>';
}

function refreshAll(){
    document.documentElement.setAttribute('data-theme', currentTheme);
    populateExercises();loadDay();renderDashboard();renderCalendar();renderBodyWeights();updateChart();renderProgressionPanel();renderRoutines();renderTrainCTA();renderTrain();
}

// ===== AVISOS DEL SISTEMA PARA EL DESCANSO =====
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); }
function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true; }
function notifState(){
  if(!('Notification' in window)||!('serviceWorker' in navigator)) return 'unsupported';
  if(isIOS()&&!isStandalone()) return 'needs-install';
  if(Notification.permission==='denied') return 'denied';
  if(Notification.permission==='granted') return localStorage.getItem('gymNotif')==='0'?'off':'on';
  return 'off';
}
function notifBody(){ try{ const e=train&&trainCur(); return e?('Siguiente serie · '+e.name):'Hora de tu siguiente serie'; }catch(_){ return 'Hora de tu siguiente serie'; } }
async function swReg(){ return Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error('sw')),2500))]); }
async function notifShow(title,body){
  try{ const reg=await swReg(); await reg.showNotification(title,{body,tag:'liftengine-rest',renotify:true,vibrate:[200,100,200,100,200],icon:'icons/icon-192.png',badge:'icons/icon-192.png'}); }catch(e){}
}
async function notifSchedule(){
  if(notifState()!=='on') return;
  try{ const reg=await swReg(); if(reg.active) reg.active.postMessage({type:'rest-start',endAt:window.timerEndAt,title:'Descanso terminado',body:notifBody()}); }catch(e){}
}
async function notifCancel(){ try{ const reg=await swReg(); if(reg.active) reg.active.postMessage({type:'rest-cancel'}); }catch(e){} }
async function notifClear(){ try{ const reg=await swReg(); (await reg.getNotifications({tag:'liftengine-rest'})).forEach(n=>n.close()); }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) notifClear(); });
window.toggleNotifications=async function(silent){
  const st=notifState();
  if(st==='unsupported'){ toast('Tu navegador no admite notificaciones'); return; }
  if(st==='needs-install'){ alert('En iPhone las notificaciones solo funcionan con la app instalada.\n\nSafari → Compartir → Añadir a pantalla de inicio, y ábrela desde ese icono.'); return; }
  if(st==='denied'){ alert('Las notificaciones están bloqueadas para esta página.\n\nActívalas en los ajustes del sistema o del navegador (Notificaciones → LiftEngine / Chrome).'); return; }
  if(st==='on'){ try{localStorage.setItem('gymNotif','0')}catch(e){} notifCancel(); }
  else{
    const p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(p==='granted'){ try{localStorage.setItem('gymNotif','1')}catch(e){} notifShow('Avisos activados','Te avisaremos cuando termine tu descanso.'); }
    else toast('Permiso no concedido');
  }
  if(!silent) renderSettingsModal();
};
function notifOffer(){
  if(notifState()!=='off'||Notification.permission!=='default'||localStorage.getItem('gymNotifAsked')) return;
  try{ localStorage.setItem('gymNotifAsked','1'); }catch(e){}
  if(confirm('¿Quieres recibir un aviso del sistema cuando termine tu descanso, incluso con la pantalla bloqueada?')) toggleNotifications(true);
}

// ===== TECLADO NUMÉRICO EN MÓVIL (inputmode) =====
const NUM_SEL={'.set-weight,#cardioDist,#mwWeight,#calcTarget,#calcBar,#mmWaist,#mmChest,#mmArm,#mmThigh,#mmHip,.tr-w':'decimal',
               '.set-reps,.set-rir,#cardioTime,.re-sets,.tr-r,.tr-rir':'numeric'};
let numPadQueued=false;
function applyNumPad(){
  numPadQueued=false;
  for(const [sel,mode] of Object.entries(NUM_SEL)) document.querySelectorAll(sel).forEach(el=>{
    if(el.getAttribute('inputmode')===mode) return;
    el.setAttribute('inputmode',mode); el.setAttribute('enterkeyhint','next'); el.setAttribute('autocomplete','off');
  });
}
new MutationObserver(()=>{ if(!numPadQueued){numPadQueued=true;requestAnimationFrame(applyNumPad)} }).observe(document.body,{childList:true,subtree:true});
applyNumPad();
document.addEventListener('focusin',e=>{ const t=e.target; if(t&&t.matches&&t.matches('input[inputmode]')) setTimeout(()=>{try{t.select()}catch(_){}},0); });

// ===== MODO ENTRENAMIENTO =====
const TRAIN_KEY='gymTrainState';
let train=safeParse(localStorage.getItem(TRAIN_KEY),null), trainClock=null, wakeLock=null, trainAutoRest=localStorage.getItem('gymAutoRest')!=='0';
const isDone=s=>s.done===undefined?(parseFloat(s.reps)>0):!!s.done;
const rd=v=>Math.round(fromKg(v)*10)/10;
let restCtx=null;
function fmtRest(sec){ return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }
function restLabel(s){ return s.restUsed?fmtRest(s.restUsed):s.rest; }
function trainRestEnded(){
  if(!restCtx) return; const c=restCtx; restCtx=null;
  const end=window.timerEndAt?Math.min(Date.now(),window.timerEndAt):Date.now();
  const secs=Math.round((end-c.startAt)/1000);
  const e=(data[c.date]||[]).find(x=>x.id===c.id), st=e&&e.sets[c.i];
  if(st&&secs>=5&&isDone(st)){ st.restUsed=secs; saveToFirebase(); renderTrain(); }
}
function saveTrain(){ try{ if(train) localStorage.setItem(TRAIN_KEY,JSON.stringify(train)); else localStorage.removeItem(TRAIN_KEY); }catch(e){} }
function trainEntries(){ return train?train.order.map(id=>(data[train.date]||[]).find(x=>x.id===id)).filter(Boolean):[]; }
function openEl(){ document.getElementById('modalBackdrop').classList.add('show'); document.body.classList.add('modal-open'); }

function renderTrainCTA(){
  document.querySelectorAll('.train-cta-slot').forEach(b=>{
    b.innerHTML=train
      ? `<button class="btn btn-primary" onclick="openTraining()">${ic('play')} Continuar entrenamiento · ${escapeHtml(train.routine||'Sesión libre')}</button>`
      : `<button class="btn btn-primary" onclick="openTrainStart()">${ic('dumbbell')} Iniciar modo entrenamiento</button>`;
  });
}
window.openTrainStart=function(){
  const pre=categories[todayStr()];
  document.getElementById('modal').innerHTML=`<h2>Modo entrenamiento</h2>
    <p class="muted">Elige la rutina de hoy. Verás tu rendimiento anterior en cada serie y el descanso arranca solo al marcar cada serie como hecha y se guarda como dato.</p>
    <div class="progress-list">${Object.keys(customRoutines).map(k=>`<button class="btn btn-secondary full" style="${k===pre?'border-color:var(--accent)':''}" data-n="${escapeHtml(k)}" onclick="startTraining(this.dataset.n)">${escapeHtml(k)}${k===pre?' · asignada hoy':''}</button>`).join('')}
    <button class="btn btn-secondary full" onclick="startTraining('')">Sesión libre</button></div>
    <div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button></div>`;
  openEl();
}
window.startTraining=function(name){
  notifOffer();
  const date=todayStr(); if(!data[date]) data[date]=[];
  const rows=name&&customRoutines[name]?customRoutines[name]:[], order=[];
  rows.forEach(ex=>{
    let e=data[date].find(x=>!x.isCardio&&x.name===ex.name&&!order.includes(x.id));
    if(!e){ e={id:Date.now()+Math.random(),isCardio:false,name:ex.name,sets:Array.from({length:ex.sets||3},(_,i)=>({setNumber:i+1,reps:'-',weight:0,rir:'-',rest:ex.rest||'-'}))}; data[date].push(e); }
    order.push(e.id);
  });
  data[date].filter(x=>!x.isCardio&&!order.includes(x.id)).forEach(x=>order.push(x.id));
  if(!order.length){ toast('Esa sesión no tiene ejercicios. Agrégalos en Rutinas.'); if(!data[date].length) delete data[date]; return; }
  if(name) categories[date]=name;
  train={date,routine:name||'',startedAt:Date.now(),order,idx:0};
  train.idx=Math.max(0,trainEntries().findIndex(e=>!e.sets.every(isDone)));
  saveTrain(); saveToFirebase(); closeModal(); openTraining(); loadDay(); renderCalendar();
}
async function trainWake(){ try{ if('wakeLock' in navigator&&!wakeLock){ wakeLock=await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release',()=>{wakeLock=null}); } }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&train&&document.getElementById('trainOverlay').classList.contains('open')) trainWake(); });
function updateTrainClock(){
  if(!train) return; const t=Math.floor((Date.now()-train.startedAt)/1000), h=Math.floor(t/3600);
  document.getElementById('trainElapsed').textContent=(h?h+':':'')+String(Math.floor(t%3600/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
}
window.openTraining=function(){
  if(!train) return;
  document.getElementById('trainOverlay').classList.add('open'); document.body.classList.add('train-open');
  clearInterval(trainClock); trainClock=setInterval(updateTrainClock,1000); updateTrainClock(); trainWake(); renderTrain();
}
function closeTrainUI(){
  document.getElementById('trainOverlay').classList.remove('open'); document.body.classList.remove('train-open');
  clearInterval(trainClock); trainClock=null; try{wakeLock&&wakeLock.release()}catch(e){} wakeLock=null;
}
window.trainExit=function(){ closeTrainUI(); renderTrainCTA(); toast('Entrenamiento en pausa · toca "Continuar" para volver'); }
function resumeTrainingIfAny(){
  if(!train) return;
  if(Date.now()-train.startedAt>12*3600e3||!trainEntries().length){ train=null; saveTrain(); renderTrainCTA(); return; }
  openTraining();
}

function renderTrain(){
  const ov=document.getElementById('trainOverlay'); if(!train||!ov.classList.contains('open')) return;
  const es=trainEntries(); if(!es.length){ train=null; saveTrain(); closeTrainUI(); renderTrainCTA(); return; }
  train.idx=Math.min(Math.max(train.idx,0),es.length-1);
  const e=es[train.idx], d=train.date, body=document.getElementById('trainBody'), keep=body.scrollTop;
  document.getElementById('trainTitle').textContent=train.routine||'Sesión libre';
  document.getElementById('trainChips').innerHTML=es.map((x,i)=>{const dn=x.sets.length&&x.sets.every(isDone);return `<button class="train-chip ${i===train.idx?'active':''} ${dn?'done':''}" onclick="trainGo(${i})" aria-label="Ejercicio ${i+1}">${dn?ic('check'):i+1}</button>`}).join('');
  document.getElementById('trainNext').innerHTML=train.idx===es.length-1?'Finalizar '+ic('check'):'Siguiente '+ic('arrow-right');
  const tg=routineTargetFor(e.name);
  const tags=tg?[`${tg.sets} series`,tg.repRange?`${tg.repRange.min}–${tg.repRange.max} reps`:'',`RIR ${tg.rir}`,`Descanso ${tg.rest}`].filter(Boolean):[];
  const prev=getExerciseSessions(e.name).filter(x=>x.date<d), last=prev[prev.length-1];
  let sug=null,hint='',lastHtml='<div class="train-last muted">Primera vez con este ejercicio: registra tus series.</div>';
  if(last){
    const v=last.sets.filter(x=>x.reps>0), rec=progressionRecommendation(e.name,prev,tg);
    const inc=rec.increment||progressionIncrementKg(Math.max(0,...v.map(x=>x.weight)));
    const suggestedWeight=rec.action==='increase'&&v.length?v[0].weight+inc:(v[0]?.weight||0);
    const suggestedReps=rec.action==='increase'&&tg?.repRange?tg.repRange.min:(v[0]?.reps||'');
    sug=i=>{const p=v[i]||v[v.length-1]||{};return rec.action==='increase'?{w:p.weight+inc,r:tg?.repRange?.min||p.reps}:{w:p.weight,r:p.reps}};
    hint=rec.title+(rec.action==='increase'?` → prueba ${rd(suggestedWeight)} ${unitLabel()}`:'');
    const best=Math.max(0,...prev.flatMap(x=>x.sets.map(z=>z.weight)));
    lastHtml=`<div class="train-last"><b>Última vez · ${fmtDate(last.date)}</b><br>${last.sets.map(z=>`${rd(z.weight)}×${z.reps}`).join(' · ')}<br><span class="muted">Récord: ${rd(best)} ${unitLabel()}</span></div>`;
  }
  const rph=tg?parseFloat(tg.rir):NaN;
  const rows=e.sets.map((s,i)=>{
    const sg=sug?sug(i):null, dn=isDone(s), has=parseFloat(s.reps)>0;
    const sw=sg&&sg.w?rd(sg.w):'', sr=sg&&sg.r?sg.r:'';
    const ri=has&&s.rir!=='-'&&!isNaN(parseFloat(s.rir))?s.rir:'';
    return `<div class="tr-row ${dn?'done':''}"><div class="tr-n">${i+1}</div>
      <input class="tr-w" type="number" step="0.5" min="0" value="${s.weight?rd(s.weight):''}" placeholder="${sw}" data-sug="${sw}" onchange="trainSave(${i})" aria-label="Peso serie ${i+1}">
      <input class="tr-r" type="number" min="0" value="${has?escapeHtml(s.reps):''}" placeholder="${sr}" data-sug="${sr}" onchange="trainSave(${i})" aria-label="Reps serie ${i+1}">
      <input class="tr-rir" type="number" min="0" max="10" value="${escapeHtml(ri)}" placeholder="${isNaN(rph)?'':rph}" onchange="trainSave(${i})" aria-label="RIR serie ${i+1}">
      <button class="tr-ok" onclick="trainToggle(${i})" aria-label="Marcar serie ${i+1}">${dn?ic('check'):ic('circle')}</button>${s.restUsed?`<div class="tr-rest">Descanso real ${fmtRest(s.restUsed)}</div>`:''}</div>`;
  }).join('');
  body.innerHTML=`<h2 class="train-name">${escapeHtml(e.name)}</h2>
    <div class="train-tags">${tags.map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>
    ${lastHtml}${hint?`<div class="train-hint">${ic('bulb')}${escapeHtml(hint)}</div>`:''}
    <div class="tr-head"><span>#</span><span>Peso (${unitLabel()})</span><span>Reps</span><span>RIR</span><span></span></div>${rows}
    <div class="train-tools"><button class="btn btn-secondary" onclick="trainAddSet()">+ Serie</button><button class="btn btn-secondary" onclick="trainAddExercise()">+ Ejercicio</button><button class="btn btn-secondary" onclick="trainDelSet()">− Serie</button><button class="btn btn-secondary" onclick="trainToggleAuto()">${ic('timer')} Auto: ${trainAutoRest?'Sí':'No'}</button></div>`;
  body.scrollTop=keep;
}
function trainCur(){ return trainEntries()[train.idx]; }
function trainRead(i,useSug){
  const row=document.querySelectorAll('#trainBody .tr-row')[i], g=c=>{const el=row.querySelector(c);return el.value!==''?el.value:(useSug?(el.dataset.sug||''):'')};
  return {w:g('.tr-w'),r:g('.tr-r'),ri:g('.tr-rir')};
}
window.trainSave=function(i){
  const e=trainCur(); if(!e) return; const s=e.sets[i], v=trainRead(i,false);
  s.reps=v.r!==''?v.r:'-'; s.weight=v.w!==''?toKg(v.w):0; s.rir=v.ri!==''?v.ri:'-'; saveToFirebase();
}
window.trainToggle=function(i){
  const es=trainEntries(), e=es[train.idx]; if(!e) return; const s=e.sets[i];
  if(isDone(s)){ s.done=false; delete s.restUsed; saveToFirebase(); renderTrain(); return; }
  const v=trainRead(i,true);
  if(!(parseFloat(v.r)>0)){ toast('Escribe las repeticiones'); return; }
  trainRestEnded(); s.reps=String(v.r); s.weight=v.w!==''?toKg(v.w):0; s.rir=v.ri!==''?v.ri:'-'; s.done=true; saveToFirebase();
  if(trainAutoRest&&!es.every(x=>x.sets.every(isDone))){ window.timerEndAt=Date.now()+parseRestSeconds(s.rest)*1000; restCtx={date:train.date,id:e.id,i,startAt:Date.now()}; ensureTimerRunning(); }
  if(navigator.vibrate) navigator.vibrate(30);
  renderTrain();
}
window.trainAddExercise=function(){
  document.getElementById('modal').innerHTML=`<h2>Añadir ejercicio</h2><label>Nombre</label><input id="trNewEx" list="exerciseList" placeholder="Ej. Press banca con barra"><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="trainAddExerciseOk()">Añadir</button></div>`;
  openEl(); setTimeout(()=>{const i=document.getElementById('trNewEx'); if(i) i.focus();},60);
}
window.trainAddExerciseOk=function(){
  const raw=document.getElementById('trNewEx').value.trim(); if(!raw){ toast('Escribe el ejercicio'); return; }
  const name=normalizeName(raw), d=train.date; if(!data[d]) data[d]=[];
  const prev=getExerciseSessions(name).filter(x=>x.date<d).pop(), n=prev?prev.sets.length:3, rest=(routineTargetFor(name)||{}).rest||'90 s';
  const e={id:Date.now()+Math.random(),isCardio:false,name,sets:Array.from({length:n},(_,i)=>({setNumber:i+1,reps:'-',weight:0,rir:'-',rest}))};
  data[d].push(e); train.order.push(e.id); train.idx=train.order.length-1;
  saveTrain(); saveToFirebase(); closeModal(); populateExercises(); renderTrain();
}
window.trainAddSet=function(){ const e=trainCur(); if(!e) return; const l=e.sets[e.sets.length-1]||{}; e.sets.push({setNumber:e.sets.length+1,reps:'-',weight:0,rir:'-',rest:l.rest||'90 s'}); saveToFirebase(); renderTrain(); }
window.trainDelSet=function(){ const e=trainCur(); if(!e||e.sets.length<2) return; if(isDone(e.sets[e.sets.length-1])){ toast('Desmarca la última serie para quitarla'); return; } e.sets.pop(); saveToFirebase(); renderTrain(); }
window.trainToggleAuto=function(){ trainAutoRest=!trainAutoRest; try{localStorage.setItem('gymAutoRest',trainAutoRest?'1':'0')}catch(e){} if(!trainAutoRest) stopTimer(); renderTrain(); }
window.trainGo=function(i){ train.idx=i; saveTrain(); renderTrain(); document.getElementById('trainBody').scrollTop=0; }
window.trainNav=function(n){
  const len=trainEntries().length;
  if(train.idx+n>=len){ trainFinish(); return; }
  if(train.idx+n<0) return; train.idx+=n; saveTrain(); renderTrain(); document.getElementById('trainBody').scrollTop=0;
}
window.trainFinish=function(){
  const es=trainEntries(), done=es.reduce((a,e)=>a+e.sets.filter(isDone).length,0);
  const vol=es.reduce((a,e)=>a+e.sets.filter(isDone).reduce((b,s)=>b+(parseFloat(s.reps)||0)*(parseFloat(s.weight)||0),0),0);
  const mins=Math.max(1,Math.round((Date.now()-train.startedAt)/60000)), rv=es.flatMap(e=>e.sets.map(z=>z.restUsed).filter(Boolean));
  const prs=findPRs().filter(p=>p.date===train.date);
  const prHtml=prs.map(p=>{
    const value=p.type==='reps'?`${p.value} reps`:formatKgValue(p.value);
    return `<div class="progress-item">${ic('trophy')} <b>${escapeHtml(p.name)}</b><span class="pr">PR ${escapeHtml(p.label)} · ${value}</span></div>`;
  }).join('');
  document.getElementById('modal').innerHTML=`<h2>Resumen del entrenamiento</h2>
    <div class="stat-grid" style="margin-bottom:12px"><div class="stat"><div class="label">Duración</div><div class="value">${mins} min</div></div><div class="stat"><div class="label">Series hechas</div><div class="value">${done}</div></div><div class="stat"><div class="label">Ejercicios</div><div class="value">${es.length}</div></div><div class="stat"><div class="label">Volumen</div><div class="value">${Math.round(fromKg(vol)).toLocaleString()} ${unitLabel()}</div></div></div>
    ${prHtml?`<div class="progress-list" style="margin-bottom:12px">${prHtml}</div>`:''}
    ${rv.length?`<p class="muted">Descanso promedio: <b>${fmtRest(Math.round(rv.reduce((a,b)=>a+b,0)/rv.length))}</b></p>`:''}<p class="muted">Las series sin datos se descartan al terminar.</p>
    <div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Seguir</button><button class="btn btn-primary" onclick="trainEnd()">Terminar y guardar</button></div>`;
  openEl();
}
window.trainEnd=function(){
  stopTimer();
  const d=train.date;
  trainEntries().forEach(e=>{ e.sets=e.sets.filter(setHasData); e.sets.forEach((s,i)=>s.setNumber=i+1); });
  data[d]=(data[d]||[]).filter(e=>e.isCardio||e.sets.length); if(!data[d].length) delete data[d];
  train=null; saveTrain(); closeTrainUI(); closeModal(); saveToFirebase(); refreshAll(); toast('¡Entrenamiento guardado!');
}

async function initApp() {
    if(DOC_ID) setTimeout(()=>{ document.getElementById('loadingOverlay').style.display='none'; },4000);
    document.getElementById('routineDate').value=todayStr();
    load();
    if(migrateNames()) persistLocal();
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateCategorySelect();
    addSet(); populateExercises(); loadDay(); renderDashboard(); renderCalendar(); renderRoutines();
    renderTrainCTA(); resumeTrainingIfAny();
    if(localRecoveryDetected) setTimeout(()=>toast('Se detectaron datos locales dañados y se conservó una copia de recuperación en este dispositivo.'),900);

    if(await connectFirebase()) {
        fb.onAuthStateChanged(fb.auth, user => {
            if(user) {
                const prevUid=localStorage.getItem('gymLastUid');
                if(prevUid && prevUid!==user.uid){ wipeLocalData(); train=null; load(); refreshAll(); }
                DOC_ID = user.uid;
                localStorage.setItem('gymLastUid', user.uid);
                document.getElementById('authOverlay').classList.add('hidden');
                if(!prevUid) document.getElementById('loadingOverlay').style.display='flex';
                updateSyncStatus('Conectando…','saving');
                syncFromCloud().then(ok => {
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
    }
}

window.addEventListener('online',()=>{ if(!saveInFlight && DOC_ID) syncFromCloud().then(ok=>{ if(!ok) updateSyncStatus('Guardado local · sin conexión','error'); }); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && window.timerInt) tickTimer(); });

document.getElementById('routineDate').addEventListener('change',()=>loadDay());
document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && document.getElementById('modalBackdrop').classList.contains('show')) closeModal()});

const settingsBtn = document.getElementById('settingsBtn');
if(settingsBtn){
    settingsBtn.addEventListener('click', () => renderSettingsModal());
}

initApp();

// Instalable y con modo sin conexión (requiere https o localhost)
if('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
