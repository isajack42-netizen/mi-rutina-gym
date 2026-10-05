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
