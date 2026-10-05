// LiftEngine · registro de entrenamientos y motor de progresión
'use strict';
function todayStr(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function fmtDate(s){return new Date(s+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}
function toast(t){
  const el=document.getElementById('toast'), text=String(t||'');
  el.textContent=text;el.style.display='block';
  clearTimeout(window.tt);
  const duration=Math.min(5200,Math.max(2200,1400+text.length*28));
  window.tt=setTimeout(()=>el.style.display='none',duration);
}

window.switchTab = function(id,btn){
  if(typeof window.closeAppDialog==='function') window.closeAppDialog(false);
  const panel=document.getElementById(id); if(!panel)return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));panel.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-selected','false');x.tabIndex=-1});
  if(btn){btn.classList.add('active');btn.setAttribute('aria-selected','true');btn.tabIndex=0;}
  if(id==='resumen')renderDashboard();
  if(id==='calendario')renderCalendar();
  if(id==='progreso'){
    populateExercises();
    ensureProgressExerciseSelection();
    updateChart();
    renderBodyWeights();
    renderAnalytics();
  }
  if(id==='rutinas'){renderRoutines();}
  if(btn){
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});
  }
}

window.setLogType = function(type){
  logType=type;document.getElementById('weightsForm').style.display=type==='pesas'?'block':'none';document.getElementById('cardioForm').style.display=type==='cardio'?'block':'none';
  document.getElementById('weightMode').classList.toggle('active',type==='pesas');document.getElementById('cardioMode').classList.toggle('active',type==='cardio')
}

window.addSet = function(values=null){
  let v = values || {};
  if (!values && setCounter > 0) {
      const rows = document.querySelectorAll('.set-row');
      if (rows.length > 0) {
          const lastRow = rows[rows.length - 1];
          v.reps = lastRow.querySelector('.set-reps').value;
          v.weight = lastRow.querySelector('.set-weight').value;
          v.rir = lastRow.querySelector('.set-rir').value;
          v.rest = lastRow.querySelector('.set-rest').value;
          v.type = lastRow.querySelector('.set-type')?.value || 'normal';
      }
  }

  setCounter++;const d=document.createElement('div');d.className='set-row';d.id=`set-${setCounter}`; if(v.restUsed) d.dataset.restused=v.restUsed; if(v.restEstimated) d.dataset.restest='1';
  d.innerHTML=`
    <div class="set-main">
        <div class="set-num">${setCounter}</div>
        <div><label>Reps</label><input class="set-reps" type="number" min="0" value="${escapeHtml(v.reps||'')}"></div>
        <div><label>Peso (${unitLabel()})</label><input class="set-weight" type="number" min="0" step="0.5" value="${escapeHtml(v.weight||'')}"></div>
        <div><label>RIR</label><input class="set-rir" type="number" min="0" max="10" value="${escapeHtml(v.rir||'')}"></div>
    </div>
    <div class="set-sub">
        <div><label>Tipo</label><select class="set-type"><option value="normal" ${normalizeSetType(v.type)==='normal'?'selected':''}>Normal</option><option value="warmup" ${normalizeSetType(v.type)==='warmup'?'selected':''}>Calentamiento</option><option value="failure" ${normalizeSetType(v.type)==='failure'?'selected':''}>Al fallo</option></select></div>
        <div><label>Descanso</label><input class="set-rest" value="${escapeHtml(normalizeRestLabel(v.rest||''))}" placeholder="120 s"></div>
        <button class="timer-btn" onclick="quickStartTimer(this)" title="Iniciar Cronómetro" aria-label="Iniciar cronómetro"><svg class="ic" aria-hidden="true"><use href="#i-timer"/></svg></button>
        <button class="remove-set" aria-label="Quitar serie" onclick="removeSet(this)"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
    </div>`;
  document.getElementById('setsContainer').appendChild(d);
}

window.removeSet = function(b){b.closest('.set-row').remove();renumberSets()}
function renumberSets(){document.querySelectorAll('.set-row').forEach((r,i)=>r.querySelector('.set-num').textContent=i+1);setCounter=document.querySelectorAll('.set-row').length}

window.clearEntry = function(){
  document.getElementById('exerciseName').value='';document.getElementById('setsContainer').innerHTML='';setCounter=0;addSet();
  document.getElementById('cardioTime').value='';document.getElementById('cardioDist').value='';
  window.editingId = null;
  document.getElementById('saveEntryBtn').innerText = 'Guardar registro';
}

window.saveCategory = function(){const d=document.getElementById('routineDate').value,c=document.getElementById('dayCategory').value;if(c)categories[d]=c;else delete categories[d];saveToFirebase({days:[d]});renderCalendar()}

window.saveNote = function(){
  const d=document.getElementById('routineDate').value; if(!d) return;
  const t=document.getElementById('sessionNote').value.trim();
  if(t) notes[d]=t; else delete notes[d];
  markDayDirty(d,{cloud:true,local:true});
  queuePersistLocal(80);
  clearTimeout(window.noteT); window.noteT=setTimeout(()=>saveToFirebase(),900);
}

window.loadTemplate = async function() {
    const date = document.getElementById('routineDate').value;
    const cat = document.getElementById('dayCategory').value;
    if (!cat || !customRoutines[cat]) { toast('Selecciona una rutina de tu lista.'); return; }
    if (!data[date]) data[date] = [];
    if (data[date].length > 0 && !(await appConfirm('¿Añadir la rutina completa de todos modos?',{title:'Añadir rutina',confirmText:'Añadir'}))) return;

    customRoutines[cat].forEach(exInfo => {
        const name = exInfo.name;
        const setsCount = exInfo.sets;
        const rir = exInfo.rir;
        const rest = exInfo.rest;
        
        const sets = [];
        for(let i=1; i<=setsCount; i++) {
            sets.push({setNumber: i, reps: '-', weight: 0, rir: rir, rest: rest, type:'normal',done:false});
        }
        data[date].push({id: Date.now() + Math.random(), isCardio: false, name: name, sets: sets, trainingDraft:true});
    });
    markDayDirty(date,{cloud:false,local:true}); persistLocal(); loadDay(); renderDashboard(); populateExercises(); updateChart();
    toast('Rutina cargada como borrador local.');
}

window.saveEntry = function(){
  const date=document.getElementById('routineDate').value;if(!date)return;
  if(!data[date])data[date]=[];
  
  let newEntry = null;
  if(logType==='pesas'){
    let name=document.getElementById('exerciseName').value.trim();if(!name){toast('Ingresa el nombre del ejercicio');return}
    const sets=[...document.querySelectorAll('.set-row')].map((r,i)=>({
        setNumber:i+1,
        reps:r.querySelector('.set-reps').value||'-',
        weight:toKg(r.querySelector('.set-weight').value),
        rir:r.querySelector('.set-rir').value||'-',
        rest:r.querySelector('.set-rest').value||'-', type:normalizeSetType(r.querySelector('.set-type')?.value),...(r.dataset.restused?{restUsed:Number(r.dataset.restused)}:{}),...(r.dataset.restused&&r.dataset.restest==='1'?{restEstimated:true}:{})
    })).filter(s=>(parseFloat(s.reps)||0)>0);
    if(!sets.length){toast('Registra al menos una serie con repeticiones');return}
    newEntry = {id: window.editingId || Date.now(), isCardio:false, name:normalizeName(name), sets:sets};
  }else{
    const time=document.getElementById('cardioTime').value,dist=document.getElementById('cardioDist').value;
    if(!time&&!dist){toast('Registra tiempo o distancia');return}
    newEntry = {id: window.editingId || Date.now(), isCardio:true, name:document.getElementById('cardioType').value, time:time||'-', distance:dist||'-'};
  }
  
  if(window.editingId) {
      const idx = data[date].findIndex(x => x.id === window.editingId);
      if(idx !== -1) data[date][idx] = newEntry; else data[date].push(newEntry);
  } else {
      data[date].push(newEntry);
  }

  const sessionNote=document.getElementById('sessionNote').value.trim(); if(sessionNote) notes[date]=sessionNote; else delete notes[date];
  
  const wasEditing=!!window.editingId; saveToFirebase({days:[date]}); clearEntry(); loadDay(); renderDashboard(); populateExercises(); updateChart(); toast(wasEditing ? 'Registro actualizado' : 'Guardado OK');
}

window.editEntry = function(date, id) {
    const entry = data[date].find(x => x.id === id);
    if(!entry) return;
    
    if(entry.isCardio) {
        setLogType('cardio');
        document.getElementById('cardioType').value = entry.name;
        document.getElementById('cardioTime').value = entry.time !== '-' ? entry.time : '';
        document.getElementById('cardioDist').value = entry.distance !== '-' ? entry.distance : '';
    } else {
        setLogType('pesas');
        document.getElementById('exerciseName').value = entry.name;
        document.getElementById('setsContainer').innerHTML = '';
        setCounter = 0;
        entry.sets.forEach(s => addSet({
            reps: s.reps!=='-'?s.reps:'', 
            weight: fromKg(s.weight) ? Math.round(fromKg(s.weight)*10)/10 : '', 
            rir: s.rir, 
            rest: s.rest, type:s.type, restUsed: s.restUsed, restEstimated: s.restEstimated
        }));
    }
    window.editingId = id;
    document.getElementById('saveEntryBtn').innerText = 'Actualizar registro';
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function normalizeName(n){
  const clean=String(n).replace(/\s+/g,' ').trim();
  const key=clean.toLowerCase();
  // Usa el diccionario dinámico de alias (Fase 3)
  if(customAliases[key]) return customAliases[key];
  const found=getAllExercises().find(x=>x.toLowerCase()===key);
  return found||clean.charAt(0).toUpperCase()+clean.slice(1);
}
function getAllExercises(){
  const s=new Set(routineExercises.filter(n=>!customAliases[n.toLowerCase()]));
  Object.values(customRoutines).forEach(rows=>(rows||[]).forEach(r=>{if(r&&r.name)s.add(r.name)}));
  Object.values(data).forEach(arr=>(arr||[]).forEach(e=>{if(!e.isCardio)s.add(e.name)}));
  return [...s].sort();
}
function migrateNames(){
  const snap=JSON.stringify({data,customRoutines,customMuscles,exerciseNotes});
  let changed=false, settingsChanged=false; const changedDates=new Set();
  const mapped=n=>customAliases[String(n||'').trim().toLowerCase()]||String(n||'').trim();
  Object.entries(data).forEach(([date,arr])=>(arr||[]).forEach(e=>{
    if(!e||e.isCardio)return; const a=mapped(e.name);
    if(a&&a!==e.name){e.name=a;changed=true;changedDates.add(date);}
  }));
  Object.values(customRoutines).forEach(rows=>(rows||[]).forEach(r=>{if(!r)return;const a=mapped(r.name);if(a&&a!==r.name){r.name=a;changed=true;settingsChanged=true;}}));
  Object.keys(exerciseNotes).forEach(k=>{const a=mapped(k);if(a&&a!==k){if(!exerciseNotes[a])exerciseNotes[a]=exerciseNotes[k];delete exerciseNotes[k];changed=true;settingsChanged=true;}});
  Object.keys(customMuscles).forEach(group=>{
    const before=customMuscles[group]||[], after=[...new Set(before.map(mapped).filter(Boolean))];
    if(JSON.stringify(before)!==JSON.stringify(after)){customMuscles[group]=after;changed=true;settingsChanged=true;}
  });
  if(changed){
    try{ if(!localStorage.getItem('gymBackupBeforeRename')) localStorage.setItem('gymBackupBeforeRename',snap); }catch(e){}
    changedDates.forEach(date=>markDayDirty(date,{cloud:true,local:true}));
    if(settingsChanged) markSettingsDirty({cloud:true,local:true});
  }
  return changed;
}
function populateExercises(){
  const all=getAllExercises();
  document.getElementById('exerciseList').innerHTML=all.map(x=>`<option value="${escapeHtml(x)}">`).join('');
  const sel=document.getElementById('chartExercise');
  const cur=sel.value;
  sel.innerHTML='<option value="">-- Elige un ejercicio --</option>'+all.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
  if(all.includes(cur))sel.value=cur;
  if(typeof renderDesktopExerciseBrowser==='function')renderDesktopExerciseBrowser();
}
function mostRecentExerciseName(){
  const dates=Object.keys(data).sort().reverse();
  for(const date of dates){
    const rows=(data[date]||[]).filter(e=>!e.isCardio&&entryHasData(e));
    if(rows.length)return rows[rows.length-1].name||'';
  }
  return '';
}
function ensureProgressExerciseSelection(){
  const sel=document.getElementById('chartExercise');
  if(!sel||sel.value)return false;
  const name=mostRecentExerciseName();
  if(!name)return false;
  const option=[...sel.options].find(o=>o.value===name||o.textContent===name);
  if(!option)return false;
  sel.value=name;
  return true;
}

window.selectDesktopExercise=function(name){
  const sel=document.getElementById('chartExercise');
  if(!sel)return;
  const option=[...sel.options].find(o=>o.value===name||o.textContent===name);
  if(!option){toast('Ese ejercicio ya no está disponible');return;}
  sel.value=name;
  updateChart();
}
window.renderDesktopExerciseBrowser=function(){
  const list=document.getElementById('desktopExerciseList'), count=document.getElementById('desktopExerciseCount');
  if(!list)return;
  const q=String(document.getElementById('desktopExerciseSearch')?.value||'').trim().toLocaleLowerCase('es-MX');
  const selected=document.getElementById('chartExercise')?.value||'';
  const all=getAllExercises().map(name=>{
    const sessions=getExerciseSessions(name);
    const last=sessions.at(-1)||null;
    return {name,sessions:sessions.length,lastDate:last?.date||''};
  }).filter(x=>!q||x.name.toLocaleLowerCase('es-MX').includes(q))
    .sort((a,b)=>(b.lastDate||'').localeCompare(a.lastDate||'')||a.name.localeCompare(b.name,'es'));
  if(count){
    const total=getAllExercises().length;
    count.textContent=q?`${all.length} de ${total}`:`${total} ejercicio${total===1?'':'s'}`;
  }
  if(!all.length){
    list.innerHTML='<div class="desktop-exercise-empty"><b>Sin coincidencias</b><span>Prueba con otro nombre.</span></div>';
    return;
  }
  list.innerHTML=all.map(x=>`
    <button class="desktop-exercise-item ${x.name===selected?'active':''}" type="button" data-name="${escapeHtml(x.name)}" onclick="selectDesktopExercise(this.dataset.name)" ${x.name===selected?'aria-current="true"':''}>
      <span class="desktop-exercise-item-name">${escapeHtml(x.name)}</span>
      <span class="desktop-exercise-item-meta">${x.sessions?`${x.sessions} sesión${x.sessions===1?'':'es'} · ${fmtDate(x.lastDate)}`:'Sin sesiones'}</span>
    </button>`).join('');
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function loadDay(){
  const date=document.getElementById('routineDate').value;
  updateCategorySelect();
  document.getElementById('dayCategory').value=categories[date]||'';
  document.getElementById('sessionNote').value=notes[date]||'';
  const arr=data[date]||[];const box=document.getElementById('dailyLog');
  if(!arr.length){box.innerHTML='<div class="empty"><b>Sin registros este día</b><span>Usa el formulario de arriba para añadir un ejercicio, cardio o una nota de sesión.</span></div>';return}
  box.innerHTML=arr.map(e=>renderExerciseCard(e,date)).join('')
}

function renderExerciseCard(e,date){
  if(e.isCardio)return `<div class="exercise-card"><div class="exercise-title"><span>${ic('pulse')} ${escapeHtml(e.name)}</span><span class="badge">Cardio</span></div><div class="muted">Tiempo ${escapeHtml(e.time)} min &nbsp; · &nbsp; Distancia ${escapeHtml(e.distance)} km</div><div class="action-group"><button class="btn-edit-sm" onclick="editEntry('${date}',${e.id})">${ic('edit')} Editar</button><button class="btn-delete-sm" onclick="deleteEntry('${date}',${e.id})">${ic('trash')}</button></div></div>`;
  const volDisplay = Math.round(fromKg(sessionVolume(e))*10)/10;
  return `<div class="exercise-card"><div class="exercise-title"><span>${ic('dumbbell')} ${escapeHtml(e.name)}${e.substitutedFrom?` <small class="muted">· sustituyó a ${escapeHtml(e.substitutedFrom)}</small>`:''}</span><span class="badge">${volDisplay} ${unitLabel()}</span></div>${e.sets.map((s,i)=>`<div class="set-log ${isWarmupSet(s)?'warmup-set':''}"><span>S${i+1}</span><span><b>${escapeHtml(s.reps)}</b> reps</span><span><b>${Math.round(fromKg(s.weight)*10)/10}</b>${unitLabel()}</span><span>${isWarmupSet(s)?'Calent.':isFailureSet(s)?'Fallo':'RIR '+escapeHtml(s.rir)}</span><span>${escapeHtml(s.restUsed?(s.restEstimated?'≈ ':'')+fmtRest(s.restUsed):normalizeRestLabel(s.rest))}</span></div>`).join('')}<div class="action-group"><button class="btn-edit-sm" onclick="editEntry('${date}',${e.id})">${ic('edit')} Editar</button><button class="btn-delete-sm" onclick="deleteEntry('${date}',${e.id})">${ic('trash')}</button></div></div>`
}

window.deleteEntry = async function(date,id){if(!(await appConfirm('¿Eliminar este registro?',{title:'Eliminar registro',confirmText:'Eliminar',danger:true})))return;data[date]=(data[date]||[]).filter(x=>x.id!==id);if(!data[date].length)delete data[date];saveToFirebase({days:[date]});loadDay();renderDashboard();populateExercises();updateChart();toast('Registro eliminado')}
function setHasData(s){return !!s && s.done!==false && (parseFloat(s.reps)||0)>0}
function setCountsForHistory(s){return setHasData(s)&&!isWarmupSet(s)}
function sessionVolume(e){return (e.sets||[]).filter(setCountsForHistory).reduce((a,s)=>a+(parseFloat(s.reps)||0)*(parseFloat(s.weight)||0),0)}
function entryHasData(e){return e.isCardio?((parseFloat(e.time)||0)>0||(parseFloat(e.distance)||0)>0):(e.sets||[]).some(setHasData)}
function allWeightEntries(name){const out=[];Object.keys(data).sort().forEach(date=>{if((data[date]||[]).some(e=>!e.isCardio&&e.name===name&&entryHasData(e)))out.push({date})});return out}
function latestExerciseEntry(name,beforeDate=''){
  const dates=allWeightEntries(name).map(x=>x.date).filter(d=>!beforeDate||d<beforeDate);
  for(let i=dates.length-1;i>=0;i--){
    const date=dates[i];
    const entries=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name&&entryHasData(e));
    if(entries.length)return {date,e:entries[entries.length-1]};
  }
  return null;
}
function exerciseLoadMode(name){ return /asistid|assisted|contrapeso/i.test(String(name||''))?'assistance':'external'; }
window.latestExerciseEntry=latestExerciseEntry;
window.exerciseLoadMode=exerciseLoadMode;
function e1rm(weight,reps){weight=parseFloat(weight);reps=parseFloat(reps);if(!weight||!reps||reps<=0)return 0;return weight*(1+reps/30)} // Epley
function bestForDate(name,date,metric){
  const es=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name);if(!es.length)return 0;
  if(metric==='weight')return Math.max(0,...es.flatMap(e=>e.sets.filter(setCountsForHistory).map(s=>parseFloat(s.weight)||0)));
  if(metric==='volume')return es.reduce((a,e)=>a+sessionVolume(e),0);
  return Math.max(0,...es.flatMap(e=>e.sets.filter(setCountsForHistory).map(s=>e1rm(s.weight,s.reps))))
}

window.updateChart = function(){
  const sel=document.getElementById('chartExercise');
  if(!sel)return;
  // La selección automática debe funcionar tanto al entrar a Progreso como
  // después de un refreshAll()/sincronización. Antes solo se ejecutaba al
  // cambiar de pestaña, por lo que el gráfico podía conservar datos mientras
  // el panel de inteligencia quedaba en estado "Selecciona un ejercicio".
  if(!sel.value) ensureProgressExerciseSelection();
  const name=sel.value;
  if(!name){
    if(chart){chart.destroy();chart=null}
    const detail=document.getElementById('exerciseDetail');
    if(detail)detail.innerHTML='<div class="empty">Selecciona un ejercicio.</div>';
    renderProgressionPanel();
    return;
  }
  const metric=document.getElementById('chartMetric').value, entries=allWeightEntries(name), labels=[],vals=[];
  entries.forEach(x=>{const v=bestForDate(name,x.date,metric);if(v){labels.push(fmtDate(x.date));vals.push(Math.round(fromKg(v)*10)/10)}});
  if(chart)chart.destroy();
  
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  
  chart=makeChart(document.getElementById('progressChart'),{type:'line',data:{labels,datasets:[{label:`${metric==='weight'?'Peso máximo':metric==='volume'?'Volumen':'e1RM estimado'} (${unitLabel()})`,data:vals,borderColor:accentColor,backgroundColor:accentColor+'20',fill:true,tension:.28,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false,grid:{color:cssVar('--line')}},x:{grid:{color:cssVar('--line')}}}}});
  // Mantén independientes los bloques de Progreso: un error visual en el
  // resumen del ejercicio no debe impedir que aparezca la inteligencia.
  try{renderExerciseDetail(name)}catch(err){
    console.error('LiftEngine: no se pudo renderizar el detalle del ejercicio',err);
    const detail=document.getElementById('exerciseDetail');
    if(detail)detail.innerHTML='<div class="empty">No se pudo mostrar el resumen del ejercicio.</div>';
  }
  try{renderProgressionPanel()}catch(err){
    console.error('LiftEngine: no se pudo renderizar la inteligencia de entrenamiento',err);
    const panel=document.getElementById('progressionPanel');
    if(panel)panel.innerHTML='<div class="empty">No se pudo generar la recomendación. Cambia de ejercicio o recarga la vista.</div>';
  }
}

function parseRepRange(range){
  const nums=String(range||'').match(/\d+/g)||[];
  if(!nums.length)return null;
  const min=parseInt(nums[0],10), max=parseInt(nums[nums.length-1],10);
  return {min,max:Math.max(min,max)};
}
function targetFromRoutineRow(row,routine){
  if(!row) return null;
  return {routine,sets:row.sets,repRange:parseRepRange(row.reps),rir:String(row.rir),rest:row.rest};
}
function routineTargetFor(name,routineName=null,date=null){
  const candidates=[];
  Object.entries(customRoutines).forEach(([routine,rows])=>{
    const row=(rows||[]).find(r=>r.name===name); if(row)candidates.push(targetFromRoutineRow(row,routine));
  });
  if(!candidates.length)return null;
  const preferred=routineName || (date&&categories[date]) || ((typeof train!=='undefined'&&train&&train.routine)?train.routine:'');
  if(preferred){const exact=candidates.find(x=>x.routine===preferred);if(exact)return exact;}
  if(candidates.length===1)return candidates[0];
  // Sin contexto explícito, usa la rutina asociada a la sesión más reciente
  // del ejercicio. Si no existe, no inventamos un objetivo único.
  const recent=Object.keys(data).sort().reverse().find(d=>(data[d]||[]).some(e=>!e.isCardio&&e.name===name&&entryHasData(e))&&categories[d]&&candidates.some(x=>x.routine===categories[d]));
  if(recent){const exact=candidates.find(x=>x.routine===categories[recent]);if(exact)return exact;}
  return {ambiguous:true,routines:candidates.map(x=>x.routine),candidates};
}
function getExerciseSessions(name){
  const out=[];
  Object.keys(data).sort().forEach(date=>{
    const sets=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name).flatMap(e=>(e.sets||[]).filter(setCountsForHistory).map(s=>({
      reps:parseFloat(s.reps)||0,
      weight:parseFloat(s.weight)||0,
      rir:s.rir==='-'||s.rir===''?null:parseFloat(s.rir),
      rest:s.rest
    }))).filter(s=>s.reps>0);
    if(sets.length) out.push({date,sets});
  });
  return out;
}
function summarizeSession(session){
  const valid=session.sets.filter(s=>s.reps>0&&s.weight>0);
  const bestWeight=valid.length?Math.max(...valid.map(s=>s.weight)):0;
  const bestReps=valid.length?Math.max(...valid.map(s=>s.reps)):0;
  const volume=valid.reduce((a,s)=>a+s.reps*s.weight,0);
  const bestSet=valid.slice().sort((a,b)=>((b.weight*b.reps)-(a.weight*a.reps)))[0]||null;
  const e1=valid.reduce((best,s)=>Math.max(best,e1rm(s.weight,s.reps)),0);
  const rirVals=valid.filter(s=>s.rir!==null).map(s=>s.rir);
  const avgRir=rirVals.length?rirVals.reduce((a,b)=>a+b,0)/rirVals.length:null;
  return {bestWeight,bestReps,volume,e1rm:e1,avgRir,sets:valid.length};
}
function formatKgValue(v, signed=false){
  if(v==null || v==='' || Number.isNaN(Number(v))) return '—';
  const n=Math.round(fromKg(Number(v))*10)/10;
  const prefix=signed && n>0?'+':'';
  return `${prefix}${n} ${unitLabel()}`;
}
function parseRirRange(value){
  const nums=String(value||'').match(/\d+(?:\.\d+)?/g)||[];
  if(!nums.length)return null;
  const a=parseFloat(nums[0]),b=nums.length>1?parseFloat(nums[nums.length-1]):a;
  return {min:Math.min(a,b),max:Math.max(a,b),target:(a+b)/2};
}
function progressionIncrementKg(weight){
  const w=Math.abs(parseFloat(weight)||0);
  if(w<=10)return 1.25;
  if(w<=40)return 2.5;
  if(w<=80)return 2.5;
  return 5;
}
function progressionRecommendation(name,sessions,target){
  const last=sessions[sessions.length-1];
  if(!last)return {title:'Sin historial suficiente',text:'Registra al menos una sesión para empezar a recibir una referencia de progresión.',className:'progression-neutral',action:'reference'};
  const sum=summarizeSession(last);
  const valid=last.sets.filter(s=>s.weight>0&&s.reps>0);
  if(!valid.length)return {title:'Completa al menos una serie',text:'No hay una serie con peso y repeticiones suficientes para evaluar la progresión.',className:'progression-neutral',action:'hold'};
  if(!target||!target.repRange){
    const prev=sessions.length>1?summarizeSession(sessions[sessions.length-2]):null;
    const e1Trend=prev&&prev.e1rm?sum.e1rm-prev.e1rm:0;
    if(e1Trend>0)return {title:'Rendimiento en mejora',text:`Tu e1RM subió ${formatKgValue(e1Trend,true)} respecto a la sesión anterior. Mantén la carga y busca repetir o superar ligeramente el rendimiento.`,className:'progression-positive',action:'hold'};
    return {title:'Usa la última sesión como referencia',text:`Tu último registro fue ${sum.bestWeight?formatKgValue(sum.bestWeight):'sin peso'} con hasta ${sum.bestReps||'—'} reps. Intenta igualar o superar ligeramente el rendimiento manteniendo una técnica sólida.`,className:'progression-neutral',action:'hold'};
  }
  const min=target.repRange.min,max=target.repRange.max;
  const rirRange=parseRirRange(target.rir), avgRir=sum.avgRir;
  const allAtTop=valid.every(s=>s.reps>=max);
  const allAtLeastMin=valid.every(s=>s.reps>=min);
  const avgReps=valid.reduce((a,s)=>a+s.reps,0)/valid.length;
  const belowMin=valid.filter(s=>s.reps<min).length;
  const topWeight=sum.bestWeight;
  const inc=progressionIncrementKg(topWeight);
  const rirTooLow=rirRange&&avgRir!==null&&avgRir<Math.max(0,rirRange.min-0.5);
  const rirComfortable=rirRange&&avgRir!==null&&avgRir>=rirRange.target-0.25;
  if(allAtTop&&!rirTooLow&&(!rirRange||avgRir===null||rirComfortable)){
    return {title:'Siguiente paso: subir el peso',text:`Completaste ${max} reps en todas las series${avgRir!==null?` con RIR promedio ${avgRir.toFixed(1)}`:''}. Prueba +${formatKgValue(inc)} y vuelve hacia ${min}–${max} reps.`,className:'progression-positive',action:'increase',increment:inc};
  }
  if(allAtTop&&rirTooLow){
    return {title:'Mantén el peso: el esfuerzo fue alto',text:`Llegaste al máximo del rango, pero el RIR promedio (${avgRir.toFixed(1)}) quedó por debajo del objetivo. Repite la carga y prioriza una ejecución sólida antes de subir.`,className:'progression-neutral',action:'hold'};
  }
  if(allAtLeastMin){
    const weak=valid.filter(s=>s.reps<max).length;
    const rirText=avgRir!==null?` RIR promedio ${avgRir.toFixed(1)}.`:'';
    return {title:'Siguiente paso: sumar repeticiones',text:`Ya estás dentro del rango en todas las series. Mantén ${formatKgValue(topWeight)} y busca +1 repetición en ${weak===1?'la serie que falta para llegar al máximo':'alguna de las series'}.${rirText}`,className:'progression-neutral',action:'reps'};
  }
  if(belowMin>0&&avgRir!==null&&rirTooLow){
    return {title:'Reduce ligeramente la carga',text:`Hay ${belowMin} serie${belowMin>1?'s':''} por debajo del mínimo y el RIR promedio fue bajo. Considera reducir aproximadamente 5% y vuelve a construir dentro de ${min}–${max} reps.`,className:'progression-warning',action:'decrease',decrease:0.05};
  }
  return {title:'Siguiente paso: consolidar el peso',text:`Aún faltan repeticiones para completar el rango en todas las series. Mantén ${formatKgValue(topWeight)} y busca acercarte a ${min} reps con buena ejecución.`,className:'progression-neutral',action:'hold'};
}
function renderProgressionPanel(){
  const box=document.getElementById('progressionPanel');
  const sel=document.getElementById('chartExercise');
  if(!box||!sel)return;
  const name=sel.value;
  if(!name){box.innerHTML='<div class="empty">Selecciona un ejercicio para ver su progresión.</div>';return}
  const sessions=getExerciseSessions(name);
  if(!sessions.length){box.innerHTML='<div class="empty">Todavía no hay registros para este ejercicio.</div>';return}
  const last=sessions[sessions.length-1];
  const target=routineTargetFor(name,categories[last.date]||null,last.date);
  const lastSum=summarizeSession(last);
  const prev=sessions.length>1?summarizeSession(sessions[sessions.length-2]):null;
  const rec=progressionRecommendation(name,sessions,target);
  const intel=typeof window.getTrainingIntelligence==='function'?window.getTrainingIntelligence(name,{sessions,target,routineName:categories[last.date]||null,date:last.date}):null;
  const targetText=target?.ambiguous?`Objetivo variable entre: ${escapeHtml(target.routines.join(', '))}`:(target&&target.repRange?`${target.repRange.min}–${target.repRange.max} reps · RIR ${escapeHtml(target.rir)}`:'Sin rango definido en rutina');
  const allRecords=getExerciseRecords(name);
  const repPr=latestRepPR(name);
  const recordCards=[
    {label:'PR de peso',value:allRecords.weight?formatKgValue(allRecords.weight):'—',date:allRecords.weightDate},
    {label:'Último PR de reps @ carga',value:repPr?`${repPr.value} reps${repPr.weight>0?` @ ${formatKgValue(repPr.weight)}`:''}`:'—',date:repPr?.date},
    {label:'PR de e1RM',value:allRecords.e1rm?formatKgValue(allRecords.e1rm):'—',date:allRecords.e1rmDate}
  ].map(r=>`<div class="record-mini"><div class="label">${r.label}</div><div class="value">${r.value}</div><small>${r.date?fmtDate(r.date):'Sin registro comparable'}</small></div>`).join('');
  const weightDelta=prev&&lastSum.bestWeight&&prev.bestWeight?lastSum.bestWeight-prev.bestWeight:0;
  const e1Delta=prev&&lastSum.e1rm&&prev.e1rm?lastSum.e1rm-prev.e1rm:0;
  const deltaText=prev&&weightDelta!==0?`${weightDelta>0?'+':''}${Math.round(fromKg(weightDelta)*10)/10} ${unitLabel()}`:'—';
  const e1DeltaText=prev&&e1Delta!==0?`${e1Delta>0?'+':''}${Math.round(fromKg(e1Delta)*10)/10} ${unitLabel()}`:'—';
  const rows=sessions.slice(-5).reverse().map((session)=>{
    const sum=summarizeSession(session);
    return `<tr><td>${fmtDate(session.date)}</td><td>${sum.sets}</td><td>${sum.bestWeight?formatKgValue(sum.bestWeight):'—'}</td><td>${sum.bestReps||'—'}</td><td>${sum.e1rm?formatKgValue(sum.e1rm):'—'}</td></tr>`;
  }).join('');
  box.innerHTML=`
    <div class="progression-grid">
      <div class="progression-stat"><div class="label">Última sesión</div><div class="value">${fmtDate(last.date)}</div></div>
      <div class="progression-stat"><div class="label">Mejor peso</div><div class="value">${formatKgValue(lastSum.bestWeight)}</div></div>
      <div class="progression-stat"><div class="label">Mejor e1RM</div><div class="value">${formatKgValue(lastSum.e1rm)}</div></div>
      <div class="progression-stat"><div class="label">Reps máximas</div><div class="value">${lastSum.bestReps||'—'}</div></div>
      <div class="progression-stat"><div class="label">Cambio de peso</div><div class="value">${deltaText}</div></div>
      <div class="progression-stat"><div class="label">Cambio e1RM</div><div class="value">${e1DeltaText}</div></div>
    </div>
    <div class="record-grid">${recordCards}</div>
    ${intel&&typeof window.renderIntelligenceCard==='function'?window.renderIntelligenceCard(intel,{whyAction:'openCurrentIntelligenceWhy()'}):`<div class="progression-message"><strong class="${rec.className}">${escapeHtml(rec.title)}</strong><span>${escapeHtml(rec.text)}</span></div>`}
    <div class="muted" style="font-size:.78rem;margin-bottom:8px"><b>Objetivo de rutina:</b> ${targetText}${target&&!target.ambiguous?` · ${target.sets} series · descanso ${escapeHtml(normalizeRestLabel(target.rest))}`:''}</div>
    <div style="overflow:auto"><table class="progression-table"><thead><tr><th>Fecha</th><th>Series</th><th>Mejor peso</th><th>Máx. reps</th><th>e1RM</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderExerciseDetail(name){
  const dates=allWeightEntries(name);
  const box=document.getElementById('exerciseDetail');
  if(!box)return;
  if(!dates.length){box.innerHTML='<div class="empty">Sin registros.</div>';return}

  let maxW=0,bestE=0,totalVol=0;
  dates.forEach(({date})=>{
    const entries=(data[date]||[]).filter(e=>!e.isCardio&&e.name===name&&entryHasData(e));
    entries.forEach(entry=>{
      (entry.sets||[]).filter(setCountsForHistory).forEach(set=>{
        maxW=Math.max(maxW,parseFloat(set.weight)||0);
        bestE=Math.max(bestE,e1rm(set.weight,set.reps));
      });
      totalVol+=sessionVolume(entry);
    });
  });

  const last=dates[dates.length-1],prev=dates.length>1?dates[dates.length-2]:null;
  let delta='—';
  if(prev){
    const a=fromKg(bestForDate(name,last.date,'weight'));
    const b=fromKg(bestForDate(name,prev.date,'weight'));
    delta=(a-b>=0?'+':'')+(a-b).toFixed(1)+' '+unitLabel();
  }
  box.innerHTML=`<div class="stat-grid"><div class="stat"><div class="label">Peso máximo</div><div class="value">${Math.round(fromKg(maxW)*10)/10} ${unitLabel()}</div></div><div class="stat"><div class="label">e1RM máximo</div><div class="value">${Math.round(fromKg(bestE)*10)/10} ${unitLabel()}</div></div><div class="stat"><div class="label">Sesiones</div><div class="value">${dates.length}</div></div><div class="stat"><div class="label">Cambio vs anterior</div><div class="value">${delta}</div></div></div><p class="muted" style="margin-bottom:0">Volumen acumulado: <b style="color:var(--accent)">${Math.round(fromKg(totalVol)).toLocaleString()} ${unitLabel()}</b>.</p>`;
}

