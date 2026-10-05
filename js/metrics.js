// LiftEngine · v6 metrics engine: definiciones compartidas de métricas derivadas
'use strict';

function metricsDate(s){ return new Date(String(s)+'T12:00:00'); }
function metricsWeekStart(d=new Date()){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()-((x.getDay()+6)%7));
  return x;
}
function metricsYmd(x){return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;}

function metricsWorkoutOnDate(date){
  return (data[date]||[]).some(e=>!e.isCardio&&entryHasData(e));
}
function metricsWorkoutDates(startKey='',endKey=''){
  return Object.keys(data).filter(d=>
    (!startKey||d>=startKey)&&(!endKey||d<=endKey)&&metricsWorkoutOnDate(d)
  ).sort();
}

function metricsWeekSnapshot(start){
  const days=[...Array(7)].map((_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return metricsYmd(d);});
  let sessions=0,sets=0,volume=0;
  days.forEach(date=>{
    const entries=(data[date]||[]).filter(e=>!e.isCardio&&entryHasData(e));
    if(entries.length)sessions++;
    entries.forEach(e=>{
      sets+=(e.sets||[]).filter(setCountsForWork).length;
      volume+=sessionVolume(e);
    });
  });
  return {days,sessions,sets,volume};
}

function metricsPeriod(weeks=8){
  const n=[4,8,12].includes(Number(weeks))?Number(weeks):8;
  const end=metricsDate(todayStr());
  const start=metricsWeekStart(end);
  start.setDate(start.getDate()-(n-1)*7);
  return {start,end,startKey:metricsYmd(start),endKey:metricsYmd(end),weeks:n};
}

function metricsCoverage(period){
  const all=metricsWorkoutDates();
  if(!all.length) return {...period,coverageStart:period.startKey,coverageDays:0,coverageWeeks:0};
  const first=all.find(d=>d>=period.startKey&&d<=period.endKey) || (all[0]>period.endKey?null:period.startKey);
  if(!first) return {...period,coverageStart:period.startKey,coverageDays:0,coverageWeeks:0};
  const startKey=first>period.startKey?first:period.startKey;
  const days=Math.max(1,Math.floor((metricsDate(period.endKey)-metricsDate(startKey))/86400000)+1);
  return {...period,coverageStart:startKey,coverageDays:days,coverageWeeks:days/7};
}

function metricsExpectedSessions(coverage,target=weeklySessionTarget){
  if(!coverage?.coverageDays)return 0;
  return Math.max(1,Number(target)||1)*(coverage.coverageDays/7);
}

function metricsAdherence(weeks=8,target=weeklySessionTarget){
  const period=metricsPeriod(weeks);
  const coverage=metricsCoverage(period);
  const dates=coverage.coverageDays?metricsWorkoutDates(coverage.coverageStart,period.endKey):[];
  const expected=metricsExpectedSessions(coverage,target);
  const raw=expected?dates.length/expected*100:0;
  return {period,coverage,dates,sessions:dates.length,expected,rawPct:raw,pct:Math.min(100,Math.max(0,raw))};
}

function metricsExerciseTrend(name,startKey,endKey){
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

function metricsMuscleStats(coverage){
  const out={};
  Object.keys(data).filter(d=>d>=coverage.coverageStart&&d<=coverage.endKey).sort().forEach(date=>{
    (data[date]||[]).forEach(e=>{
      if(e.isCardio||!entryHasData(e))return;
      const sets=(e.sets||[]).filter(setCountsForWork);
      if(!sets.length)return;
      const muscle=getMuscleGroup(e.name);
      if(!out[muscle])out[muscle]={sets:0,days:new Set(),rir:[]};
      out[muscle].sets+=sets.length;
      out[muscle].days.add(date);
      sets.forEach(s=>{const r=parseFloat(s.rir);if(Number.isFinite(r))out[muscle].rir.push(r);});
    });
  });
  const w=Math.max(coverage.coverageWeeks,1/7);
  return Object.entries(out).map(([muscle,x])=>({
    muscle,
    sets:x.sets,
    setsPerWeek:x.sets/w,
    daysPerWeek:x.days.size/w,
    avgRir:x.rir.length?x.rir.reduce((a,b)=>a+b,0)/x.rir.length:null
  })).sort((a,b)=>b.setsPerWeek-a.setsPerWeek);
}

function metricsBodyDelta(arr,key,days){
  const valid=[...arr].filter(x=>x&&x.date&&x[key]!=null).sort((a,b)=>a.date.localeCompare(b.date));
  if(valid.length<2)return null;
  const latest=valid.at(-1),cutoff=metricsDate(latest.date);
  cutoff.setDate(cutoff.getDate()-days);
  const candidates=valid.filter(x=>metricsDate(x.date)<=cutoff);
  const base=candidates.at(-1)||valid[0];
  if(base===latest)return null;
  const actualDays=Math.round((metricsDate(latest.date)-metricsDate(base.date))/86400000);
  return {delta:latest[key]-base[key],from:base.date,to:latest.date,actualDays,fullWindow:actualDays>=Math.max(1,days-3)};
}
