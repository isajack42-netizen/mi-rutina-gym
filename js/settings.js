// LiftEngine · v6 settings & goals: contrato único de preferencias
'use strict';

const BODY_GOAL_MODES=['neutral','recomp','cut','gain','maintain'];

function sanitizeBodyGoal(raw){
  const x=isPlainObject(raw)?raw:{};
  const mode=BODY_GOAL_MODES.includes(String(x.mode||''))?String(x.mode):'neutral';
  const tw=finiteNumber(x.targetWeightKg,0);
  const waist=finiteNumber(x.targetWaistCm,0);
  return {
    mode,
    targetWeightKg:tw&&tw>0?Math.round(tw*10)/10:null,
    targetWaistCm:waist&&waist>0?Math.round(waist*10)/10:null
  };
}

function bodyGoalLabel(mode=bodyGoal?.mode){
  return ({
    neutral:'Sin objetivo corporal',
    recomp:'Recomposición',
    cut:'Pérdida de grasa',
    gain:'Ganancia de masa',
    maintain:'Mantenimiento'
  })[mode]||'Sin objetivo corporal';
}

function sanitizeSettingsSnapshot(raw){
  const x=isPlainObject(raw)?raw:{};
  const has=k=>Object.prototype.hasOwnProperty.call(x,k);
  return {
    exerciseNotes:sanitizeExerciseNotes(x.exerciseNotes||{}),
    customRoutines:has('customRoutines')?sanitizeRoutines(x.customRoutines):JSON.parse(JSON.stringify(defaultPPL)),
    customAliases:has('customAliases')?sanitizeAliases(x.customAliases):JSON.parse(JSON.stringify(defaultAliases)),
    customMuscles:has('customMuscles')?sanitizeMuscles(x.customMuscles):JSON.parse(JSON.stringify(defaultMuscles)),
    currentUnit:x.currentUnit==='lbs'?'lbs':'kg',
    currentTheme:cleanString(x.currentTheme,'default')||'default',
    weeklySessionTarget:Math.min(7,Math.max(1,parseInt(x.weeklySessionTarget,10)||6)),
    bodyGoal:sanitizeBodyGoal(x.bodyGoal)
  };
}

function buildSettingsSnapshot(){
  return sanitizeSettingsSnapshot({
    exerciseNotes,
    customRoutines,
    customAliases,
    customMuscles,
    currentUnit,
    currentTheme,
    weeklySessionTarget,
    bodyGoal
  });
}

function applySettingsSnapshot(raw){
  const clean=sanitizeSettingsSnapshot(raw);
  exerciseNotes=clean.exerciseNotes;
  customRoutines=clean.customRoutines;
  customAliases=clean.customAliases;
  customMuscles=clean.customMuscles;
  currentUnit=clean.currentUnit;
  currentTheme=clean.currentTheme;
  weeklySessionTarget=clean.weeklySessionTarget;
  bodyGoal=clean.bodyGoal;
  const unit=document.getElementById('unitBtn');
  if(unit) unit.innerText=currentUnit.toUpperCase();
  document.documentElement.setAttribute('data-theme',currentTheme);
  return clean;
}

function settingsNeedSeed(raw){
  if(!isPlainObject(raw)) return true;
  return !Object.prototype.hasOwnProperty.call(raw,'weeklySessionTarget')
    || !Object.prototype.hasOwnProperty.call(raw,'bodyGoal');
}

function validateSettingsInput(raw){
  const x=isPlainObject(raw)?raw:{};
  if(x.currentUnit!=null&&!['kg','lbs'].includes(x.currentUnit)) return 'La unidad del archivo no es válida.';
  if(x.weeklySessionTarget!=null&&(!Number.isInteger(Number(x.weeklySessionTarget))||Number(x.weeklySessionTarget)<1||Number(x.weeklySessionTarget)>7)) return 'La meta semanal del archivo no es válida.';
  if(x.bodyGoal!=null){
    if(!isPlainObject(x.bodyGoal)) return 'El objetivo corporal del archivo no es válido.';
    if(x.bodyGoal.mode!=null&&!BODY_GOAL_MODES.includes(String(x.bodyGoal.mode))) return 'El tipo de objetivo corporal no es válido.';
    for(const k of ['targetWeightKg','targetWaistCm']){
      if(x.bodyGoal[k]!=null&&x.bodyGoal[k]!==''&&(!Number.isFinite(Number(x.bodyGoal[k]))||Number(x.bodyGoal[k])<=0)) return 'Los objetivos numéricos deben ser mayores que cero.';
    }
  }
  return '';
}

function bodyMetricTrendClass(metric,delta,currentValue=null){
  if(delta==null||Math.abs(delta)<0.01) return 'trend-neutral';
  const goal=sanitizeBodyGoal(bodyGoal);
  const target=metric==='weight'?goal.targetWeightKg:metric==='waist'?goal.targetWaistCm:null;
  const current=Number(currentValue);
  if(target&&Number.isFinite(current)){
    const previous=current-Number(delta);
    const before=Math.abs(previous-target),after=Math.abs(current-target);
    if(after<before-.01)return 'trend-positive';
    if(after>before+.01)return 'trend-negative';
    return 'trend-neutral';
  }
  const mode=goal.mode||'neutral';
  if(mode==='cut'&&(metric==='weight'||metric==='waist')) return delta<0?'trend-positive':'trend-negative';
  if(mode==='recomp'&&metric==='waist') return delta<0?'trend-positive':'trend-negative';
  if(mode==='gain'&&metric==='weight') return delta>0?'trend-positive':'trend-negative';
  return 'trend-neutral';
}

window.bodyGoalLabel=bodyGoalLabel;
window.saveGoalSettings=async function(){
  const weekly=document.getElementById('settingsWeeklyTarget');
  const mode=document.getElementById('settingsBodyGoalMode');
  const weight=document.getElementById('settingsTargetWeight');
  const waist=document.getElementById('settingsTargetWaist');

  const nextWeekly=Math.min(7,Math.max(1,parseInt(weekly?.value,10)||weeklySessionTarget||6));
  const displayWeight=parseFloat(weight?.value);
  const targetWeightKg=Number.isFinite(displayWeight)&&displayWeight>0?toKg(displayWeight):null;
  const targetWaistCm=Number.isFinite(parseFloat(waist?.value))&&parseFloat(waist.value)>0?parseFloat(waist.value):null;

  weeklySessionTarget=nextWeekly;
  bodyGoal=sanitizeBodyGoal({
    mode:mode?.value||'neutral',
    targetWeightKg,
    targetWaistCm
  });

  markSettingsDirty({cloud:true,local:true});
  await persistLocal({settings:true});
  await saveToFirebase({settings:true});
  if(typeof renderAnalytics==='function') renderAnalytics();
  if(typeof renderDashboard==='function') renderDashboard();
  if(typeof renderBodyWeights==='function') renderBodyWeights();
  renderSettingsModal();
  toast('Objetivos guardados');
};
