// LiftEngine · v6.6 Planning Workspace: planificación semanal derivada de rutinas
'use strict';

// <planning-helpers>
function planningClampFrequency(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 0;
  return Math.max(0,Math.min(7,Math.round(n*2)/2));
}
function planningDefaultFrequencies(names,target=6){
  const list=[...(names||[])];
  const out={};
  if(!list.length)return out;
  const totalUnits=Math.max(0,Math.round((Number(target)||0)*2));
  const base=Math.floor(totalUnits/list.length);
  let remainder=totalUnits-base*list.length;
  list.forEach(name=>{
    const units=base+(remainder>0?1:0);
    if(remainder>0)remainder--;
    out[name]=planningClampFrequency(units/2);
  });
  return out;
}
function planningMedian(values){
  const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return 0;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function planningComputePlan(routines,frequencies){
  const routineStats=[],muscleMap={};
  let totalSessions=0,totalSets=0;
  Object.entries(routines||{}).forEach(([name,rows])=>{
    const frequency=planningClampFrequency(frequencies?.[name]||0);
    const valid=(rows||[]).map(r=>({
      name:r.name||'',
      sets:Math.max(0,Number(r.sets)||0),
      muscle:r.muscle||'Otros'
    })).filter(r=>r.name&&r.sets>0);
    const setsPerPass=valid.reduce((a,r)=>a+r.sets,0);
    const byMuscle={};
    valid.forEach(r=>{byMuscle[r.muscle]=(byMuscle[r.muscle]||0)+r.sets;});
    const weeklySets=setsPerPass*frequency;
    totalSessions+=frequency;
    totalSets+=weeklySets;
    Object.entries(byMuscle).forEach(([muscle,sets])=>{
      if(!muscleMap[muscle])muscleMap[muscle]={muscle,sets:0,frequency:0,routines:0,exercises:new Set()};
      muscleMap[muscle].sets+=sets*frequency;
      muscleMap[muscle].frequency+=frequency;
      muscleMap[muscle].routines+=1;
      valid.filter(r=>r.muscle===muscle).forEach(r=>muscleMap[muscle].exercises.add(r.name));
    });
    routineStats.push({name,frequency,setsPerPass,weeklySets,exercises:valid.length,muscles:Object.keys(byMuscle)});
  });
  const muscles=Object.values(muscleMap).map(x=>({...x,exercises:[...x.exercises]})).sort((a,b)=>b.sets-a.sets||a.muscle.localeCompare(b.muscle));
  const classified=muscles.filter(x=>x.muscle!=='Otros'&&x.sets>0);
  const medianSets=planningMedian(classified.map(x=>x.sets));
  const medianFrequency=planningMedian(classified.map(x=>x.frequency));
  return {routineStats,muscles,totalSessions,totalSets,medianSets,medianFrequency};
}
function planningBalanceSignals(plan,targetSessions=6){
  const out=[];
  const target=Math.max(0,Number(targetSessions)||0);
  if(Math.abs((plan?.totalSessions||0)-target)>=0.25){
    out.push({kind:'info',title:'Sesiones del escenario',text:`${plan.totalSessions.toFixed(1)} por semana frente a tu meta de ${target.toFixed(1)}.`});
  }
  const other=(plan?.muscles||[]).find(x=>x.muscle==='Otros');
  if(other?.sets>0){
    out.push({kind:'info',title:'Ejercicios sin clasificar',text:`${other.sets.toFixed(1)} series/semana están en “Otros”. Puedes asignarles músculo desde Ajustes para afinar el análisis.`});
  }
  const median=plan?.medianSets||0;
  if(median>0){
    (plan.muscles||[]).filter(x=>x.muscle!=='Otros'&&x.sets>0).forEach(x=>{
      const ratio=x.sets/median;
      if(ratio>=1.75&&x.sets-median>=4){
        out.push({kind:'high',title:`${x.muscle} destaca en volumen`,text:`${x.sets.toFixed(1)} series/semana · ${ratio.toFixed(1)}× la mediana del plan.`});
      }else if(ratio<=0.55&&median-x.sets>=3){
        out.push({kind:'low',title:`${x.muscle} queda por debajo del resto`,text:`${x.sets.toFixed(1)} series/semana · ${ratio.toFixed(1)}× la mediana del plan.`});
      }
    });
  }
  return out.slice(0,6);
}
// </planning-helpers>

let planningFrequencyOverrides=Object.create(null);

function planningEnrichedRoutines(source=customRoutines){
  const out={};
  Object.entries(source||{}).forEach(([name,rows])=>{
    out[name]=(rows||[]).map(r=>({...r,muscle:typeof getMuscleGroup==='function'?getMuscleGroup(r.name):'Otros'}));
  });
  return out;
}
function planningEnsureFrequencies(source=customRoutines){
  const names=Object.keys(source||{});
  const defaults=planningDefaultFrequencies(names,weeklySessionTarget);
  Object.keys(planningFrequencyOverrides).forEach(name=>{if(!names.includes(name))delete planningFrequencyOverrides[name];});
  names.forEach(name=>{
    if(!Number.isFinite(Number(planningFrequencyOverrides[name])))planningFrequencyOverrides[name]=defaults[name]||0;
  });
  return Object.fromEntries(names.map(name=>[name,planningClampFrequency(planningFrequencyOverrides[name])]));
}
function planningFrequencyValue(name,source=customRoutines){
  return planningEnsureFrequencies(source)[name]||0;
}
window.setRoutinePlanFrequency=function(name,value){
  if(!customRoutines[name])return;
  planningFrequencyOverrides[name]=planningClampFrequency(value);
  renderRoutinePlanner();
};
window.resetRoutinePlanScenario=function(){
  planningFrequencyOverrides=Object.create(null);
  renderRoutinePlanner();
  if(typeof renderRoutineEditorPreview==='function')renderRoutineEditorPreview();
};
function planningSummaryMarkup(plan){
  const groups=plan.muscles.filter(x=>x.muscle!=='Otros'&&x.sets>0).length;
  const avg=groups?plan.muscles.filter(x=>x.muscle!=='Otros'&&x.sets>0).reduce((a,x)=>a+x.sets,0)/groups:0;
  return `<div class="routine-plan-summary">
    <div><small>Sesiones / semana</small><b>${plan.totalSessions.toFixed(1)}</b><span>Meta ${Number(weeklySessionTarget)||0}</span></div>
    <div><small>Series directas</small><b>${plan.totalSets.toFixed(1)}</b><span>por semana</span></div>
    <div><small>Grupos cubiertos</small><b>${groups}</b><span>músculos</span></div>
    <div><small>Promedio / grupo</small><b>${avg.toFixed(1)}</b><span>series / semana</span></div>
  </div>`;
}
function planningFrequencyMarkup(plan){
  if(!plan.routineStats.length)return '<div class="empty"><b>Sin rutinas</b><span>Crea una rutina para empezar a planificar tu semana.</span></div>';
  return `<div class="routine-plan-block-head"><div><span class="eyebrow">Frecuencia</span><h3>Sesiones por rutina</h3></div><small>Escenario editable</small></div>
    <div class="routine-frequency-list">${plan.routineStats.map(r=>`
      <label class="routine-frequency-row">
        <span><b>${escapeHtml(r.name)}</b><small>${r.setsPerPass} series / sesión · ${r.weeklySets.toFixed(1)} / semana</small></span>
        <input type="number" min="0" max="7" step="0.5" value="${r.frequency}" data-name="${escapeHtml(r.name)}" onchange="setRoutinePlanFrequency(this.dataset.name,this.value)" aria-label="Sesiones por semana de ${escapeHtml(r.name)}">
      </label>`).join('')}</div>`;
}
function planningMuscleMarkup(plan){
  const rows=plan.muscles.filter(x=>x.sets>0);
  if(!rows.length)return '';
  const max=Math.max(1,...rows.map(x=>x.sets));
  return `<div class="routine-plan-block-head"><div><span class="eyebrow">Distribución</span><h3>Series directas por músculo</h3></div><small>Frecuencia = sesiones donde aparece</small></div>
    <div class="routine-muscle-list">${rows.map(x=>`
      <div class="routine-muscle-row">
        <div><b>${escapeHtml(x.muscle)}</b><small>${x.frequency.toFixed(1)}× / semana · ${x.exercises.length} ejercicio${x.exercises.length===1?'':'s'}</small></div>
        <div class="routine-muscle-bar"><i style="width:${Math.max(5,Math.round(x.sets/max*100))}%"></i></div>
        <strong>${x.sets.toFixed(1)}</strong>
      </div>`).join('')}</div>`;
}
function planningSignalsMarkup(plan){
  const signals=planningBalanceSignals(plan,weeklySessionTarget);
  return `<div class="routine-plan-block-head"><div><span class="eyebrow">Lectura</span><h3>Distribución relativa</h3></div></div>
    <div class="routine-signal-list">${signals.length?signals.map(s=>`
      <div class="routine-signal ${s.kind}"><b>${escapeHtml(s.title)}</b><span>${escapeHtml(s.text)}</span></div>`).join(''):
      '<div class="routine-signal neutral"><b>Sin diferencias marcadas</b><span>La distribución del escenario no presenta extremos grandes frente a su propia mediana.</span></div>'}</div>`;
}
window.renderRoutinePlanner=function(){
  const summary=document.getElementById('routinePlanSummary');
  if(!summary)return;
  const frequencies=planningEnsureFrequencies(customRoutines);
  const plan=planningComputePlan(planningEnrichedRoutines(),frequencies);
  summary.innerHTML=planningSummaryMarkup(plan);
  const freq=document.getElementById('routinePlanFrequency');if(freq)freq.innerHTML=planningFrequencyMarkup(plan);
  const muscles=document.getElementById('routinePlanMuscles');if(muscles)muscles.innerHTML=planningMuscleMarkup(plan);
  const signals=document.getElementById('routinePlanSignals');if(signals)signals.innerHTML=planningSignalsMarkup(plan);
};

function planningDraftRowsFromEditor(){
  return [...document.querySelectorAll('#editRoutineExercises .routine-edit-row')].map(row=>{
    const name=String(row.querySelector('.re-name')?.value||'').trim();
    const sets=Math.max(0,parseInt(row.querySelector('.re-sets')?.value,10)||0);
    return {name,sets,muscle:name&&typeof getMuscleGroup==='function'?getMuscleGroup(normalizeName(name)):'Otros'};
  }).filter(x=>x.name&&x.sets>0);
}
window.renderRoutineEditorPreview=function(){
  const box=document.getElementById('routineEditorPreview');
  const nameEl=document.getElementById('editRoutineName');
  if(!box||!nameEl)return;
  const orig=nameEl.getAttribute('data-orig')||'';
  const typed=nameEl.value.trim();
  const draftName=typed||orig||'Borrador';
  const draftRows=planningDraftRowsFromEditor();
  const source=planningEnrichedRoutines();
  if(orig&&orig!==draftName)delete source[orig];
  source[draftName]=draftRows;
  const names=Object.keys(source);
  const defaults=planningDefaultFrequencies(names,weeklySessionTarget);
  const frequencies={};
  names.forEach(name=>{
    if(name===draftName&&orig&&Number.isFinite(Number(planningFrequencyOverrides[orig])))frequencies[name]=planningClampFrequency(planningFrequencyOverrides[orig]);
    else if(Number.isFinite(Number(planningFrequencyOverrides[name])))frequencies[name]=planningClampFrequency(planningFrequencyOverrides[name]);
    else frequencies[name]=defaults[name]||0;
  });
  const plan=planningComputePlan(source,frequencies);
  const routine=plan.routineStats.find(x=>x.name===draftName)||{frequency:frequencies[draftName]||0,setsPerPass:0,weeklySets:0,exercises:0};
  const draftMuscles={};
  draftRows.forEach(r=>{draftMuscles[r.muscle]=(draftMuscles[r.muscle]||0)+r.sets;});
  const muscleRows=Object.entries(draftMuscles).sort((a,b)=>b[1]-a[1]);
  const signals=planningBalanceSignals(plan,weeklySessionTarget).slice(0,3);
  box.innerHTML=`<div class="routine-editor-preview-head"><span class="eyebrow">Vista previa</span><h3>Impacto del borrador</h3><p>Se recalcula mientras editas. No se guarda hasta pulsar Guardar.</p></div>
    <div class="routine-editor-preview-kpis">
      <div><small>Ejercicios</small><b>${draftRows.length}</b></div>
      <div><small>Series / sesión</small><b>${routine.setsPerPass}</b></div>
      <div><small>Frecuencia escenario</small><b>${routine.frequency.toFixed(1)}×</b></div>
      <div><small>Series / semana</small><b>${routine.weeklySets.toFixed(1)}</b></div>
    </div>
    <div class="routine-editor-preview-block"><b>Impacto muscular directo</b>
      ${muscleRows.length?muscleRows.map(([m,n])=>`<div><span>${escapeHtml(m)}</span><strong>${n} series / sesión</strong></div>`).join(''):'<p class="muted">Añade ejercicios y series para ver el impacto.</p>'}
    </div>
    <div class="routine-editor-preview-block"><b>Plan semanal resultante</b>
      <div><span>Sesiones</span><strong>${plan.totalSessions.toFixed(1)} / ${Number(weeklySessionTarget)||0}</strong></div>
      <div><span>Series directas</span><strong>${plan.totalSets.toFixed(1)}</strong></div>
      ${signals.map(s=>`<div class="preview-signal ${s.kind}"><span>${escapeHtml(s.title)}</span><strong>${escapeHtml(s.text)}</strong></div>`).join('')}
    </div>
    <p class="routine-editor-preview-note">La frecuencia pertenece al escenario del planificador; no forma parte de la rutina guardada.</p>`;
};
