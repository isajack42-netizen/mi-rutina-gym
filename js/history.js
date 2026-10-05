// LiftEngine · v6.5 History & Compare: historial filtrable y comparación entre bloques
'use strict';

// <history-helpers>
function historyShiftDate(key,deltaDays){
  const d=new Date(String(key)+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+Number(deltaDays||0));
  return d.toISOString().slice(0,10);
}
function historyValidSet(s){
  return !!s&&s.done!==false&&s.type!=='warmup'&&(Number(s.reps)||0)>0;
}
function historySessionRow(date,entries,routine='',routineFilter='',exerciseFilter='',prEvents=[]){
  if(routineFilter&&routine!==routineFilter)return null;
  const filtered=(entries||[]).filter(e=>!e.isCardio&&(!exerciseFilter||e.name===exerciseFilter));
  const usable=filtered.map(e=>({
    name:e.name,
    sets:(e.sets||[]).filter(historyValidSet)
  })).filter(e=>e.sets.length);
  if(!usable.length)return null;
  const sets=usable.flatMap(e=>e.sets);
  const exerciseNames=[...new Set(usable.map(e=>e.name))];
  const volume=sets.reduce((a,s)=>a+(Number(s.weight)||0)*(Number(s.reps)||0),0);
  const rirValues=sets.map(s=>s.rir).filter(v=>v!==null&&v!==undefined&&v!==''&&v!=='-').map(Number).filter(Number.isFinite);
  const prs=(prEvents||[]).filter(p=>p.date===date&&(!exerciseFilter||p.name===exerciseFilter)).length;
  return {
    date,routine:routine||'',exerciseNames,exercises:exerciseNames.length,
    sets:sets.length,volume,
    rirSum:rirValues.reduce((a,b)=>a+b,0),rirCount:rirValues.length,
    avgRir:rirValues.length?rirValues.reduce((a,b)=>a+b,0)/rirValues.length:null,
    prs
  };
}
function historyAggregate(rows){
  const list=rows||[];
  const exerciseNames=new Set();
  let sets=0,volume=0,rirSum=0,rirCount=0,prs=0;
  list.forEach(r=>{
    sets+=Number(r.sets)||0;
    volume+=Number(r.volume)||0;
    rirSum+=Number(r.rirSum)||0;
    rirCount+=Number(r.rirCount)||0;
    prs+=Number(r.prs)||0;
    (r.exerciseNames||[]).forEach(n=>exerciseNames.add(n));
  });
  return {
    sessions:list.length,sets,volume,
    volumePerSession:list.length?volume/list.length:0,
    avgRir:rirCount?rirSum/rirCount:null,
    exercises:exerciseNames.size,prs
  };
}
function historyPct(current,previous){
  const a=Number(current)||0,b=Number(previous)||0;
  return b>0?((a-b)/b)*100:null;
}
function historyPeriodCompare(rows,weeks=4){
  const list=[...(rows||[])].sort((a,b)=>a.date.localeCompare(b.date));
  if(!list.length)return null;
  const w=[4,8,12].includes(Number(weeks))?Number(weeks):4;
  const days=w*7,anchor=list.at(-1).date;
  const currentStart=historyShiftDate(anchor,-(days-1));
  const previousEnd=historyShiftDate(currentStart,-1);
  const previousStart=historyShiftDate(previousEnd,-(days-1));
  const currentRows=list.filter(r=>r.date>=currentStart&&r.date<=anchor);
  const previousRows=list.filter(r=>r.date>=previousStart&&r.date<=previousEnd);
  const current=historyAggregate(currentRows),previous=historyAggregate(previousRows);
  return {
    weeks,anchor,currentStart,previousStart,previousEnd,
    currentRows,previousRows,current,previous,
    deltas:{
      sessions:historyPct(current.sessions,previous.sessions),
      sets:historyPct(current.sets,previous.sets),
      volumePerSession:historyPct(current.volumePerSession,previous.volumePerSession),
      exercises:historyPct(current.exercises,previous.exercises),
      prs:historyPct(current.prs,previous.prs)
    }
  };
}
// </history-helpers>

function historyFormatVolume(kg){
  const v=Math.round(fromKg(Number(kg)||0));
  return `${v.toLocaleString('es-MX')} ${unitLabel()}`;
}
function historyPctLabel(v){
  return Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1)}%`:'—';
}
function historyRowsFromState(routineFilter='',exerciseFilter=''){
  let prs=[];
  try{prs=typeof findPRs==='function'?findPRs():[]}catch(_){}
  return Object.keys(data).sort().map(date=>
    historySessionRow(date,data[date]||[],categories[date]||'',routineFilter,exerciseFilter,prs)
  ).filter(Boolean);
}
function historyPopulateFilters(){
  const routineEl=document.getElementById('historyRoutine');
  const exerciseEl=document.getElementById('historyExercise');
  if(!routineEl||!exerciseEl)return;
  const routineCurrent=routineEl.value,exerciseCurrent=exerciseEl.value;
  const routines=[...new Set(Object.keys(data).sort().map(d=>categories[d]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const exercises=getAllExercises();
  routineEl.innerHTML='<option value="">Todas las rutinas</option>'+routines.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  exerciseEl.innerHTML='<option value="">Todos los ejercicios</option>'+exercises.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  if(routines.includes(routineCurrent))routineEl.value=routineCurrent;
  if(exercises.includes(exerciseCurrent))exerciseEl.value=exerciseCurrent;
}
function historyComparisonMarkup(cmp){
  if(!cmp)return '<div class="empty"><b>Sin sesiones para comparar</b><span>Registra entrenamientos o cambia los filtros para generar una comparación.</span></div>';
  const c=cmp.current,p=cmp.previous;
  const card=(label,current,previous,delta)=>`<div class="history-kpi">
    <small>${label}</small><b>${current}</b>
    <span>Anterior · ${previous}</span>
    <em class="${Number.isFinite(delta)?(delta>0?'up':delta<0?'down':'flat'):'flat'}">${historyPctLabel(delta)}</em>
  </div>`;
  const range=`${fmtDate(cmp.currentStart)} — ${fmtDate(cmp.anchor)}`;
  const previousRange=`${fmtDate(cmp.previousStart)} — ${fmtDate(cmp.previousEnd)}`;
  return `<div class="history-compare-card">
    <div class="history-compare-head">
      <div><span class="eyebrow">Comparación equivalente</span><h3>Últimas ${cmp.weeks} semanas vs. ${cmp.weeks} anteriores</h3></div>
      <div class="history-range"><b>${range}</b><span>Anterior · ${previousRange}</span></div>
    </div>
    <div class="history-kpi-grid">
      ${card('Sesiones',c.sessions,p.sessions,cmp.deltas.sessions)}
      ${card('Series de trabajo',c.sets,p.sets,cmp.deltas.sets)}
      ${card('Volumen / sesión',c.sessions?historyFormatVolume(c.volumePerSession):'—',p.sessions?historyFormatVolume(p.volumePerSession):'—',cmp.deltas.volumePerSession)}
      ${card('RIR promedio',c.avgRir!==null?c.avgRir.toFixed(1):'—',p.avgRir!==null?p.avgRir.toFixed(1):'—',null)}
      ${card('Ejercicios distintos',c.exercises,p.exercises,cmp.deltas.exercises)}
      ${card('PR registrados',c.prs,p.prs,cmp.deltas.prs)}
    </div>
    ${!p.sessions?'<div class="history-compare-note">Aún no existe una base previa con estos mismos filtros; LiftEngine muestra el periodo actual sin inventar porcentajes.</div>':''}
  </div>`;
}
function historySessionMarkup(row){
  const routine=row.routine||'Sin etiqueta';
  const exercises=row.exerciseNames.join(', ');
  return `<button class="history-session-row" type="button" onclick="goToDate('${row.date}')" aria-label="Abrir sesión del ${fmtDate(row.date)}">
    <span class="history-session-date"><b>${fmtDate(row.date)}</b><small>${escapeHtml(routine)}</small></span>
    <span><small>Ejercicios</small><b>${row.exercises}</b><em title="${escapeHtml(exercises)}">${escapeHtml(exercises)}</em></span>
    <span><small>Series</small><b>${row.sets}</b></span>
    <span><small>Volumen</small><b>${historyFormatVolume(row.volume)}</b></span>
    <span><small>RIR</small><b>${row.avgRir!==null?row.avgRir.toFixed(1):'—'}</b></span>
    <span><small>PR</small><b>${row.prs}</b></span>
  </button>`;
}
window.resetHistoryFilters=function(){
  const routine=document.getElementById('historyRoutine'),exercise=document.getElementById('historyExercise'),period=document.getElementById('historyWindow');
  if(routine)routine.value='';
  if(exercise)exercise.value='';
  if(period)period.value='4';
  renderHistory();
};
window.renderHistory=function(){
  const summary=document.getElementById('historyCompareSummary');
  const list=document.getElementById('historySessionList');
  const count=document.getElementById('historySessionCount');
  if(!summary||!list)return;
  historyPopulateFilters();
  const weeks=parseInt(document.getElementById('historyWindow')?.value,10)||4;
  const routine=document.getElementById('historyRoutine')?.value||'';
  const exercise=document.getElementById('historyExercise')?.value||'';
  const rows=historyRowsFromState(routine,exercise);
  const cmp=historyPeriodCompare(rows,weeks);
  summary.innerHTML=historyComparisonMarkup(cmp);
  const current=cmp?[...cmp.currentRows].reverse():[];
  if(count)count.textContent=`${current.length} sesión${current.length===1?'':'es'}`;
  list.innerHTML=current.length?current.map(historySessionMarkup).join(''):`<div class="empty"><b>No hay sesiones en este periodo</b><span>Cambia el periodo o limpia alguno de los filtros.</span></div>`;
};
