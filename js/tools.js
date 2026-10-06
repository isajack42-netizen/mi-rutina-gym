// LiftEngine · calculadora, descansos, CSV, ajustes, catálogos y backups
'use strict';
window.openPlateCalc = function(targetValue=null) {
    const defaultTarget = targetValue!=null && Number.isFinite(Number(targetValue)) ? String(Math.round(Number(targetValue)*10)/10) : (currentUnit === 'lbs' ? '135' : '60');
    const defaultBar = currentUnit === 'lbs' ? '45' : '20';
    document.getElementById('modal').innerHTML = `
        <h2>Calculadora de Discos (${unitLabel()})</h2>
        <p class="muted">Discos necesarios por cada lado de la barra.</p>
        <div class="grid grid-2">
            <div><label>Peso Objetivo (${unitLabel()})</label><input type="number" id="calcTarget" value="${defaultTarget}"></div>
            <div><label>Peso Barra (${unitLabel()})</label><input type="number" id="calcBar" value="${defaultBar}"></div>
        </div>
        <button class="btn btn-primary full" style="margin-top:14px" onclick="calculatePlates()">Calcular Discos</button>
        <div id="calcResult" style="margin-top:15px; text-align:center; font-size:1.1rem; line-height:1.5;"></div>
        <div class="actions"><button class="btn btn-secondary full" onclick="closeModal()">Cerrar</button></div>
    `;
    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
}

window.calculatePlates = function() {
    const target = parseFloat(document.getElementById('calcTarget').value) || 0;
    const bar = parseFloat(document.getElementById('calcBar').value) || 0;
    if(target <= bar) { document.getElementById('calcResult').innerHTML = "<span class='muted'>El objetivo debe ser mayor a la barra.</span>"; return; }
    
    let perSide = (target - bar) / 2;
    const plates = currentUnit === 'lbs' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
    let res = [];
    plates.forEach(p => {
        let count = Math.floor(perSide / p);
        if(count > 0) { res.push(`<b>${count}</b> de <b>${p} ${unitLabel()}</b>`); perSide -= count * p; }
    });
    
    document.getElementById('calcResult').innerHTML = `<span style="color:var(--accent)">Por cada lado pon:</span><br>${res.join('<br>')}<br><small class="muted" style="font-size:0.8rem; display:block; margin-top:8px;">(Restante: ${perSide.toFixed(2)} ${unitLabel()})</small>`;
}

function parseRestSpec(raw){
  let s=String(raw||'').trim().toLowerCase().replace(/–|—/g,'-').replace(/\s+/g,' ');
  if(!s||s==='-') return null;
  const hasMin=/\bmin(?:uto|utos)?\b|\bmins?\b|\bm\b/.test(s);
  const hasSec=/\bseg(?:undo|undos)?\b|\bsecs?\b|\bs\b/.test(s);
  const parseToken=(token,unitHint='')=>{
    token=String(token).trim();
    if(/^\d{1,3}:\d{1,2}$/.test(token)){
      const [m,sec]=token.split(':').map(Number); return m*60+sec;
    }
    const n=parseFloat(token.replace(',','.')); if(!Number.isFinite(n)||n<=0)return null;
    if(unitHint==='min'||hasMin) return Math.round(n*60);
    if(unitHint==='sec'||hasSec) return Math.round(n);
    return n<=10?Math.round(n*60):Math.round(n);
  };
  const stripped=s.replace(/\b(min(?:uto|utos)?|mins?|m|seg(?:undo|undos)?|secs?|s)\b/g,'').trim();
  const parts=stripped.split(/\s*-\s*/).filter(Boolean);
  let vals=[];
  if(parts.length>=2){
    const unitHint=hasMin?'min':hasSec?'sec':'';
    vals=parts.slice(0,2).map(x=>parseToken(x,unitHint)).filter(Number.isFinite);
  }else{
    const token=parts[0]||stripped;
    const v=parseToken(token,hasMin?'min':hasSec?'sec':''); if(Number.isFinite(v)) vals=[v];
  }
  if(!vals.length) return null;
  const min=Math.min(...vals),max=Math.max(...vals);
  return {min,max};
}
function parseRestSeconds(raw){ return parseRestSpec(raw)?.min ?? 90; }
function normalizeRestLabel(raw){
  const spec=parseRestSpec(raw); if(!spec) return String(raw||'').trim()||'-';
  return spec.min===spec.max?`${spec.min} s`:`${spec.min}–${spec.max} s`;
}
function persistTimerState(){ try{ if(typeof saveTrain==='function') saveTrain(); }catch(e){} }

function timerRemaining(){ return Math.max(0, Math.ceil((window.timerEndAt - Date.now())/1000)); }
function timerOvertime(){ return window.timerEndAt ? Math.max(0, Math.floor((Date.now()-window.timerEndAt)/1000)) : 0; }
function ensureTimerRunning(){
    document.getElementById('floatingTimer').style.display = 'flex';
    if(!window.timerInt) window.timerInt = setInterval(tickTimer, 500);
    if(!window.timerAlarmed) notifSchedule();
    updateTimerUI();
}
window.quickStartTimer = function(btn) {
    const restInput = btn && btn.closest ? btn.closest('.set-row')?.querySelector('.set-rest') : null;
    const secs = parseRestSeconds(restInput?.value);
    window.timerEndAt = Date.now() + secs*1000;
    window.timerAlarmed=false;
    persistTimerState();
    ensureTimerRunning();
    toast('Cronómetro iniciado ('+secs+'s)');
}
window.addTimer = function(secs) {
    const base = window.timerEndAt>Date.now() ? window.timerEndAt : Date.now();
    window.timerEndAt = base + secs*1000;
    window.timerAlarmed=false;
    notifCancel();
    persistTimerState();
    ensureTimerRunning();
}
window.stopTimer = function() {
    trainRestEnded(); notifCancel();
    clearInterval(window.timerInt); window.timerInt = null; window.timerEndAt = 0; window.timerAlarmed=false;
    const ft=document.getElementById('floatingTimer'); if(ft){ft.style.display = 'none';ft.classList.remove('overtime');}
    const ov=document.getElementById('trainOverlay'); if(ov){ov.classList.remove('resting');ov.classList.remove('overtime');}
    persistTimerState();
}
function fireRestAlarm(){
    if(window.timerAlarmed) return;
    window.timerAlarmed=true; persistTimerState();
    if(document.hidden && notifState()==='on') notifShow('Descanso terminado', notifBody());
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
    toast('¡Descanso objetivo terminado! El contador sigue registrando el tiempo real.');
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); osc.connect(ctx.destination);
        osc.frequency.value = 800; osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch(e){}
}
function tickTimer() {
    if(!window.timerEndAt) return;
    if(timerRemaining()<=0) fireRestAlarm();
    updateTimerUI();
}
function updateTimerUI() {
    const left = timerRemaining(), over=timerOvertime(), overtime=window.timerEndAt>0&&Date.now()>=window.timerEndAt;
    const val=overtime?over:left;
    const m = Math.floor(val / 60).toString().padStart(2, '0');
    const ss = (val % 60).toString().padStart(2, '0');
    const label = overtime?`+${m}:${ss}`:`${m}:${ss}`;
    const ft=document.getElementById('floatingTimer'); if(ft) ft.classList.toggle('overtime',overtime);
    document.getElementById('timerDisplay').innerText = label;
    const tr=document.getElementById('trainRestTime'); if(tr) tr.textContent=label;
    const ov=document.getElementById('trainOverlay'); if(ov){ov.classList.toggle('resting',!!window.timerInt);ov.classList.toggle('overtime',overtime);}
}

window.exportCSV = function() {
    const csvEscape = value => {
      let v=String(value ?? '');
      if(/^[=+@]/.test(v)||/^-\D/.test(v))v="'"+v;
      return /[",\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
    };
    const addRow = row => { csv += row.map(csvEscape).join(',') + '\n'; };
    let csv = "Fecha,Rutina,Tipo,Ejercicio,Serie,Reps,Peso,Unidad,RIR,Descanso,Tiempo_min,Distancia_km,Notas,Peso_corporal,Unidad_peso,Cintura_cm,Pecho_cm,Brazo_cm,Muslo_cm,Cadera_cm,Descanso_real_seg,Tipo_serie,Nota_ejercicio\n";
    let allDates = new Set([...Object.keys(data), ...Object.keys(categories), ...Object.keys(notes), ...weights.map(w=>w.date), ...measurements.map(m=>m.date)]);
    let sortedDates = Array.from(allDates).sort();

    sortedDates.forEach(date => {
        const cat = categories[date] || "";
        const note = notes[date] || "";
        const dayUnit = currentUnit.toUpperCase();
        const wEntry = weights.find(w => w.date === date);
        const mEntry = measurements.find(m => m.date === date);

        if(wEntry) {
            let wVal = currentUnit === 'lbs' ? wEntry.weight * 2.20462 : wEntry.weight;
            addRow([date,cat,"Peso Corporal","Peso Corporal","-","-",Math.round(wVal*10)/10,dayUnit,"-","-","-","-",note,wVal,dayUnit,mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??""]);
        }

        const arr = data[date] || [];
        arr.forEach(ex => {
            const exName = ex.name;
            if (ex.isCardio) {
                addRow([date,cat,"Cardio",exName,"-","-","-","-","-","-",ex.time,ex.distance,note,"","",mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??""]);
            } else {
                ex.sets.forEach(s => {
                    let wVal = currentUnit === 'lbs' ? s.weight * 2.20462 : s.weight;
                    addRow([date,cat,"Pesas",exName,s.setNumber,s.reps,Math.round(wVal*10)/10,dayUnit,s.rir,normalizeRestLabel(s.rest),"-","-",note,"","",mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??"",s.restUsed??"",setTypeLabel(s.type),exerciseNotes[ex.name]||""]);
                });
            }
        });

        if(!wEntry && arr.length === 0 && (cat || note || mEntry)) {
            addRow([date,cat,"Info","-","-","-","-","-","-","-","-","-",note,"","",mEntry?.waist??"",mEntry?.chest??"",mEntry?.arm??"",mEntry?.thigh??"",mEntry?.hip??""]);
        }
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LiftEngine_Historial_${todayStr()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Exportado a Excel OK');
}


function parseCSVText(text){
  text=String(text||'').replace(/^\uFEFF/,'');
  const first=(text.split(/\r?\n/,1)[0]||'');
  const count=(ch)=>{let q=false,n=0;for(let i=0;i<first.length;i++){if(first[i]==='"')q=!q;else if(!q&&first[i]===ch)n++;}return n;};
  const delim=count(';')>count(',')?';':',';
  const rows=[]; let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'&&text[i+1]==='"'){cell+='"';i++;} else if(c==='"')q=false; else cell+=c; }
    else if(c==='"') q=true;
    else if(c===delim){row.push(cell);cell='';}
    else if(c==='\n'){row.push(cell.replace(/\r$/,'')); if(row.some(x=>x!==''))rows.push(row); row=[];cell='';}
    else cell+=c;
  }
  row.push(cell.replace(/\r$/,'')); if(row.some(x=>x!==''))rows.push(row);
  return rows;
}
function csvNum(v){ const n=Number(String(v??'').trim().replace(',','.')); return Number.isFinite(n)?n:null; }
function csvDate(v){
  const s=String(v||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return validDateKey(s)?s:null;
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m){const out=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return validDateKey(out)?out:null;}
  return null;
}
window.importCSV=async function(event){
  const input=event.target, file=input.files&&input.files[0]; if(!file) return;
  try{
    if(file.size>10*1024*1024) throw new Error('El CSV supera el límite de 10 MB.');
    const rows=parseCSVText(await file.text()); if(rows.length<2) throw new Error('El archivo no contiene filas de datos.');
    const headers=rows[0].map(h=>String(h).trim().replace(/^\uFEFF/,'').toLowerCase());
    const req=['fecha','tipo','ejercicio']; if(req.some(x=>!headers.includes(x))) throw new Error('El CSV no tiene el formato de LiftEngine (faltan Fecha, Tipo o Ejercicio).');
    const ix=n=>headers.indexOf(n.toLowerCase()), val=(r,n)=>ix(n)>=0?(r[ix(n)]??''):'';
    const stagedData={}, stagedCats={}, stagedNotes={}, stagedExerciseNotes={}, stagedWeights=[], stagedMeasures=[]; let valid=0, skipped=0;
    for(const r of rows.slice(1)){
      const date=csvDate(val(r,'Fecha')); if(!date){skipped++;continue;}
      const type=String(val(r,'Tipo')).trim().toLowerCase(), routine=String(val(r,'Rutina')).trim(), note=String(val(r,'Notas')).trim();
      if(routine) stagedCats[date]=routine; if(note) stagedNotes[date]=note;
      const bodyW=csvNum(val(r,'Peso_corporal')), bodyUnit=String(val(r,'Unidad_peso')||val(r,'Unidad')).toLowerCase();
      if(bodyW!=null&&bodyW>0){ const kg=bodyUnit.includes('lb')?bodyW/2.20462:bodyW; stagedWeights.push({date,weight:kg}); }
      const mm={date}; let hasM=false; for(const [col,key] of [['Cintura_cm','waist'],['Pecho_cm','chest'],['Brazo_cm','arm'],['Muslo_cm','thigh'],['Cadera_cm','hip']]){const n=csvNum(val(r,col));if(n!=null&&n>0){mm[key]=n;hasM=true;}} if(hasM) stagedMeasures.push(mm);
      if(type==='pesas'){
        const rawName=String(val(r,'Ejercicio')).trim(); const name=rawName?normalizeName(rawName):''; const reps=String(val(r,'Reps')).trim(); const repsN=csvNum(reps); const weight=csvNum(val(r,'Peso'))??0; const unit=String(val(r,'Unidad')).toLowerCase(); if(!name||repsN==null||repsN<=0){skipped++;continue;}
        const kg=unit.includes('lb')?weight/2.20462:weight, setNo=Math.max(1,Math.round(csvNum(val(r,'Serie'))||1));
        stagedData[date] ||= []; let ex=stagedData[date].find(e=>!e.isCardio&&e.name===name); if(!ex){ex={id:Date.now()+Math.random(),isCardio:false,name,sets:[]};stagedData[date].push(ex);}
        ex.sets.push({setNumber:setNo,reps:reps||'-',weight:kg,rir:String(val(r,'RIR')).trim()||'-',rest:normalizeRestLabel(val(r,'Descanso')||'90 s'),type:normalizeSetType(val(r,'Tipo_serie')),...(csvNum(val(r,'Descanso_real_seg'))!=null?{restUsed:Math.round(csvNum(val(r,'Descanso_real_seg')))}:{})}); const exNote=String(val(r,'Nota_ejercicio')).trim(); if(exNote) stagedExerciseNotes[name]=exNote.slice(0,1200); valid++;
      } else if(type==='cardio'){
        const name=String(val(r,'Ejercicio')).trim(); if(!name){skipped++;continue;} stagedData[date] ||= []; stagedData[date].push({id:Date.now()+Math.random(),isCardio:true,name,time:csvNum(val(r,'Tiempo_min'))||0,distance:csvNum(val(r,'Distancia_km'))||0}); valid++;
      } else if(type==='peso corporal'||type==='info'){valid++;}
    }
    if(!valid) throw new Error('No encontré registros válidos para importar.');
    const dates=Object.keys(stagedData), existing=dates.filter(d=>(data[d]||[]).length).length;
    const mode=existing?await appConfirm(`Se encontraron ${valid} registros válidos${skipped?` y ${skipped} filas omitidas`:''}.\n\n${existing} fecha(s) ya tienen entrenamientos.\n\n¿Quieres REEMPLAZAR los entrenamientos de esas fechas?`,{title:'Importar CSV',confirmText:'Reemplazar',cancelText:'Agregar sin borrar',danger:true}):false;
    if(existing && !(await appConfirm(`¿Confirmas la importación? ${mode?'Se reemplazarán':'Se agregarán'} los entrenamientos en las fechas coincidentes.`,{title:'Confirmar importación',confirmText:'Importar'}))){ input.value=''; return; }
    const affectedDates=[...new Set([...Object.keys(stagedData),...Object.keys(stagedCats),...Object.keys(stagedNotes),...stagedWeights.map(x=>x.date),...stagedMeasures.map(x=>x.date)])];
    if(train&&affectedDates.includes(train.date)){await appAlert('Termina el entrenamiento en curso antes de importar datos de esa fecha.','Entrenamiento en curso');return;}
    const imported=await recoverableChange('Importar CSV',{days:affectedDates,settings:Object.keys(stagedExerciseNotes).length>0},()=>{
    for(const [d,arr] of Object.entries(stagedData)){
      const merged=mode?arr:[...(data[d]||[]),...arr];
      const clean=sanitizeData({[d]:merged})[d]||[];
      if(clean.length)data[d]=clean;else delete data[d];
    }
    Object.assign(categories,sanitizeCategories(stagedCats)); Object.assign(notes,sanitizeNotes(stagedNotes)); Object.assign(exerciseNotes,sanitizeExerciseNotes(stagedExerciseNotes));
    const byDate=(arr,sanitizer)=>{const m=new Map();sanitizer(arr).forEach(x=>m.set(x.date,x));return [...m.values()].sort((a,b)=>a.date.localeCompare(b.date));};
    weights=byDate([...weights,...stagedWeights],sanitizeWeights); measurements=byDate([...measurements,...stagedMeasures],sanitizeMeasurements);
    });
    if(imported){refreshAll();closeModal();toast(`CSV importado: ${valid} registros${skipped?` · ${skipped} omitidos`:''}`);}
  }catch(err){ await appAlert('No se pudo importar el CSV: '+(err&&err.message?err.message:err),'Error de importación'); }
  finally{ input.value=''; }
}

function recoverableMeasurementsFromLocalBackup(){
  try{
    const backup=safeParse(localStorage.getItem('gymRecoveryBackup'),{}), item=backup&&backup[MEASURE];
    if(!item||typeof item.raw!=='string') return [];
    return sanitizeMeasurements(JSON.parse(item.raw));
  }catch(e){ return []; }
}
window.restoreMeasurementsFromRecovery=async function(){
  const recovered=recoverableMeasurementsFromLocalBackup();
  if(!recovered.length){toast('No hay medidas recuperables en este dispositivo');return;}
  if(!(await appConfirm(`Se encontraron ${recovered.length} fecha(s) con medidas en la copia de recuperación local.

Se combinarán con tus medidas actuales sin borrar registros más recientes.`,{title:'Recuperar medidas',confirmText:'Recuperar'})))return;
  const byDate=new Map();recovered.forEach(x=>byDate.set(x.date,x));measurements.forEach(x=>byDate.set(x.date,x));
  measurements=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  try{
    const backup=safeParse(localStorage.getItem('gymRecoveryBackup'),{});delete backup[MEASURE];
    if(Object.keys(backup).length)localStorage.setItem('gymRecoveryBackup',JSON.stringify(backup));else localStorage.removeItem('gymRecoveryBackup');
  }catch(e){}
  await saveToFirebase({days:recovered.map(x=>x.date)});renderBodyWeights();renderSettingsModal();toast('Medidas recuperadas y sincronizadas');
}

function renderSettingsModal(){
    const modal = document.getElementById('modal');
    if(!modal) return;
    const notificationLabel=({on:'Activados',off:'Desactivados',denied:'Bloqueados','needs-install':'Instala la app',unsupported:'No disponibles'})[notifState()];
    const accountEmail=(fb&&fb.auth&&fb.auth.currentUser&&fb.auth.currentUser.email)||'sin conexión';
    const recoverableCount=recoverableMeasurementsFromLocalBackup().length;
    const goal=sanitizeBodyGoal(bodyGoal);
    const goalWeight=goal.targetWeightKg?Math.round(fromKg(goal.targetWeightKg)*10)/10:'';
    const weeklyOptions=[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${n===weeklySessionTarget?'selected':''}>${n} sesión${n===1?'':'es'}</option>`).join('');
    modal.innerHTML=`
        <div class="modal-content-wrapper settings-modal">
            <div class="settings-modal-head">
                <span class="eyebrow">Configuración</span>
                <h2>Ajustes de LiftEngine</h2>
                <p>Personaliza la app, revisa la sincronización y administra tus datos.</p>
            </div>

            <section class="settings-section">
                <div class="settings-section-head"><div><h3>Apariencia</h3><p>Elige cómo se adapta LiftEngine a tu dispositivo.</p></div></div>
                <div class="settings-appearance-grid">
                    <button class="btn-theme settings-theme-mode ${currentTheme==='auto'?'active':''}" onclick="setTheme('auto')" style="--theme-swatch:linear-gradient(90deg,#f5f7fa 0 50%,#171a1f 50%)"><b>Automático</b><small>Sigue claro/oscuro del sistema</small></button>
                    <button class="btn-theme settings-theme-mode ${currentTheme==='light'?'active':''}" onclick="setTheme('light')" style="--theme-swatch:#f4f6f8"><b>Claro</b><small>Fondo luminoso</small></button>
                    <button class="btn-theme settings-theme-mode ${currentTheme==='default'?'active':''}" onclick="setTheme('default')" style="--theme-swatch:#171a1f"><b>Oscuro</b><small>Contraste clásico</small></button>
                </div>
                <div class="settings-palette-label">Paletas oscuras</div>
                <div class="theme-grid settings-theme-grid settings-palette-grid">
                    <button class="btn-theme ${currentTheme==='ocean'?'active':''}" onclick="setTheme('ocean')" style="--theme-swatch:#60a5fa">Océano</button>
                    <button class="btn-theme ${currentTheme==='forest'?'active':''}" onclick="setTheme('forest')" style="--theme-swatch:#4ade80">Bosque</button>
                    <button class="btn-theme ${currentTheme==='coffee'?'active':''}" onclick="setTheme('coffee')" style="--theme-swatch:#fbbf24">Café</button>
                </div>
                <div class="settings-unit-row">
                  <div><span>Unidad de carga</span><b>${unitLabel()}</b></div>
                  <button class="btn btn-secondary" onclick="toggleUnit();renderSettingsModal()">Cambiar a ${currentUnit==='kg'?'LBS':'KG'}</button>
                </div>
            </section>

            <section class="settings-section">
                <div class="settings-section-head"><div><h3>Entrenamiento</h3><p>Catálogos, músculos y avisos de descanso.</p></div></div>
                <div class="settings-stack">
                    <button class="btn btn-secondary full settings-action" onclick="openCatalogsModal('musculos')">${ic('list')}<span><b>Gestionar músculos y alias</b><small>Clasificación muscular y nombres equivalentes.</small></span></button>
                    <button class="btn btn-secondary full settings-action" onclick="toggleNotifications()">${ic('bell')}<span><b>Avisos de descanso: ${notificationLabel}</b><small>Alertas locales mientras el sistema mantiene activa la PWA.</small></span></button>
                </div>
            </section>

            <section class="settings-section">
                <div class="settings-section-head"><div><h3>Objetivos</h3><p>Define la referencia con la que LiftEngine interpreta tu constancia y composición corporal.</p></div></div>
                <div class="settings-goal-grid">
                    <div><label for="settingsWeeklyTarget">Meta semanal</label><select id="settingsWeeklyTarget">${weeklyOptions}</select></div>
                    <div><label for="settingsBodyGoalMode">Objetivo corporal</label><select id="settingsBodyGoalMode">
                        <option value="neutral" ${goal.mode==='neutral'?'selected':''}>Sin objetivo</option>
                        <option value="recomp" ${goal.mode==='recomp'?'selected':''}>Recomposición</option>
                        <option value="cut" ${goal.mode==='cut'?'selected':''}>Pérdida de grasa</option>
                        <option value="gain" ${goal.mode==='gain'?'selected':''}>Ganancia de masa</option>
                        <option value="maintain" ${goal.mode==='maintain'?'selected':''}>Mantenimiento</option>
                    </select></div>
                    <div><label for="settingsTargetWeight">Peso objetivo (${unitLabel()}) · opcional</label><input id="settingsTargetWeight" type="number" step="0.1" min="0" value="${goalWeight}" placeholder="Sin objetivo"></div>
                    <div><label for="settingsTargetWaist">Cintura objetivo (cm) · opcional</label><input id="settingsTargetWaist" type="number" step="0.1" min="0" value="${goal.targetWaistCm??''}" placeholder="Sin objetivo"></div>
                </div>
                <p class="settings-goal-note">Si eliges “Sin objetivo”, los cambios de peso y cintura se muestran de forma neutral: LiftEngine no asumirá que subir o bajar es mejor.</p>
                <button class="btn btn-primary full" onclick="saveGoalSettings()">Guardar objetivos</button>
            </section>

            <section class="settings-section">
                <div class="settings-section-head"><div><h3>Cuenta y nube</h3><p>Estado de tu sesión y almacenamiento sincronizado.</p></div><span class="cloud-badge ${cloudMode==='v2'?'v2':''}">${ic('cloud')} ${escapeHtml(cloudModeLabel())}</span></div>
                <div class="settings-account-card">
                    <div><span>Sesión</span><b>${escapeHtml(accountEmail)}</b></div>
                    <div><span>Almacenamiento local</span><b>${escapeHtml(localStoreLabel())}</b></div>
                    <div><span>Sincronización</span><b>${cloudMode==='v2'?'Incremental':'Modo heredado'}</b></div>
                </div>
                <div class="settings-stack settings-stack-tight">
                    <button class="btn btn-secondary full" onclick="retryCloudSync()">${ic('cloud')} Reintentar sincronización</button>
                    ${cloudMode!=='v2'?`<button class="btn btn-secondary full settings-dashed" onclick="tryMigrateCloudV2()">${ic('trend')} Activar nube v2</button>`:''}
                    ${recoverableCount?`<button class="btn btn-secondary full settings-warning" onclick="restoreMeasurementsFromRecovery()">${ic('trend')} Recuperar ${recoverableCount} registro${recoverableCount===1?'':'s'} de medidas</button>`:''}
                </div>
            </section>

            <section class="settings-section">
                <div class="settings-section-head"><div><h3>Datos</h3><p>Exporta para analizar o crea una copia completa para restaurar.</p></div></div>
                <div class="settings-data-grid">
                    <button class="btn settings-excel full" onclick="exportCSV()">${ic('table')}<span><b>Exportar a Excel</b><small>CSV editable</small></span></button>
                    <button class="btn btn-secondary full" onclick="document.getElementById('importCSVFile').click()">${ic('upload')}<span><b>Importar desde Excel</b><small>CSV de LiftEngine</small></span></button>
                    <button class="btn btn-primary full" onclick="exportData()">${ic('download')}<span><b>Crear copia</b><small>Respaldo JSON completo</small></span></button>
                    <button class="btn btn-secondary full" onclick="document.getElementById('importFile').click()">${ic('upload')}<span><b>Restaurar copia</b><small>Desde respaldo JSON</small></span></button>
                </div>
                <button class="btn btn-secondary full" onclick="openRecovery()">Historial de recuperación y deshacer</button>
                <input id="importCSVFile" type="file" accept=".csv,text/csv" hidden onchange="importCSV(event)">
                <input id="importFile" type="file" accept=".json" hidden onchange="importData(event)">
            </section>

            <section class="settings-section settings-section-last">
                <div class="settings-section-head"><div><h3>Aplicación</h3><p>LiftEngine v${APP_VERSION}</p></div></div>
                <div class="settings-about">
                    <span>Creada y diseñada por <b>Isaias Cruz</b></span>
                    <a href="mailto:isajack42@gmail.com">isajack42@gmail.com</a>
                </div>
                <button class="btn btn-danger full settings-signout" onclick="logout()">Cerrar sesión</button>
            </section>

            <div class="settings-close-row"><button class="btn btn-secondary full" onclick="closeModal()">Cerrar</button></div>
        </div>`;
    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
    improveFormAccessibility(modal);
}

window.openDataModal = function(){
    renderSettingsModal();
};

// ==========================================
// NUEVAS FUNCIONES FASE 3: GESTOR DE CATÁLOGOS
// ==========================================
window.openCatalogsModal = function(tab = 'musculos') {
    let isM = tab === 'musculos';
    let html = `<h2 style="margin-top:0">Catálogos y Mapeos</h2>
    <div class="type-toggle" style="margin-bottom:10px;">
        <button class="${isM?'active':''}" onclick="openCatalogsModal('musculos')">Músculos</button>
        <button class="${!isM?'active':''}" onclick="openCatalogsModal('alias')">Corrector (Alias)</button>
    </div>
    <div id="catContent" style="max-height: 50vh; overflow: auto; margin-bottom: 12px; padding-right:5px;"></div>
    <div class="actions">
        <button class="btn btn-primary full" onclick="renderSettingsModal()">Volver a Ajustes</button>
    </div>`;
    document.getElementById('modal').innerHTML = html;

    if(isM) {
        let allEx = getAllExercises();
        let list = allEx.map(ex => {
            let currentMuscle = getMuscleGroup(ex);
            return `<div class="routine-edit-row" style="padding:8px">
                <div style="font-size:0.85rem; font-weight:bold; margin-bottom:4px;">${escapeHtml(ex)}</div>
                <select data-ex="${escapeHtml(ex)}" onchange="updateExerciseMuscle(this.dataset.ex, this.value)" style="min-height:36px; height:36px; padding:4px 8px; font-size:14px;">
                    <option value="Otros">Otros</option>
                    ${Object.keys(customMuscles).concat(['Pecho','Espalda','Piernas','Hombros','Brazos','Core']).filter((v,i,a)=>a.indexOf(v)===i).sort().map(m => `<option value="${m}" ${currentMuscle===m?'selected':''}>${m}</option>`).join('')}
                </select>
            </div>`;
        }).join('');
        document.getElementById('catContent').innerHTML = list || '<div class="empty">No hay ejercicios registrados.</div>';
    } else {
        let list = Object.entries(customAliases).map(([alias, real]) => {
            return `<div class="routine-edit-row" style="padding:8px; display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center;">
                <div style="font-size:0.8rem; color:var(--muted)">Si escribo: <br><b style="color:var(--text)">${escapeHtml(alias)}</b></div>
                <div style="font-size:0.8rem; color:var(--muted)">Se guarda como: <br><b style="color:var(--text)">${escapeHtml(real)}</b></div>
                <button class="btn-delete-sm" data-alias="${escapeHtml(alias)}" onclick="deleteAlias(this.dataset.alias)">${ic('trash')}</button>
            </div>`;
        }).join('');
        let form = `<div class="routine-edit-row" style="padding:10px; margin-bottom:15px; border-color:var(--accent);">
            <div style="font-size:0.85rem; font-weight:bold; margin-bottom:8px;">Añadir Nuevo Alias</div>
            <input id="newAliasFrom" placeholder="Escribes... (ej. pull up)" style="margin-bottom:6px; min-height:36px; height:36px; font-size:14px;">
            <input id="newAliasTo" placeholder="Se guarda... (ej. Dominadas)" style="margin-bottom:8px; min-height:36px; height:36px; font-size:14px;" list="exerciseList">
            <button class="btn btn-primary full" style="min-height:36px;" onclick="addAlias()">Añadir Regla</button>
        </div>`;
        document.getElementById('catContent').innerHTML = form + (list || '<div class="empty">No hay alias configurados.</div>');
    }
}

window.updateExerciseMuscle = function(ex, newMuscle) {
    for(let m in customMuscles) {
        customMuscles[m] = customMuscles[m].filter(x => x !== ex);
    }
    if(newMuscle && newMuscle !== 'Otros') {
        if(!customMuscles[newMuscle]) customMuscles[newMuscle] = [];
        if(!customMuscles[newMuscle].includes(ex)) customMuscles[newMuscle].push(ex);
    }
    saveToFirebase({settings:true});
    refreshAll();
}

window.addAlias = function() {
    let from = document.getElementById('newAliasFrom').value.trim().toLowerCase();
    let to = document.getElementById('newAliasTo').value.trim();
    if(!from || !to) { toast('Llena ambos campos'); return; }
    customAliases[from] = to;
    const changed=migrateNames();
    saveToFirebase({settings:true});
    populateExercises(); refreshAll();
    openCatalogsModal('alias');
    toast(changed?'Alias añadido y nombres unificados':'Regla de alias añadida');
}

window.deleteAlias = async function(alias) {
    if(!(await appConfirm('¿Eliminar esta regla de alias?',{title:'Eliminar alias',confirmText:'Eliminar',danger:true}))) return;
    delete customAliases[alias];
    saveToFirebase({settings:true});
    openCatalogsModal('alias');
    toast('Regla eliminada');
}
// ==========================================

window.closeModal = function(){const b=document.getElementById('modalBackdrop'),m=document.getElementById('modal');b.classList.remove('show');document.body.classList.remove('modal-open');m.scrollTop=0;m.scrollLeft=0;m.classList.remove('routine-editor-modal');m.oninput=null}
function buildBackupPayload(){
  return {
    appVersion:APP_VERSION,
    schemaVersion:DATA_SCHEMA_VERSION,
    exportedAt:new Date().toISOString(),
    activeTraining:trainingSnapshot(),
    data:sanitizeData(data),
    categories:sanitizeCategories(categories),
    weights:sanitizeWeights(weights),
    measurements:sanitizeMeasurements(measurements),
    notes:sanitizeNotes(notes),
    ...buildSettingsSnapshot()
  };
}

function validateBackupPayload(x){
  if(!isPlainObject(x)) return {ok:false,reason:'El archivo no contiene un objeto JSON válido.'};
  if(x.schemaVersion!=null&&Number(x.schemaVersion)>Number(DATA_SCHEMA_VERSION)) return {ok:false,reason:'Este respaldo pertenece a una versión futura de LiftEngine y no se puede restaurar de forma segura.'};
  if(!isPlainObject(x.data)) return {ok:false,reason:'Falta o es inválida la sección de registros.'};
  if(x.categories!=null&&!isPlainObject(x.categories)) return {ok:false,reason:'La sección de categorías no es válida.'};
  if(x.weights!=null&&!Array.isArray(x.weights)) return {ok:false,reason:'La sección de peso corporal no es válida.'};
  if(x.measurements!=null&&!Array.isArray(x.measurements)) return {ok:false,reason:'La sección de medidas corporales no es válida.'};
  if(x.notes!=null&&!isPlainObject(x.notes)) return {ok:false,reason:'La sección de notas no es válida.'};
  if(x.exerciseNotes!=null&&!isPlainObject(x.exerciseNotes)) return {ok:false,reason:'La sección de notas por ejercicio no es válida.'};
  if(x.customRoutines!=null&&!isPlainObject(x.customRoutines)) return {ok:false,reason:'La sección de rutinas no es válida.'};
  if(x.customAliases!=null&&!isPlainObject(x.customAliases)) return {ok:false,reason:'La sección de alias no es válida.'};
  if(x.customMuscles!=null&&!isPlainObject(x.customMuscles)) return {ok:false,reason:'La sección de músculos no es válida.'};
  const settingsError=validateSettingsInput(x);
  if(settingsError) return {ok:false,reason:settingsError};
  const cleanData=sanitizeData(x.data);
  const sourceDays=Object.keys(x.data).length,cleanDays=Object.keys(cleanData).length;
  if(sourceDays>0&&cleanDays===0) return {ok:false,reason:'Los registros no tienen una estructura reconocible.'};
  return {ok:true,cleanDays};
}

window.exportData = function(){
  const payload=buildBackupPayload();
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`liftengine-backup-v${APP_VERSION}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href),0);
  toast('Respaldo JSON OK');
}

window.importData = function(ev){
  const file=ev.target.files[0]; if(!file) return;
  if(file.size>10*1024*1024){ appAlert('El archivo es demasiado grande (máximo 10 MB).','Archivo demasiado grande'); ev.target.value=''; return; }
  const r=new FileReader();
  r.onload=async()=>{
    try{
      const x=JSON.parse(r.result);
      if(x.type==='liftengine-recovery'){await importRecoveryFile(x);return;}
      const validation=validateBackupPayload(x);
      if(!validation.ok) throw new Error(validation.reason);
      const clean={
        data:sanitizeData(x.data),
        categories:sanitizeCategories(x.categories||{}),
        weights:sanitizeWeights(x.weights||[]),
        measurements:sanitizeMeasurements(x.measurements||[]),
        notes:sanitizeNotes(x.notes||{}),
        ...sanitizeSettingsSnapshot(x)
      };
      const days=Object.keys(clean.data).length;
      const sourceDays=Object.keys(x.data).length;
      const warning=sourceDays!==days?`\n\nAviso: ${sourceDays-days} día(s) con estructura inválida serán omitidos.`:'';
      if(!(await appConfirm(`Este respaldo contiene ${days} días de registros.${warning}\n\nImportarlo REEMPLAZARÁ todos tus datos actuales (también en la nube). Se guardará antes una copia en Recuperación; si no es posible, la importación se detendrá.`,{title:'Restaurar copia',confirmText:'Restaurar',danger:true}))) return;
      if(x.activeTraining&&!validTrainingSnapshot(x.activeTraining))throw new Error('La sesión activa del respaldo no es válida.');
      const synced=await recoverableChange('Restaurar respaldo JSON',{allDays:true,settings:true,training:true},()=>{
        const previousDates=new Set([...allLocalDates(),...Object.keys(cloudMeta.days||{})]);
        data=clean.data;categories=clean.categories;weights=clean.weights;measurements=clean.measurements;notes=clean.notes;
        applySettingsSnapshot(clean);migrateNames();
        restoreTrainingSnapshot(x.activeTraining||null);
        previousDates.forEach(d=>{if(validDateKey(d))markDayDirty(d);});
      });
      if(!synced)return;
      // recoverableChange uses persistLocal({replaceDays:true}) for full restores.
      closeModal(); refreshAll();
      toast('Importado en este dispositivo · sincronización pendiente');
    }catch(e){ await appAlert('Archivo no válido.\n\n'+(e.message||'No se pudo validar la estructura.'),'No se pudo restaurar'); }
    finally{ ev.target.value=''; }
  };
  r.readAsText(file);
}

// --- FUNCIONES DEL CREADOR DE RUTINAS ---
