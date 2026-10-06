import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const runtime=[
  'app.js','sw.js',
  'js/config.js','js/storage.js','js/core.js','js/settings.js','js/logbook.js','js/metrics.js','js/dashboard.js',
  'js/analytics.js','js/history.js','js/planning.js','js/schedule.js','js/review.js','js/intelligence.js','js/tools.js','js/routines.js',
  'js/notifications.js','js/training.js','js/recovery.js','js/bootstrap.js','js/version.js'
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
if(!css.includes('--progress-workspace-min:calc(100vh - 40px)')||!css.includes('min-height:var(--progress-workspace-min)')||!css.includes('height:var(--progress-workspace-min)')) fail.push('El workspace de Progreso debe mantener una altura visual estable entre subpestañas.');
if(!html.includes('id="summaryVersionLabel"')||!read('js/bootstrap.js').includes('summaryVersionLabel')) fail.push('La versión visible debe provenir de LIFTENGINE_VERSION y no quedar estática.');
if(!css.includes('v6.3.2 · PROGRESS ALIGNMENT')||!css.includes('#progreso .progress-nav{')||!css.includes('top:0')||!css.includes('#progreso.active>.desktop-exercise-browser')) fail.push('Las columnas de Progreso deben compartir la misma línea superior en escritorio.');
if(!html.includes('id="desktopExerciseComparison"')||!html.includes('id="desktopExerciseMilestones"')) fail.push('Faltan los paneles de perfil analítico v6.4.');
if(!html.includes('<option value="reps">')||!html.includes('<option value="rir">')||!html.includes('<option value="sets">')) fail.push('Faltan métricas de reps/RIR/series en la gráfica de ejercicio.');
if(!read('js/logbook.js').includes('function exercisePeriodComparison')||!read('js/logbook.js').includes('function exercisePrMilestones')) fail.push('Falta la lógica comparativa o de hitos del perfil v6.4.');
if(!css.includes('.desktop-compare-grid')||!css.includes('.desktop-milestone-list')) fail.push('Faltan estilos del perfil analítico de ejercicio v6.4.');
if(!html.includes('id="progress-tab-history"')||!html.includes('id="progress-history"')||!html.includes('id="historyCompareSummary"')) fail.push('Falta el workspace Historial de v6.5.');
if(!read('js/history.js').includes('function historyPeriodCompare')||!read('js/history.js').includes('window.renderHistory')) fail.push('Falta el motor de historial/comparación v6.5.');
if(!read('js/bootstrap.js').includes("'history'")||!read('js/bootstrap.js').includes("activeProgressView==='history'")) fail.push('Historial no está integrado en la subnavegación de Progreso.');
if(!css.includes('v6.5 · TRAINING HISTORY & COMPARE')||!css.includes('.desktop-progress-only{display:none!important}')||!css.includes('#progreso .desktop-history-view.active')||!css.includes('display:block!important')) fail.push('Historial debe ser una experiencia exclusiva de escritorio.');
if(!app.includes("'history'")||!sw.includes("'history'")) fail.push('history.js debe cargarse y precachearse.');
if(!html.includes('id="routinePlanSummary"')||!html.includes('id="routinePlanFrequency"')||!html.includes('id="routinePlanMuscles"')) fail.push('Falta el Planning Workspace v6.6 en Rutinas.');
if(!read('js/planning.js').includes('function planningComputePlan')||!read('js/planning.js').includes('window.renderRoutinePlanner')||!read('js/planning.js').includes('window.renderRoutineEditorPreview')) fail.push('Falta el motor o la vista previa del planificador v6.6.');
if(!app.includes("'planning'")||!sw.includes("'planning'")) fail.push('planning.js debe cargarse y precachearse.');
if(!read('js/routines.js').includes("modal.classList.add('routine-editor-modal')")||!read('js/routines.js').includes("renderRoutineEditorPreview")) fail.push('El editor de rutinas debe mostrar vista previa de planificación en escritorio.');
if(!css.includes('v6.6 · PLANNING WORKSPACE')||!css.includes('.routine-plan-summary')||!css.includes('.routine-editor-preview')) fail.push('Faltan estilos del Planning Workspace v6.6.');
if(!read('js/analytics.js').includes("resetRoutinePlanScenario")) fail.push('El planificador debe reajustar su escenario cuando cambia la meta semanal.');
if(!read('js/planning.js').includes('function planningRoutineDelta')||!read('js/planning.js').includes('Cambios respecto a')||!read('js/planning.js').includes('Las alertas globales de otros músculos permanecen en el Planificador principal')) fail.push('La vista previa del editor debe limitarse a la rutina editada en v6.6.1.');
if(!css.includes('.preview-delta-row')||!css.includes('.preview-no-change')) fail.push('Faltan estilos para los deltas específicos del editor v6.6.1.');
if(!read('js/settings.js').includes('function sanitizeWeeklyPlan')||!read('js/settings.js').includes('weeklyPlan:sanitizeWeeklyPlan')) fail.push('Falta el contrato persistente del plan semanal v6.7.');
if(!read('js/core.js').includes("WEEKLY_PLAN_KEY='gymWeeklyPlanV1'")||!read('js/core.js').includes("weeklyPlan={template:{},overrides:{}}")) fail.push('Falta el estado/localStorage del plan semanal v6.7.');
if(!read('js/schedule.js').includes('function scheduleBuildTemplate')||!read('js/schedule.js').includes('window.scheduleStatusForDate')||!read('js/schedule.js').includes('window.moveScheduledSession')) fail.push('Falta el motor de planificación/reprogramación v6.7.');
if(!app.includes("'schedule'")||!sw.includes("'schedule'")) fail.push('schedule.js debe cargarse y precachearse.');
if(!html.includes('id="routineWeeklySchedule"')||!read('js/planning.js').includes('renderWeeklySchedulePlanner')) fail.push('El plan semanal debe integrarse en el Planning Workspace.');
if(!read('js/dashboard.js').includes('plannedRoutineForDate')||!read('js/dashboard.js').includes('openScheduleDateEditor')) fail.push('Calendario no muestra planeado vs. realizado en v6.7.');
if(!read('js/training.js').includes("plannedRoutineForDate(todayStr())")||!read('js/training.js').includes('startPlannedRoutine')) fail.push('Modo Entrenamiento no utiliza la rutina planeada de hoy.');
if(!css.includes('v6.7 · WEEKLY SCHEDULE')||!css.includes('.dashboard-week-plan')||!css.includes('.weekly-template-grid')||!css.includes('.calendar-plan-line')) fail.push('Faltan estilos del Weekly Schedule v6.7.');
if(!css.includes('v6.8 · DESKTOP DESIGN SYSTEM')||!css.includes('--desktop-line:')||!css.includes('--desktop-surface:')) fail.push('Falta la capa visual desktop v6.8.');
if(!css.includes('#resumen .summary-glance-grid')||!css.includes('align-items:start')||!css.includes('#recentWorkouts .progress-item')) fail.push('Resumen v6.8 debe evitar estiramiento artificial y usar historial visualmente plano.');
if(!css.includes('#progreso .progress-nav-btn.active')||!css.includes('box-shadow:inset 2px 0 0 var(--accent)')) fail.push('La navegación desktop v6.8 debe usar un estado activo más sutil.');
if(!css.includes('.cal-day.selected')||!css.includes('color-mix(in srgb,var(--accent) 11%,var(--card))')) fail.push('Calendario v6.8 debe usar selección de bajo contraste.');
if(!css.includes('.routine details')||!css.includes('.routine summary:hover')||!css.includes('.modal,')||!css.includes('.app-dialog')) fail.push('Rutinas/modales deben compartir el lenguaje visual v6.8.');
if(!html.includes('id="progress-tab-review"')||!html.includes('id="progress-review"')||!html.includes('id="reviewHero"')) fail.push('Falta el workspace de Revisión v6.9.');
if(!read('js/review.js').includes('function reviewInsightModel')||!read('js/review.js').includes('function reviewNextFocus')||!read('js/review.js').includes('window.renderReview')) fail.push('Falta el motor de Weekly & Monthly Review v6.9.');
if(!app.includes("'schedule','review','intelligence'")||!sw.includes("'schedule','review','intelligence'")) fail.push('review.js debe cargarse y precachearse entre Schedule e Intelligence.');
if(!read('js/bootstrap.js').includes("'performance','intelligence','analytics','review','history','body'")||!read('js/bootstrap.js').includes("activeProgressView==='review'")) fail.push('Revisión no está integrada correctamente en Progreso.');
if(!css.includes('v6.9 · PERIODIC REVIEW')||!css.includes('.review-hero')||!css.includes('.review-insight-grid')||!css.includes('.desktop-review-view.active')) fail.push('Faltan estilos o responsive de Revisión v6.9.');
if(!read('js/intelligence.js').includes('function intelPersonalPatterns')||!read('js/intelligence.js').includes('function intelPatternReason')||!read('js/intelligence.js').includes('patterns=intelPersonalPatterns')) fail.push('Falta el motor de patrones personales de Intelligence 2.0.');
if(!read('js/intelligence.js').includes('Tu patrón reciente')||!read('js/intelligence.js').includes('Patrones personales recientes')) fail.push('Intelligence 2.0 debe explicar los patrones personales en UI y detalle.');
if(!read('js/logbook.js').includes('exerciseIndex:first?first.index:0')||!read('js/logbook.js').includes('exerciseCount:strength.length')) fail.push('El historial por ejercicio debe conservar contexto de posición para Intelligence 2.0.');
if(!css.includes('v6.10 · TRAINING INTELLIGENCE 2.0')||!css.includes('.intel-personal-memory')||!css.includes('.intel-pattern-item')) fail.push('Faltan estilos de Intelligence 2.0.');
if(!html.includes('patrones personales recientes')) fail.push('El subtítulo de Intelligence debe comunicar el nuevo contexto personal.');

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
