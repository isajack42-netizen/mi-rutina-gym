import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const size=p=>fs.statSync(path.join(root,p)).size;

const core=read('js/core.js');
const bootstrap=read('js/bootstrap.js');
const training=read('js/training.js');
const tools=read('js/tools.js');
const html=read('index.html');
const css=read('styles.css');
const sw=read('sw.js');
const rules=read('firestore.rules');
const pkg=JSON.parse(read('package.json'));
const app=read('app.js');

assert.doesNotMatch(core,/withTimeout\(\s*fb\.(?:setDoc|deleteDoc)\s*\(/,'las escrituras setDoc/deleteDoc no deben tener timeout local');
assert.doesNotMatch(core,/withTimeout\(\s*batch\.commit\s*\(/,'los batch writes no deben tener timeout local');
assert.match(core,/await fb\.runTransaction/,'las escrituras v2 deben conservar transacciones Firestore');
assert.match(core,/assertCloudDocumentSize\([^\n]*El día/,'los días deben proteger el límite de documento');
assert.match(core,/assertCloudDocumentSize\('La configuración'/,'settings debe proteger el límite de documento');
assert.match(core,/CLOUD_DOC_SOFT_LIMIT_BYTES=900\*1024/,'debe existir margen antes del límite de Firestore');

assert.match(tools,/function backupDataShapeCounts/,'la restauración debe medir pérdidas estructurales');
assert.match(tools,/omittedEntries/,'la restauración debe avisar registros omitidos');
assert.match(tools,/omittedSets/,'la restauración debe avisar series omitidas');
assert.match(tools,/activeTraining:trainingSnapshot\(\)/,'el respaldo completo debe conservar la sesión activa');
assert.match(tools,/escapeHtml\(m\).*escapeHtml\(m\)/,'los grupos musculares restaurados deben escaparse antes de renderizarse');

assert.match(core,/ev\.key==='Tab'&&box/,'el diálogo de confirmación debe atrapar Tab');
assert.match(bootstrap,/function labelModalDialog/,'los modales dinámicos deben tener nombre accesible');
assert.match(bootstrap,/previous\.getClientRects\(\)\.length/,'no se debe devolver foco a controles ocultos');
assert.match(html,/id="trainOverlay"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="trainTitle"/,'Modo Entrenamiento debe exponerse como diálogo modal');
assert.match(training,/querySelector\('\.app'\)\?\.setAttribute\('inert',''\)/,'Modo Entrenamiento debe aislar la app de fondo');
assert.match(training,/function bindTrainFocusTrap/,'Modo Entrenamiento debe contener el foco');
assert.match(css,/prefers-reduced-motion:reduce/,'debe respetarse reduce motion');

assert.match(sw,/if\(requestedVersion\)[\s\S]*Response\.error\(\)/,'offline no debe mezclar assets de releases distintas');
assert.match(rules,/request\.auth\.uid == userId/,'Firestore debe restringir datos al propietario');
assert.match(rules,/match \/days\/\{dayId\}/,'Firestore debe mantener documentos diarios bajo el usuario');

const listMatch=app.match(/const files=\[([^\]]+)\]/);
assert.ok(listMatch,'no se pudo leer la lista runtime de app.js');
const runtimeNames=[...listMatch[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
assert.ok(runtimeNames.length>=18,'lista runtime incompleta');
const runtimeFiles=['app.js','sw.js','js/version.js',...runtimeNames.filter(n=>n!=='version').map(n=>'js/'+n+'.js')];
const unique=[...new Set(runtimeFiles)];
const runtimeBytes=unique.reduce((sum,p)=>sum+size(p),0);
assert.ok(runtimeBytes<=450*1024,'JS runtime excede presupuesto: '+runtimeBytes+' bytes');
assert.ok(size('styles.css')<=140*1024,'CSS excede presupuesto: '+size('styles.css')+' bytes');
assert.ok(size('index.html')<=45*1024,'HTML excede presupuesto: '+size('index.html')+' bytes');
assert.equal(pkg.dependencies,undefined,'LiftEngine Personal no debe añadir dependencias npm runtime');

assert.match(read('ROADMAP-PERSONAL-EDITION.md'),/Final Audit|auditoría final/i,'el roadmap debe mantener la fase de cierre');
assert.match(read('ARCHITECTURE.md'),/IndexedDB/,'la arquitectura debe documentar persistencia local');

console.log('LiftEngine final audit OK · '+unique.length+' runtime JS · '+Math.round(runtimeBytes/1024)+' KiB JS · '+Math.round(size('styles.css')/1024)+' KiB CSS');
