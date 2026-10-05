// LiftEngine · v5.8 Training Intelligence
// Motor determinista y explicable para convertir historial + objetivo de rutina
// en una recomendación prudente para la siguiente sesión.
'use strict';

function intelMean(values){
  const v=(values||[]).filter(Number.isFinite);
  return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
}
function intelPctChange(a,b){ return Number.isFinite(a)&&a>0&&Number.isFinite(b)?((b-a)/a)*100:null; }
function intelRoundLoadKg(v){
  const n=Number(v)||0;
  if(n<=0)return 0;
  // Medio kilo permite representar incrementos pequeños sin inventar precisión excesiva.
  return Math.max(0,Math.round(n*2)/2);
}
function intelAssistanceLike(name){ return /asistid|assisted|contrapeso/i.test(String(name||'')); }
function intelPrimaryWeight(sets){
  const groups=new Map();
  (sets||[]).forEach(s=>{
    const w=Number(s.weight)||0;if(w<=0)return;
    const key=w.toFixed(3),g=groups.get(key)||{weight:w,count:0,reps:[]};
    g.count++;g.reps.push(Number(s.reps)||0);groups.set(key,g);
  });
  const rows=[...groups.values()];
  if(!rows.length)return 0;
  rows.sort((a,b)=>b.count-a.count||b.weight-a.weight);
  return rows[0].weight;
}
function intelSessionProfile(session){
  // Para la decisión de reps/RIR también cuentan ejercicios sin carga externa.
  // e1RM y volumen, en cambio, solo se calculan cuando existe un peso > 0.
  const performed=(session?.sets||[]).filter(s=>(Number(s.reps)||0)>0);
  const loaded=performed.filter(s=>(Number(s.weight)||0)>0);
  const rir=performed.map(s=>parseFloat(s.rir)).filter(Number.isFinite);
  const primaryWeight=intelPrimaryWeight(loaded);
  const primarySets=primaryWeight?loaded.filter(s=>Math.abs((Number(s.weight)||0)-primaryWeight)<0.001):performed;
  const e1=loaded.reduce((m,s)=>Math.max(m,e1rm(s.weight,s.reps)),0);
  return {
    date:session?.date||'',
    validSets:performed,
    loadedSets:loaded,
    setCount:performed.length,
    primaryWeight,
    bestWeight:loaded.length?Math.max(...loaded.map(s=>Number(s.weight)||0)):0,
    bestReps:performed.length?Math.max(...performed.map(s=>Number(s.reps)||0)):0,
    avgReps:performed.length?intelMean(performed.map(s=>Number(s.reps)||0)):null,
    avgPrimaryReps:primarySets.length?intelMean(primarySets.map(s=>Number(s.reps)||0)):null,
    minReps:performed.length?Math.min(...performed.map(s=>Number(s.reps)||0)):0,
    maxReps:performed.length?Math.max(...performed.map(s=>Number(s.reps)||0)):0,
    avgRir:rir.length?intelMean(rir):null,
    rirCoverage:performed.length?rir.length/performed.length:0,
    e1rm:e1,
    volume:loaded.reduce((a,s)=>a+(Number(s.weight)||0)*(Number(s.reps)||0),0)
  };
}
function intelTrend(profiles,target){
  const rows=(profiles||[]).filter(x=>x.e1rm>0);
  if(!rows.length)return {status:'insufficient',plateau:false,performanceDown:false,fatigueLike:false,sessionsSinceBest:0,periodDeltaPct:null,recentDeltaPct:null,recentRir:null};
  const first=rows[0],last=rows[rows.length-1];
  const periodDeltaPct=intelPctChange(first.e1rm,last.e1rm);
  const best=Math.max(...rows.map(x=>x.e1rm));
  // "Mejora" exige superar el mejor anterior por >0.5%. Repetir el mismo
  // máximo no reinicia el contador de meseta.
  let meaningfulBest=0,lastMeaningfulBestIndex=0;
  rows.forEach((x,i)=>{
    if(meaningfulBest<=0 || x.e1rm>meaningfulBest*1.005){ meaningfulBest=x.e1rm; lastMeaningfulBestIndex=i; }
  });
  const sessionsSinceBest=Math.max(0,rows.length-1-lastMeaningfulBestIndex);
  const plateau=rows.length>=4&&sessionsSinceBest>=3;

  const block=Math.min(3,Math.floor(rows.length/2));
  let recentDeltaPct=null,performanceDown=false;
  if(block>=2){
    const prevMean=intelMean(rows.slice(-(block*2),-block).map(x=>x.e1rm));
    const recentMean=intelMean(rows.slice(-block).map(x=>x.e1rm));
    recentDeltaPct=intelPctChange(prevMean,recentMean);
    performanceDown=recentDeltaPct!=null&&recentDeltaPct<=-3;
  }
  if(rows.length>=3){
    const a=rows[rows.length-3].e1rm,b=rows[rows.length-2].e1rm,c=rows[rows.length-1].e1rm;
    if(a>0&&b<=a*.985&&c<=b*.985)performanceDown=true;
  }
  const recentRir=intelMean(rows.slice(-2).map(x=>x.avgRir).filter(Number.isFinite));
  const rr=target&&!target.ambiguous?parseRirRange(target.rir):null;
  const fatigueLike=!!(performanceDown&&rr&&recentRir!=null&&recentRir<Math.max(0,rr.min-.25));
  let status='stable';
  if(performanceDown)status='down';
  else if(plateau)status='plateau';
  else if(periodDeltaPct!=null&&periodDeltaPct>=2)status='improving';
  return {status,plateau,performanceDown,fatigueLike,sessionsSinceBest,periodDeltaPct,recentDeltaPct,recentRir,bestE1rm:best};
}
function intelConfidence(profiles,target){
  const n=profiles.length;
  const exact=!!(target&&!target.ambiguous&&target.repRange);
  const rirCoverage=intelMean(profiles.slice(-3).map(x=>x.rirCoverage).filter(Number.isFinite))||0;
  const latestRirKnown=(profiles[profiles.length-1]?.rirCoverage||0)>0;
  if(n>=4&&exact&&rirCoverage>=.5&&latestRirKnown)return {level:'high',label:'Alta',text:'Historial suficiente, objetivo definido y RIR reciente disponible.'};
  if(n>=2&&exact)return {level:'medium',label:'Media',text:'Hay historial comparable y objetivo de rutina, pero faltan más sesiones o RIR consistente.'};
  if(n>=2)return {level:'medium',label:'Media',text:'Hay historial comparable, aunque no existe un objetivo único de rutina.'};
  return {level:'low',label:'Baja',text:'La recomendación se apoya en muy poco historial; úsala solo como referencia.'};
}
function intelPlanSuggestions(last,target,action,nextWeightKg){
  const previous=last?.validSets||[];
  const count=Math.max(1,Number(target&&!target.ambiguous&&target.sets)||previous.length||1);
  const min=target&&!target.ambiguous&&target.repRange?target.repRange.min:null;
  const max=target&&!target.ambiguous&&target.repRange?target.repRange.max:null;
  const out=[];
  for(let i=0;i<count;i++){
    const p=previous[i]||previous[previous.length-1]||{};
    let weight=Number(p.weight)||Number(nextWeightKg)||0;
    let reps=Number(p.reps)||min||0;
    if(action==='increase'){
      const base=Number(p.weight)||Number(last?.primaryWeight)||0;
      const inc=Number(nextWeightKg)>0&&Number(last?.primaryWeight)>0 ? Number(nextWeightKg)-Number(last.primaryWeight) : 0;
      weight=intelRoundLoadKg(Math.max(0,base+inc));
      if(min)reps=min;
    }else if(action==='decrease'){
      weight=intelRoundLoadKg((Number(p.weight)||Number(last?.primaryWeight)||Number(nextWeightKg)||0)*.95);
      if(min)reps=min;
    }else if(action==='reps'){
      weight=Number(p.weight)||Number(last?.primaryWeight)||Number(nextWeightKg)||0;
      if(min&&reps<min)reps=min;
      if(max&&reps>max)reps=max;
    }else{
      weight=Number(p.weight)||Number(last?.primaryWeight)||Number(nextWeightKg)||0;
    }
    out.push({weightKg:intelRoundLoadKg(weight),reps:Math.max(0,Math.round(reps))});
  }
  if(action==='reps'&&max){
    // Doble progresión: pide una sola repetición adicional total, empezando por
    // la serie más débil/última para no inflar de golpe el objetivo completo.
    let candidate=-1,minSeen=Infinity;
    out.forEach((x,i)=>{if(x.reps<max&&x.reps<=minSeen){minSeen=x.reps;candidate=i;}});
    if(candidate>=0)out[candidate].reps=Math.min(max,out[candidate].reps+1);
  }
  return out;
}
function intelActionMeta(action){
  const map={
    increase:{label:'Subir carga',tone:'positive'},
    reps:{label:'Sumar reps',tone:'neutral'},
    decrease:{label:'Bajar carga',tone:'warning'},
    hold:{label:'Mantener',tone:'neutral'},
    difficulty:{label:'Más dificultad',tone:'positive'},
    reference:{label:'Referencia',tone:'muted'}
  };
  return map[action]||map.hold;
}

function getTrainingIntelligence(name,opts={}){
  name=String(name||'').trim();
  const all=Array.isArray(opts.sessions)?opts.sessions:getExerciseSessions(name);
  const sessions=all.filter(s=>{
    if(opts.beforeDate&&s.date>=opts.beforeDate)return false;
    if(opts.throughDate&&s.date>opts.throughDate)return false;
    return true;
  });
  const lastSession=sessions[sessions.length-1]||null;
  const contextDate=opts.date||lastSession?.date||null;
  const routineName=opts.routineName||opts.routine||null;
  const target=opts.target!==undefined?opts.target:routineTargetFor(name,routineName,contextDate);
  const profiles=sessions.map(intelSessionProfile).filter(x=>x.setCount>0);
  const last=profiles[profiles.length-1]||null;
  const trend=intelTrend(profiles,target);
  const confidence=intelConfidence(profiles,target);
  const reasons=[];
  let action='reference',title='Usa una sesión de referencia',summary='Todavía no hay suficiente información para prescribir una progresión con confianza.';
  let nextWeightKg=last?.primaryWeight||last?.bestWeight||0;

  if(!last){
    if(target&&!target.ambiguous&&target.repRange){
      summary=`Primera sesión registrada para este ejercicio. Empieza con una carga que te permita quedar dentro de ${target.repRange.min}–${target.repRange.max} reps respetando RIR ${target.rir}.`;
      reasons.push(`Objetivo de rutina: ${target.sets} series de ${target.repRange.min}–${target.repRange.max} reps.`);
    }else reasons.push('No existe una sesión previa comparable.');
  }else if(target?.ambiguous){
    action='reference';title='Define el contexto de rutina';
    summary='Este ejercicio tiene objetivos diferentes entre rutinas. LiftEngine evita recomendar una carga única sin saber cuál estás ejecutando.';
    reasons.push(`Aparece en: ${target.routines.join(', ')}.`);
    reasons.push(`Última referencia: ${(last.primaryWeight||last.bestWeight)>0?formatKgValue(last.primaryWeight||last.bestWeight):'sin carga externa'}${last.e1rm>0?` · e1RM ${formatKgValue(last.e1rm)}`:''}.`);
  }else if(!target||!target.repRange){
    if(trend.performanceDown){
      action='hold';title='No subas todavía';
      summary='El rendimiento reciente bajó frente a las sesiones anteriores. Mantén una referencia conservadora y comprueba si el patrón continúa.';
      reasons.push(trend.recentDeltaPct!=null?`e1RM reciente ${trend.recentDeltaPct.toFixed(1)}% frente al bloque anterior.`:'Hay una caída consecutiva de e1RM.');
    }else if(trend.plateau){
      action='hold';title='Consolida antes de cambiar';
      summary='No aparece un nuevo máximo reciente. Repite una sesión comparable y busca una mejora pequeña antes de cambiar la carga.';
      reasons.push(`${trend.sessionsSinceBest} sesiones desde el último mejor e1RM.`);
    }else{
      action='reference';title='Usa la última sesión como referencia';
      summary=`Repite aproximadamente ${formatKgValue(last.primaryWeight||last.bestWeight)} y busca igualar o superar ligeramente el rendimiento con técnica estable.`;
      if(trend.periodDeltaPct!=null)reasons.push(`Tendencia del historial: ${trend.periodDeltaPct>=0?'+':''}${trend.periodDeltaPct.toFixed(1)}% de e1RM.`);
    }
  }else{
    const min=target.repRange.min,max=target.repRange.max,rr=parseRirRange(target.rir);
    const expectedSets=Math.max(1,Number(target.sets)||last.setCount||1);
    const evalSets=last.validSets.slice(0,expectedSets);
    const enoughSets=last.validSets.length>=expectedSets;
    const belowMin=evalSets.filter(s=>(Number(s.reps)||0)<min).length;
    const allAtLeastMin=enoughSets&&evalSets.every(s=>(Number(s.reps)||0)>=min);
    const allAtTop=enoughSets&&evalSets.every(s=>(Number(s.reps)||0)>=max);
    const rirVals=evalSets.map(s=>parseFloat(s.rir)).filter(Number.isFinite);
    const avgRir=rirVals.length?intelMean(rirVals):null;
    const rirTooHard=!!(rr&&avgRir!=null&&avgRir<Math.max(0,rr.min-.25));
    const rirComfortable=!rr||(avgRir!=null&&avgRir>=Math.max(0,rr.min-.25));
    const base=last.primaryWeight||last.bestWeight||0;
    const assistanceLike=intelAssistanceLike(name);
    const inc=progressionIncrementKg(base);

    reasons.push(`Última sesión: ${last.setCount} series · ${base>0?formatKgValue(base):'sin carga externa'}${avgRir!=null?` · RIR ${avgRir.toFixed(1)}`:''}.`);
    reasons.push(`Objetivo: ${expectedSets} × ${min}–${max} · RIR ${target.rir}.`);

    if(belowMin>0&&rirTooHard){
      action='decrease';title='Baja ligeramente la carga';nextWeightKg=intelRoundLoadKg(base*.95);
      summary=`Quedaste por debajo de ${min} reps y el esfuerzo fue mayor al objetivo. Una reducción pequeña puede devolverte al rango sin convertir la sesión en un test máximo.`;
      reasons.push(`${belowMin} serie${belowMin===1?'':'s'} por debajo del mínimo con RIR más bajo de lo previsto.`);
    }else if(trend.performanceDown&&trend.fatigueLike){
      action='hold';title='No subas todavía';nextWeightKg=base;
      summary='El rendimiento reciente está bajando mientras el esfuerzo percibido es alto. Repite la carga y revisa recuperación, descanso o volumen antes de progresar.';
      reasons.push(trend.recentDeltaPct!=null?`Bloque reciente: ${trend.recentDeltaPct.toFixed(1)}% de e1RM frente al anterior.`:'Hay una caída consecutiva de rendimiento.');
      reasons.push('La señal es compatible con fatiga, pero no la diagnostica.');
    }else if(!enoughSets){
      action='hold';title='Completa primero el volumen objetivo';nextWeightKg=base;
      summary=`Antes de subir carga, intenta completar las ${expectedSets} series previstas dentro del rango.`;
      reasons.push(`Solo hay ${last.setCount} serie${last.setCount===1?'':'s'} de trabajo registrada${last.setCount===1?'':'s'} en la última sesión.`);
    }else if(allAtTop&&(base<=0||assistanceLike)&&rirComfortable){
      action='difficulty';title=assistanceLike?'Ajusta la asistencia para progresar':'Aumenta la dificultad si aplica';nextWeightKg=base;
      summary=assistanceLike
        ?'Llegaste al techo del rango en un ejercicio que parece asistido. LiftEngine no aumenta automáticamente el número de “peso”, porque en estas máquinas más asistencia suele significar menos dificultad. Ajusta la asistencia manualmente en la dirección adecuada.'
        :'Llegaste al techo de repeticiones sin una carga externa registrada. Si el ejercicio lo permite, aumenta ligeramente la dificultad o usa una variante más exigente.';
      reasons.push(`Completaste ${max} reps en todas las series dentro del RIR previsto.`);
    }else if(allAtTop&&rr&&avgRir==null){
      action='hold';title='Confirma el esfuerzo antes de subir';nextWeightKg=base;
      summary='Las repeticiones ya están en el techo del rango, pero falta RIR en la última sesión. Repite o sube solo si sabes que todavía quedaba el margen previsto.';
      reasons.push('Sin RIR no podemos distinguir una serie cómoda de una serie al límite.');
    }else if(allAtTop&&rirComfortable){
      action='increase';title='Sube la carga';nextWeightKg=intelRoundLoadKg(base+inc);
      summary=`Completaste el extremo superior del rango en todas las series sin una señal clara de esfuerzo excesivo. Es un buen momento para reiniciar el rango con más peso.`;
      reasons.push(`Propuesta: +${formatKgValue(inc)} y volver hacia ${min} reps.`);
    }else if(allAtTop&&rirTooHard){
      action='hold';title='Mantén la carga';nextWeightKg=base;
      summary='Llegaste al techo de repeticiones, pero demasiado cerca del fallo para el RIR objetivo. Repite la carga y busca el mismo resultado con algo más de margen.';
      reasons.push(`RIR promedio ${avgRir.toFixed(1)} frente al objetivo ${target.rir}.`);
    }else if(allAtLeastMin){
      action='reps';title='Mantén la carga y suma reps';nextWeightKg=base;
      summary='Ya estás dentro del rango. La siguiente mejora más prudente es añadir una repetición total manteniendo la misma carga y el RIR objetivo.';
      reasons.push(`Todavía hay series por debajo de ${max} reps.`);
      if(trend.plateau)reasons.push(`${trend.sessionsSinceBest} sesiones sin un nuevo mejor e1RM: busca una mejora pequeña, no un salto grande.`);
    }else if(trend.performanceDown){
      action='hold';title='Consolida y observa la tendencia';nextWeightKg=base;
      summary=`Aún faltan repeticiones para estabilizarte dentro de ${min}–${max}, y el rendimiento reciente no favorece aumentar carga.`;
      if(trend.recentDeltaPct!=null)reasons.push(`e1RM reciente ${trend.recentDeltaPct.toFixed(1)}% frente al bloque anterior.`);
    }else{
      action='hold';title='Consolida esta carga';nextWeightKg=base;
      summary=`Mantén el peso y busca que todas las series entren al menos en ${min} reps antes de progresar.`;
      reasons.push(`${belowMin} serie${belowMin===1?'':'s'} todavía por debajo del mínimo.`);
    }
  }

  if(trend.plateau&&action!=='increase'&&!reasons.some(x=>x.includes('sesiones sin'))) reasons.push(`${trend.sessionsSinceBest} sesiones desde el último mejor e1RM.`);
  if(trend.performanceDown&&!reasons.some(x=>x.includes('e1RM reciente'))&&trend.recentDeltaPct!=null) reasons.push(`Rendimiento reciente: ${trend.recentDeltaPct.toFixed(1)}% de e1RM frente al bloque anterior.`);

  const suggestions=intelPlanSuggestions(last,target,action,nextWeightKg);
  const exactTarget=target&&!target.ambiguous?target:null;
  const plan={
    weightKg:nextWeightKg,
    sets:exactTarget?Math.max(1,Number(exactTarget.sets)||suggestions.length):suggestions.length,
    repMin:exactTarget?.repRange?.min||null,
    repMax:exactTarget?.repRange?.max||null,
    rir:exactTarget?.rir||'',
    rest:exactTarget?.rest||'',
    suggestions
  };
  return {
    name,action,...intelActionMeta(action),title,summary,reasons:[...new Set(reasons)].slice(0,5),
    confidence,trend,target,profiles,last,plan,
    hasHistory:!!last,historyCount:profiles.length,lastDate:last?.date||'',
    warning:trend.fatigueLike?'possible-fatigue':trend.performanceDown?'performance-down':trend.plateau?'plateau':''
  };
}
window.getTrainingIntelligence=getTrainingIntelligence;

window.intelligenceSuggestionForSet=function(intel,i){
  return intel?.plan?.suggestions?.[i]||intel?.plan?.suggestions?.[intel.plan.suggestions.length-1]||null;
};
function intelligencePlanText(intel){
  if(!intel)return 'Sin recomendación';
  const p=intel.plan||{},bits=[];
  if(p.weightKg>0)bits.push(formatKgValue(p.weightKg));
  if(p.sets&&p.repMin&&p.repMax)bits.push(`${p.sets} × ${p.repMin}–${p.repMax}`);
  else if(p.sets)bits.push(`${p.sets} series`);
  if(p.rir)bits.push(`RIR ${p.rir}`);
  return bits.join(' · ')||'Usa la última sesión como referencia';
}
window.intelligencePlanText=intelligencePlanText;

function intelligenceSignalChips(intel){
  const chips=[];
  if(intel.trend?.plateau)chips.push('<span class="intel-chip watch">Meseta reciente</span>');
  if(intel.trend?.performanceDown)chips.push('<span class="intel-chip down">Rendimiento ↓</span>');
  else if(intel.trend?.status==='improving')chips.push('<span class="intel-chip up">Tendencia ↑</span>');
  if(intel.trend?.fatigueLike)chips.push('<span class="intel-chip watch">Revisar recuperación</span>');
  chips.push(`<span class="intel-chip">Confianza ${escapeHtml(intel.confidence.label.toLowerCase())}</span>`);
  return chips.join('');
}
window.renderIntelligenceCard=function(intel,{compact=false,whyAction='openCurrentIntelligenceWhy()'}={}){
  if(!intel)return '<div class="empty">No hay suficiente información.</div>';
  return `<div class="intelligence-card ${escapeHtml(intel.tone)} ${compact?'compact':''}">
    <div class="intelligence-head"><div><span class="eyebrow">Próxima decisión</span><strong>${escapeHtml(intel.title)}</strong></div><span class="intelligence-action ${escapeHtml(intel.tone)}">${escapeHtml(intel.label)}</span></div>
    <div class="intelligence-plan">${escapeHtml(intelligencePlanText(intel))}</div>
    <p>${escapeHtml(intel.summary)}</p>
    <div class="intelligence-chips">${intelligenceSignalChips(intel)}</div>
    ${compact?'<small class="intel-placeholder-note">Los valores grises de las series son la propuesta; puedes ajustarlos antes de ✓.</small>':''}
    <button class="intel-why" type="button" onclick="${whyAction}">¿Por qué?</button>
  </div>`;
};

function intelligenceWhyHtml(intel){
  const target=intel.target;
  const targetText=target?.ambiguous
    ? `Objetivo variable entre: ${target.routines.join(', ')}`
    : target?.repRange?`${target.sets} × ${target.repRange.min}–${target.repRange.max} · RIR ${target.rir} · descanso ${normalizeRestLabel(target.rest)}`:'Sin objetivo único de rutina';
  const history=intel.last?`${fmtDate(intel.last.date)} · ${intel.last.setCount} series · ${(intel.last.primaryWeight||intel.last.bestWeight)>0?formatKgValue(intel.last.primaryWeight||intel.last.bestWeight):'sin carga externa'}${intel.last.e1rm>0?` · e1RM ${formatKgValue(intel.last.e1rm)}`:''}`:'Sin sesión previa';
  return `<h2>¿Por qué esta recomendación?</h2>
    <div class="intel-dialog-summary"><span class="intelligence-action ${escapeHtml(intel.tone)}">${escapeHtml(intel.label)}</span><b>${escapeHtml(intel.title)}</b><span>${escapeHtml(intelligencePlanText(intel))}</span></div>
    <div class="intel-reason-list">${intel.reasons.length?intel.reasons.map(x=>`<div>${ic('check')}<span>${escapeHtml(x)}</span></div>`).join(''):'<div><span>Aún falta historial para explicar una progresión con detalle.</span></div>'}</div>
    <div class="intel-detail-grid">
      <div><small>Última referencia</small><b>${escapeHtml(history)}</b></div>
      <div><small>Objetivo de rutina</small><b>${escapeHtml(targetText)}</b></div>
      <div><small>Confianza</small><b>${escapeHtml(intel.confidence.label)}</b><span>${escapeHtml(intel.confidence.text)}</span></div>
      <div><small>Lectura de tendencia</small><b>${escapeHtml(intel.trend.status==='down'?'Descendente':intel.trend.status==='plateau'?'Meseta reciente':intel.trend.status==='improving'?'En mejora':'Estable / insuficiente')}</b><span>Una señal no equivale a un diagnóstico de fatiga.</span></div>
    </div>
    <p class="muted intel-disclaimer">LiftEngine usa reglas transparentes basadas en tus series, repeticiones, carga, RIR, objetivo de rutina y tendencia de e1RM. No evalúa técnica, sueño, dolor, nutrición ni recuperación fuera de lo que registras.</p>
    <div class="actions"><button class="btn btn-primary" onclick="closeModal()">Entendido</button></div>`;
}
window.openCurrentIntelligenceWhy=function(){
  const name=document.getElementById('chartExercise')?.value;if(!name)return;
  const sessions=getExerciseSessions(name);const last=sessions[sessions.length-1];
  const intel=getTrainingIntelligence(name,{routineName:last?categories[last.date]||null:null,date:last?.date||null});
  document.getElementById('modal').innerHTML=intelligenceWhyHtml(intel);openEl();
};
window.openTrainIntelligenceWhy=function(){
  if(typeof train==='undefined'||!train)return;const e=trainCur();if(!e)return;
  const intel=getTrainingIntelligence(e.name,{routineName:train.routine||null,date:train.date,beforeDate:train.date});
  document.getElementById('modal').innerHTML=intelligenceWhyHtml(intel);openEl();
};

window.renderIntelligenceAnalytics=function(coverage){
  const box=document.getElementById('analyticsIntelligence');if(!box)return;
  if(!coverage?.coverageDays){box.innerHTML='<div class="empty">Aún no hay historial suficiente para sugerir decisiones.</div>';return;}
  const names=analyticsExerciseNames(coverage.coverageStart,coverage.endKey);
  const priority={decrease:0,hold:4,increase:1,difficulty:2,reps:3,reference:5};
  const rows=names.map(name=>getTrainingIntelligence(name,{})).filter(x=>x.hasHistory).sort((a,b)=>{
    const aw=a.warning==='possible-fatigue'?0:a.warning==='performance-down'?1:a.warning==='plateau'?2:3;
    const bw=b.warning==='possible-fatigue'?0:b.warning==='performance-down'?1:b.warning==='plateau'?2:3;
    return aw-bw||(priority[a.action]??9)-(priority[b.action]??9)||String(b.lastDate).localeCompare(String(a.lastDate));
  }).slice(0,6);
  box.innerHTML=rows.length?rows.map(x=>`<div class="intel-list-item"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.title)} · ${escapeHtml(intelligencePlanText(x))}</small></div><span class="intelligence-action ${escapeHtml(x.tone)}">${escapeHtml(x.label)}</span></div>`).join(''):'<div class="empty">No hay ejercicios evaluables en este periodo.</div>';
};
