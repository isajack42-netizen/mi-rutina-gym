import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');

function context(extra={}){
  const ctx={
    console,
    window:{},
    document:{
      getElementById:()=>null,
      documentElement:{setAttribute:()=>{}},
      querySelectorAll:()=>[]
    },
    ...extra
  };
  ctx.globalThis=ctx;
  return vm.createContext(ctx);
}

function run(file,ctx){ vm.runInContext(read(file),ctx,{filename:file}); }

// ===== Settings & goals =====
{
  const ctx=context({
    bodyGoal:{mode:'neutral',targetWeightKg:null,targetWaistCm:null},
    isPlainObject:v=>!!v&&typeof v==='object'&&!Array.isArray(v),
    finiteNumber:(v,min=0)=>{const n=Number(v);return Number.isFinite(n)&&n>=min?n:null;},
    boundedString:(v,max=160,f='')=>String(v??f).slice(0,max),
    validDateKey:v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')),
    sanitizeExerciseNotes:x=>x||{},
    sanitizeRoutines:x=>x||{},
    sanitizeAliases:x=>x||{},
    sanitizeMuscles:x=>x||{},
    cleanString:(v,f='')=>typeof v==='string'?v.trim():(v==null?f:String(v).trim()),
    defaultPPL:{Push:[]},
    defaultAliases:{},
    defaultMuscles:{},
    exerciseNotes:{},
    customRoutines:{Push:[]},
    customAliases:{},
    customMuscles:{},
    currentUnit:'kg',
    currentTheme:'default',
    THEME_VALUES:['auto','light','default','ocean','forest','coffee'],
    normalizeTheme:v=>['auto','light','default','ocean','forest','coffee'].includes(String(v||''))?String(v):'auto',
    applyTheme:()=>{},
    weeklySessionTarget:6,
    weeklyPlan:{template:{},overrides:{}},
    toKg:v=>Number(v),
    renderSettingsModal:()=>{},
    toast:()=>{},
    markSettingsDirty:()=>{},
    persistLocal:async()=>true,
    saveToFirebase:async()=>true
  });
  run('js/settings.js',ctx);

  const old=ctx.sanitizeSettingsSnapshot({weeklySessionTarget:5,currentUnit:'kg'});
  assert.equal(old.weeklySessionTarget,5);
  assert.deepEqual(JSON.parse(JSON.stringify(old.bodyGoal)),{mode:'neutral',targetWeightKg:null,targetWaistCm:null});
  assert.deepEqual(JSON.parse(JSON.stringify(old.weeklyPlan)),{template:{},overrides:{}});

  const plan=ctx.sanitizeSettingsSnapshot({weeklyPlan:{template:{'1':'Push','0':'Descanso','9':'X'},overrides:{'2026-10-07':'Pull','bad-date':'Push'}}});
  assert.deepEqual(JSON.parse(JSON.stringify(plan.weeklyPlan)),{template:{'0':'Descanso','1':'Push'},overrides:{'2026-10-07':'Pull'}});

  ctx.bodyGoal={mode:'neutral',targetWeightKg:null,targetWaistCm:null};
  assert.equal(ctx.bodyMetricTrendClass('weight',-1,75),'trend-neutral');

  ctx.bodyGoal={mode:'cut',targetWeightKg:null,targetWaistCm:null};
  assert.equal(ctx.bodyMetricTrendClass('weight',-1,75),'trend-positive');
  assert.equal(ctx.bodyMetricTrendClass('weight',1,76),'trend-negative');

  ctx.bodyGoal={mode:'neutral',targetWeightKg:80,targetWaistCm:null};
  assert.equal(ctx.bodyMetricTrendClass('weight',1,78),'trend-positive');
  assert.equal(ctx.bodyMetricTrendClass('weight',1,82),'trend-negative');

  assert.equal(ctx.validateSettingsInput({bodyGoal:{mode:'cut',targetWeightKg:70}}),'');
  assert.ok(ctx.validateSettingsInput({bodyGoal:{mode:'unknown'}}));
}

// ===== Shared metrics =====
{
  const data={
    '2026-07-01':[{isCardio:false,name:'Press',sets:[{done:true,type:'normal',weight:25,reps:10},{done:true,type:'normal',weight:25,reps:9}]}],
    '2026-09-28':[{isCardio:false,name:'Press',sets:[{done:true,type:'normal',weight:30,reps:10},{done:true,type:'normal',weight:30,reps:9}]}],
    '2026-10-01':[{isCardio:false,name:'Press',sets:[{done:true,type:'normal',weight:32.5,reps:9},{done:true,type:'normal',weight:32.5,reps:8}]}],
    '2026-10-05':[{isCardio:false,name:'Press',sets:[{done:true,type:'normal',weight:32.5,reps:10},{done:true,type:'normal',weight:32.5,reps:9}]}]
  };
  const ctx=context({
    data,
    weeklySessionTarget:3,
    todayStr:()=> '2026-10-05',
    entryHasData:e=>!!e?.sets?.some(s=>s.done!==false&&Number(s.reps)>0),
    setCountsForWork:s=>s.done!==false&&s.type!=='warmup'&&Number(s.reps)>0,
    sessionVolume:e=>(e.sets||[]).filter(s=>s.done!==false&&s.type!=='warmup').reduce((a,s)=>a+(Number(s.weight)||0)*(Number(s.reps)||0),0),
    getExerciseSessions:name=>Object.keys(data).sort().map(date=>({
      date,
      sets:data[date].filter(e=>e.name===name).flatMap(e=>e.sets.map(s=>({weight:s.weight,reps:s.reps,rir:2})))
    })).filter(x=>x.sets.length),
    summarizeSession:session=>{
      const e1=session.sets.reduce((m,s)=>Math.max(m,(Number(s.weight)||0)*(1+(Number(s.reps)||0)/30)),0);
      return {e1rm:e1};
    },
    getMuscleGroup:()=> 'Pecho'
  });
  run('js/metrics.js',ctx);

  const week=ctx.metricsWeekSnapshot(ctx.metricsWeekStart(new Date(2026,8,28)));
  assert.equal(week.sessions,2);
  assert.equal(week.sets,4);
  assert.ok(week.volume>0);

  const adherence=ctx.metricsAdherence(8,3);
  assert.equal(adherence.sessions,3);
  assert.equal(adherence.coverage.coverageStart,adherence.period.startKey);
  assert.equal(adherence.coverage.hadHistoryBefore,true);
  assert.ok(adherence.pct>0&&adherence.pct<25);

  const trend=ctx.metricsExerciseTrend('Press','2026-09-01','2026-10-05');
  assert.equal(trend.sessions,3);
  assert.ok(Number.isFinite(trend.deltaPct));
}

// ===== Training Intelligence =====
{
  const parseRirRange=value=>{
    const nums=String(value||'').match(/\d+(?:\.\d+)?/g)||[];
    if(!nums.length)return null;
    const a=parseFloat(nums[0]),b=nums.length>1?parseFloat(nums.at(-1)):a;
    return {min:Math.min(a,b),max:Math.max(a,b),target:(a+b)/2};
  };
  const ctx=context({
    data:{},
    e1rm:(w,r)=>(Number(w)||0)*(1+(Number(r)||0)/30),
    parseRirRange,
    progressionIncrementKg:w=>Math.abs(Number(w)||0)<=40?2.5:5,
    formatKgValue:v=>`${Math.round((Number(v)||0)*10)/10} kg`,
    getExerciseSessions:()=>[],
    routineTargetFor:()=>null,
    escapeHtml:s=>String(s??''),
    fmtDate:s=>String(s??''),
    normalizeRestLabel:s=>String(s??''),
    analyticsExerciseNames:()=>[],
    unitLabel:()=> 'kg',
    fromKg:v=>Number(v)
  });
  run('js/intelligence.js',ctx);

  const target={routine:'Push',sets:3,repRange:{min:8,max:12},rir:'1–2',rest:'120 s'};
  const session=(date,reps,rir=2,weight=30)=>({date,sets:reps.map(r=>({weight,reps:r,rir}))});

  let x=ctx.window.getTrainingIntelligence('Press',{sessions:[session('2026-10-01',[12,12,12],2,30)],target});
  assert.equal(x.action,'increase');
  assert.equal(x.plan.weightKg,32.5);
  assert.deepEqual(JSON.parse(JSON.stringify(x.plan.suggestions.map(s=>s.reps))),[8,8,8]);

  x=ctx.window.getTrainingIntelligence('Press',{sessions:[session('2026-10-01',[12,11,10],2,30)],target});
  assert.equal(x.action,'reps');
  assert.deepEqual(JSON.parse(JSON.stringify(x.plan.suggestions.map(s=>s.reps))),[12,11,11]);

  x=ctx.window.getTrainingIntelligence('Press',{sessions:[session('2026-10-01',[7,6,6],0,30)],target});
  assert.equal(x.action,'decrease');

  x=ctx.window.getTrainingIntelligence('Press',{sessions:[session('2026-10-01',[12],2,30)],target});
  assert.equal(x.action,'hold');

  x=ctx.window.getTrainingIntelligence('Press',{sessions:[{date:'2026-10-01',sets:[12,12,12].map(reps=>({weight:30,reps,rir:null}))}],target});
  assert.equal(x.action,'hold');
  assert.equal(x.title,'Confirma el esfuerzo antes de subir');

  x=ctx.window.getTrainingIntelligence('Dominadas',{sessions:[session('2026-10-01',[12,12,12],2,0)],target});
  assert.equal(x.action,'difficulty');

  x=ctx.window.getTrainingIntelligence('Dominadas asistidas',{sessions:[session('2026-10-01',[12,12,12],2,40)],target});
  assert.equal(x.action,'difficulty');
  assert.equal(x.plan.weightKg,40);

  const repSessions=[
    session('2026-09-01',[8,8,8],2,30),
    session('2026-09-08',[9,9,9],2,30),
    session('2026-09-15',[10,10,10],2,30),
    session('2026-09-22',[11,11,11],2,30)
  ];
  x=ctx.window.getTrainingIntelligence('Press',{sessions:repSessions,target:null});
  assert.equal(x.patterns.strategy.status,'reps-first');
  assert.equal(x.action,'reps');
  assert.equal(x.title,'Tu patrón favorece sumar reps');
  assert.ok(x.reasons.some(r=>r.includes('misma carga')));

  const loadSessions=[
    session('2026-09-01',[8,8,8],2,30),
    session('2026-09-08',[8,8,8],2,32.5),
    session('2026-09-15',[8,8,8],2,35),
    session('2026-09-22',[8,8,8],2,37.5)
  ];
  x=ctx.window.getTrainingIntelligence('Press',{sessions:loadSessions,target:null});
  assert.equal(x.patterns.strategy.status,'load-tolerant');
  assert.equal(x.patterns.strategy.loadIncreases,3);
  assert.equal(x.patterns.strategy.loadSustained,3);

  const dropSessions=[
    session('2026-09-01',[12,10,8],2,30),
    session('2026-09-08',[12,10,8],2,30),
    session('2026-09-15',[12,10,8],2,30)
  ];
  x=ctx.window.getTrainingIntelligence('Press',{sessions:dropSessions,target});
  assert.equal(x.patterns.setConsistency.status,'drop');
  assert.ok(x.patterns.setConsistency.avgDrop>30);
  assert.ok(x.patterns.signals.some(s=>s.key==='sets'));

  const effortSessions=[
    session('2026-09-01',[10,10,10],3,30),
    session('2026-09-08',[10,10,10],3,30),
    session('2026-09-15',[10,10,10],2,30),
    session('2026-09-22',[10,10,10],1,30)
  ];
  x=ctx.window.getTrainingIntelligence('Press',{sessions:effortSessions,target});
  assert.equal(x.patterns.effort.status,'harder');
  assert.ok(x.patterns.effort.delta<=-1.4);

  const positioned=(date,weight,index)=>({
    ...session(date,[10,10,10],2,weight),
    exerciseIndex:index,
    exerciseCount:4,
    routine:'Push'
  });
  const alternating=[
    positioned('2026-09-01',40,0),
    positioned('2026-09-08',35,3),
    positioned('2026-09-15',40,0),
    positioned('2026-09-22',35,3)
  ];
  x=ctx.window.getTrainingIntelligence('Press',{sessions:alternating,target:null});
  assert.equal(x.patterns.position.status,'late-down');
  assert.ok(x.patterns.position.switches>=2);

  const oneSwitch=[
    positioned('2026-09-01',40,0),
    positioned('2026-09-08',40,0),
    positioned('2026-09-15',35,3),
    positioned('2026-09-22',35,3)
  ];
  x=ctx.window.getTrainingIntelligence('Press',{sessions:oneSwitch,target:null});
  assert.equal(x.patterns.position.status,'forming','un único cambio de orden no debe atribuir efecto a la posición');
}

// ===== Weekly & Monthly Review (v6.9.0) =====
{
  const src=read('js/review.js');
  const a=src.indexOf('// <review-helpers>'), z=src.indexOf('// </review-helpers>');
  assert.ok(a>=0&&z>a,'faltan los helpers puros de Revisión v6.9');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__review={reviewShiftDate,reviewWindow,reviewPct,reviewAggregate,reviewCompare,reviewExpectedSessions,reviewInsightModel,reviewNextFocus};',ctx);
  const h=ctx.__review, J=x=>JSON.parse(JSON.stringify(x));

  assert.equal(h.reviewShiftDate('2026-10-05',-6),'2026-09-29');
  assert.deepEqual(J(h.reviewWindow('2026-10-05',7)),{
    days:7,start:'2026-09-29',end:'2026-10-05',
    previousStart:'2026-09-22',previousEnd:'2026-09-28'
  });
  assert.deepEqual(J(h.reviewWindow('2026-10-05',28)),{
    days:28,start:'2026-09-08',end:'2026-10-05',
    previousStart:'2026-08-11',previousEnd:'2026-09-07'
  });

  const current=J(h.reviewAggregate([
    {sets:12,volume:3600,rirSum:18,rirCount:12,prs:2,exerciseNames:['Press','Remo']},
    {sets:10,volume:3000,rirSum:15,rirCount:10,prs:1,exerciseNames:['Press','Curl']}
  ]));
  const previous=J(h.reviewAggregate([
    {sets:10,volume:2800,rirSum:20,rirCount:10,prs:0,exerciseNames:['Press','Remo']}
  ]));
  assert.equal(current.sessions,2);
  assert.equal(current.sets,22);
  assert.equal(current.volume,6600);
  assert.equal(current.prs,3);
  assert.equal(current.exercises,3);
  assert.ok(current.avgRir>1.49&&current.avgRir<1.51);
  assert.equal(current.volumePerSession,3300);

  const cmp=J(h.reviewCompare(current,previous));
  assert.equal(cmp.sessions,100);
  assert.ok(cmp.sets>119&&cmp.sets<121);
  assert.ok(cmp.volumePerSession>17&&cmp.volumePerSession<18);
  assert.equal(cmp.prs,null);
  assert.equal(h.reviewExpectedSessions(6,7),6);
  assert.equal(h.reviewExpectedSessions(6,28),24);

  const good=J(h.reviewInsightModel({
    current:{sessions:6,prs:2},
    previous:{sessions:5,prs:0},
    deltas:{volumePerSession:8},
    expected:6,
    plan:{due:5,completed:5,missed:0},
    topImproving:{name:'Press',deltaPct:5},
    topAttention:null
  }));
  assert.ok(good.some(x=>x.title==='Consistencia sólida'));
  assert.ok(good.some(x=>x.title==='Plan cumplido hasta hoy'));
  assert.ok(good.some(x=>x.title==='Hubo progreso medible'));
  assert.equal(h.reviewNextFocus({current:{sessions:6,prs:2},expected:6,plan:{missed:0},topImproving:{name:'Press'}}).kind,'positive');

  const warning=J(h.reviewInsightModel({
    current:{sessions:2,prs:0},
    previous:{sessions:5,prs:1},
    deltas:{volumePerSession:-20},
    expected:6,
    plan:{due:4,completed:2,missed:2},
    topImproving:null,
    topAttention:{name:'Remo',down:true,deltaPct:-4}
  }));
  assert.ok(warning.some(x=>x.title==='Consistencia por recuperar'));
  assert.ok(warning.some(x=>x.title==='Plan semanal incompleto'));
  assert.ok(warning.some(x=>x.title==='Rendimiento a revisar'));
  const focus=J(h.reviewNextFocus({current:{sessions:2,prs:0},expected:6,plan:{missed:2},topAttention:{name:'Remo',down:true}}));
  assert.equal(focus.title,'Prioriza el plan antes de cambiar volumen');
}

// ===== Weekly Schedule & Planned vs Actual (v6.7.0) =====
{
  const src=read('js/schedule.js');
  const a=src.indexOf('// <schedule-helpers>'), z=src.indexOf('// </schedule-helpers>');
  assert.ok(a>=0&&z>a,'faltan los helpers puros del Weekly Schedule v6.7');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__schedule={scheduleDayForDate,schedulePlanForDate,scheduleTemplateForDate,scheduleHasPlan,scheduleShiftDate,scheduleWeekDates,scheduleAllocateCounts,scheduleBuildTemplate,scheduleStatus};',ctx);
  const h=ctx.__schedule, J=x=>JSON.parse(JSON.stringify(x));

  assert.equal(h.scheduleDayForDate('2026-10-05'),1);
  assert.deepEqual(J(h.scheduleWeekDates('2026-10-07')),['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);

  const plan={template:{'1':'Push','2':'Pull','3':'Legs','4':'Push','5':'Pull','6':'Legs','0':'Descanso'},overrides:{'2026-10-08':'Descanso','2026-10-11':'Push'}};
  assert.equal(h.schedulePlanForDate(plan,'2026-10-05'),'Push');
  assert.equal(h.schedulePlanForDate(plan,'2026-10-08'),'Descanso');
  assert.equal(h.schedulePlanForDate(plan,'2026-10-11'),'Push');
  assert.equal(h.scheduleTemplateForDate(plan,'2026-10-11'),'Descanso');
  assert.equal(h.scheduleHasPlan(plan),true);

  const counts=J(h.scheduleAllocateCounts({Push:2,Pull:2,Legs:2},6));
  assert.deepEqual(counts,{Push:2,Pull:2,Legs:2});
  const tpl=J(h.scheduleBuildTemplate({Push:2,Pull:2,Legs:2}));
  assert.deepEqual(tpl,{'0':'Descanso','1':'Push','2':'Pull','3':'Legs','4':'Push','5':'Pull','6':'Legs'});

  const tpl5=J(h.scheduleBuildTemplate({Push:1.5,Pull:1.5,Legs:2}));
  assert.equal(Object.values(tpl5).filter(x=>x!=='Descanso').length,5);

  assert.equal(h.scheduleStatus('Push','Push',true,'2026-10-05','2026-10-05'),'completed');
  assert.equal(h.scheduleStatus('Push','Pull',true,'2026-10-05','2026-10-05'),'changed');
  assert.equal(h.scheduleStatus('Push','',false,'2026-10-04','2026-10-05'),'missed');
  assert.equal(h.scheduleStatus('Push','',false,'2026-10-05','2026-10-05'),'today');
  assert.equal(h.scheduleStatus('Descanso','Push',true,'2026-10-05','2026-10-05'),'extra');
}

// ===== Planning Workspace (v6.6.0) =====
{
  const src=read('js/planning.js');
  const a=src.indexOf('// <planning-helpers>'), z=src.indexOf('// </planning-helpers>');
  assert.ok(a>=0&&z>a,'faltan los helpers puros del Planning Workspace v6.6');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__plan={planningClampFrequency,planningDefaultFrequencies,planningMedian,planningComputePlan,planningBalanceSignals,planningRoutineMuscleMap,planningRoutineDelta};',ctx);
  const p=ctx.__plan, J=x=>JSON.parse(JSON.stringify(x));

  assert.equal(p.planningClampFrequency(1.24),1);
  assert.equal(p.planningClampFrequency(1.26),1.5);
  assert.equal(p.planningClampFrequency(99),7);

  const defaults=J(p.planningDefaultFrequencies(['Push','Pull','Legs'],6));
  assert.deepEqual(defaults,{Push:2,Pull:2,Legs:2});
  const defaults5=J(p.planningDefaultFrequencies(['Push','Pull','Legs'],5));
  assert.equal(defaults5.Push+defaults5.Pull+defaults5.Legs,5);

  const routines={
    Push:[
      {name:'Press',sets:3,muscle:'Pecho'},
      {name:'Aperturas',sets:3,muscle:'Pecho'},
      {name:'Laterales',sets:3,muscle:'Hombros'}
    ],
    Pull:[
      {name:'Jalón',sets:3,muscle:'Espalda'},
      {name:'Remo',sets:3,muscle:'Espalda'},
      {name:'Curl',sets:3,muscle:'Brazos'}
    ],
    Legs:[
      {name:'Hack',sets:3,muscle:'Piernas'},
      {name:'Prensa',sets:3,muscle:'Piernas'}
    ]
  };
  const plan=J(p.planningComputePlan(routines,{Push:2,Pull:2,Legs:2}));
  assert.equal(plan.totalSessions,6);
  assert.equal(plan.totalSets,48);
  const pecho=plan.muscles.find(x=>x.muscle==='Pecho');
  const espalda=plan.muscles.find(x=>x.muscle==='Espalda');
  assert.equal(pecho.sets,12);
  assert.equal(pecho.frequency,2,'la frecuencia muscular cuenta sesiones, no ejercicios');
  assert.equal(espalda.sets,12);
  assert.equal(plan.routineStats.find(x=>x.name==='Push').weeklySets,18);

  const signals=J(p.planningBalanceSignals({
    totalSessions:6,
    medianSets:10,
    muscles:[
      {muscle:'Pecho',sets:20,frequency:2},
      {muscle:'Espalda',sets:10,frequency:2},
      {muscle:'Brazos',sets:4,frequency:2},
      {muscle:'Otros',sets:6,frequency:1}
    ]
  },6));
  assert.ok(signals.some(x=>x.kind==='high'));
  assert.ok(signals.some(x=>x.kind==='low'));
  assert.ok(signals.some(x=>x.title==='Ejercicios sin clasificar'));

  const delta=J(p.planningRoutineDelta(
    [{name:'Press',sets:3,muscle:'Pecho'},{name:'Aperturas',sets:3,muscle:'Pecho'},{name:'Laterales',sets:3,muscle:'Hombros'}],
    [{name:'Press',sets:4,muscle:'Pecho'},{name:'Aperturas',sets:3,muscle:'Pecho'},{name:'Laterales',sets:3,muscle:'Hombros'}],
    2
  ));
  assert.equal(delta.beforeTotal,9);
  assert.equal(delta.afterTotal,10);
  assert.equal(delta.totalDelta,1);
  assert.equal(delta.weeklyDelta,2);
  assert.deepEqual(delta.changes,[{muscle:'Pecho',beforeSets:6,afterSets:7,deltaSets:1,weeklyDelta:2}]);

  const unchanged=J(p.planningRoutineDelta(
    [{name:'Press',sets:3,muscle:'Pecho'}],
    [{name:'Press',sets:3,muscle:'Pecho'}],
    2
  ));
  assert.equal(unchanged.changes.length,0);
}

// ===== Training History & Compare (v6.5.0) =====
{
  const src=read('js/history.js');
  const a=src.indexOf('// <history-helpers>'), z=src.indexOf('// </history-helpers>');
  assert.ok(a>=0&&z>a,'faltan los helpers puros de Historial v6.5');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__hist={historyShiftDate,historyValidSet,historySessionRow,historyAggregate,historyPct,historyPeriodCompare};',ctx);
  const h=ctx.__hist, J=x=>JSON.parse(JSON.stringify(x));

  const entries=[
    {isCardio:false,name:'Press',sets:[
      {done:true,type:'warmup',weight:20,reps:10,rir:4},
      {done:true,type:'normal',weight:30,reps:10,rir:2},
      {done:true,type:'normal',weight:30,reps:9,rir:2}
    ]},
    {isCardio:false,name:'Remo',sets:[
      {done:true,type:'normal',weight:40,reps:10,rir:1}
    ]},
    {isCardio:true,name:'Caminadora',time:20,distance:2}
  ];
  const prs=[
    {date:'2026-10-05',name:'Press'},
    {date:'2026-10-05',name:'Remo'}
  ];

  let row=J(h.historySessionRow('2026-10-05',entries,'Push','','',prs));
  assert.equal(row.exercises,2);
  assert.equal(row.sets,3,'calentamiento no cuenta como serie de trabajo');
  assert.equal(row.volume,30*10+30*9+40*10);
  assert.equal(row.prs,2);
  assert.ok(row.avgRir>1.6&&row.avgRir<1.7);

  row=J(h.historySessionRow('2026-10-05',entries,'Push','','Press',prs));
  assert.equal(row.exercises,1);
  assert.equal(row.sets,2);
  assert.equal(row.prs,1);
  assert.equal(h.historySessionRow('2026-10-05',entries,'Push','Pull','',prs),null);

  const makeRow=(date,sets,volume,rir=2,exercise='Press')=>({
    date,routine:'Push',exerciseNames:[exercise],exercises:1,sets,volume,
    rirSum:rir*sets,rirCount:sets,avgRir:rir,prs:0
  });
  const rows=[
    makeRow('2026-08-15',3,900),
    makeRow('2026-09-01',3,960),
    makeRow('2026-09-15',3,1020),
    makeRow('2026-10-05',4,1400)
  ];
  assert.equal(h.historyShiftDate('2026-10-05',-27),'2026-09-08');
  const cmp=J(h.historyPeriodCompare(rows,4));
  assert.equal(cmp.current.sessions,2);
  assert.equal(cmp.previous.sessions,2);
  assert.equal(cmp.current.sets,7);
  assert.equal(cmp.previous.sets,6);
  assert.ok(cmp.deltas.volumePerSession>25);
  assert.equal(cmp.currentRows.at(-1).date,'2026-10-05');

  const noPrev=J(h.historyPeriodCompare([makeRow('2026-10-05',3,900)],4));
  assert.equal(noPrev.previous.sessions,0);
  assert.equal(noPrev.deltas.sessions,null);
}

// ===== Exercise Profile Analytics (v6.4.0) =====
{
  const src=read('js/logbook.js');
  const a=src.indexOf('// <exercise-profile-helpers>'), z=src.indexOf('// </exercise-profile-helpers>');
  assert.ok(a>=0&&z>a,'faltan los helpers puros del perfil de ejercicio');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__p={profileShiftDate,profileSessionSummary,exerciseWindowAggregate,profilePct,exercisePeriodComparison,exercisePrMilestones,exerciseTrendSignal};',ctx);
  const p=ctx.__p, J=x=>JSON.parse(JSON.stringify(x));
  const session=(date,weight,reps,rir=2,sets=3)=>({date,sets:Array.from({length:sets},()=>({weight,reps,rir}))});
  const sessions=[
    session('2026-08-15',30,10,2),
    session('2026-09-01',32,10,2),
    session('2026-09-15',34,10,2),
    session('2026-10-05',38,10,1.5)
  ];

  assert.equal(p.profileShiftDate('2026-10-05',-27),'2026-09-08');
  const cmp=J(p.exercisePeriodComparison(sessions,28));
  assert.equal(cmp.anchor,'2026-10-05');
  assert.equal(cmp.current.sessions,2);
  assert.equal(cmp.previous.sessions,2);
  assert.ok(cmp.deltas.bestWeight>18&&cmp.deltas.bestWeight<19);
  assert.ok(cmp.deltas.bestE1rm>18&&cmp.deltas.bestE1rm<19);
  assert.equal(p.exerciseTrendSignal(cmp).kind,'positive');

  const milestones=J(p.exercisePrMilestones(sessions));
  assert.equal(milestones.length,4);
  assert.equal(milestones.at(-1).weight,38);
  assert.ok(milestones.at(-1).e1rm>50);

  const empty=J(p.exercisePeriodComparison([session('2026-10-05',30,8)],28));
  assert.equal(empty.previous.sessions,0);
  assert.equal(p.exerciseTrendSignal(empty).kind,'neutral');
}

// ===== Entrenamiento: series pendientes y descanso estimado (v6.1.2) =====
{
  const src=read('js/training.js');
  const a=src.indexOf('// <train-helpers>'), z=src.indexOf('// </train-helpers>');
  assert.ok(a>=0&&z>a,'faltan los marcadores de helpers de entrenamiento');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__h={isDone,trainPendingSets,trainApplyEnd,trainRestResult};',ctx);
  const h=ctx.__h, J=x=>JSON.parse(JSON.stringify(x));
  const mkEntries=()=>[{id:1,isCardio:false,name:'Remo',trainingDraft:true,sets:[
    {reps:'8',weight:50,done:true},{reps:'8',weight:50,done:false},{reps:'-',weight:0,done:false}]}];

  assert.equal(h.trainPendingSets(mkEntries()).length,1,'detecta 1 serie con reps sin marcar');

  let es=mkEntries(), r=h.trainApplyEnd(es,false);
  assert.deepEqual(J(r),{saved:0,dropped:1});
  assert.equal(es[0].sets.length,1,'descartar conserva solo la serie hecha');
  assert.equal(es[0].trainingDraft,undefined);

  es=mkEntries(); r=h.trainApplyEnd(es,true);
  assert.equal(r.saved,1);
  assert.equal(es[0].sets.length,2,'guardar conserva hecha + pendiente y descarta la vacía');
  assert.ok(es[0].sets.every(s=>s.done===true));
  assert.deepEqual(J(es[0].sets.map(s=>s.setNumber)),[1,2]);

  es=mkEntries(); r=h.trainApplyEnd(es,undefined);
  assert.equal(r.saved,0,'sin decisión explícita nunca se guarda automáticamente');

  assert.equal(h.trainRestResult(0,3000,true),null,'descansos de menos de 5 s se ignoran');
  assert.deepEqual(J(h.trainRestResult(0,95000,true)),{restUsed:95,estimated:false});
  assert.deepEqual(J(h.trainRestResult(0,95000,false)),{restUsed:95,estimated:true});
}

console.log('LiftEngine regression OK · settings/goals · metrics · training intelligence · cierre de entrenamiento');
