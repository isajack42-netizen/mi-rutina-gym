
'use strict';

// <schedule-helpers>
function scheduleDayForDate(date){
  const d=new Date(String(date)+'T12:00:00');
  return Number.isNaN(d.getTime())?0:d.getDay();
}
function schedulePlanForDate(plan,date){
  const clean=plan&&typeof plan==='object'?plan:{template:{},overrides:{}};
  const overrides=clean.overrides&&typeof clean.overrides==='object'?clean.overrides:{};
  if(Object.prototype.hasOwnProperty.call(overrides,date))return String(overrides[date]||'');
  const template=clean.template&&typeof clean.template==='object'?clean.template:{};
  return String(template[String(scheduleDayForDate(date))]||'');
}
function scheduleTemplateForDate(plan,date){
  const template=plan&&plan.template&&typeof plan.template==='object'?plan.template:{};
  return String(template[String(scheduleDayForDate(date))]||'');
}
function scheduleHasPlan(plan){
  return Object.values(plan?.template||{}).some(v=>String(v||'')&&String(v)!=='Descanso')
    || Object.values(plan?.overrides||{}).some(v=>String(v||'')&&String(v)!=='Descanso');
}
function scheduleShiftDate(key,deltaDays){
  const d=new Date(String(key)+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+Number(deltaDays||0));
  return d.toISOString().slice(0,10);
}
function scheduleWeekDates(anchor){
  const d=new Date(String(anchor)+'T12:00:00');
  const js=d.getDay(),back=js===0?6:js-1;
  const monday=scheduleShiftDate(anchor,-back);
  return Array.from({length:7},(_,i)=>scheduleShiftDate(monday,i));
}
function scheduleAllocateCounts(frequencies,total){
  const entries=Object.entries(frequencies||{}).filter(([,v])=>Number(v)>0);
  const target=Math.max(0,Math.min(7,Math.round(Number(total)||0)));
  const out=Object.fromEntries(entries.map(([name])=>[name,0]));
  if(!entries.length||!target)return out;
  const sum=entries.reduce((a,[,v])=>a+Number(v),0);
  const quotas=entries.map(([name,v])=>{
    const q=Number(v)/sum*target,base=Math.floor(q);
    out[name]=base;
    return {name,fraction:q-base,weight:Number(v)};
  });
  let used=Object.values(out).reduce((a,b)=>a+b,0);
  quotas.sort((a,b)=>b.fraction-a.fraction||b.weight-a.weight||a.name.localeCompare(b.name));
  for(let i=0;used<target;i++,used++)out[quotas[i%quotas.length].name]++;
  return out;
}
function scheduleBuildTemplate(frequencies){
  const sum=Object.values(frequencies||{}).reduce((a,v)=>a+Math.max(0,Number(v)||0),0);
  const target=Math.max(0,Math.min(7,Math.round(sum)));
  const counts=scheduleAllocateCounts(frequencies,target);
  const remaining={...counts},sequence=[];
  let last='';
  while(sequence.length<target){
    const choices=Object.entries(remaining).filter(([,n])=>n>0)
      .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    if(!choices.length)break;
    const pick=choices.find(([name])=>name!==last)||choices[0];
    sequence.push(pick[0]);remaining[pick[0]]--;last=pick[0];
  }
  const order=['1','2','3','4','5','6','0'];
  const template=Object.fromEntries(order.map(k=>[k,'Descanso']));
  if(!target)return template;
  sequence.forEach((routine,i)=>{
    const pos=Math.min(6,Math.floor(i*7/target));
    template[order[pos]]=routine;
  });
  return template;
}
function scheduleStatus(planned,actual,completed,date,today){
  const plan=String(planned||''),act=String(actual||'');
  if(!plan||plan==='Descanso'){
    if(completed)return 'extra';
    return plan==='Descanso'?'rest':'none';
  }
  if(completed)return act===plan?'completed':'changed';
  if(date<today)return 'missed';
  if(date===today)return 'today';
  return 'planned';
}
// </schedule-helpers>

const SCHEDULE_DAY_ORDER=['1','2','3','4','5','6','0'];
const SCHEDULE_DAY_LABEL={1:'Lun',2:'Mar',3:'Mie',4:'Jue',5:'Vie',6:'Sab',0:'Dom'};

window.plannedRoutineForDate=function(date){
  return schedulePlanForDate(weeklyPlan,date);
};
window.weeklyPlanConfigured=function(){
  return scheduleHasPlan(weeklyPlan);
};
window.renameWeeklyPlanRoutine=function(oldName,newName){
  if(!oldName||!newName||oldName===newName)return false;
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  let changed=false;
  Object.keys(weeklyPlan.template).forEach(k=>{if(weeklyPlan.template[k]===oldName){weeklyPlan.template[k]=newName;changed=true;}});
  Object.keys(weeklyPlan.overrides).forEach(k=>{if(weeklyPlan.overrides[k]===oldName){weeklyPlan.overrides[k]=newName;changed=true;}});
  return changed;
};
window.removeWeeklyPlanRoutine=function(name){
  if(!name)return false;
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  let changed=false;
  Object.keys(weeklyPlan.template).forEach(k=>{if(weeklyPlan.template[k]===name){weeklyPlan.template[k]='';changed=true;}});
  Object.keys(weeklyPlan.overrides).forEach(k=>{if(weeklyPlan.overrides[k]===name){weeklyPlan.overrides[k]='';changed=true;}});
  return changed;
};
function scheduleHasStrengthWorkout(date){
  return (data[date]||[]).some(e=>!e.isCardio&&entryHasData(e));
}
window.scheduleStatusForDate=function(date){
  const planned=schedulePlanForDate(weeklyPlan,date);
  const completed=scheduleHasStrengthWorkout(date);
  const actual=completed?(categories[date]||''):'';
  return {date,planned,actual,completed,status:scheduleStatus(planned,actual,completed,date,todayStr())};
};
window.scheduleWeekCompliance=function(anchor=todayStr()){
  const days=scheduleWeekDates(anchor),today=todayStr();
  const rows=days.map(d=>scheduleStatusForDate(d));
  const due=rows.filter(r=>r.planned&&r.planned!=='Descanso'&&r.date<=today);
  const planned=rows.filter(r=>r.planned&&r.planned!=='Descanso');
  const completed=due.filter(r=>r.status==='completed').length;
  const changed=due.filter(r=>r.status==='changed').length;
  const missed=due.filter(r=>r.status==='missed').length;
  const extras=rows.filter(r=>r.status==='extra').length;
  const adjustments=days.filter(d=>{
    const overrides=weeklyPlan?.overrides||{};
    return Object.prototype.hasOwnProperty.call(overrides,d)&&schedulePlanForDate(weeklyPlan,d)!==scheduleTemplateForDate(weeklyPlan,d);
  }).length;
  return {days,rows,due:due.length,planned:planned.length,completed,changed,missed,extras,adjustments,pct:due.length?completed/due.length*100:null};
};
window.nextPlannedWorkout=function(from=todayStr(),limit=14){
  for(let i=0;i<=limit;i++){
    const date=scheduleShiftDate(from,i),routine=schedulePlanForDate(weeklyPlan,date);
    if(routine&&routine!=='Descanso')return {date,routine,status:scheduleStatusForDate(date).status};
  }
  return null;
};

async function persistWeeklyPlanChange(message){
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  markSettingsDirty({cloud:true,local:true});
  await persistLocal({settings:true});
  await saveToFirebase({settings:true});
  if(typeof refreshAll==='function')refreshAll();
  if(message)toast(message);
}
function scheduleOptions(selected,includeBlank=true){
  let html=includeBlank?'<option value="">Sin plan</option>':'';
  html+='<option value="Descanso">Descanso</option>';
  Object.keys(customRoutines).forEach(name=>{
    html+='<option value="'+escapeHtml(name)+'"'+(name===selected?' selected':'')+'>'+escapeHtml(name)+'</option>';
  });
  return html;
}
window.setWeeklyTemplateDay=async function(day,value){
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  weeklyPlan.template[String(day)]=String(value||'');
  await persistWeeklyPlanChange('Plan semanal actualizado');
};
window.clearWeeklySchedule=async function(){
  if(!(await appConfirm('¿Limpiar la plantilla semanal y todas sus excepciones?',{title:'Limpiar plan semanal',confirmText:'Limpiar',danger:true})))return;
  weeklyPlan={template:{},overrides:{}};
  await persistWeeklyPlanChange('Plan semanal limpiado');
};
window.applyPlanningScenarioToSchedule=async function(){
  if(Object.values(weeklyPlan?.template||{}).some(Boolean)){
    const ok=await appConfirm('Esto reemplazará la plantilla semanal actual. Las excepciones por fecha se conservarán. ¿Continuar?',{title:'Usar escenario',confirmText:'Aplicar'});
    if(!ok)return;
  }
  let frequencies={};
  try{
    frequencies=typeof planningEnsureFrequencies==='function'?planningEnsureFrequencies(customRoutines):planningDefaultFrequencies(Object.keys(customRoutines),weeklySessionTarget);
  }catch(_){
    frequencies=planningDefaultFrequencies(Object.keys(customRoutines),weeklySessionTarget);
  }
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  weeklyPlan.template=scheduleBuildTemplate(frequencies);
  await persistWeeklyPlanChange('Escenario convertido en plan semanal');
};
window.renderWeeklySchedulePlanner=function(){
  const box=document.getElementById('routineWeeklySchedule');
  if(!box)return;
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  const configured=scheduleHasPlan(weeklyPlan);
  const compliance=scheduleWeekCompliance(todayStr());
  const summary=configured
    ? (compliance.due?compliance.completed+'/'+compliance.due+' previstas hasta hoy':'Aun no hay sesiones previstas vencidas')
    : 'Sin plantilla semanal';
  box.innerHTML='<div class="routine-plan-block-head"><div><span class="eyebrow">Calendario</span><h3>Plan semanal</h3></div><small>'+escapeHtml(summary)+'</small></div>'
    +'<div class="weekly-template-grid">'
    +SCHEDULE_DAY_ORDER.map(day=>{
      const value=weeklyPlan.template?.[day]||'';
      return '<label class="weekly-template-day"><span>'+SCHEDULE_DAY_LABEL[day]+'</span><select onchange="setWeeklyTemplateDay(\''+day+'\',this.value)">'+scheduleOptions(value,true).replace('value="'+escapeHtml(value)+'"','value="'+escapeHtml(value)+'" selected')+'</select></label>';
    }).join('')
    +'</div><div class="weekly-template-actions"><button class="btn btn-primary" type="button" onclick="applyPlanningScenarioToSchedule()">Usar escenario</button><button class="btn btn-secondary" type="button" onclick="clearWeeklySchedule()">Limpiar</button></div>';
};

window.openScheduleDateEditor=function(date){
  if(!validDateKey(date))return;
  const template=scheduleTemplateForDate(weeklyPlan,date);
  const current=schedulePlanForDate(weeklyPlan,date);
  const hasOverride=Object.prototype.hasOwnProperty.call(weeklyPlan?.overrides||{},date);
  const modal=document.getElementById('modal');
  let options='<option value="">Sin entrenamiento</option><option value="Descanso">Descanso</option>';
  Object.keys(customRoutines).forEach(name=>{
    options+='<option value="'+escapeHtml(name)+'"'+(name===current?' selected':'')+'>'+escapeHtml(name)+'</option>';
  });
  if(current==='Descanso')options=options.replace('value="Descanso"','value="Descanso" selected');
  modal.innerHTML='<h2>Plan del '+fmtDate(date)+'</h2>'
    +'<p class="muted">Plantilla: <b>'+escapeHtml(template||'Sin plan')+'</b>'+ (hasOverride?' · excepción activa':'') +'</p>'
    +'<label>Plan para esta fecha</label><select id="scheduleDateRoutine">'+options+'</select>'
    +'<div class="actions"><button class="btn btn-secondary" onclick="restoreScheduleDate(\''+date+'\')">Usar plantilla</button><button class="btn btn-primary" onclick="saveScheduleDateOverride(\''+date+'\')">Guardar excepción</button></div>'
    +(current&&current!=='Descanso'?'<hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><label>Mover '+escapeHtml(current)+' a otra fecha</label><input id="scheduleMoveTarget" type="date" min="'+todayStr()+'" value="'+scheduleShiftDate(date,1)+'"><button class="btn btn-secondary full" style="margin-top:8px" onclick="moveScheduledSession(\''+date+'\')">Mover sesión</button>':'')
    +'<div class="actions"><button class="btn btn-secondary" onclick="closeModal()">Cerrar</button></div>';
  document.getElementById('modalBackdrop').classList.add('show');
  document.body.classList.add('modal-open');
};
window.saveScheduleDateOverride=async function(date){
  const el=document.getElementById('scheduleDateRoutine');if(!el)return;
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  weeklyPlan.overrides[date]=String(el.value||'');
  closeModal();
  await persistWeeklyPlanChange('Excepción guardada');
};
window.restoreScheduleDate=async function(date){
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  delete weeklyPlan.overrides[date];
  closeModal();
  await persistWeeklyPlanChange('Fecha restaurada a la plantilla');
};
window.moveScheduledSession=async function(from){
  const target=document.getElementById('scheduleMoveTarget')?.value||'';
  if(!validDateKey(target)||target===from){toast('Elige otra fecha válida');return;}
  const routine=schedulePlanForDate(weeklyPlan,from);
  if(!routine||routine==='Descanso'){toast('No hay una sesión para mover');return;}
  const targetPlan=schedulePlanForDate(weeklyPlan,target);
  if(targetPlan&&targetPlan!=='Descanso'){
    const ok=await appConfirm('El '+fmtDate(target)+' ya tiene '+targetPlan+' planeado. ¿Reemplazarlo por '+routine+'?',{title:'Reprogramar sesión',confirmText:'Reemplazar'});
    if(!ok)return;
  }
  weeklyPlan=sanitizeWeeklyPlan(weeklyPlan);
  weeklyPlan.overrides[from]='Descanso';
  weeklyPlan.overrides[target]=routine;
  closeModal();
  await persistWeeklyPlanChange(routine+' movido a '+fmtDate(target));
};
window.startPlannedRoutine=function(routine){
  if(train){openTraining();return;}
  if(!routine||routine==='Descanso'||!customRoutines[routine]){toast('La rutina planeada no está disponible');return;}
  startTraining(routine);
};
