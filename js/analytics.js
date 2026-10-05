// LiftEngine · Analytics: UI sobre el motor compartido de métricas
'use strict';

function analyticsDate(s){ return metricsDate(s); }
function analyticsWeeks(){
  const el=document.getElementById('analyticsWindow');
  const n=parseInt(el?.value,10); return [4,8,12].includes(n)?n:8;
}
function analyticsPeriod(weeks=analyticsWeeks()){ return metricsPeriod(weeks); }
function workoutOnDate(date){ return metricsWorkoutOnDate(date); }
function analyticsWorkoutDates(startKey,endKey){ return metricsWorkoutDates(startKey,endKey); }
function analyticsCoverage(period){ return metricsCoverage(period); }
function analyticsWeekBuckets(period){
  const buckets=[];
  for(let i=0;i<period.weeks;i++){
    const start=new Date(period.start); start.setDate(period.start.getDate()+i*7);
    const end=new Date(start);end.setDate(start.getDate()+6);
    const startKey=metricsYmd(start);
    const actualEnd=end>period.end?period.end:end;
    const dates=metricsWorkoutDates(startKey,metricsYmd(actualEnd));
    buckets.push({start:startKey,end:metricsYmd(actualEnd),sessions:dates.length,label:`${start.getDate()} ${start.toLocaleDateString('es-MX',{month:'short'}).replace('.','')}`});
  }
  return buckets;
}
function analyticsExpectedSessions(coverage){ return metricsExpectedSessions(coverage,weeklySessionTarget); }
function analyticsExerciseNames(startKey,endKey){
  const set=new Set();
  Object.keys(data).filter(d=>d>=startKey&&d<=endKey).forEach(d=>(data[d]||[]).forEach(e=>{if(!e.isCardio&&entryHasData(e))set.add(e.name)}));
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
function analyticsExerciseTrend(name,startKey,endKey){ return metricsExerciseTrend(name,startKey,endKey); }
function analyticsExerciseTrends(startKey,endKey){ return analyticsExerciseNames(startKey,endKey).map(n=>metricsExerciseTrend(n,startKey,endKey)); }
function analyticsMuscleStats(coverage){ return metricsMuscleStats(coverage); }
function analyticsPRCount(startKey,endKey){ return findPRs().filter(p=>p.date>=startKey&&p.date<=endKey).length; }
function analyticsPct(v){ if(v==null||!Number.isFinite(v))return '—';return `${v>0?'+':''}${v.toFixed(1)}%`; }

window.setWeeklySessionTarget=function(v){
  const n=Math.min(7,Math.max(1,parseInt(v,10)||6));
  weeklySessionTarget=n;
  markSettingsDirty({cloud:true,local:true});
  persistLocal({settings:true});
  saveToFirebase({settings:true});
  renderAnalytics();
  if(typeof renderDashboard==='function')renderDashboard();
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
  if(note)note.innerHTML='<div class="analytics-note">Si ya existía historial antes del periodo, la adherencia usa la ventana completa; solo se prorratea cuando estás empezando a registrar. Con poco historial, LiftEngine evita extrapolar una semana incompleta.</div>';

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
