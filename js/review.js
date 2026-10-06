// LiftEngine · v6.9 Periodic Review: síntesis semanal/mensual sobre métricas existentes
'use strict';

// <review-helpers>
function reviewShiftDate(key,deltaDays){
  const d=new Date(String(key)+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+Number(deltaDays||0));
  return d.toISOString().slice(0,10);
}
function reviewWindow(anchor,days){
  const n=Math.max(1,Math.round(Number(days)||7));
  const end=String(anchor);
  const start=reviewShiftDate(end,-(n-1));
  const previousEnd=reviewShiftDate(start,-1);
  const previousStart=reviewShiftDate(previousEnd,-(n-1));
  return {days:n,start,end,previousStart,previousEnd};
}
function reviewPct(current,previous){
  const a=Number(current)||0,b=Number(previous)||0;
  return b>0?((a-b)/b)*100:null;
}
function reviewAggregate(rows){
  const list=rows||[];
  const exercises=new Set();
  let sets=0,volume=0,rirSum=0,rirCount=0,prs=0;
  list.forEach(r=>{
    sets+=Number(r.sets)||0;
    volume+=Number(r.volume)||0;
    rirSum+=Number(r.rirSum)||0;
    rirCount+=Number(r.rirCount)||0;
    prs+=Number(r.prs)||0;
    (r.exerciseNames||[]).forEach(n=>exercises.add(n));
  });
  return {
    sessions:list.length,sets,volume,prs,exercises:exercises.size,
    volumePerSession:list.length?volume/list.length:0,
    avgRir:rirCount?rirSum/rirCount:null
  };
}
function reviewCompare(current,previous){
  return {
    sessions:reviewPct(current.sessions,previous.sessions),
    sets:reviewPct(current.sets,previous.sets),
    volumePerSession:reviewPct(current.volumePerSession,previous.volumePerSession),
    prs:reviewPct(current.prs,previous.prs),
    exercises:reviewPct(current.exercises,previous.exercises)
  };
}
function reviewExpectedSessions(target,coverageDays){
  const t=Math.max(1,Number(target)||1),d=Math.max(0,Number(coverageDays)||0);
  return t*(d/7);
}
function reviewInsightModel(input){
  const x=input||{},current=x.current||{},previous=x.previous||{},deltas=x.deltas||{};
  const insights=[];
  const expected=Math.max(0,Number(x.expected)||0);
  const adherence=expected?current.sessions/expected*100:null;
  if(!current.sessions){
    insights.push({kind:'neutral',title:'Sin sesiones en el periodo',text:'No hay entrenamiento suficiente para construir una revisión útil todavía.'});
  }else if(adherence!==null&&adherence>=90){
    insights.push({kind:'positive',title:'Consistencia sólida',text:`${current.sessions} sesiones completadas frente a un objetivo equivalente de ${expected.toFixed(1)}.`});
  }else if(adherence!==null&&adherence>=65){
    insights.push({kind:'neutral',title:'Ritmo parcial',text:`${current.sessions} sesiones completadas frente a un objetivo equivalente de ${expected.toFixed(1)}.`});
  }else if(adherence!==null){
    insights.push({kind:'warning',title:'Consistencia por recuperar',text:`${current.sessions} sesiones completadas frente a un objetivo equivalente de ${expected.toFixed(1)}.`});
  }
  if((Number(x.plan?.missed)||0)>0){
    insights.push({kind:'warning',title:'Plan semanal incompleto',text:`${x.plan.missed} sesión${x.plan.missed===1?'':'es'} planeada${x.plan.missed===1?'':'s'} quedó${x.plan.missed===1?'':'aron'} pendiente${x.plan.missed===1?'':'s'} esta semana.`});
  }else if(x.plan&&Number(x.plan.due)>0&&Number(x.plan.completed)===Number(x.plan.due)){
    insights.push({kind:'positive',title:'Plan cumplido hasta hoy',text:`${x.plan.completed}/${x.plan.due} sesiones previstas ya vencidas o realizadas coinciden con el plan.`});
  }
  if(Number(current.prs)>0){
    insights.push({kind:'positive',title:'Hubo progreso medible',text:`${current.prs} PR${current.prs===1?'':'s'} registrado${current.prs===1?'':'s'} en el periodo.`});
  }else if(x.topImproving?.name){
    insights.push({kind:'positive',title:'Mejor señal de rendimiento',text:`${x.topImproving.name} mejoró ${Math.abs(Number(x.topImproving.deltaPct)||0).toFixed(1)}% en e1RM dentro del periodo.`});
  }
  if(x.topAttention?.name){
    const down=x.topAttention.down;
    insights.push({kind:down?'warning':'neutral',title:down?'Rendimiento a revisar':'Progreso estancado',text:`${x.topAttention.name}: ${down?'caída':'sin nuevo máximo reciente'}${Number.isFinite(x.topAttention.deltaPct)?` · ${x.topAttention.deltaPct>0?'+':''}${x.topAttention.deltaPct.toFixed(1)}% e1RM`:''}.`});
  }
  if(Number.isFinite(deltas.volumePerSession)&&Math.abs(deltas.volumePerSession)>=15){
    insights.push({kind:'neutral',title:'Cambió la carga de trabajo',text:`El volumen medio por sesión ${deltas.volumePerSession>0?'subió':'bajó'} ${Math.abs(deltas.volumePerSession).toFixed(1)}% frente al periodo anterior.`});
  }
  return insights.slice(0,4);
}
function reviewNextFocus(model){
  const x=model||{},current=x.current||{};
  if(!current.sessions)return {kind:'neutral',title:'Vuelve a construir contexto',text:'Completa una sesión y LiftEngine podrá volver a comparar rendimiento, volumen y consistencia.'};
  if((Number(x.plan?.missed)||0)>0)return {kind:'warning',title:'Prioriza el plan antes de cambiar volumen',text:'Hay una sesión planeada pendiente. Recuperar consistencia aporta más información que modificar el programa ahora.'};
  if(x.topAttention?.down)return {kind:'warning',title:`Revisa ${x.topAttention.name}`,text:'Antes de subir carga o series, abre Intelligence y revisa cómo vienen reps, RIR y e1RM en sus sesiones recientes.'};
  const expected=Math.max(0,Number(x.expected)||0);
  if(expected&&current.sessions/expected<.7)return {kind:'warning',title:'Primero consolida la frecuencia',text:'Completa con mayor regularidad las sesiones previstas antes de interpretar cambios de volumen como una tendencia.'};
  if(Number(current.prs)>0||x.topImproving?.name)return {kind:'positive',title:'Mantén la estructura',text:'Hay señales de progreso. No aparece una razón fuerte para cambiar el programa solo por este periodo.'};
  return {kind:'neutral',title:'Sigue acumulando historial',text:'El periodo es estable. Mantén el plan y deja que las próximas sesiones aporten una señal más clara.'};
}
// </review-helpers>

function reviewMode(){return document.getElementById('reviewPeriod')?.value==='month'?'month':'week';}
function reviewDays(){return reviewMode()==='month'?28:7;}
function reviewRows(startKey,endKey,prEvents){
  return Object.keys(data).filter(d=>d>=startKey&&d<=endKey).sort().map(date=>{
    const entries=(data[date]||[]).filter(e=>!e.isCardio&&entryHasData(e));
    if(!entries.length)return null;
    const exerciseNames=[...new Set(entries.map(e=>e.name))];
    let sets=0,volume=0,rirSum=0,rirCount=0;
    entries.forEach(e=>{
      const work=(e.sets||[]).filter(setCountsForWork);
      sets+=work.length;
      volume+=sessionVolume(e);
      work.forEach(set=>{const r=Number(set.rir);if(Number.isFinite(r)){rirSum+=r;rirCount++;}});
    });
    return {date,exerciseNames,sets,volume,rirSum,rirCount,prs:(prEvents||[]).filter(p=>p.date===date).length};
  }).filter(Boolean);
}
function reviewCoverageDays(window){
  const all=metricsWorkoutDates();
  if(!all.length)return 0;
  const hadBefore=all.some(d=>d<window.start);
  const firstInside=all.find(d=>d>=window.start&&d<=window.end);
  if(hadBefore)return window.days;
  if(!firstInside)return 0;
  return Math.max(1,Math.floor((metricsDate(window.end)-metricsDate(firstInside))/86400000)+1);
}
function reviewExerciseSignals(startKey,endKey){
  const names=new Set();
  Object.keys(data).filter(d=>d>=startKey&&d<=endKey).forEach(d=>{
    (data[d]||[]).forEach(e=>{if(!e.isCardio&&entryHasData(e))names.add(e.name);});
  });
  const trends=[...names].map(name=>metricsExerciseTrend(name,startKey,endKey));
  const improving=trends.filter(x=>x.improving).sort((a,b)=>(b.deltaPct||0)-(a.deltaPct||0));
  const attention=trends.filter(x=>x.down||x.stagnant).sort((a,b)=>{if(!!a.down!==!!b.down)return a.down?-1:1;return (a.deltaPct||0)-(b.deltaPct||0);});
  return {trends,improving,attention,topImproving:improving[0]||null,topAttention:attention[0]||null};
}
function reviewBodyDelta(days){
  const weight=metricsBodyDelta(weights,'weight',days);
  const waist=metricsBodyDelta(measurements,'waist',days);
  return {weight,waist};
}
function reviewDeltaLabel(v){return Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1)}%`:'—';}
function reviewVolume(kg){return `${Math.round(fromKg(Number(kg)||0)).toLocaleString('es-MX')} ${unitLabel()}`;}
function reviewKindLabel(kind){return kind==='positive'?'Bien':kind==='warning'?'Revisar':'Contexto';}
function reviewExerciseCard(x,kind){
  if(!x)return '<div class="review-exercise-card empty-card"><b>Sin señal suficiente</b><span>Hace falta más historial comparable en este periodo.</span></div>';
  const delta=Number.isFinite(x.deltaPct)?`${x.deltaPct>=0?'+':''}${x.deltaPct.toFixed(1)}% e1RM`:'Sin comparación';
  return `<button class="review-exercise-card ${kind}" type="button" data-name="${escapeHtml(x.name)}" onclick="selectDesktopExercise(this.dataset.name);setProgressView('performance',document.getElementById('progress-tab-performance'))"><span class="eyebrow">${kind==='up'?'En progreso':'Para revisar'}</span><b>${escapeHtml(x.name)}</b><strong>${delta}</strong><small>${x.sessions} sesión${x.sessions===1?'':'es'} · última ${x.lastDate?fmtDate(x.lastDate):'—'}</small></button>`;
}
window.renderReview=function(){
  const hero=document.getElementById('reviewHero'),kpis=document.getElementById('reviewKpis'),insightsBox=document.getElementById('reviewInsights'),exerciseBox=document.getElementById('reviewExercises');
  if(!hero||!kpis||!insightsBox||!exerciseBox)return;
  const days=reviewDays(),window=reviewWindow(todayStr(),days),prs=findPRs();
  const currentRows=reviewRows(window.start,window.end,prs),previousRows=reviewRows(window.previousStart,window.previousEnd,prs);
  const current=reviewAggregate(currentRows),previous=reviewAggregate(previousRows),deltas=reviewCompare(current,previous);
  const coverageDays=reviewCoverageDays(window),expected=reviewExpectedSessions(weeklySessionTarget,coverageDays);
  const signals=reviewExerciseSignals(window.start,window.end);
  const body=reviewBodyDelta(days);
  const plan=typeof weeklyPlanConfigured==='function'&&weeklyPlanConfigured()&&typeof scheduleWeekCompliance==='function'?scheduleWeekCompliance(todayStr()):null;
  const model={current,previous,deltas,expected,plan,topImproving:signals.topImproving,topAttention:signals.topAttention};
  const insights=reviewInsightModel(model),focus=reviewNextFocus(model);
  const range=document.getElementById('reviewRange');if(range)range.textContent=`${fmtDate(window.start)} — ${fmtDate(window.end)}`;
  const periodLabel=reviewMode()==='month'?'28 días':'7 días';
  const planLine=plan&&plan.due?`${plan.completed}/${plan.due} del plan cumplidas hasta hoy`:'Sin sesiones del plan vencidas';
  hero.innerHTML=`<div class="review-hero ${focus.kind}"><div><span class="eyebrow">Siguiente enfoque · ${periodLabel}</span><h3>${escapeHtml(focus.title)}</h3><p>${escapeHtml(focus.text)}</p></div><div class="review-hero-meta"><b>${current.sessions} sesiones</b><span>${escapeHtml(planLine)}</span></div></div>`;
  const adherence=expected?Math.min(100,current.sessions/expected*100):null;
  const weightText=body.weight?formatKgValue(body.weight.delta,true):'—';
  kpis.innerHTML=[
    ['Sesiones',String(current.sessions),`Anterior ${previous.sessions}`,reviewDeltaLabel(deltas.sessions)],
    ['Meta equivalente',adherence===null?'—':Math.round(adherence)+'%',expected?`${expected.toFixed(1)} esperadas`:'Sin cobertura',''],
    ['Series de trabajo',String(current.sets),`Anterior ${previous.sets}`,reviewDeltaLabel(deltas.sets)],
    ['Volumen / sesión',current.sessions?reviewVolume(current.volumePerSession):'—',previous.sessions?`Anterior ${reviewVolume(previous.volumePerSession)}`:'Sin previo',reviewDeltaLabel(deltas.volumePerSession)],
    ['PR',String(current.prs),`Anterior ${previous.prs}`,reviewDeltaLabel(deltas.prs)],
    ['Peso corporal',weightText,body.weight?`${body.weight.actualDays} días de referencia`:'Sin comparación','']
  ].map(([label,value,sub,delta])=>`<div class="review-kpi"><small>${label}</small><b>${value}</b><span>${sub}</span>${delta?`<em>${delta}</em>`:''}</div>`).join('');
  insightsBox.innerHTML=insights.length?insights.map(x=>`<div class="review-insight ${x.kind}"><span>${reviewKindLabel(x.kind)}</span><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.text)}</p></div>`).join(''):'<div class="empty"><b>Aún sin una lectura clara</b><span>Completa más sesiones para generar conclusiones comparables.</span></div>';
  const up=signals.improving.slice(0,3),watch=signals.attention.slice(0,3);
  exerciseBox.innerHTML=`<div><div class="review-exercise-head"><span>En progreso</span><small>e1RM</small></div>${up.length?up.map(x=>reviewExerciseCard(x,'up')).join(''):reviewExerciseCard(null,'up')}</div><div><div class="review-exercise-head"><span>Para revisar</span><small>señales</small></div>${watch.length?watch.map(x=>reviewExerciseCard(x,'watch')).join(''):reviewExerciseCard(null,'watch')}</div>`;
};