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
}

// ===== Planning Workspace (v6.6.0) =====
{
  const src=read('js/planning.js');
  const a=src.indexOf('// <planning-helpers>'), z=src.indexOf('// </planning-helpers>');
  assert.ok(a>=0&&z>a,'faltan los helpers puros del Planning Workspace v6.6');
  const ctx=context();
  vm.runInContext(src.slice(a,z)+'\nglobalThis.__plan={planningClampFrequency,planningDefaultFrequencies,planningMedian,planningComputePlan,planningBalanceSignals};',ctx);
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
