// LiftEngine · dashboard, PR, calendario y composición corporal
'use strict';
// Fase 3: Consulta el diccionario dinámico de músculos
function getMuscleGroup(name) {
    for(const [group, exercises] of Object.entries(customMuscles)) {
        if(exercises.includes(name)) return group;
    }
    return 'Otros';
}

function weekStart(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function ymd(x){return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function renderWeek(){
  const box=document.getElementById('weekBody'); if(!box) return;
  const ws=weekStart(), days=[...Array(7)].map((_,i)=>{const x=new Date(ws);x.setDate(ws.getDate()+i);return ymd(x)});
  const lifted=d=>(data[d]||[]).some(e=>!e.isCardio&&entryHasData(e));
  const trained=days.filter(lifted), sets={};
  days.forEach(d=>(data[d]||[]).forEach(e=>{ if(e.isCardio) return; const n=e.sets.filter(setCountsForWork).length; if(n){const m=getMuscleGroup(e.name); sets[m]=(sets[m]||0)+n;} }));
  const wk=new Set(Object.keys(data).filter(lifted).map(d=>ymd(weekStart(new Date(d+'T12:00:00')))));
  let streak=0, cur=new Date(ws); if(!wk.has(ymd(cur))) cur.setDate(cur.getDate()-7);
  while(wk.has(ymd(cur))){ streak++; cur.setDate(cur.getDate()-7); }
  document.getElementById('weekBadge').textContent=streak?`Racha ${streak} sem`:'Sin racha';
  const rows=Object.entries(sets).sort((a,b)=>b[1]-a[1]), mx=Math.max(10,...rows.map(r=>r[1]));
  box.innerHTML=`<div class="week-days">${days.map((d,i)=>`<div class="wd ${trained.includes(d)?'on':''} ${d===todayStr()?'today':''}">${'LMXJVSD'[i]}</div>`).join('')}</div>
    <div class="muted" style="font-size:var(--fs-sm)"><b style="color:var(--text)">${trained.length}</b> entrenamientos esta semana · series por músculo:</div>
    ${rows.length?rows.map(([m,n])=>`<div class="mbar"><span>${escapeHtml(m)}</span><i><b style="width:${Math.round(n/mx*100)}%"></b></i><span>${n}</span></div>`).join(''):'<div class="empty" style="padding:12px">Aún no hay series esta semana.</div>'}`;
}
function weekPerformanceSnapshot(start){
  const days=[...Array(7)].map((_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return ymd(d)});
  let sessions=0,sets=0,volume=0;
  days.forEach(date=>{
    const entries=(data[date]||[]).filter(e=>!e.isCardio&&entryHasData(e));
    if(entries.length)sessions++;
    entries.forEach(e=>{sets+=(e.sets||[]).filter(setCountsForWork).length;volume+=sessionVolume(e)});
  });
  return {days,sessions,sets,volume};
}
function dashboardDelta(current,previous,formatter=v=>String(v)){
  const delta=current-previous;
  if(!previous&&!current)return {value:formatter(current),sub:'Sin actividad en ambas semanas',cls:''};
  if(!previous)return {value:formatter(current),sub:'Primera semana con datos comparables',cls:'positive'};
  const pct=Math.round((delta/previous)*100);
  return {value:formatter(current),sub:`${delta>=0?'+':''}${pct}% vs. semana anterior`,cls:delta>0?'positive':delta<0?'negative':''};
}
function latestMetricDelta(arr,key,days){
  const valid=[...arr].filter(x=>x&&x.date&&x[key]!=null).sort((a,b)=>a.date.localeCompare(b.date));
  if(valid.length<2)return null;
  const latest=valid.at(-1), cutoff=new Date(latest.date+'T12:00:00');cutoff.setDate(cutoff.getDate()-days);
  const candidates=valid.filter(x=>new Date(x.date+'T12:00:00')<=cutoff);
  const base=candidates.at(-1)||valid[0];
  if(base===latest)return null;
  const actualDays=Math.round((new Date(latest.date+'T12:00:00')-new Date(base.date+'T12:00:00'))/86400000);
  return {delta:latest[key]-base[key],from:base.date,to:latest.date,actualDays,fullWindow:actualDays>=Math.max(1,days-3)};
}
function renderPerformanceOverview(prs=null){
  const box=document.getElementById('performanceOverview');if(!box)return;
  const currentStart=weekStart(),previousStart=new Date(currentStart);previousStart.setDate(previousStart.getDate()-7);
  const cur=weekPerformanceSnapshot(currentStart),prev=weekPerformanceSnapshot(previousStart);
  const sessions=dashboardDelta(cur.sessions,prev.sessions,v=>String(v));
  const sets=dashboardDelta(cur.sets,prev.sets,v=>String(v));
  const volume=dashboardDelta(cur.volume,prev.volume,v=>`${Math.round(fromKg(v)).toLocaleString()} ${unitLabel()}`);
  const weekPRs=(prs||findPRs()).filter(p=>cur.days.includes(p.date));
  const uniquePRExercises=new Set(weekPRs.map(p=>p.name)).size;
  const weight30=latestMetricDelta(weights,'weight',30),waist30=latestMetricDelta(measurements,'waist',30);
  const body=[];
  if(weight30){const label=weight30.fullWindow?'Peso 30 d':`Peso desde ${fmtDate(weight30.from)}`;body.push(`${label}: <b>${weight30.delta>=0?'+':''}${Math.round(fromKg(weight30.delta)*10)/10} ${unitLabel()}</b>`);}
  if(waist30){const label=waist30.fullWindow?'Cintura 30 d':`Cintura desde ${fmtDate(waist30.from)}`;body.push(`${label}: <b>${waist30.delta>=0?'+':''}${waist30.delta.toFixed(1)} cm</b>`);}
  let headline='Aún faltan datos para comparar tu rendimiento semanal.';
  if(cur.sessions){
    if(weekPRs.length)headline=`Esta semana lograste <b>${weekPRs.length} PR${weekPRs.length===1?'':'s'}</b> en ${uniquePRExercises} ejercicio${uniquePRExercises===1?'':'s'}.`;
    else if(prev.sessions&&cur.volume>prev.volume)headline='Esta semana acumulaste más volumen que la anterior, aunque todavía no registras un PR nuevo.';
    else if(prev.sessions&&cur.sessions>=prev.sessions)headline='Mantienes o mejoras tu frecuencia de entrenamiento respecto a la semana anterior.';
    else headline='Ya tienes actividad esta semana; sigue registrando para construir una comparación más útil.';
  }
  box.innerHTML=`<div class="performance-hero"><div><span class="eyebrow">¿Estoy progresando?</span><div class="performance-headline">${headline}</div></div><div class="performance-pr"><b>${weekPRs.length}</b><span>PR esta semana</span></div></div>
    <div class="performance-grid">
      <div class="performance-stat"><span>Sesiones</span><b>${sessions.value}</b><small class="${sessions.cls}">${sessions.sub}</small></div>
      <div class="performance-stat"><span>Series</span><b>${sets.value}</b><small class="${sets.cls}">${sets.sub}</small></div>
      <div class="performance-stat"><span>Volumen</span><b>${volume.value}</b><small class="${volume.cls}">${volume.sub}</small></div>
      <div class="performance-stat"><span>Récords</span><b>${weekPRs.length}</b><small>${uniquePRExercises?`${uniquePRExercises} ejercicio${uniquePRExercises===1?'':'s'} con mejora`:'Sin PR nuevos esta semana'}</small></div>
    </div>
    ${body.length?`<div class="body-trend-strip"><span>Composición corporal</span><div>${body.join(' <i>·</i> ')}</div></div>`:''}`;
}
function renderDashboard(){
  renderWeek();
  const prs=findPRs();
  renderPerformanceOverview(prs);
  const dates=Object.keys(data).filter(d=>(data[d]||[]).some(entryHasData)).sort(),workouts=dates.filter(d=>(data[d]||[]).some(e=>!e.isCardio&&entryHasData(e))).length;
  const allSets=dates.reduce((a,d)=>a+(data[d]||[]).reduce((b,e)=>b+(e.isCardio?0:e.sets.filter(setCountsForWork).length),0),0);
  const totalVolKg=dates.reduce((a,d)=>a+(data[d]||[]).reduce((b,e)=>b+(e.isCardio?0:sessionVolume(e)),0),0);
  const displayVol = currentUnit === 'lbs' ? totalVolKg * 2.20462 : totalVolKg;
  
  document.getElementById('stats').innerHTML=`<div class="stat"><div class="label">Días registrados</div><div class="value">${dates.length}</div></div><div class="stat"><div class="label">Entrenamientos</div><div class="value">${workouts}</div></div><div class="stat"><div class="label">Series</div><div class="value">${allSets}</div></div><div class="stat"><div class="label">Volumen total</div><div class="value">${currentUnit==='lbs' ? Math.round(displayVol).toLocaleString()+' lb' : Math.round(displayVol).toLocaleString()+' kg'}</div></div>`;
  
  const recent=dates.slice(-6).reverse();
  document.getElementById('recentWorkouts').innerHTML=recent.length?recent.map(d=>{
      const vol = Math.round(fromKg((data[d]||[]).reduce((a,e)=>a+(e.isCardio?0:sessionVolume(e)),0))).toLocaleString();
      return `<div class="progress-item" onclick="goToDate('${d}')" style="cursor:pointer"><div><b>${fmtDate(d)}</b><br><small>${escapeHtml(categories[d]||'Sin etiqueta')} · ${(data[d]||[]).filter(e=>!e.isCardio&&entryHasData(e)).length} ejercicios</small></div><b>${vol} ${unitLabel()}</b></div>`;
  }).join(''):'<div class="empty">Todavía no hay entrenamientos.</div>';
  
  document.getElementById('recentPRs').innerHTML=prs.slice(-9).reverse().map(p=>{
    const value=p.type==='reps'?`${p.value} reps`:formatKgValue(p.value);
    const detail=p.previous?(p.type==='reps'?`antes ${p.previous} reps`:`antes ${formatKgValue(p.previous)}`):'';
    return `<div class="progress-item"><div><b>${escapeHtml(p.name)}</b><br><small>${fmtDate(p.date)} · ${escapeHtml(p.label)}${detail?' · '+detail:''}</small></div><span class="pr">PR ${value}</span></div>`;
  }).join('')||'<div class="empty">Tus PR aparecerán aquí.</div>'

  let volByMuscle = {};
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  dates.forEach(d => {
      if(new Date(d+'T12:00:00') >= thirtyDaysAgo) {
          (data[d]||[]).forEach(e => {
              if(!e.isCardio) {
                  const m = getMuscleGroup(e.name);
                  volByMuscle[m] = (volByMuscle[m]||0) + sessionVolume(e);
              }
          });
      }
  });

  if(muscleChart) muscleChart.destroy();
  if(Object.keys(volByMuscle).length > 0) {
      const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      muscleChart = makeChart(document.getElementById('musclePieChart'), {
          type: 'doughnut',
          data: { labels: Object.keys(volByMuscle), datasets: [{ data: Object.values(volByMuscle).map(v=>Math.round(fromKg(v))), backgroundColor: [accentColor, '#78a9ff', '#f2c96d', '#ff7272', '#67d391', '#8f98a5', '#c792ea'], borderWidth:0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: cssVar('--text') } } } }
      });
  }
}

function getExerciseRecords(name,beforeDate=null){
  const best={weight:0,reps:0,e1rm:0,weightDate:'',repsDate:'',e1rmDate:''};
  Object.keys(data).sort().forEach(date=>{
    if(beforeDate&&date>=beforeDate)return;
    (data[date]||[]).filter(e=>!e.isCardio&&e.name===name).forEach(e=>(e.sets||[]).filter(setCountsForHistory).forEach(s=>{
      const w=parseFloat(s.weight)||0, r=parseFloat(s.reps)||0;
      if(w>best.weight){best.weight=w;best.weightDate=date}
      if(r>best.reps){best.reps=r;best.repsDate=date}
      const e1=e1rm(w,r);
      if(e1>best.e1rm){best.e1rm=e1;best.e1rmDate=date}
    }));
  });
  return best;
}
function sessionExerciseBest(e){
  const out={weight:0,reps:0,e1rm:0,weightSet:null,repsSet:null,e1rmSet:null};
  (e.sets||[]).filter(setCountsForHistory).forEach(s=>{
    const w=parseFloat(s.weight)||0,r=parseFloat(s.reps)||0;
    if(w>out.weight){out.weight=w;out.weightSet=s}
    if(r>out.reps){out.reps=r;out.repsSet=s}
    const e1=e1rm(w,r);
    if(e1>out.e1rm){out.e1rm=e1;out.e1rmSet=s}
  });
  return out;
}
function weightRepKey(weight){ return (Math.round((Number(weight)||0)*10)/10).toFixed(1); }
function findPRs(){
  const out=[], bestByExercise=new Map();
  Object.keys(data).sort().forEach(date=>{
    const today=new Map();
    (data[date]||[]).filter(e=>!e.isCardio&&entryHasData(e)).forEach(e=>{
      let cur=today.get(e.name); if(!cur){cur={weight:0,e1rm:0,repsByWeight:new Map()};today.set(e.name,cur);}
      (e.sets||[]).filter(setCountsForHistory).forEach(s=>{
        const w=parseFloat(s.weight)||0,r=parseFloat(s.reps)||0;if(r<=0)return;
        cur.weight=Math.max(cur.weight,w);cur.e1rm=Math.max(cur.e1rm,e1rm(w,r));
        const key=weightRepKey(w), old=cur.repsByWeight.get(key)||{reps:0,weight:w}; if(r>old.reps)cur.repsByWeight.set(key,{reps:r,weight:w});
      });
    });
    today.forEach((current,name)=>{
      let prev=bestByExercise.get(name);if(!prev)prev={weight:0,e1rm:0,repsByWeight:new Map()};
      if(prev.weight>0&&current.weight>prev.weight)out.push({name,date,type:'weight',label:'Peso',value:current.weight,previous:prev.weight});
      if(prev.e1rm>0&&current.e1rm>prev.e1rm)out.push({name,date,type:'e1RM',label:'e1RM',value:current.e1rm,previous:prev.e1rm});
      current.repsByWeight.forEach((rec,key)=>{
        const before=prev.repsByWeight.get(key);
        if(before&&before.reps>0&&rec.reps>before.reps)out.push({name,date,type:'reps',label:'Reps @ carga',value:rec.reps,previous:before.reps,weight:rec.weight});
        if(!before||rec.reps>before.reps)prev.repsByWeight.set(key,{...rec});
      });
      prev.weight=Math.max(prev.weight,current.weight);prev.e1rm=Math.max(prev.e1rm,current.e1rm);bestByExercise.set(name,prev);
    });
  });
  return out;
}
function latestRepPR(name){
  const a=findPRs().filter(p=>p.name===name&&p.type==='reps');return a[a.length-1]||null;
}
function latestPRsByExercise(name){
  return findPRs().filter(p=>p.name===name).slice(-20);
}

window.goToDate = function(d){document.getElementById('routineDate').value=d;loadDay();switchTab('registro',document.querySelectorAll('.tab-btn')[1])}
window.copyLastWorkout = async function(){
  const date=document.getElementById('routineDate').value;
  if(!date){toast('Selecciona una fecha');return}
  const dates=Object.keys(data).filter(d=>d<date&&data[d]&&data[d].some(e=>!e.isCardio&&entryHasData(e))).sort();
  const last=dates[dates.length-1];
  if(!last){toast('No hay sesión anterior');return}
  const source=(data[last]||[]).filter(e=>!e.isCardio&&entryHasData(e));
  if(!source.length){toast('La última sesión no tiene ejercicios válidos');return}
  if(data[date]?.length && !(await appConfirm(`El día ${fmtDate(date)} ya tiene registros.\n\nSe añadirán ${source.length} ejercicios de ${fmtDate(last)} sin borrar lo existente.`,{title:'Copiar última sesión',confirmText:'Añadir'}))) return;
  if(!data[date]) data[date]=[];
  source.forEach((e,exerciseIndex)=>{
    const cloned={
      id:Date.now()+Math.random()+exerciseIndex,
      isCardio:false,
      name:e.name,
      sets:(e.sets||[]).map((s,i)=>({
        setNumber:i+1,
        reps:'-',
        weight:Math.max(0,Number(s.weight)||0),
        rir:s.rir||'-',
        rest:s.rest||'-',
        type:normalizeSetType(s.type),
        done:false
      })),
      trainingDraft:true
    };
    if(cloned.sets.length) data[date].push(cloned);
  });
  markDayDirty(date,{cloud:false,local:true}); persistLocal();
  clearEntry();
  loadDay(); renderDashboard(); populateExercises(); updateChart();
  toast(`Copiados ${source.length} ejercicios como borrador local`);
}
window.loadLastPerformance = function(){
  const name=normalizeName(document.getElementById('exerciseName').value);if(!name)return;
  const entries=allWeightEntries(name);if(!entries.length){toast('No hay sesión anterior');return}
  const e=entries[entries.length-1].e;document.getElementById('setsContainer').innerHTML='';setCounter=0;e.sets.forEach(s=>addSet({reps:s.reps==='-'?'':s.reps,weight:Math.round(fromKg(s.weight)*10)/10,rir:s.rir==='-'?'':s.rir,rest:s.rest==='-'?'':s.rest,type:s.type}));
  toast('Series cargadas')
}
window.offerLastPerformance = function(){
  const raw=document.getElementById('exerciseName').value.trim();
  if(!raw) return;
  const name=normalizeName(raw);
  document.getElementById('exerciseName').value=name;
  const entries=allWeightEntries(name);
  if(!entries.length) return;
  const rows=document.querySelectorAll('.set-row');
  const empty=[...rows].every(r=>!r.querySelector('.set-reps').value && !r.querySelector('.set-weight').value);
  if(empty) loadLastPerformance();
  else {
    const last=entries[entries.length-1];
    toast('Última vez: '+fmtDate(last.date)+' · usa “Cargar anterior” para copiar');
  }
}

window.renderCalendar = function(){
  const grid=document.getElementById('calendarGrid'),name=document.getElementById('monthYear');grid.innerHTML='';name.textContent=new Date(currentYear,currentMonth,1).toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(x=>grid.innerHTML+=`<div class="day-name">${x}</div>`);
  const first=new Date(currentYear,currentMonth,1).getDay(),days=new Date(currentYear,currentMonth+1,0).getDate();for(let i=0;i<first;i++)grid.innerHTML+='<div class="cal-day empty"></div>';
  for(let i=1;i<=days;i++){const d=`${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`,has=!!(categories[d]||notes[d]||(data[d]||[]).some(entryHasData));const el=document.createElement('div');el.className='cal-day '+(has?'has-workout ':'')+(d===selectedDate?'selected ':'')+(d===todayStr()?'today':'');el.innerHTML=`<div class="cal-num">${i}</div><div class="cal-cat">${escapeHtml(categories[d]||((data[d]||[]).length?' Entreno':''))}</div>`;el.onclick=()=>{selectedDate=d;renderCalendar();showDaySummary(d)};grid.appendChild(el)}
  if(selectedDate)showDaySummary(selectedDate)
}

function showDaySummary(d){
  const box=document.getElementById('calendarSummary'),arr=(data[d]||[]).filter(entryHasData);
  const hasWorkout=arr.length||!!categories[d]||!!notes[d];
  if(!hasWorkout){
    box.innerHTML=`<div class="card calendar-summary-card"><div class="section-title"><div class="calendar-summary-heading"><span class="eyebrow">Día seleccionado</span><h2>${fmtDate(d)}</h2></div><button class="btn btn-secondary" onclick="goToDate('${d}')">Abrir registro</button></div><div class="empty"><b>Sin entrenamiento registrado</b><span>Puedes abrir Registro para añadir una sesión, una nota o asignar una rutina a este día.</span></div></div>`;
    return;
  }
  const strength=arr.filter(e=>!e.isCardio), totalSets=strength.reduce((n,e)=>n+(e.sets||[]).filter(setCountsForWork).length,0);
  const totalVolume=strength.reduce((n,e)=>n+sessionVolume(e),0);
  const category=categories[d]||'Sesión sin etiqueta';
  box.innerHTML=`<div class="card calendar-summary-card">
    <div class="section-title"><div class="calendar-summary-heading"><span class="eyebrow">Día seleccionado</span><h2>${fmtDate(d)}</h2><div class="calendar-summary-sub"><span>${escapeHtml(category)}</span>${totalSets?`<span>${totalSets} series</span>`:''}${totalVolume?`<span>${Math.round(fromKg(totalVolume))} ${unitLabel()} de volumen</span>`:''}</div></div><button class="btn btn-secondary" onclick="goToDate('${d}')">Abrir registro</button></div>
    ${notes[d]?`<div class="calendar-note"><b>Nota de sesión</b><span>${escapeHtml(notes[d])}</span></div>`:''}
    <div class="calendar-exercise-list">${arr.map(e=>e.isCardio?`<div class="progress-item"><b>${ic('pulse')} ${escapeHtml(e.name)}</b><span>${escapeHtml(e.time)} min</span></div>`:`<div class="progress-item"><b>${ic('dumbbell')} ${escapeHtml(e.name)}</b><span>${Math.round(fromKg(sessionVolume(e)))} ${unitLabel()} · ${(e.sets||[]).filter(setCountsForWork).length} series</span></div>`).join('')}</div>
    <div class="calendar-summary-actions"><button class="btn btn-danger full" onclick="deleteCalendarWorkout('${d}')">${ic('trash')} Eliminar entrenamiento completo</button></div>
  </div>`;
}

window.deleteCalendarWorkout=async function(d){
  if(!validDateKey(d))return;
  const hasWorkout=!!categories[d]||!!notes[d]||(data[d]||[]).some(entryHasData);
  if(!hasWorkout){toast('No hay entrenamiento que eliminar');return;}
  const active=typeof train!=='undefined'&&train&&train.date===d;
  const msg=`¿Eliminar el entrenamiento completo del ${fmtDate(d)}?\n\nSe borrarán ejercicios, series, etiqueta de rutina y nota de la sesión.${active?' También se cerrará el entrenamiento que está en curso.':''}\n\nEl peso corporal y las medidas de ese día se conservarán.`;
  if(!(await appConfirm(msg,{title:'Eliminar entrenamiento completo',confirmText:'Eliminar entrenamiento',cancelText:'Cancelar',danger:true})))return;
  if(typeof window.closeAppDialog==='function') window.closeAppDialog(false);
  if(active&&typeof window.discardTrainingForDate==='function')window.discardTrainingForDate(d,{silent:true});
  delete data[d];delete categories[d];delete notes[d];
  await saveToFirebase({days:[d]});
  selectedDate=d;
  if(typeof refreshAll==='function')refreshAll();else{renderCalendar();renderDashboard();populateExercises();updateChart();renderProgressionPanel();renderAnalytics();}
  showDaySummary(d);
  if(typeof window.closeAppDialog==='function') window.closeAppDialog(false);
  toast('Entrenamiento eliminado');
}
window.changeMonth = function(n){currentMonth+=n;if(currentMonth<0){currentMonth=11;currentYear--}if(currentMonth>11){currentMonth=0;currentYear++}renderCalendar()}
function avgWeight(days){
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-days);
    const vals=weights.filter(x=>new Date(x.date+'T00:00:00')>=cutoff).map(x=>x.weight);
    if(!vals.length)return null;
    return vals.reduce((a,b)=>a+b,0)/vals.length;
}
function weightChangeDays(days){
    const arr=[...weights].sort((a,b)=>a.date.localeCompare(b.date));
    if(arr.length<2)return null;
    const latest=arr[arr.length-1], latestMs=new Date(latest.date+'T00:00:00Z').getTime();
    const targetMs=latestMs-days*86400000, candidates=arr.slice(0,-1);
    let base=candidates[0];
    candidates.forEach(x=>{ if(Math.abs(new Date(x.date+'T00:00:00Z').getTime()-targetMs)<Math.abs(new Date(base.date+'T00:00:00Z').getTime()-targetMs)) base=x; });
    const span=Math.round((latestMs-new Date(base.date+'T00:00:00Z').getTime())/86400000);
    if(span<Math.max(7,Math.floor(days*0.7))) return null;
    return latest.weight-base.weight;
}
function latestMeasurement(){return [...measurements].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||null}
function firstMeasurement(){return [...measurements].sort((a,b)=>a.date.localeCompare(b.date))[0]||null}
function measurementDelta(key){const arr=[...measurements].filter(x=>x[key]!=null).sort((a,b)=>a.date.localeCompare(b.date));if(arr.length<2)return null;return arr.at(-1)[key]-arr[0][key]}
function trendClass(v){return v==null||Math.abs(v)<0.01?'trend-neutral':v<0?'trend-positive':'trend-negative'}
function formatDelta(v,unit='cm'){if(v==null)return '—';return `${v>0?'+':''}${v.toFixed(1)} ${unit}`}
function renderBodyCompSummary(){
    const box=document.getElementById('bodyCompSummary');if(!box)return;
    const arr=[...weights].sort((a,b)=>a.date.localeCompare(b.date));const latest=arr.at(-1);const avg7=avgWeight(7);const d30=weightChangeDays(30);const waist=measurementDelta('waist');
    const cards=[];
    cards.push(`<div class="bodycomp-stat"><div class="label">Peso actual</div><div class="value">${latest?formatKgValue(latest.weight):'—'}</div><div class="sub">${latest?fmtDate(latest.date):'Sin registro'}</div></div>`);
    cards.push(`<div class="bodycomp-stat"><div class="label">Promedio 7 días</div><div class="value">${avg7!=null?formatKgValue(avg7):'—'}</div><div class="sub">Promedio de mediciones disponibles</div></div>`);
    cards.push(`<div class="bodycomp-stat"><div class="label">Cambio 30 días</div><div class="value ${trendClass(d30)}">${d30!=null?formatKgValue(d30,true):'—'}</div><div class="sub">Respecto a una medición de referencia</div></div>`);
    cards.push(`<div class="bodycomp-stat"><div class="label">Cambio de cintura</div><div class="value ${trendClass(waist)}">${formatDelta(waist)}</div><div class="sub">Desde la primera medición</div></div>`);
    box.innerHTML=`<div class="bodycomp-grid">${cards.join('')}</div>`;
}
function renderBodyWeights(){
    const box=document.getElementById('bodyWeightList');const arr=[...weights].sort((a,b)=>a.date.localeCompare(b.date));
    box.innerHTML=arr.slice(-10).reverse().map(x=>`<div class="progress-item"><span>${fmtDate(x.date)}</span><span style="display:flex;align-items:center;gap:10px"><b style="color:var(--accent)">${Math.round(fromKg(x.weight)*10)/10} ${unitLabel()}</b><button class="btn-delete-sm" aria-label="Eliminar peso" onclick="deleteBodyWeight('${x.date}')">${ic('trash')}</button></span></div>`).join('')||'<div class="empty">Sin peso corporal registrado.</div>';
    if(bodyWeightChart) bodyWeightChart.destroy();
    const canvas=document.getElementById('bodyWeightChart');
    if(canvas && arr.length){
      const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      bodyWeightChart=makeChart(canvas,{type:'line',data:{labels:arr.map(x=>fmtDate(x.date)),datasets:[{label:`Peso (${unitLabel()})`,data:arr.map(x=>Math.round(fromKg(x.weight)*10)/10),borderColor:accent,backgroundColor:accent,fill:false,tension:.25,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}},y:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}}},plugins:{legend:{labels:{color:cssVar('--text')}}}}});
    }
    renderBodyCompSummary();renderMeasurementChart();renderBodyMeasurements();
}
function renderMeasurementChart(){
    const canvas=document.getElementById('measurementChart'),sel=document.getElementById('measurementMetric');if(!canvas||!sel)return;
    if(measurementChart)measurementChart.destroy();
    const key=sel.value||'waist';const arr=[...measurements].filter(x=>x[key]!=null).sort((a,b)=>a.date.localeCompare(b.date));
    if(!arr.length)return;
    const labels={waist:'Cintura',chest:'Pecho',arm:'Brazo',thigh:'Muslo',hip:'Cadera'};const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    measurementChart=makeChart(canvas,{type:'line',data:{labels:arr.map(x=>fmtDate(x.date)),datasets:[{label:`${labels[key]} (cm)`,data:arr.map(x=>x[key]),borderColor:accent,backgroundColor:accent,fill:false,tension:.25,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}},y:{ticks:{color:cssVar('--muted')},grid:{color:cssVar('--line')}}},plugins:{legend:{labels:{color:cssVar('--text')}}}}});
}
function renderBodyMeasurements(){
    const box=document.getElementById('bodyMeasurementList');if(!box)return;const arr=[...measurements].sort((a,b)=>b.date.localeCompare(a.date));
    if(!arr.length){box.innerHTML='<div class="empty">Sin medidas corporales registradas.</div>';return}
    box.innerHTML=`<div class="bodycomp-history"><table class="measurement-table"><thead><tr><th>Fecha</th><th>Cintura</th><th>Pecho</th><th>Brazo</th><th>Muslo</th><th>Cadera</th><th></th></tr></thead><tbody>${arr.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${x.waist!=null?x.waist.toFixed(1)+' cm':'—'}</td><td>${x.chest!=null?x.chest.toFixed(1)+' cm':'—'}</td><td>${x.arm!=null?x.arm.toFixed(1)+' cm':'—'}</td><td>${x.thigh!=null?x.thigh.toFixed(1)+' cm':'—'}</td><td>${x.hip!=null?x.hip.toFixed(1)+' cm':'—'}</td><td><button class="btn btn-secondary" style="padding:5px 8px" onclick="openMeasurementModal('${x.date}')">Editar</button> <button class="btn btn-secondary" style="padding:5px 8px" onclick="deleteMeasurement('${x.date}')">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`;
}
window.openMeasurementModal=function(existingDate=''){
  window.editingMeasurementDate=existingDate||'';
  const existing=measurements.find(x=>x.date===existingDate)||{};const date=existing.date||todayStr();
  document.getElementById('modal').innerHTML=`<h2>${existingDate?'Editar':'Registrar'} medidas corporales</h2><p class="muted">Mide en condiciones similares cada vez. Deja en blanco lo que no quieras registrar.</p><div class="grid grid-2"><div><label>Fecha</label><input id="mmDate" type="date" value="${date}"></div><div><label>Unidad</label><div class="muted" style="padding-top:10px">Centímetros (cm)</div></div></div><div class="measurement-grid" style="margin-top:12px"><div><label>Cintura</label><input id="mmWaist" type="number" step="0.1" min="0" value="${existing.waist??''}"></div><div><label>Pecho</label><input id="mmChest" type="number" step="0.1" min="0" value="${existing.chest??''}"></div><div><label>Brazo</label><input id="mmArm" type="number" step="0.1" min="0" value="${existing.arm??''}"></div><div><label>Muslo</label><input id="mmThigh" type="number" step="0.1" min="0" value="${existing.thigh??''}"></div><div><label>Cadera</label><input id="mmHip" type="number" step="0.1" min="0" value="${existing.hip??''}"></div></div><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveMeasurements()">Guardar</button></div>`;
  document.getElementById('modalBackdrop').classList.add('show');document.body.classList.add('modal-open');document.getElementById('modal').scrollTop=0;
}
window.saveMeasurements=function(){
  const date=document.getElementById('mmDate').value;if(!date)return;
  const vals={waist:'mmWaist',chest:'mmChest',arm:'mmArm',thigh:'mmThigh',hip:'mmHip'};const entry={date};let has=false;
  Object.entries(vals).forEach(([k,id])=>{const v=parseFloat(document.getElementById(id).value);if(Number.isFinite(v)&&v>0){entry[k]=Math.round(v*10)/10;has=true;}});
  if(!has){toast('Registra al menos una medida');return;}
  const original=window.editingMeasurementDate||'';
  measurements=measurements.filter(x=>x.date!==date && (!original||x.date!==original));measurements.push(entry);
  window.editingMeasurementDate='';saveToFirebase({days:[...new Set([date,original].filter(Boolean))]});closeModal();renderBodyWeights();toast('Medidas guardadas OK');
}
window.deleteMeasurement=async function(date){if(!(await appConfirm('¿Eliminar las medidas del '+fmtDate(date)+'?',{title:'Eliminar medición',confirmText:'Eliminar',danger:true})))return;measurements=measurements.filter(x=>x.date!==date);saveToFirebase({days:[date]});renderBodyWeights();toast('Medición eliminada')}

window.openWeightModal = function(){
    const modalEl=document.getElementById('modal');
    modalEl.innerHTML=`<h2>Registrar peso corporal</h2><div class="grid grid-2"><div><label>Fecha</label><input id="mwDate" type="date" value="${todayStr()}"></div><div><label>Peso (${unitLabel()})</label><input id="mwWeight" type="number" step="0.1" min="0"></div></div><div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveBodyWeight()">Guardar</button></div>`;
    modalEl.scrollTop = 0;
    modalEl.scrollLeft = 0;
    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => { modalEl.scrollTop = 0; modalEl.scrollLeft = 0; });
}
window.saveBodyWeight = function(){
    const date=document.getElementById('mwDate').value,w=parseFloat(document.getElementById('mwWeight').value);if(!date||!w)return;
    weights=weights.filter(x=>x.date!==date);weights.push({date,weight:toKg(w)});
    saveToFirebase({days:[date]}); closeModal(); renderBodyWeights(); toast('Peso guardado OK');
}

window.deleteBodyWeight = async function(date){
    if(!(await appConfirm('¿Eliminar el peso del '+fmtDate(date)+'?',{title:'Eliminar peso',confirmText:'Eliminar',danger:true}))) return;
    weights=weights.filter(x=>x.date!==date);
    saveToFirebase({days:[date]}); renderBodyWeights(); toast('Peso eliminado');
}

