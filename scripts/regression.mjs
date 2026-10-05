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
  assert.ok(adherence.pct>0&&adherence.pct<=100);

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

console.log('LiftEngine regression OK · settings/goals · metrics · training intelligence');
