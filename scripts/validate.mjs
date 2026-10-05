import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const runtime=[
  'app.js','sw.js',
  'js/config.js','js/storage.js','js/core.js','js/settings.js','js/logbook.js','js/metrics.js','js/dashboard.js',
  'js/analytics.js','js/intelligence.js','js/tools.js','js/routines.js',
  'js/notifications.js','js/training.js','js/bootstrap.js','js/version.js'
];

const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=[];
const warn=[];

for(const p of runtime){
  if(!fs.existsSync(path.join(root,p))) fail.push(`Falta archivo runtime: ${p}`);
}

const html=read('index.html');
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const seen=new Set();
for(const id of ids){
  if(seen.has(id)) fail.push(`ID HTML duplicado: ${id}`);
  seen.add(id);
}

const sources=runtime.filter(p=>fs.existsSync(path.join(root,p))).map(p=>read(p));
const allText=html+'\n'+sources.join('\n');
const globals=new Set();

for(const c of sources){
  for(const m of c.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) globals.add(m[1]);
  for(const m of c.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) globals.add(m[1]);
}

const handlerBodies=[...allText.matchAll(/\bon(?:click|change|input|keydown|submit)=["'`]([^"'`]+)["'`]/g)].map(m=>m[1]);
const ignored=new Set([
  'if','for','while','switch','function','Math','Number','String','Object','Array','Date',
  'parseInt','parseFloat','event','document','console','setTimeout','clearTimeout',
  'encodeURIComponent','preventDefault','stopPropagation','closest','getElementById'
]);

for(const body of handlerBodies){
  for(const m of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){
    const name=m[1];
    if(!ignored.has(name)&&!globals.has(name)) fail.push(`Handler sin target global: ${name}() · ${body}`);
  }
}

const app=read('app.js');
const sw=read('sw.js');
const appList=app.match(/const files=\[([^\]]+)\]/s);
const swList=sw.match(/\.\.\.\[([^\]]+)\]\.map\(n=>q\(`js\/\$\{n\}\.js`\)\)/s);

function quotedList(s){
  return [...String(s||'').matchAll(/['"]([^'"]+)['"]/g)].map(m=>m[1]);
}

if(appList&&swList){
  const a=quotedList(appList[1]);
  const b=quotedList(swList[1]).filter(x=>x!=='version');
  const missingInSw=a.filter(x=>!b.includes(x));
  const extraInSw=b.filter(x=>!a.includes(x));
  if(missingInSw.length) fail.push('Módulos del loader fuera del Service Worker: '+missingInSw.join(', '));
  if(extraInSw.length) fail.push('Módulos del Service Worker fuera del loader: '+extraInSw.join(', '));
}else{
  warn.push('No se pudo comparar automáticamente la lista de módulos de app.js y sw.js');
}

const dashboard=read('js/dashboard.js');
const core=read('js/core.js');
const toolsJs=read('js/tools.js');
const css=read('styles.css');
if(/entries\[entries\.length-1\]\.e/.test(dashboard)) fail.push('Regresión: Cargar anterior vuelve a asumir .e en allWeightEntries().');
if(!core.includes('function sanitizeRecordId')) fail.push('Falta sanitización estricta de IDs importados.');
if(!core.includes("const key=boundedString(rawKey,80,'');")) fail.push('Falta normalizar nombres de rutina antes de safeKey().');
if(!toolsJs.includes('replaceDays:true')) fail.push('Restore JSON no reemplaza IndexedDB de forma explícita.');
if(!sw.includes("await caches.delete(VER)")) fail.push('Service Worker no revierte un precache incompleto.');
if(!html.includes('class="progress-nav"')||!html.includes('data-progress-view="analytics"')) fail.push('Falta la subnavegación de Progreso v6.1.');
if(!core.includes("const THEME_VALUES=['auto','light','default','ocean','forest','coffee']")) fail.push('Falta el contrato de temas v6.1.');
if(!core.includes('function applyTheme()')) fail.push('Falta aplicar el tema automático de forma centralizada.');
if(!css.includes('[data-theme="light"]')||!css.includes('prefers-color-scheme:light')) fail.push('Falta tema claro o seguimiento del tema del sistema.');
if(!html.includes('id="summaryMore"')||!css.includes('.summary-glance-grid')) fail.push('Falta la jerarquía compacta del Resumen v6.1.');
if(!dashboard.includes("document.createElement('button')")||!css.includes('.cal-dot')) fail.push('Calendario v6.1 no usa celdas accesibles e indicador visual.');
if(!read('js/training.js').includes('class="train-context')) fail.push('Modo Entrenamiento v6.1 no compacta el contexto previo.');

const trainingJs=read('js/training.js');
if(trainingJs.includes('Pulsa “Empezar” al iniciar la serie para cerrar el descanso correctamente')) fail.push('Regresión: marcar una serie durante el descanso vuelve a bloquearse.');
if(!trainingJs.includes('function trainApplyEnd')||!trainingJs.includes('onclick="trainEnd(true)"')) fail.push('Falta proteger las series pendientes al terminar el entrenamiento.');
if(!/trainEnd=function\(savePending\)/.test(trainingJs)) fail.push('trainEnd debe recibir explícitamente si guarda o descarta las pendientes.');
if(!trainingJs.includes('Descanso ${restLabel(s)}')||!read('js/logbook.js').includes("s.restEstimated?'≈ ':''")) fail.push('El descanso estimado debe mostrarse con ≈ en Entrenamiento y Registro.');
if(!html.includes('aria-controls="resumen"')||!html.includes('role="tabpanel" aria-labelledby="tab-resumen"')) fail.push('Falta la semántica accesible de pestañas v6.1.3.');
if(!read('js/bootstrap.js').includes('function bindRovingTablist')||!read('js/bootstrap.js').includes('function initModalFocusManagement')) fail.push('Falta navegación por teclado o gestión de foco en modales.');
if(!trainingJs.includes("data-set-state=\"${setState||'idle'}\"")||!css.includes('.tr-row.next-set')||!css.includes('.tr-row.active-set')) fail.push('Modo Entrenamiento no distingue la siguiente serie o la serie en curso.');
if(!read('js/dashboard.js').includes('progress-item-button')||!read('js/routines.js').includes('Crear primera rutina')) fail.push('Faltan estados interactivos accesibles de v6.1.3.');
if(!read('js/logbook.js').includes('1400+text.length*28')) fail.push('Los toasts largos no ajustan su duración.');
if(!html.includes('class="app-sidebar"')||!html.includes('class="app-main"')) fail.push('Falta el shell de escritorio v6.2.');
if(!css.includes('@media(min-width:1200px)')||!css.includes('grid-template-columns:248px minmax(0,1fr)')) fail.push('Falta el layout desktop principal v6.2.');
if(!css.includes('#registro.active')||!css.includes('#calendario.active')||!css.includes('#progreso.active')) fail.push('Faltan layouts desktop por sección.');
if(!css.includes('.train-overlay.open')||!css.includes('.train-chip-name')) fail.push('Falta el workspace desktop del Modo Entrenamiento.');
if(!read('js/routines.js').includes('trainRoutineFromLibrary')||!read('js/routines.js').includes('routine-train-btn')) fail.push('Rutinas no ofrece inicio directo en escritorio.');
if(!read('js/dashboard.js').includes('cal-desktop-stats')) fail.push('Calendario no expone metadatos desktop.');
if(!read('js/bootstrap.js').includes('function initDesktopExperience')) fail.push('Falta inicialización del comportamiento desktop.');
if(!html.includes('class="desktop-train-slot"')||!read('js/training.js').includes('desktop-train-btn')) fail.push('La acción de entrenamiento desktop debe vivir en la sidebar.');
if(!css.includes('.app-main .train-cta-slot{display:none}')||!css.includes('overflow:hidden')||!css.includes('height:calc(100vh - 40px)')) fail.push('El workspace desktop debe conservar márgenes verticales simétricos y scroll interno.');
if(!css.includes('border-radius:16px')||!css.includes('.app-main::-webkit-scrollbar-thumb')||!css.includes('scrollbar-width:thin')) fail.push('Falta el acabado redondeado/minimalista del scroll desktop.');
if(!html.includes('id="desktopExerciseBrowser"')||!html.includes('id="desktopExerciseHero"')||!html.includes('id="desktopExerciseHistory"')) fail.push('Falta el workspace de análisis por ejercicio v6.3.');
if(!read('js/logbook.js').includes('renderDesktopExerciseBrowser')||!read('js/logbook.js').includes('selectDesktopExercise')||!read('js/logbook.js').includes('renderDesktopExerciseContext')) fail.push('Falta la lógica del explorador de ejercicios v6.3.');
if(!read('js/bootstrap.js').includes("dataset.progressMode=['performance','intelligence'].includes(activeProgressView)?'exercise':'overview'")) fail.push('Progreso no distingue modo ejercicio/overview en escritorio.');
if(!css.includes('v6.3 · DESKTOP ANALYTICS WORKSPACE')||!css.includes('#progreso.active[data-progress-mode="exercise"]')) fail.push('Falta el layout Desktop Analytics Workspace v6.3.');
if(!css.includes('@media(min-width:1320px)')) fail.push('El explorador de ejercicios debe activarse solo con ancho desktop suficiente.');

let depth=0;
for(const ch of css){
  if(ch==='{') depth++;
  if(ch==='}') depth--;
  if(depth<0){ fail.push('CSS: llave de cierre sin apertura'); break; }
}
if(depth!==0) fail.push(`CSS: balance de llaves = ${depth}`);
if(css.includes('\\n\\n/*')) warn.push('CSS contiene un literal histórico \\n\\n antes de un comentario.');

if(fail.length){
  console.error('\nLiftEngine validation FAILED');
  fail.forEach(x=>console.error(' - '+x));
  if(warn.length){console.error('\nWarnings');warn.forEach(x=>console.error(' - '+x));}
  process.exit(1);
}

console.log(`LiftEngine validation OK · ${runtime.length} archivos runtime · ${ids.length} IDs · ${handlerBodies.length} handlers revisados`);
if(warn.length){console.warn('\nWarnings');warn.forEach(x=>console.warn(' - '+x));}
