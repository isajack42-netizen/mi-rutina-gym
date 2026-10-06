// LiftEngine v1.1 · Exercise Library pilot
'use strict';

const EXERCISE_LIBRARY_BASE='exercise-library';
let exerciseLibraryIndex=[];
let exerciseLibraryTaxonomy=null;
let exerciseLibraryPlanned=[];
let exerciseLibraryLookup=new Map();
let exerciseLibraryCache=new Map();

function exerciseLibraryNorm(value){
  return String(value||'').trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
}
function exerciseLibraryUrl(path){
  const version=globalThis.LIFTENGINE_VERSION||'dev';
  return `${EXERCISE_LIBRARY_BASE}/${path}?v=${encodeURIComponent(version)}`;
}
async function exerciseLibraryFetchJson(path){
  const response=await fetch(exerciseLibraryUrl(path),{credentials:'same-origin'});
  if(!response.ok)throw new Error(`Exercise Library: no se pudo cargar ${path} · ${response.status}`);
  return response.json();
}
function exerciseLibraryBuildLookup(){
  const map=new Map();
  for(const item of exerciseLibraryIndex){
    for(const raw of [item.name,...(item.aliases||[])]){
      const key=exerciseLibraryNorm(raw);
      if(key&&!map.has(key))map.set(key,item.id);
    }
  }
  exerciseLibraryLookup=map;
}
const exerciseLibraryReady=Promise.all([
  exerciseLibraryFetchJson('index.json'),
  exerciseLibraryFetchJson('taxonomy.json'),
  exerciseLibraryFetchJson('planned-exercises.json')
]).then(([index,taxonomy,planned])=>{
  exerciseLibraryIndex=Array.isArray(index?.exercises)?index.exercises:[];
  exerciseLibraryTaxonomy=taxonomy||null;
  exerciseLibraryPlanned=Array.isArray(planned?.exercises)?planned.exercises:[];
  exerciseLibraryBuildLookup();
  return true;
}).catch(error=>{
  console.warn('Exercise Library no pudo iniciar:',error);
  exerciseLibraryIndex=[];
  exerciseLibraryTaxonomy=null;
  exerciseLibraryPlanned=[];
  exerciseLibraryLookup=new Map();
  return false;
});

window.exerciseLibraryWhenReady=function(callback){
  return exerciseLibraryReady.then(ok=>{if(ok&&typeof callback==='function')callback();return ok;});
};
window.exerciseLibraryHas=function(name){
  return exerciseLibraryLookup.has(exerciseLibraryNorm(name));
};
function exerciseLibraryIdForName(name){
  return exerciseLibraryLookup.get(exerciseLibraryNorm(name))||null;
}
function exerciseLibraryIndexItem(id){
  return exerciseLibraryIndex.find(item=>item.id===id)||null;
}
function exerciseLibraryTaxLabel(group,id){
  const rows=exerciseLibraryTaxonomy?.[group]||[];
  return rows.find(row=>row.id===id)?.label||id||'—';
}
async function exerciseLibraryLoad(id){
  if(!id)return null;
  if(exerciseLibraryCache.has(id))return exerciseLibraryCache.get(id);
  const item=exerciseLibraryIndexItem(id);
  if(!item)return null;
  const data=await exerciseLibraryFetchJson(`exercises/${id}.json`);
  exerciseLibraryCache.set(id,data);
  return data;
}
function exerciseLibraryRelationLabel(id){
  return exerciseLibraryIndexItem(id)?.name||exerciseLibraryPlanned.find(item=>item.id===id)?.name||id;
}
function exerciseLibraryAssetUrl(src){
  const version=globalThis.LIFTENGINE_VERSION||'dev';
  return src?`${src}?v=${encodeURIComponent(version)}`:'';
}
function exerciseLibraryMedia(ex,kind,label){
  const src=ex?.media?.[kind];
  const ready=ex?.media?.status==='ready'&&src;
  if(ready){
    return `<figure class="exercise-media"><img src="${escapeHtml(exerciseLibraryAssetUrl(src))}" alt="${escapeHtml(label)}" loading="lazy"><figcaption>${escapeHtml(label)}</figcaption></figure>`;
  }
  return `<figure class="exercise-media exercise-media-placeholder" role="img" aria-label="${escapeHtml(label)}">
    <div class="exercise-placeholder-art" aria-hidden="true"><span class="exercise-placeholder-body"></span><span class="exercise-placeholder-bar"></span><span class="exercise-placeholder-bench"></span></div>
    <figcaption><b>Ilustración técnica</b><span>En producción · estándar visual LiftEngine</span></figcaption>
  </figure>`;
}
function exerciseLibraryList(items,cls='exercise-bullet-list'){
  return `<ul class="${cls}">${(items||[]).map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}
function exerciseLibraryRelationCards(items,kind){
  if(!items?.length)return '<div class="exercise-empty-inline">Sin relaciones registradas.</div>';
  return `<div class="exercise-relation-grid">${items.map(rel=>`<article class="exercise-relation-card"><span class="eyebrow">${escapeHtml(kind)}</span><b>${escapeHtml(exerciseLibraryRelationLabel(rel.exerciseId))}</b><p>${escapeHtml(rel.note)}</p></article>`).join('')}</div>`;
}
function exerciseLibraryOverview(ex){
  const t=ex.taxonomy||{};
  const primary=(t.primaryMuscles||[]).map(id=>exerciseLibraryTaxLabel('muscles',id));
  const secondary=(t.secondaryMuscles||[]).map(id=>exerciseLibraryTaxLabel('muscles',id));
  const equipment=(t.equipment||[]).map(id=>exerciseLibraryTaxLabel('equipment',id));
  return `<div class="exercise-detail-grid">
    <div>${exerciseLibraryMedia(ex,'hero',`${ex.name}: vista principal de técnica`)}</div>
    <div class="exercise-overview-copy">
      <section class="exercise-copy-section"><span class="eyebrow">Qué es</span><p class="exercise-lead">${escapeHtml(ex.summary)}</p></section>
      <section class="exercise-copy-section"><span class="eyebrow">Beneficios</span>${exerciseLibraryList(ex.benefits)}</section>
      <div class="exercise-fact-grid">
        <div><span>Principal</span><b>${escapeHtml(primary.join(', '))}</b></div>
        <div><span>Secundarios</span><b>${escapeHtml(secondary.join(', ')||'—')}</b></div>
        <div><span>Patrón</span><b>${escapeHtml(exerciseLibraryTaxLabel('movementPatterns',t.movementPattern))}</b></div>
        <div><span>Equipo</span><b>${escapeHtml(equipment.join(', '))}</b></div>
        <div><span>Nivel</span><b>${escapeHtml(exerciseLibraryTaxLabel('difficulties',t.difficulty))}</b></div>
        <div><span>Objetivo</span><b>${escapeHtml((t.goals||[]).map(id=>exerciseLibraryTaxLabel('goals',id)).join(', '))}</b></div>
      </div>
    </div>
  </div>`;
}
function exerciseLibraryTechnique(ex){
  return `<div class="exercise-tech-layout">
    <section class="exercise-copy-section"><span class="eyebrow">Preparación</span>${exerciseLibraryList(ex.setup)}</section>
    <section class="exercise-copy-section"><span class="eyebrow">Ejecución</span>
      <div class="exercise-step-list">${(ex.executionSteps||[]).map(step=>`<article class="exercise-step">${step.asset?`<img class="exercise-step-media" src="${escapeHtml(exerciseLibraryAssetUrl(step.asset))}" alt="Paso ${step.step}: ${escapeHtml(step.title)}" loading="lazy">`:''}<div class="exercise-step-number">${step.step}</div><div class="exercise-step-copy"><b>${escapeHtml(step.title)}</b><p>${escapeHtml(step.instruction)}</p></div></article>`).join('')}</div>
    </section>
    <section class="exercise-breathing"><div><span class="eyebrow">Descenso</span><p>${escapeHtml(ex.breathing?.eccentric||'')}</p></div><div><span class="eyebrow">Empuje</span><p>${escapeHtml(ex.breathing?.concentric||'')}</p></div></section>
    <section class="exercise-copy-section"><span class="eyebrow">Cues rápidos</span>${exerciseLibraryList(ex.keyCues,'exercise-cue-list')}</section>
    ${ex.safetyNotes?.length?`<section class="exercise-safety"><b>Seguridad</b>${exerciseLibraryList(ex.safetyNotes)}</section>`:''}
  </div>`;
}
function exerciseLibraryMuscles(ex){
  const t=ex.taxonomy||{};
  const groups=[
    ['Principal','primary',(t.primaryMuscles||[])],
    ['Secundarios','secondary',(t.secondaryMuscles||[])],
    ['Estabilizadores','stabilizer',(t.stabilizers||[])]
  ];
  return `<div class="exercise-muscle-layout">
    ${exerciseLibraryMedia(ex,'muscleMap',`Mapa muscular de ${ex.name}`)}
    <div class="exercise-muscle-list">${groups.map(([title,level,ids])=>`<section><span class="eyebrow">${title}</span>${ids.length?ids.map(id=>`<div class="exercise-muscle-row"><i class="exercise-muscle-dot ${level}" aria-hidden="true"></i><b>${escapeHtml(exerciseLibraryTaxLabel('muscles',id))}</b></div>`).join(''):'<span class="muted">No registrado.</span>'}</section>`).join('')}</div>
  </div>`;
}
function exerciseLibraryVariants(ex){
  return `<div class="exercise-variants-layout">
    <section><h3>Variantes</h3>${exerciseLibraryRelationCards(ex.variants,'Variante')}</section>
    <section><h3>Sustituciones</h3>${exerciseLibraryRelationCards(ex.substitutions,'Sustitución')}</section>
    <section><h3>Relacionados</h3>${exerciseLibraryRelationCards(ex.relatedExercises,'Relacionado')}</section>
  </div>`;
}
function exerciseLibraryMistakes(ex){
  return `<div class="exercise-mistake-grid">${(ex.commonMistakes||[]).map(m=>`<article class="exercise-mistake-card">
    ${m.asset?`<img class="exercise-mistake-media" src="${escapeHtml(exerciseLibraryAssetUrl(m.asset))}" alt="Error común: ${escapeHtml(m.title)}" loading="lazy">`:''}
    <div class="exercise-mistake-head"><span class="exercise-severity ${escapeHtml(m.severity)}">${m.severity==='high'?'Prioridad alta':m.severity==='medium'?'Prioridad media':'Ajuste'}</span><b>${escapeHtml(m.title)}</b></div>
    <p>${escapeHtml(m.description)}</p>
    <div class="exercise-correction"><span>Cómo corregirlo</span><p>${escapeHtml(m.correction)}</p></div>
  </article>`).join('')}</div>`;
}
const EXERCISE_TABS=[
  ['overview','Visión general'],
  ['technique','Técnica'],
  ['muscles','Músculos'],
  ['variants','Variantes'],
  ['mistakes','Errores comunes']
];
function exerciseLibraryTabContent(ex,tab){
  if(tab==='technique')return exerciseLibraryTechnique(ex);
  if(tab==='muscles')return exerciseLibraryMuscles(ex);
  if(tab==='variants')return exerciseLibraryVariants(ex);
  if(tab==='mistakes')return exerciseLibraryMistakes(ex);
  return exerciseLibraryOverview(ex);
}
function exerciseLibraryRender(ex,activeTab='overview'){
  const modal=document.getElementById('modal');
  if(!modal)return;
  const t=ex.taxonomy||{};
  const primary=(t.primaryMuscles||[]).map(id=>exerciseLibraryTaxLabel('muscles',id)).join(' · ');
  modal.classList.remove('routine-editor-modal');
  modal.classList.add('exercise-library-modal');
  modal.innerHTML=`<div class="exercise-sheet" data-exercise-id="${escapeHtml(ex.id)}" data-active-tab="${escapeHtml(activeTab)}">
    <header class="exercise-sheet-head">
      <div><span class="eyebrow">Exercise Library · ficha piloto</span><h2 id="exerciseLibraryTitle">${escapeHtml(ex.name)}</h2><p>${escapeHtml(primary)} · ${escapeHtml(exerciseLibraryTaxLabel('movementPatterns',t.movementPattern))}</p></div>
      <button class="icon-btn exercise-sheet-close" type="button" onclick="closeModal()" aria-label="Cerrar ficha"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
    </header>
    <nav class="exercise-sheet-tabs" role="tablist" aria-label="Información del ejercicio">
      ${EXERCISE_TABS.map(([id,label])=>`<button type="button" role="tab" id="exercise-tab-${id}" aria-controls="exercise-panel" aria-selected="${id===activeTab?'true':'false'}" tabindex="${id===activeTab?'0':'-1'}" data-tab="${id}" onclick="exerciseLibrarySetTab('${id}')" onkeydown="exerciseLibraryTabKey(event)">${label}</button>`).join('')}
    </nav>
    <div id="exercise-panel" class="exercise-sheet-panel" role="tabpanel" aria-labelledby="exercise-tab-${escapeHtml(activeTab)}">
      ${exerciseLibraryTabContent(ex,activeTab)}
    </div>
  </div>`;
}
window.exerciseLibrarySetTab=function(tab){
  const shell=document.querySelector('#modal .exercise-sheet');
  if(!shell)return;
  const id=shell.dataset.exerciseId;
  const ex=exerciseLibraryCache.get(id);
  if(!ex)return;
  const active=EXERCISE_TABS.some(([key])=>key===tab)?tab:'overview';
  shell.dataset.activeTab=active;
  shell.querySelectorAll('[role="tab"]').forEach(btn=>{
    const selected=btn.dataset.tab===active;
    btn.setAttribute('aria-selected',selected?'true':'false');
    btn.tabIndex=selected?0:-1;
  });
  const panel=shell.querySelector('#exercise-panel');
  panel.setAttribute('aria-labelledby','exercise-tab-'+active);
  panel.innerHTML=exerciseLibraryTabContent(ex,active);
};
window.exerciseLibraryTabKey=function(event){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=[...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  const current=Math.max(0,tabs.indexOf(event.currentTarget));
  let next=current;
  if(event.key==='ArrowRight')next=(current+1)%tabs.length;
  if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=tabs.length-1;
  event.preventDefault();
  tabs[next].click();
  tabs[next].focus();
};
window.openExerciseInfo=async function(name,initialTab='overview'){
  const ready=await exerciseLibraryReady;
  if(!ready){toast('La biblioteca técnica no está disponible ahora');return;}
  const id=exerciseLibraryIdForName(name);
  if(!id){toast('Este ejercicio aún no tiene ficha técnica');return;}
  try{
    const ex=await exerciseLibraryLoad(id);
    if(!ex){toast('No se encontró la ficha técnica');return;}
    exerciseLibraryRender(ex,initialTab);
    const train=document.getElementById('trainOverlay');
    if(train?.classList.contains('open'))train.setAttribute('inert','');
    const back=document.getElementById('modalBackdrop');
    back.classList.add('show');
    document.body.classList.add('modal-open');
  }catch(error){
    console.error(error);
    toast('No se pudo abrir la ficha técnica');
  }
};
window.exerciseLibraryButtonHtml=function(name,label='Técnica'){
  if(!window.exerciseLibraryHas(name))return '';
  return `<button class="exercise-info-btn" type="button" data-exercise="${escapeHtml(name)}" onclick="event.preventDefault(); event.stopPropagation(); openExerciseInfo(this.dataset.exercise)">${ic('bulb')} <span>${escapeHtml(label)}</span></button>`;
};


function exerciseLibraryUniqueTax(group,ids){
  const wanted=new Set(ids);
  return (exerciseLibraryTaxonomy?.[group]||[]).filter(row=>wanted.has(row.id));
}
function exerciseLibraryFillSelect(id,rows){
  const select=document.getElementById(id); if(!select||select.dataset.libraryReady==='1')return;
  const current=select.value;
  select.innerHTML='<option value="">Todos</option>'+rows.map(row=>`<option value="${escapeHtml(row.id)}">${escapeHtml(row.label)}</option>`).join('');
  if([...select.options].some(o=>o.value===current))select.value=current;
  select.dataset.libraryReady='1';
}
function exerciseLibraryInitFilters(){
  const muscles=new Set(),equipment=new Set(),patterns=new Set();
  exerciseLibraryIndex.forEach(item=>{
    (item.primaryMuscles||[]).forEach(id=>muscles.add(id));
    (item.equipment||[]).forEach(id=>equipment.add(id));
    if(item.movementPattern)patterns.add(item.movementPattern);
  });
  exerciseLibraryFillSelect('exerciseLibraryMuscleFilter',exerciseLibraryUniqueTax('muscles',muscles));
  exerciseLibraryFillSelect('exerciseLibraryEquipmentFilter',exerciseLibraryUniqueTax('equipment',equipment));
  exerciseLibraryFillSelect('exerciseLibraryPatternFilter',exerciseLibraryUniqueTax('movementPatterns',patterns));
}
function exerciseLibrarySearchText(item){
  const labels=[
    ...(item.primaryMuscles||[]).map(id=>exerciseLibraryTaxLabel('muscles',id)),
    ...(item.equipment||[]).map(id=>exerciseLibraryTaxLabel('equipment',id)),
    exerciseLibraryTaxLabel('movementPatterns',item.movementPattern),
    exerciseLibraryTaxLabel('difficulties',item.difficulty),
    ...(item.goals||[]).map(id=>exerciseLibraryTaxLabel('goals',id))
  ];
  return exerciseLibraryNorm([item.name,...(item.aliases||[]),...labels].join(' '));
}
window.renderExerciseLibraryBrowser=function(){
  const root=document.getElementById('exerciseLibraryBrowserList'); if(!root)return;
  exerciseLibraryInitFilters();
  const q=exerciseLibraryNorm(document.getElementById('exerciseLibrarySearch')?.value||'');
  const muscle=document.getElementById('exerciseLibraryMuscleFilter')?.value||'';
  const equipment=document.getElementById('exerciseLibraryEquipmentFilter')?.value||'';
  const pattern=document.getElementById('exerciseLibraryPatternFilter')?.value||'';
  const rows=exerciseLibraryIndex.filter(item=>
    (!q||exerciseLibrarySearchText(item).includes(q))&&
    (!muscle||(item.primaryMuscles||[]).includes(muscle))&&
    (!equipment||(item.equipment||[]).includes(equipment))&&
    (!pattern||item.movementPattern===pattern)
  );
  const count=document.getElementById('exerciseLibraryCount');
  if(count)count.textContent=`${rows.length} ejercicio${rows.length===1?'':'s'}`;
  if(!rows.length){
    root.innerHTML='<div class="empty"><b>No encontré ejercicios</b><span>Prueba otro nombre o quita alguno de los filtros.</span></div>';
    return;
  }
  root.innerHTML=rows.map(item=>{
    const muscleLabel=(item.primaryMuscles||[]).map(id=>exerciseLibraryTaxLabel('muscles',id)).join(', ');
    const equipmentLabel=(item.equipment||[]).map(id=>exerciseLibraryTaxLabel('equipment',id)).join(', ');
    const patternLabel=exerciseLibraryTaxLabel('movementPatterns',item.movementPattern);
    const thumb=item.thumbnail?`<img src="${escapeHtml(exerciseLibraryAssetUrl(item.thumbnail))}" alt="" loading="lazy">`:'<div class="exercise-browser-thumb-placeholder" aria-hidden="true"></div>';
    return `<button class="exercise-browser-card" type="button" data-exercise="${escapeHtml(item.name)}" onclick="openExerciseInfo(this.dataset.exercise)">
      <span class="exercise-browser-thumb">${thumb}</span>
      <span class="exercise-browser-card-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(muscleLabel)} · ${escapeHtml(patternLabel)}</small><span>${escapeHtml(equipmentLabel)}</span></span>
      <span class="exercise-browser-open" aria-hidden="true">→</span>
    </button>`;
  }).join('');
};
exerciseLibraryReady.then(ok=>{if(ok)window.renderExerciseLibraryBrowser();});
