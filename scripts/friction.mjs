import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const training=read('js/training.js');
const html=read('index.html');
const css=read('styles.css');

const a=training.indexOf('// <train-helpers>'), z=training.indexOf('// </train-helpers>');
assert.ok(a>=0&&z>a,'faltan helpers de entrenamiento');
const ctx={console,Math,Date,Number,parseFloat};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(training.slice(a,z)+'\nglobalThis.__f={isDone,trainNextIncompleteExercise,trainShouldOfferStart};',ctx);
const h=ctx.__f;

const entries=[
  {sets:[{done:true,reps:'8'}]},
  {sets:[{done:true,reps:'8'},{done:true,reps:'8'}]},
  {sets:[{done:false,reps:'-'},{done:false,reps:'-'}]},
  {sets:[{done:false,reps:'10'}]}
];
assert.equal(h.trainNextIncompleteExercise(entries,0),2,'debe saltar ejercicios ya completos');
assert.equal(h.trainNextIncompleteExercise(entries,2),3,'debe avanzar al siguiente ejercicio incompleto');
assert.equal(h.trainNextIncompleteExercise(entries,3),-1,'no debe envolver al inicio al terminar');
assert.equal(h.trainShouldOfferStart(true,false,1,1),true,'Empezar debe mostrarse en la siguiente serie durante descanso');
assert.equal(h.trainShouldOfferStart(true,false,2,1),false,'Empezar no debe repetirse en todas las series');
assert.equal(h.trainShouldOfferStart(false,false,1,1),false,'Empezar no debe aparecer fuera del descanso');

assert.match(training,/startPlannedRoutine\(this\.dataset\.routine\)/,'el plan de hoy debe iniciar directamente desde el CTA');
assert.match(training,/class="train-cta-actions"/,'el CTA planeado debe conservar acceso a otra rutina');
assert.match(training,/routineNames=Object\.keys\(customRoutines\)\.sort/,'la rutina planeada debe priorizarse en el selector');
assert.match(training,/inputmode="decimal" enterkeyhint="next"/,'peso debe optimizar el teclado móvil');
assert.match(training,/inputmode="numeric" enterkeyhint="next"/,'reps debe optimizar el teclado móvil');
assert.match(training,/enterkeyhint="done".*trainFieldNext\(event,\$\{i\},'rir'\)/s,'RIR debe cerrar el recorrido de teclado');
assert.match(training,/const autoNext=e\.sets\.every\(isDone\)\?trainNextIncompleteExercise/,'debe existir autoavance al terminar ejercicio');
assert.match(training,/class="train-more"/,'las acciones raras deben agruparse');
assert.match(training,/prevBtn\.disabled=train\.idx===0/,'Anterior debe deshabilitarse cuando no aplica');
assert.match(html,/id="trainPrev"/,'el control Anterior debe tener estado controlable');
assert.match(css,/v6\.12 · FRICTION AUDIT/,'faltan estilos de v6.12');
assert.match(css,/\.train-chip\{min-height:44px;height:44px/,'los chips táctiles deben tener 44 px');
assert.match(css,/\.train-tools\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'las herramientas deben reducir ruido visual');

console.log('LiftEngine friction audit OK · recorrido principal y guardrails de interacción v6.12');
