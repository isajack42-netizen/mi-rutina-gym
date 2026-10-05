// LiftEngine · modo entrenamiento
'use strict';
// ===== MODO ENTRENAMIENTO =====
const TRAIN_KEY='gymTrainState';
const rawTrainState=safeParse(localStorage.getItem(TRAIN_KEY),null);
let train=rawTrainState&&typeof rawTrainState==='object'?{...rawTrainState}:null, trainClock=null, wakeLock=null, trainAutoRest=localStorage.getItem('gymAutoRest')!=='0';
let restCtx=train&&train.__restCtx&&typeof train.__restCtx==='object'?train.__restCtx:null;
if(train){
  window.timerEndAt=Number(train.__timerEndAt)||0;
  window.timerAlarmed=!!train.__timerAlarmed;
  delete train.__restCtx; delete train.__timerEndAt; delete train.__timerAlarmed;
}
// <train-helpers>
const isDone=s=>s?.done===true||(s?.done===undefined&&(parseFloat(s.reps)||0)>0);
const hasTypedReps=s=>(parseFloat(s?.reps)||0)>0;
// Series con repeticiones escritas pero sin marcar como hechas (borrador).
function trainPendingSets(entries){
  return (entries||[]).flatMap(e=>e.isCardio?[]:(e.sets||[]).filter(s=>!isDone(s)&&hasTypedReps(s)));
}
// Cierra la sesión: conserva las series hechas y, según lo que elija el usuario,
// guarda o descarta las pendientes. Nunca descarta nada en silencio.
function trainApplyEnd(entries,savePending){
  let saved=0,dropped=0;
  (entries||[]).forEach(e=>{
    if(e.isCardio) return;
    (e.sets||[]).forEach(s=>{
      if(!isDone(s)&&hasTypedReps(s)){ if(savePending===true){ s.done=true; saved++; } else dropped++; }
    });
    e.sets=(e.sets||[]).filter(isDone);
    e.sets.forEach((s,i)=>{ s.setNumber=i+1; });
    delete e.trainingDraft;
  });
  return {saved,dropped};
}
// Descanso: «medido» si el usuario pulsó Empezar; «estimado» si marcó la serie directamente.
function trainRestResult(startAt,endAt,measured){
  const secs=Math.round((endAt-startAt)/1000);
  return secs>=5?{restUsed:secs,estimated:!measured}:null;
}
// </train-helpers>
function saveTrain(){
  try{
    if(train){
      const payload={...train,__restCtx:restCtx||null,__timerEndAt:Number(window.timerEndAt)||0,__timerAlarmed:!!window.timerAlarmed};
      localStorage.setItem(TRAIN_KEY,JSON.stringify(payload));
    }else localStorage.removeItem(TRAIN_KEY);
  }catch(e){}
}
function saveTrainingDraftLocal(){ try{if(train?.date)markDayDirty(train.date,{cloud:false,local:true});queuePersistLocal(60);saveTrain();}catch(e){console.warn('No se pudo guardar el borrador de entrenamiento:',e);} }
const rd=v=>Math.round(fromKg(v)*10)/10;
function fmtRest(sec){ return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); }
function restLabel(s){ return s.restUsed?(s.restEstimated?'≈ ':'')+fmtRest(s.restUsed):s.rest; }
function trainRestEnded(measured=true){
  if(!restCtx) return; const c=restCtx; restCtx=null;
  const r=trainRestResult(c.startAt,Date.now(),measured);
  const e=(data[c.date]||[]).find(x=>x.id===c.id), st=e&&e.sets[c.i];
  saveTrain();
  if(st&&r&&isDone(st)){
    st.restUsed=r.restUsed;
    if(r.estimated) st.restEstimated=true; else delete st.restEstimated;
    saveToFirebase({days:[c.date]}); renderTrain();
  }
}
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
  if(name&&!rows.length){toast('Esa rutina no tiene ejercicios.');if(!data[date].length)delete data[date];return;}
  rows.forEach(ex=>{
    let e=data[date].find(x=>!x.isCardio&&x.name===ex.name&&!order.includes(x.id)&&entryHasData(x));
    if(!e){ e={id:Date.now()+Math.random(),isCardio:false,name:ex.name,trainingDraft:true,sets:Array.from({length:ex.sets||3},(_,i)=>({setNumber:i+1,reps:'-',weight:0,rir:'-',rest:ex.rest||'-',type:'normal',done:false}))}; data[date].push(e); }
    order.push(e.id);
  });
  data[date].filter(x=>!x.isCardio&&entryHasData(x)&&!order.includes(x.id)).forEach(x=>order.push(x.id));
  train={date,routine:name||'',startedAt:Date.now(),order,idx:0,activeSet:null};
  const next=trainEntries().findIndex(e=>!e.sets.every(isDone));train.idx=next>=0?next:0;
  saveTrainingDraftLocal(); closeModal(); openTraining(); loadDay(); renderCalendar();
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
window.discardTrainingForDate=function(date,{silent=false}={}){
  if(!train||train.date!==date)return false;
  closeTrainUI();
  restCtx=null;
  try{notifCancel();}catch(e){}
  clearInterval(window.timerInt);window.timerInt=null;window.timerEndAt=0;window.timerAlarmed=false;
  const ft=document.getElementById('floatingTimer');if(ft){ft.style.display='none';ft.classList.remove('overtime');}
  const ov=document.getElementById('trainOverlay');if(ov){ov.classList.remove('resting');ov.classList.remove('overtime');}
  train=null;saveTrain();renderTrainCTA();
  if(!silent)toast('Entrenamiento descartado');
  return true;
}
function cleanupAbandonedTraining(){
  if(!train)return;
  const d=train.date, ids=new Set(train.order||[]); let keptAny=false;
  data[d]=(data[d]||[]).filter(e=>{
    if(!ids.has(e.id)||e.isCardio)return true;
    if(!e.trainingDraft)return true;
    e.sets=(e.sets||[]).filter(isDone);e.sets.forEach((x,i)=>x.setNumber=i+1);delete e.trainingDraft;
    if(e.sets.length){keptAny=true;return true;} return false;
  });
  if(!(data[d]||[]).length)delete data[d];
  if(keptAny&&train.routine)categories[d]=train.routine;
  restCtx=null;window.timerEndAt=0;window.timerAlarmed=false;train=null;saveTrain();saveToFirebase({days:[d]});
}
function resumeTrainingIfAny(){
  if(!train) return;
  if(Date.now()-train.startedAt>12*3600e3){ cleanupAbandonedTraining(); renderTrainCTA(); return; }
  openTraining();
  if(restCtx&&window.timerEndAt>0) ensureTimerRunning();
}

function renderTrain(){
  const ov=document.getElementById('trainOverlay'); if(!train||!ov.classList.contains('open')) return;
  const es=trainEntries();
  if(!es.length){
    document.getElementById('trainTitle').textContent=train.routine||'Sesión libre';
    document.getElementById('trainChips').innerHTML='';document.getElementById('trainNext').innerHTML='Finalizar '+ic('check');
    document.getElementById('trainBody').innerHTML=`<div class="empty" style="padding:28px 12px"><b>${train.routine?'No hay ejercicios disponibles':'Sesión libre'}</b><br><span class="muted">Añade el primer ejercicio para empezar.</span><div style="margin-top:16px"><button class="btn btn-primary" onclick="trainAddExercise()">+ Añadir ejercicio</button></div></div>`;
    return;
  }
  train.idx=Math.min(Math.max(train.idx,0),es.length-1);
  const e=es[train.idx], d=train.date, body=document.getElementById('trainBody'), keep=body.scrollTop;
  document.getElementById('trainTitle').textContent=train.routine||'Sesión libre';
  document.getElementById('trainChips').innerHTML=es.map((x,i)=>{const dn=x.sets.length&&x.sets.every(isDone);return `<button class="train-chip ${i===train.idx?'active':''} ${dn?'done':''}" onclick="trainGo(${i})" aria-label="Ejercicio ${i+1}">${dn?ic('check'):i+1}</button>`}).join('');
  document.getElementById('trainNext').innerHTML=train.idx===es.length-1?'Finalizar '+ic('check'):'Siguiente '+ic('arrow-right');
  const tg=routineTargetFor(e.name,train.routine||null,d);
  const tags=tg?[`${tg.sets} series`,tg.repRange?`${tg.repRange.min}–${tg.repRange.max} reps`:'',`RIR ${tg.rir}`,`Descanso ${normalizeRestLabel(tg.rest)}`].filter(Boolean):[];
  const prev=getExerciseSessions(e.name).filter(x=>x.date<d), last=prev[prev.length-1];
  const intel=typeof window.getTrainingIntelligence==='function'?window.getTrainingIntelligence(e.name,{sessions:prev,target:tg,routineName:train.routine||null,date:d,beforeDate:d}):null;
  const sug=i=>{
    const x=intel&&typeof window.intelligenceSuggestionForSet==='function'?window.intelligenceSuggestionForSet(intel,i):null;
    return x?{w:x.weightKg,r:x.reps}:null;
  };
  let lastHtml='<div class="train-context-empty">Primera vez con este ejercicio · registra tus series para crear una referencia.</div>';
  if(last){
    const best=Math.max(0,...prev.flatMap(x=>x.sets.map(z=>Number(z.weight)||0)));
    const bestReps=Math.max(0,...prev.flatMap(x=>x.sets.map(z=>Number(z.reps)||0)));
    const setText=last.sets.map(z=>`${Number(z.weight)>0?rd(z.weight)+'×':''}${z.reps}`).join(' · ');
    lastHtml=`<details class="train-context"><summary><span><small>Última sesión · ${fmtDate(last.date)}</small><b>${escapeHtml(setText)}</b></span><span class="train-context-link">Ver</span></summary><div class="train-context-detail">${best>0?`Récord de carga: ${rd(best)} ${unitLabel()}`:`Mejor registro: ${bestReps} reps`}</div></details>`;
  }
  const intelHtml=intel&&typeof window.renderIntelligenceCard==='function'?window.renderIntelligenceCard(intel,{compact:true,whyAction:'openTrainIntelligenceWhy()'}):'';
  const intelPlan=intel&&typeof intelligencePlanText==='function'?intelligencePlanText(intel):'';
  const intelShell=intel?`<details class="train-context train-context-intel"><summary><span><small>Objetivo sugerido</small><b>${escapeHtml(intelPlan||intel.title||'Revisar propuesta')}</b></span><span class="intelligence-action ${escapeHtml(intel.tone)}">${escapeHtml(intel.label)}</span></summary><div class="train-context-card">${intelHtml}</div></details>`:'';
  const rph=tg?parseFloat(tg.rir):NaN;
  const rows=e.sets.map((s,i)=>{
    const sg=sug?sug(i):null, dn=isDone(s), has=parseFloat(s.reps)>0;
    const sw=sg&&sg.w?rd(sg.w):'', sr=sg&&sg.r?sg.r:'';
    const ri=has&&s.rir!=='-'&&!isNaN(parseFloat(s.rir))?s.rir:'';
    const tp=normalizeSetType(s.type), weightStep=1;
    return `<div class="tr-row ${dn?'done':''} ${tp==='warmup'?'warmup':''} ${tp==='failure'?'failure':''}"><div class="tr-n">${i+1}</div>
      <div class="tr-weight-stepper"><button type="button" onclick="trainAdjustWeight(${i},-${weightStep})" aria-label="Bajar peso ${weightStep} ${unitLabel()}">−</button><input class="tr-w" type="number" step="0.5" min="0" value="${s.weight?rd(s.weight):''}" placeholder="${sw}" data-sug="${sw}" onchange="trainSave(${i})" aria-label="Peso serie ${i+1}"><button type="button" onclick="trainAdjustWeight(${i},${weightStep})" aria-label="Subir peso ${weightStep} ${unitLabel()}">+</button></div>
      <div class="tr-reps-stepper"><button type="button" onclick="trainAdjustReps(${i},-1)" aria-label="Bajar una repetición">−</button><input class="tr-r" type="number" step="1" min="0" value="${has?escapeHtml(s.reps):''}" placeholder="${sr}" data-sug="${sr}" onchange="trainSave(${i})" aria-label="Reps serie ${i+1}"><button type="button" onclick="trainAdjustReps(${i},1)" aria-label="Subir una repetición">+</button></div>
      <input class="tr-rir" type="number" min="0" max="10" value="${escapeHtml(ri)}" placeholder="${isNaN(rph)?'':rph}" onchange="trainSave(${i})" aria-label="RIR serie ${i+1}">
      <button class="tr-ok" onclick="trainToggle(${i})" aria-label="Marcar serie ${i+1}">${dn?ic('check'):ic('circle')}</button>
      <div class="tr-meta"><select class="tr-type" onchange="trainSetType(${i})" aria-label="Tipo de serie ${i+1}"><option value="normal" ${tp==='normal'?'selected':''}>Normal</option><option value="warmup" ${tp==='warmup'?'selected':''}>Calentamiento</option><option value="failure" ${tp==='failure'?'selected':''}>Al fallo</option></select><button class="tr-plate" type="button" onclick="openTrainPlateCalc(${i})">${ic('plate')} Discos</button>${!dn&&restCtx?`<button class="tr-start" type="button" onclick="trainStartSet(${i})">${train.activeSet&&train.activeSet.id===e.id&&train.activeSet.i===i?'En curso':'Empezar'}</button>`:(s.restUsed?`<span class="tr-rest-inline">Descanso ${restLabel(s)}</span>`:'<span></span>')}</div></div>`;
  }).join('');
  const exNote=exerciseNotes[e.name]||'';
  body.innerHTML=`<div class="train-name-row"><h2 class="train-name">${escapeHtml(e.name)}</h2>${e.substitutedFrom?`<span class="badge">Sustituye a ${escapeHtml(e.substitutedFrom)}</span>`:''}</div>
    <div class="train-tags">${tags.map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>
    ${intelShell}
    ${lastHtml}
    <button class="train-ex-note ${exNote?'has-note':''}" onclick="trainEditExerciseNote()">${ic('edit')} <span>${exNote?escapeHtml(exNote):'Nota del ejercicio'}</span></button>
    <div class="tr-head"><span>#</span><span>Peso (${unitLabel()})</span><span>Reps</span><span>RIR</span><span></span></div>${rows}
    <div class="train-tools"><button class="btn btn-secondary" onclick="trainAddSet()">+ Serie</button><button class="btn btn-secondary" onclick="trainAddExercise()">+ Ejercicio</button><button class="btn btn-secondary" onclick="trainSubstitute()">Sustituir ejercicio</button><button class="btn btn-secondary" onclick="trainDelSet()">− Serie</button><button class="btn btn-secondary" onclick="trainToggleAuto()">${ic('timer')} Auto: ${trainAutoRest?'Sí':'No'}</button></div>`;
  body.scrollTop=keep;
}
function trainCur(){ return trainEntries()[train.idx]; }
function trainRead(i,useSug){
  const row=document.querySelectorAll('#trainBody .tr-row')[i], g=c=>{const el=row.querySelector(c);return el.value!==''?el.value:(useSug?(el.dataset.sug||''):'')};
  return {w:g('.tr-w'),r:g('.tr-r'),ri:g('.tr-rir'),type:normalizeSetType(row.querySelector('.tr-type')?.value)};
}
window.trainSave=function(i){
  const e=trainCur(); if(!e) return; const s=e.sets[i], v=trainRead(i,false);
  s.reps=v.r!==''?v.r:'-'; s.weight=v.w!==''?toKg(v.w):0; s.rir=v.ri!==''?v.ri:'-'; s.type=v.type;
  if(s.done===true) saveToFirebase({days:[train.date]});
  else { s.done=false; saveTrainingDraftLocal(); }
}
window.trainStartSet=function(i){
  const e=trainCur();if(!e||!e.sets[i]||isDone(e.sets[i]))return;
  if(restCtx){trainRestEnded();if(window.timerInt)stopTimer();}
  train.activeSet={id:e.id,i,startedAt:Date.now()};saveTrain();renderTrain();
}
window.trainToggle=function(i){
  const es=trainEntries(), e=es[train.idx]; if(!e) return; const s=e.sets[i];
  if(isDone(s)){ s.done=false; delete s.restUsed; delete s.restEstimated; saveToFirebase({days:[train.date]}); renderTrain(); return; }
  const v=trainRead(i,true);
  if(!(parseFloat(v.r)>0)){ toast('Escribe las repeticiones'); return; }
  const measured=!!(train.activeSet&&train.activeSet.id===e.id&&train.activeSet.i===i);
  if(restCtx&&!measured&&!train.estimateHint){ train.estimateHint=true; toast('Descanso guardado como estimado (≈). Pulsa “Empezar” al iniciar cada serie para medirlo con precisión.'); }
  if(restCtx)trainRestEnded(measured); train.activeSet=null; s.reps=String(v.r); s.weight=v.w!==''?toKg(v.w):0; s.rir=v.ri!==''?v.ri:'-'; s.type=v.type; if(isFailureSet(s)&&v.ri==='') s.rir='0'; s.done=true; saveToFirebase({days:[train.date]});
  if(trainAutoRest&&!es.every(x=>x.sets.every(isDone))){ window.timerEndAt=Date.now()+parseRestSeconds(s.rest)*1000; window.timerAlarmed=false; restCtx={date:train.date,id:e.id,i,startAt:Date.now()}; train.activeSet=null; saveTrain(); ensureTimerRunning(); }
  if(navigator.vibrate) navigator.vibrate(30);
  renderTrain();
}
window.trainSetType=function(i){ trainSave(i); renderTrain(); }
window.trainAdjustWeight=function(i,deltaDisplay){
  const row=document.querySelectorAll('#trainBody .tr-row')[i]; if(!row) return;
  const input=row.querySelector('.tr-w');
  const base=parseFloat(input.value!==''?input.value:(input.dataset.sug||0))||0;
  const next=Math.max(0,Math.round((base+Number(deltaDisplay))*10)/10);
  input.value=next||''; trainSave(i);
}
window.trainAdjustReps=function(i,delta){
  const row=document.querySelectorAll('#trainBody .tr-row')[i]; if(!row) return;
  const input=row.querySelector('.tr-r');
  const base=parseInt(input.value!==''?input.value:(input.dataset.sug||0),10)||0;
  const next=Math.max(0,base+Number(delta||0));
  input.value=next>0?String(next):''; trainSave(i);
}
window.openTrainPlateCalc=function(i){
  const row=document.querySelectorAll('#trainBody .tr-row')[i]; if(!row) return;
  const input=row.querySelector('.tr-w'); const v=parseFloat(input.value!==''?input.value:(input.dataset.sug||''));
  openPlateCalc(Number.isFinite(v)?v:null);
}
window.trainEditExerciseNote=function(){
  const e=trainCur(); if(!e) return;
  const cur=exerciseNotes[e.name]||'';
  document.getElementById('modal').innerHTML=`<h2>Nota · ${escapeHtml(e.name)}</h2><p class="muted">Se guarda para este ejercicio y aparecerá en futuras sesiones. Úsala para asiento, agarre, altura de polea, posición, etc.</p><textarea id="trExerciseNote" maxlength="1200" rows="5" placeholder="Ej. Asiento en 4 · agarre neutro · respaldo 2">${escapeHtml(cur)}</textarea><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="trainSaveExerciseNote()">Guardar nota</button></div>`;
  openEl(); setTimeout(()=>document.getElementById('trExerciseNote')?.focus(),60);
}
window.trainSaveExerciseNote=function(){
  const e=trainCur(); if(!e) return;
  const v=(document.getElementById('trExerciseNote')?.value||'').trim();
  if(v) exerciseNotes[e.name]=v.slice(0,1200); else delete exerciseNotes[e.name];
  saveToFirebase({settings:true}); closeModal(); renderTrain(); toast(v?'Nota del ejercicio guardada':'Nota eliminada');
}
window.trainSubstitute=function(){
  const e=trainCur(); if(!e) return;
  document.getElementById('modal').innerHTML=`<h2>Sustituir ejercicio</h2><p class="muted">El historial anterior de <b>${escapeHtml(e.name)}</b> no se modifica. El ejercicio sustituto usará su propio historial y notas.</p><label>Nuevo ejercicio</label><input id="trSubEx" list="exerciseList" placeholder="Ej. Remo sentado en máquina"><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="trainSubstituteOk()">Sustituir</button></div>`;
  openEl(); setTimeout(()=>document.getElementById('trSubEx')?.focus(),60);
}
window.trainSubstituteOk=function(){
  const old=trainCur(); if(!old) return;
  const raw=(document.getElementById('trSubEx')?.value||'').trim(); if(!raw){toast('Escribe el ejercicio sustituto');return;}
  const name=normalizeName(raw); if(name===old.name){toast('Es el mismo ejercicio');return;}
  trainRestEnded(); if(window.timerInt) stopTimer();
  const d=train.date, oldName=old.name, completed=old.sets.filter(isDone), pending=Math.max(1,old.sets.length-completed.length);
  const target=routineTargetFor(name,train.routine||null,d)||{}, prev=getExerciseSessions(name).filter(x=>x.date<d).pop();
  const count=completed.length?pending:(target.sets||prev?.sets?.length||old.sets.length||3);
  const rest=target.rest||old.sets[0]?.rest||'90 s';
  if(!completed.length){
    old.name=name; old.substitutedFrom=oldName;
    old.sets=Array.from({length:count},(_,i)=>({setNumber:i+1,reps:'-',weight:0,rir:'-',rest,type:'normal',done:false}));
  }else{
    old.sets=completed.map((x,i)=>({...x,setNumber:i+1}));
    const ne={id:Date.now()+Math.random(),isCardio:false,name,substitutedFrom:oldName,trainingDraft:true,sets:Array.from({length:count},(_,i)=>({setNumber:i+1,reps:'-',weight:0,rir:'-',rest,type:'normal',done:false}))};
    data[d].push(ne); train.order.splice(train.idx+1,0,ne.id); train.idx++;
  }
  saveTrainingDraftLocal(); closeModal(); populateExercises(); renderTrain(); toast(`Sustituido por ${name}`);
}
window.trainAddExercise=function(){
  document.getElementById('modal').innerHTML=`<h2>Añadir ejercicio</h2><label>Nombre</label><input id="trNewEx" list="exerciseList" placeholder="Ej. Press banca con barra"><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="trainAddExerciseOk()">Añadir</button></div>`;
  openEl(); setTimeout(()=>{const i=document.getElementById('trNewEx'); if(i) i.focus();},60);
}
window.trainAddExerciseOk=function(){
  const raw=document.getElementById('trNewEx').value.trim(); if(!raw){ toast('Escribe el ejercicio'); return; }
  const name=normalizeName(raw), d=train.date; if(!data[d]) data[d]=[];
  const prev=getExerciseSessions(name).filter(x=>x.date<d).pop(), n=prev?prev.sets.length:3, rest=(routineTargetFor(name,train.routine||null,d)||{}).rest||'90 s';
  const e={id:Date.now()+Math.random(),isCardio:false,name,trainingDraft:true,sets:Array.from({length:n},(_,i)=>({setNumber:i+1,reps:'-',weight:0,rir:'-',rest,type:'normal',done:false}))};
  data[d].push(e); train.order.push(e.id); train.idx=train.order.length-1;
  saveTrainingDraftLocal(); closeModal(); populateExercises(); renderTrain();
}
window.trainAddSet=function(){ const e=trainCur(); if(!e) return; const l=e.sets[e.sets.length-1]||{}; e.sets.push({setNumber:e.sets.length+1,reps:'-',weight:0,rir:'-',rest:l.rest||'90 s',type:normalizeSetType(l.type),done:false}); saveTrainingDraftLocal(); renderTrain(); }
window.trainDelSet=function(){ const e=trainCur(); if(!e||e.sets.length<2) return; if(isDone(e.sets[e.sets.length-1])){ toast('Desmarca la última serie para quitarla'); return; } e.sets.pop(); saveTrainingDraftLocal(); renderTrain(); }
window.trainToggleAuto=function(){ trainAutoRest=!trainAutoRest; try{localStorage.setItem('gymAutoRest',trainAutoRest?'1':'0')}catch(e){} if(!trainAutoRest) stopTimer(); renderTrain(); }
window.trainGo=function(i){ train.idx=i; saveTrain(); renderTrain(); document.getElementById('trainBody').scrollTop=0; }
window.trainNav=function(n){
  const len=trainEntries().length;
  if(train.idx+n>=len){ trainFinish(); return; }
  if(train.idx+n<0) return; train.idx+=n; saveTrain(); renderTrain(); document.getElementById('trainBody').scrollTop=0;
}
// Si el usuario escribió reps y pulsó «Finalizar» sin salir del campo, guardamos lo visible como borrador.
function trainFlushInputs(){
  const e=trainCur(); if(!e) return;
  document.querySelectorAll('#trainBody .tr-row').forEach((row,i)=>{
    const s=e.sets[i]; if(!s||isDone(s)) return;
    const r=row.querySelector('.tr-r'); if(r&&r.value!=='') trainSave(i);
  });
}
window.trainFinish=function(){
  trainFlushInputs();
  const es=trainEntries(), pend=trainPendingSets(es).length, done=es.reduce((a,e)=>a+e.sets.filter(s=>isDone(s)&&!isWarmupSet(s)).length,0), warmups=es.reduce((a,e)=>a+e.sets.filter(s=>isDone(s)&&isWarmupSet(s)).length,0);
  const vol=es.reduce((a,e)=>a+e.sets.filter(s=>isDone(s)&&!isWarmupSet(s)).reduce((b,s)=>b+(parseFloat(s.reps)||0)*(parseFloat(s.weight)||0),0),0);
  const mins=Math.max(1,Math.round((Date.now()-train.startedAt)/60000)), rv=es.flatMap(e=>e.sets.map(z=>z.restUsed).filter(Boolean));
  const prs=findPRs().filter(p=>p.date===train.date);
  const prHtml=prs.map(p=>{
    const value=p.type==='reps'?`${p.value} reps${p.weight>0?` @ ${formatKgValue(p.weight)}`:''}`:formatKgValue(p.value);
    return `<div class="progress-item">${ic('trophy')} <b>${escapeHtml(p.name)}</b><span class="pr">PR ${escapeHtml(p.label)} · ${value}</span></div>`;
  }).join('');
  document.getElementById('modal').innerHTML=`<h2>Resumen del entrenamiento</h2>
    <div class="stat-grid" style="margin-bottom:12px"><div class="stat"><div class="label">Duración</div><div class="value">${mins} min</div></div><div class="stat"><div class="label">Series efectivas</div><div class="value">${done}</div></div><div class="stat"><div class="label">Ejercicios</div><div class="value">${es.length}</div></div><div class="stat"><div class="label">Volumen</div><div class="value">${Math.round(fromKg(vol)).toLocaleString()} ${unitLabel()}</div></div></div>
    ${prHtml?`<div class="progress-list" style="margin-bottom:12px">${prHtml}</div>`:''}
    ${rv.length?`<p class="muted">Descanso promedio: <b>${fmtRest(Math.round(rv.reduce((a,b)=>a+b,0)/rv.length))}</b></p>`:''}${warmups?`<p class="muted">Calentamientos registrados: <b>${warmups}</b> · no cuentan para volumen ni PR.</p>`:''}${pend?`<div class="train-pending" role="alert"><b>${pend} serie${pend===1?'':'s'} sin marcar</b><span>Escribiste repeticiones, pero no marcaste ${pend===1?'esa serie':'esas series'} como hecha${pend===1?'':'s'}. ¿Quieres guardarla${pend===1?'':'s'}?</span></div>`:'<p class="muted">Las series vacías se descartan al terminar.</p>'}
    <div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Seguir</button>${pend?`<button class="btn btn-secondary" onclick="trainEnd(false)">Descartar</button><button class="btn btn-primary" onclick="trainEnd(true)">Guardar y terminar</button>`:`<button class="btn btn-primary" onclick="trainEnd(false)">Terminar y guardar</button>`}</div>`;
  openEl();
}
window.trainEnd=function(savePending){
  if(restCtx)trainRestEnded();stopTimer();
  const d=train.date, routine=train.routine;
  const endResult=trainApplyEnd(trainEntries(),savePending===true);
  data[d]=(data[d]||[]).filter(e=>e.isCardio||entryHasData(e));
  if((data[d]||[]).some(e=>!e.isCardio&&entryHasData(e))&&routine)categories[d]=routine;
  if(!data[d]?.length) delete data[d];
  train=null; restCtx=null; saveTrain(); closeTrainUI(); closeModal(); saveToFirebase({days:[d]}); refreshAll(); toast(endResult.saved?`¡Entrenamiento guardado! Se incluyeron ${endResult.saved} serie${endResult.saved===1?'':'s'} pendiente${endResult.saved===1?'':'s'}.`:endResult.dropped?`Entrenamiento guardado. Se descartaron ${endResult.dropped} serie${endResult.dropped===1?'':'s'} sin marcar.`:'¡Entrenamiento guardado!');
}

