// LiftEngine · v5.7 Analytics: tendencias, adherencia, frecuencia y estancamientos
'use strict';

function analyticsDate(s){ return new Date(String(s)+'T12:00:00'); }
function analyticsWeeks(){
  const el=document.getElementById('analyticsWindow');
  const n=parseInt(el?.value,10); return [4,8,12].includes(n)?n:8;
}
function analyticsPeriod(weeks=analyticsWeeks()){
  const end=analyticsDate(todayStr());
  const start=weekStart(end); start.setDate(start.getDate()-(weeks-1)*7);
  return {start,end,startKey:ymd(start),endKey:ymd(end),weeks};
}
function workoutOnDate(date){ return (data[date]||[]).some(e=>!e.isCardio&&entryHasData(e)); }
function analyticsWorkoutDates(startKey,endKey){
  return Object.keys(data).filter(d=>d>=startKey&&d<=endKey&&workoutOnDate(d)).sort();
}
function analyticsCoverage(period){
  const all=Object.keys(data).filter(workoutOnDate).sort();
  if(!all.length) return {...period,coverageStart:period.startKey,coverageDays:0,coverageWeeks:0};
  const first=all.find(d=>d>=period.startKey&&d<=period.endKey) || (all[0]>period.endKey?null:period.startKey);
  if(!first) return {...period,coverageStart:period.startKey,coverageDays:0,coverageWeeks:0};
  const startKey=first>period.startKey?first:period.startKey;
  const days=Math.max(1,Math.floor((analyticsDate(period.endKey)-analyticsDate(startKey))/86400000)+1);
  return {...period,coverageStart:startKey,coverageDays:days,coverageWeeks:days/7};
}
function analyticsWeekBuckets(period){
  const buckets=[];
  for(let i=0;i<period.weeks;i++){
    const start=new Date(period.start); start.setDate(period.start.getDate()+i*7);
    const end=new Date(start);end.setDate(start.getDate()+6);
    const startKey=ymd(start),endKey=ymd(end);
    const actualEnd=end>period.end?period.end:end;
    const dates=analyticsWorkoutDates(startKey,ymd(actualEnd));
    buckets.push({start:startKey,end:ymd(actualEnd),sessions:dates.length,label:`${start.getDate()} ${start.toLocaleDateString('es-MX',{month:'short'}).replace('.','')}`});
  }
  return buckets;
}
function analyticsExpectedSessions(coverage){
  if(!coverage.coverageDays)return 0;
  return weeklySessionTarget*(coverage.coverageDays/7);
}
function analyticsExerciseNames(startKey,endKey){
  const set=new Set();
  Object.keys(data).filter(d=>d>=startKey&&d<=endKey).forEach(d=>(data[d]||[]).forEach(e=>{if(!e.isCardio&&entryHasData(e))set.add(e.name)}));
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
function analyticsExerciseTrend(name,startKey,endKey){
  const sessions=getExerciseSessions(name).filter(s=>s.date>=startKey&&s.date<=endKey);
  const rows=sessions.map(s=>({date:s.date,...summarizeSession(s)})).filter(x=>x.e1rm>0);
  if(rows.length<2)return {name,sessions:rows.length,status:'insufficient',deltaPct:null,lastDate:rows.at(-1)?.date||''};
  const first=rows[0],last=rows.at(-1),deltaPct=first.e1rm?((last.e1rm-first.e1rm)/first.e1rm)*100:null;
  let stagnant=false;
  if(rows.length>=4){
    const recent=rows.slice(-3),before=rows.slice(0,-3);
    const priorBest=before.length?Math.max(...before.map(x=>x.e1rm)):0;
    const recentBest=Math.max(...recent.map(x=>x.e1rm));
    stagnant=priorBest>0&&recentBest<=priorBest*1.005;
  }
  const down=deltaPct!=null&&deltaPct<=-3;
  const improving=deltaPct!=null&&deltaPct>=2;
  const status=down?'down':stagnant?'watch':improving?'up':'stable';
  return {name,sessions:rows.length,status,improving,stagnant,down,deltaPct,lastDate:last.date,firstE1:first.e1rm,lastE1:last.e1rm};
}
function analyticsExerciseTrends(startKey,endKey){ return analyticsExerciseNames(startKey,endKey).map(n=>analyticsExerciseTrend(n,startKey,endKey)); }
function analyticsMuscleStats(coverage){
  const out={};
  Object.keys(data).filter(d=>d>=coverage.coverageStart&&d<=coverage.endKey).sort().forEach(date=>{
    (data[date]||[]).forEach(e=>{
      if(e.isCardio||!entryHasData(e))return;
      const sets=(e.sets||[]).filter(setCountsForWork); if(!sets.length)return;
      const muscle=getMuscleGroup(e.name); if(!out[muscle])out[muscle]={sets:0,days:new Set(),rir:[]};
      out[muscle].sets+=sets.length;out[muscle].days.add(date);
      sets.forEach(s=>{const r=parseFloat(s.rir);if(Number.isFinite(r))out[muscle].rir.push(r)});
    });
  });
  const w=Math.max(coverage.coverageWeeks,1/7);
  return Object.entries(out).map(([muscle,x])=>({
    muscle,sets:x.sets,setsPerWeek:x.sets/w,daysPerWeek:x.days.size/w,avgRir:x.rir.length?x.rir.reduce((a,b)=>a+b,0)/x.rir.length:null
  })).sort((a,b)=>b.setsPerWeek-a.setsPerWeek);
}
function analyticsPRCount(startKey,endKey){ return findPRs().filter(p=>p.date>=startKey&&p.date<=endKey).length; }
function analyticsPct(v){ if(v==null||!Number.isFinite(v))return '—';return `${v>0?'+':''}${v.toFixed(1)}%`; }

window.setWeeklySessionTarget=function(v){
  const n=Math.min(7,Math.max(1,parseInt(v,10)||6));
  weeklySessionTarget=n;
  markSettingsDirty({cloud:true,local:true});
  persistLocal({settings:true});
  saveToFirebase({settings:true});
  renderAnalytics();
  toast(`Meta semanal: ${n} sesión${n===1?'':'es'}`);
};

function analyticsSafe(label,fn){
  try{return fn();}catch(e){console.error(`Analytics · ${label}:`,e);return null;}
}
function analyticsAdherenceMarkup(coverage,dates,expected){
  if(!coverage.coverageDays){
    return `<div class="analytics-adherence-hero empty-state"><div><span class="eyebrow">Adherencia</span><strong>Empieza con tu primera semana</strong><p>Aún no hay entrenamientos completados dentro del periodo seleccionado.</p></div></div>`;
  }
  const raw=expected?dates.length/expected*100:0;
  const adherence=Math.min(100,Math.max(0,raw));
  const pct=Math.round(adherence);
  const expectedText=expected<10?expected.toFixed(1):Math.round(expected).toString();
  const status=pct>=90?'Meta cubierta':pct>=70?'Buen ritmo':pct>=50?'Ritmo parcial':'Por debajo de la meta';
  return `<div class="analytics-adherence-hero">
    <div class="analytics-adherence-copy"><span class="eyebrow">Adherencia a tu meta</span><div class="analytics-adherence-value">${pct}%</div><strong>${status}</strong><p>${dates.length} sesiones completadas · objetivo equivalente ${expectedText} · meta ${weeklySessionTarget}/sem</p></div>
    <div class="analytics-adherence-meter" aria-label="Adherencia ${pct}%"><span style="width:${pct}%"></span></div>
  </div>`;
}
window.renderAnalytics=function(){
  const overview=document.getElementById('analyticsOverview'); if(!overview)return;
  const target=document.getElementById('analyticsWeeklyTarget'); if(target)target.value=String(weeklySessionTarget);

  let period,coverage,dates=[],expected=0;
  try{
    period=analyticsPeriod();
    coverage=analyticsCoverage(period);
    dates=coverage.coverageDays?analyticsWorkoutDates(coverage.coverageStart,period.endKey):[];
    expected=analyticsExpectedSessions(coverage);
  }catch(e){
    console.error('Analytics · resumen base:',e);
    overview.innerHTML='<div class="analytics-adherence-hero empty-state"><div><span class="eyebrow">Adherencia</span><strong>No se pudo calcular</strong><p>Recarga la vista de Progreso. Tus entrenamientos no se modificaron.</p></div></div>';
    return;
  }

  // La adherencia se pinta primero y de forma independiente: si un gráfico o
  // análisis avanzado falla, este indicador básico nunca debe quedar vacío.
  overview.innerHTML=analyticsAdherenceMarkup(coverage,dates,expected)+'<div id="analyticsSecondaryKpis"></div><div id="analyticsNoteSlot"></div>';

  let prs=0,trends=[],up=[],attention=[],evaluated=0;
  analyticsSafe('PR del periodo',()=>{prs=coverage.coverageDays?analyticsPRCount(coverage.coverageStart,period.endKey):0;});
  analyticsSafe('tendencias por ejercicio',()=>{
    trends=coverage.coverageDays?analyticsExerciseTrends(coverage.coverageStart,period.endKey):[];
    up=trends.filter(x=>x.improving);
    attention=trends.filter(x=>x.stagnant||x.down);
    evaluated=trends.filter(x=>x.status!=='insufficient').length;
  });
  const avg=coverage.coverageWeeks?dates.length/coverage.coverageWeeks:0;
  const secondary=document.getElementById('analyticsSecondaryKpis');
  if(secondary) secondary.innerHTML=`<div class="analytics-kpis analytics-kpis-secondary">
    <div class="analytics-kpi"><div class="label">Promedio semanal</div><div class="value">${coverage.coverageDays?avg.toFixed(1):'—'}</div><small>${coverage.coverageDays?`${coverage.coverageDays} días de cobertura`:'Aún sin historial'}</small></div>
    <div class="analytics-kpi"><div class="label">PR en el periodo</div><div class="value">${prs}</div><small>peso, e1RM y reps @ carga</small></div>
    <div class="analytics-kpi"><div class="label">Ejercicios en mejora</div><div class="value">${up.length}</div><small>${evaluated?`${attention.length} para revisar · ${evaluated} evaluados`:'Con 1–3 sesiones aún priorizamos propuestas provisionales'}</small></div>
  </div>`;
  const note=document.getElementById('analyticsNoteSlot');
  if(note)note.innerHTML='<div class="analytics-note">La adherencia se prorratea desde tu primer entrenamiento disponible dentro del periodo. Con poco historial, LiftEngine muestra propuestas provisionales; las señales de meseta o caída requieren más sesiones comparables.</div>';

  const cov=document.getElementById('analyticsCoverage');
  if(cov)cov.textContent=coverage.coverageDays?`${fmtDate(coverage.coverageStart)} → ${fmtDate(period.endKey)}`:'Sin datos';
  analyticsSafe('gráfica semanal',()=>renderAnalyticsWeeklyChart(period,coverage));
  analyticsSafe('músculos',()=>renderAnalyticsMuscles(coverage));
  analyticsSafe('listas de progreso',()=>renderAnalyticsExerciseLists(up,attention,trends));
  analyticsSafe('próximas decisiones',()=>{if(typeof window.renderIntelligenceAnalytics==='function')window.renderIntelligenceAnalytics(coverage);});
};

function renderAnalyticsWeeklyChart(period,coverage){
  const canvas=document.getElementById('analyticsWeeklyChart'); if(!canvas)return;
  if(analyticsWeeklyChart){analyticsWeeklyChart.destroy();analyticsWeeklyChart=null;}
  const buckets=analyticsWeekBuckets(period);
  const accent=cssVar('--accent'),muted=cssVar('--muted');
  analyticsWeeklyChart=makeChart(canvas,{type:'bar',data:{labels:buckets.map(x=>x.label),datasets:[
    {label:'Sesiones',data:buckets.map(x=>x.sessions),backgroundColor:accent+'55',borderColor:accent,borderWidth:1,borderRadius:5},
    {type:'line',label:'Meta semanal',data:buckets.map(()=>weeklySessionTarget),borderColor:muted,backgroundColor:muted,pointRadius:0,borderDash:[5,5],tension:0}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:cssVar('--text'),boxWidth:12}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1,color:cssVar('--muted')},grid:{color:cssVar('--line')}},x:{ticks:{color:cssVar('--muted')},grid:{display:false}}}}});
}
function renderAnalyticsMuscles(coverage){
  const box=document.getElementById('analyticsMuscles');if(!box)return;
  if(!coverage.coverageDays){box.innerHTML='<div class="empty">Todavía no hay datos suficientes.</div>';return;}
  const rows=analyticsMuscleStats(coverage);
  box.innerHTML=rows.length?`<div class="analytics-muscle-row"><b>Músculo</b><span>Series/sem</span><span>Días/sem</span></div>${rows.map(x=>`<div class="analytics-muscle-row"><b>${escapeHtml(x.muscle)}</b><span>${x.setsPerWeek.toFixed(1)}</span><span>${x.daysPerWeek.toFixed(1)}</span></div>`).join('')}`:'<div class="empty">Sin series de trabajo en este periodo.</div>';
}
function analyticsTrendItem(x,kind){
  const attention=kind==='watch';
  const cls=attention?(x.down?'down':'watch'):'up';
  const status=attention?(x.down?'Rendimiento ↓':'Sin mejora reciente'):'Mejora';
  const base=x.deltaPct==null?'Sin comparación':`${analyticsPct(x.deltaPct)} e1RM · ${x.sessions} sesiones`;
  const desc=attention&&x.stagnant?`${base} · 3 sesiones sin nuevo máximo` : base;
  return `<div class="progress-item"><div><b>${escapeHtml(x.name)}</b><br><small>${desc}${x.lastDate?` · última ${fmtDate(x.lastDate)}`:''}</small></div><span class="analytics-status ${cls}">${status}</span></div>`;
}
function renderAnalyticsExerciseLists(up,attention,trends){
  const a=document.getElementById('analyticsProgressing'),b=document.getElementById('analyticsAttention');if(!a||!b)return;
  const ups=[...up].sort((x,y)=>(y.deltaPct||0)-(x.deltaPct||0)).slice(0,6);
  const watches=[...attention].sort((x,y)=>{if(x.down!==y.down)return x.down?-1:1;return (x.deltaPct||0)-(y.deltaPct||0)}).slice(0,6);
  a.innerHTML=ups.length?ups.map(x=>analyticsTrendItem(x,'up')).join(''):'<div class="empty">Aún no hay ejercicios con una mejora ≥2% de e1RM en el periodo.</div>';
  b.innerHTML=watches.length?watches.map(x=>analyticsTrendItem(x,'watch')).join(''):'<div class="empty">No aparecen señales claras de estancamiento en los ejercicios con historial suficiente.</div>';
}
