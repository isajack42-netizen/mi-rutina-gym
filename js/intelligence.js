// LiftEngine · Training Intelligence: recomendaciones deterministas y explicables
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
  const firstPrimary=primarySets[0]||null,lastPrimary=primarySets[primarySets.length-1]||null;
  const firstReps=Number(firstPrimary?.reps)||0,lastReps=Number(lastPrimary?.reps)||0;
  const repDropPct=primarySets.length>=2&&firstReps>0?((firstReps-lastReps)/firstReps)*100:null;
  const exerciseIndex=Number.isFinite(Number(session?.exerciseIndex))?Number(session.exerciseIndex):null;
  const exerciseCount=Number.isFinite(Number(session?.exerciseCount))?Number(session.exerciseCount):null;
  const positionRatio=exerciseIndex!=null&&exerciseCount>1?exerciseIndex/(exerciseCount-1):null;
  return {
    date:session?.date||'',
    routine:session?.routine||'',
    exerciseIndex,exerciseCount,positionRatio,
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
    firstPrimaryReps:firstReps||null,
    lastPrimaryReps:lastReps||null,
    repDropPct,
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
  if(n>=3&&exact)return {level:'medium',label:'Media',text:'Ya hay varias sesiones comparables; la recomendación puede usar progresión reciente, aunque la tendencia larga aún es limitada.'};
  if(n>=2&&exact)return {level:'medium',label:'Media',text:'Hay dos sesiones comparables y un objetivo de rutina. La propuesta ya puede orientarte, pero todavía tiene poco historial.'};
  if(n===1&&exact)return {level:'low',label:'Baja',text:'Propuesta provisional basada en una sola sesión y el objetivo de la rutina.'};
  if(n>=2)return {level:'medium',label:'Media',text:'Hay historial comparable, aunque no existe un objetivo único de rutina.'};
  return {level:'low',label:'Baja',text:'La recomendación se apoya en muy poco historial; úsala como referencia y deja que gane confianza con nuevas sesiones.'};
}
function intelMaturity(profiles,target){
  const n=profiles.length;
  if(!n)return {level:'initial',label:'Referencia inicial',detail:'Aún no hay una sesión previa completa.'};
  if(n<=2)return {level:'provisional',label:'Propuesta provisional',detail:`${n} sesión${n===1?'':'es'} registrada${n===1?'':'s'}: útil para orientar la próxima sesión, todavía sin tendencia sólida.`};
  if(n===3)return {level:'standard',label:'Recomendación',detail:'Tres sesiones comparables permiten una recomendación más estable, pero aún no una lectura fuerte de meseta o fatiga.'};
  return {level:'trend',label:'Recomendación + tendencia',detail:'Hay suficiente historial para combinar la próxima decisión con señales de tendencia reciente.'};
}

// <intelligence-2-patterns>
function intelPersonalPatterns(name,profiles){
  const rows=(profiles||[]).slice(-8);
  let repOpportunities=0,repWins=0,loadIncreases=0,loadSustained=0;
  const assistance=intelAssistanceLike(name);
  for(let i=1;i<rows.length;i++){
    const prev=rows[i-1],cur=rows[i];
    if(prev.primaryWeight<=0||cur.primaryWeight<=0||assistance)continue;
    const deltaWeight=cur.primaryWeight-prev.primaryWeight;
    if(Math.abs(deltaWeight)<=.25&&Number.isFinite(prev.avgPrimaryReps)&&Number.isFinite(cur.avgPrimaryReps)){
      repOpportunities++;
      if(cur.avgPrimaryReps>=prev.avgPrimaryReps+.5)repWins++;
    }else if(deltaWeight>.25){
      loadIncreases++;
      if(prev.e1rm>0&&cur.e1rm>=prev.e1rm*.98)loadSustained++;
    }
  }
  const repRate=repOpportunities?repWins/repOpportunities:null;
  const loadRate=loadIncreases?loadSustained/loadIncreases:null;
  let strategy={status:'forming',label:'Patrón en formación',detail:'Aún faltan transiciones comparables de carga y repeticiones.',repOpportunities,repWins,loadIncreases,loadSustained,repRate,loadRate};
  if(!assistance&&(repOpportunities+loadIncreases)>=3){
    if(repOpportunities>=2&&repWins>=2&&(loadIncreases<2||loadRate==null||repRate>=loadRate+.15)){
      strategy={...strategy,status:'reps-first',label:'Progresión por reps',detail:`${repWins}/${repOpportunities} comparaciones con la misma carga mejoraron las reps antes de subir peso.`};
    }else if(loadIncreases>=2&&loadRate>=.67){
      strategy={...strategy,status:'load-tolerant',label:'Carga bien tolerada',detail:`${loadSustained}/${loadIncreases} aumentos recientes de carga sostuvieron el e1RM.`};
    }else{
      strategy={...strategy,status:'mixed',label:'Progresión mixta',detail:'Tu historial no muestra una ventaja clara entre acumular reps y subir carga.'};
    }
  }

  const dropRows=rows.filter(x=>Number.isFinite(x.repDropPct));
  const avgDrop=dropRows.length?intelMean(dropRows.slice(-4).map(x=>x.repDropPct)):null;
  const setConsistency=dropRows.length>=3
    ? (avgDrop>=15
      ? {status:'drop',label:'Caída entre series',detail:`Las reps caen en promedio ${avgDrop.toFixed(1)}% entre la primera y la última serie reciente.`,avgDrop}
      : {status:'stable',label:'Series consistentes',detail:`La caída media entre primera y última serie es ${Math.max(0,avgDrop).toFixed(1)}%.`,avgDrop})
    : {status:'forming',label:'Consistencia por aprender',detail:'Faltan sesiones comparables para medir la caída entre series.',avgDrop};

  const rirRows=rows.filter(x=>Number.isFinite(x.avgRir));
  let effort={status:'forming',label:'Esfuerzo sin patrón',detail:'Falta RIR suficiente para comparar bloques recientes.',delta:null};
  if(rirRows.length>=4){
    const prior=intelMean(rirRows.slice(-4,-2).map(x=>x.avgRir));
    const recent=intelMean(rirRows.slice(-2).map(x=>x.avgRir));
    const delta=recent-prior;
    effort=delta<=-.75
      ? {status:'harder',label:'Esfuerzo en aumento',detail:`El RIR medio reciente bajó ${Math.abs(delta).toFixed(1)} puntos frente a las dos sesiones anteriores.`,delta}
      : delta>=.75
        ? {status:'easier',label:'Más margen reciente',detail:`El RIR medio reciente subió ${delta.toFixed(1)} puntos frente a las dos sesiones anteriores.`,delta}
        : {status:'stable',label:'Esfuerzo estable',detail:`El RIR medio cambió solo ${Math.abs(delta).toFixed(1)} puntos entre bloques recientes.`,delta};
  }

  const positioned=rows.filter(x=>x.e1rm>0&&Number.isFinite(x.positionRatio));
  const bucket=x=>x.positionRatio<=.4?'early':x.positionRatio>=.6?'late':'middle';
  const early=positioned.filter(x=>bucket(x)==='early'),late=positioned.filter(x=>bucket(x)==='late');
  let positionSwitches=0,previousBucket='';
  positioned.forEach(x=>{
    const b=bucket(x);
    if(b==='middle')return;
    if(previousBucket&&previousBucket!==b)positionSwitches++;
    previousBucket=b;
  });
  let position={status:'forming',label:'Posición sin señal',detail:'El ejercicio no ha variado suficiente de posición para comparar su rendimiento.',deltaPct:null,earlyCount:early.length,lateCount:late.length,switches:positionSwitches};
  // Exigimos cambios de posición repetidos para reducir el riesgo de confundir
  // una progresión temporal con un efecto real del orden de la sesión.
  if(early.length>=2&&late.length>=2&&positionSwitches>=2){
    const earlyMean=intelMean(early.map(x=>x.e1rm)),lateMean=intelMean(late.map(x=>x.e1rm));
    const deltaPct=intelPctChange(earlyMean,lateMean);
    position=deltaPct!=null&&deltaPct<=-5
      ? {status:'late-down',label:'Rinde menos al final',detail:`Tras varios cambios de posición, el e1RM medio es ${Math.abs(deltaPct).toFixed(1)}% menor cuando aparece tarde en la sesión.`,deltaPct,earlyCount:early.length,lateCount:late.length,switches:positionSwitches}
      : {status:'stable',label:'Posición estable',detail:`Tras varios cambios de posición no aparece una diferencia grande (${deltaPct==null?'—':`${deltaPct>=0?'+':''}${deltaPct.toFixed(1)}%`}).`,deltaPct,earlyCount:early.length,lateCount:late.length,switches:positionSwitches};
  }

  const signals=[];
  if(strategy.status!=='forming')signals.push({key:'strategy',kind:strategy.status==='load-tolerant'||strategy.status==='reps-first'?'positive':'neutral',label:strategy.label,detail:strategy.detail});
  if(setConsistency.status==='drop')signals.push({key:'sets',kind:'warning',label:setConsistency.label,detail:setConsistency.detail});
  else if(setConsistency.status==='stable'&&dropRows.length>=4)signals.push({key:'sets',kind:'neutral',label:setConsistency.label,detail:setConsistency.detail});
  if(effort.status==='harder')signals.push({key:'effort',kind:'warning',label:effort.label,detail:effort.detail});
  else if(effort.status==='easier')signals.push({key:'effort',kind:'positive',label:effort.label,detail:effort.detail});
  if(position.status==='late-down')signals.push({key:'position',kind:'warning',label:position.label,detail:position.detail});

  return {
    sessionsUsed:rows.length,
    strategy,setConsistency,effort,position,
    signals:signals.slice(0,4),
    hasStablePattern:signals.length>0
  };
}
function intelPatternReason(patterns,action){
  if(!patterns)return '';
  if(action==='reps'&&patterns.strategy?.status==='reps-first')return patterns.strategy.detail;
  if(action==='increase'&&patterns.strategy?.status==='load-tolerant')return patterns.strategy.detail;
  if(['reps','hold'].includes(action)&&patterns.setConsistency?.status==='drop')return patterns.setConsistency.detail;
  if(['hold','decrease'].includes(action)&&patterns.effort?.status==='harder')return patterns.effort.detail;
  return '';
}
// </intelligence-2-patterns>
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
  const maturity=intelMaturity(profiles,target);
  const patterns=intelPersonalPatterns(name,profiles);
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
      const repsPattern=patterns.strategy?.status==='reps-first';
      action=profiles.length<=2||repsPattern?'reps':'reference';
      title=profiles.length<=2?'Repite la carga y busca una mejora pequeña':repsPattern?'Tu patrón favorece sumar reps':'Usa la última sesión como referencia';
      summary=profiles.length<=2
        ?`Con el historial actual, la opción más prudente es repetir aproximadamente ${formatKgValue(last.primaryWeight||last.bestWeight)} e intentar una repetición total adicional o una ejecución más cómoda.`
        :repsPattern
          ?`En tus sesiones comparables, acumular repeticiones con la misma carga ha producido la señal más consistente. Repite aproximadamente ${formatKgValue(last.primaryWeight||last.bestWeight)} y busca una mejora pequeña antes de subir peso.`
          :`Repite aproximadamente ${formatKgValue(last.primaryWeight||last.bestWeight)} y busca igualar o superar ligeramente el rendimiento con técnica estable.`;
      reasons.push(profiles.length<=2?`${profiles.length} sesión${profiles.length===1?'':'es'} disponible${profiles.length===1?'':'s'}: todavía no hay base suficiente para interpretar una tendencia.`:repsPattern?patterns.strategy.detail:'Usamos la sesión más reciente como referencia comparable.');
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
  const personalReason=intelPatternReason(patterns,action);
  if(personalReason)reasons.push(personalReason);

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
    confidence,maturity,trend,patterns,target,profiles,last,plan,
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
  const personal=intel.patterns?.signals?.[0];
  if(personal)chips.push(`<span class="intel-chip ${personal.kind==='warning'?'watch':personal.kind==='positive'?'up':''}">${escapeHtml(personal.label)}</span>`);
  if(intel.maturity?.label)chips.push(`<span class="intel-chip">${escapeHtml(intel.maturity.label)}</span>`);
  chips.push(`<span class="intel-chip">Confianza ${escapeHtml(intel.confidence.label.toLowerCase())}</span>`);
  return chips.join('');
}
window.renderIntelligenceCard=function(intel,{compact=false,whyAction='openCurrentIntelligenceWhy()'}={}){
  if(!intel)return '<div class="empty">No hay suficiente información.</div>';
  const eyebrow=intel.maturity?.label||'Próxima decisión';
  const patternSignals=(intel.patterns?.signals||[]).slice(0,3);
  const patternHtml=!compact
    ? `<div class="intel-personal-memory">
        <div class="intel-personal-memory-head"><span class="eyebrow">Tu patrón reciente</span><small>${intel.patterns?.sessionsUsed||0} sesiones analizadas</small></div>
        ${patternSignals.length
          ? `<div class="intel-pattern-list">${patternSignals.map(x=>`<div class="intel-pattern-item ${escapeHtml(x.kind)}"><b>${escapeHtml(x.label)}</b><span>${escapeHtml(x.detail)}</span></div>`).join('')}</div>`
          : '<div class="intel-pattern-empty">Todavía no hay un patrón personal suficientemente repetido para usarlo como contexto.</div>'}
      </div>`
    :'';
  return `<div class="intelligence-card ${escapeHtml(intel.tone)} ${compact?'compact':''}">
    <div class="intelligence-head"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><strong>${escapeHtml(intel.title)}</strong></div><span class="intelligence-action ${escapeHtml(intel.tone)}">${escapeHtml(intel.label)}</span></div>
    <div class="intelligence-plan">${escapeHtml(intelligencePlanText(intel))}</div>
    <p>${escapeHtml(intel.summary)}</p>
    <div class="intelligence-chips">${intelligenceSignalChips(intel)}</div>
    ${patternHtml}
    ${compact?'<small class="intel-placeholder-note">Los valores grises de las series son la propuesta; puedes ajustarlos antes de ✓.</small>':''}
    <button class="intel-why" type="button" onclick="${whyAction}">¿Por qué?</button>
  </div>`;
};

function intelligenceWhyHtml(intel){
  const target=intel.target;
  const personalSignals=intel.patterns?.signals||[];
  const personalHtml=personalSignals.length
    ? `<div class="intel-pattern-dialog"><h3>Patrones personales recientes</h3>${personalSignals.map(x=>`<div class="intel-pattern-item ${escapeHtml(x.kind)}"><b>${escapeHtml(x.label)}</b><span>${escapeHtml(x.detail)}</span></div>`).join('')}</div>`
    : '<div class="intel-pattern-dialog"><h3>Patrones personales recientes</h3><div class="intel-pattern-empty">Aún no existe una señal repetida suficiente. LiftEngine seguirá usando la sesión reciente y el objetivo de rutina sin inventar un patrón.</div></div>';
  const targetText=target?.ambiguous
    ? `Objetivo variable entre: ${target.routines.join(', ')}`
    : target?.repRange?`${target.sets} × ${target.repRange.min}–${target.repRange.max} · RIR ${target.rir} · descanso ${normalizeRestLabel(target.rest)}`:'Sin objetivo único de rutina';
  const history=intel.last?`${fmtDate(intel.last.date)} · ${intel.last.setCount} series · ${(intel.last.primaryWeight||intel.last.bestWeight)>0?formatKgValue(intel.last.primaryWeight||intel.last.bestWeight):'sin carga externa'}${intel.last.e1rm>0?` · e1RM ${formatKgValue(intel.last.e1rm)}`:''}`:'Sin sesión previa';
  return `<h2>¿Por qué esta recomendación?</h2>
    <div class="intel-dialog-summary"><span class="intelligence-action ${escapeHtml(intel.tone)}">${escapeHtml(intel.label)}</span><b>${escapeHtml(intel.title)}</b><span>${escapeHtml(intelligencePlanText(intel))}</span></div>
    <div class="intel-reason-list">${intel.reasons.length?intel.reasons.map(x=>`<div>${ic('check')}<span>${escapeHtml(x)}</span></div>`).join(''):'<div><span>Aún falta historial para explicar una progresión con detalle.</span></div>'}</div>
    ${personalHtml}
    <div class="intel-detail-grid">
      <div><small>Última referencia</small><b>${escapeHtml(history)}</b></div>
      <div><small>Objetivo de rutina</small><b>${escapeHtml(targetText)}</b></div>
      <div><small>Madurez de la recomendación</small><b>${escapeHtml(intel.maturity?.label||'Referencia')}</b><span>${escapeHtml(intel.maturity?.detail||intel.confidence.text)}</span></div>
      <div><small>Confianza</small><b>${escapeHtml(intel.confidence.label)}</b><span>${escapeHtml(intel.confidence.text)}</span></div>
      <div><small>Lectura de tendencia</small><b>${escapeHtml(intel.trend.status==='down'?'Descendente':intel.trend.status==='plateau'?'Meseta reciente':intel.trend.status==='improving'?'En mejora':'Estable / insuficiente')}</b><span>Una señal no equivale a un diagnóstico de fatiga.</span></div>
    </div>
    <p class="muted intel-disclaimer">LiftEngine usa reglas transparentes basadas en tus series, repeticiones, carga, RIR, objetivo de rutina, tendencia de e1RM y patrones repetidos de hasta 8 sesiones. Los patrones describen tu historial; no prueban causalidad ni evalúan técnica, sueño, dolor, nutrición o recuperación fuera de lo que registras.</p>
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
  box.innerHTML=rows.length?rows.map(x=>`<div class="intel-list-item"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.maturity?.label||'Recomendación')} · ${escapeHtml(x.title)} · ${escapeHtml(intelligencePlanText(x))}</small></div><span class="intelligence-action ${escapeHtml(x.tone)}">${escapeHtml(x.label)}</span></div>`).join(''):'<div class="empty">No hay ejercicios evaluables en este periodo.</div>';
};
