import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('.');
const fail=msg=>{throw new Error('[Exercise Library Acceptance] '+msg);};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const norm=value=>String(value||'').trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');

const index=json('exercise-library/index.json');
const taxonomy=json('exercise-library/taxonomy.json');
const planned=json('exercise-library/planned-exercises.json');
const html=read('index.html');
const css=read('styles.css');
const ui=read('js/exercise-library.js');
const toolsJs=read('js/tools.js');
const sw=read('sw.js');
const version=read('js/version.js');
const pkg=json('package.json');
const lock=json('package-lock.json');

const exercises=index.exercises.map(row=>json('exercise-library/exercises/'+row.id+'.json'));
const byId=new Map(exercises.map(ex=>[ex.id,ex]));
const indexById=new Map(index.exercises.map(ex=>[ex.id,ex]));
const muscleById=new Map(taxonomy.muscles.map(x=>[x.id,x]));
const groupById=new Map(taxonomy.muscleGroups.map(x=>[x.id,x]));
const equipmentById=new Map(taxonomy.equipment.map(x=>[x.id,x]));
const patternById=new Map(taxonomy.movementPatterns.map(x=>[x.id,x]));
const difficultyById=new Map(taxonomy.difficulties.map(x=>[x.id,x]));
const goalById=new Map(taxonomy.goals.map(x=>[x.id,x]));

const FIRST_PACK=[
'bench-press-barbell','incline-dumbbell-press','cable-fly','overhead-press-barbell','lateral-raise-dumbbell',
'lat-pulldown','seated-cable-row','one-arm-dumbbell-row','barbell-curl','incline-dumbbell-curl',
'triceps-cable-pushdown','parallel-bar-dip','back-squat-barbell','leg-press','lying-leg-curl'
];

if(FIRST_PACK.some(id=>!byId.has(id))) fail('First Pack baseline is incomplete.');
if(exercises.length!==15) fail('Acceptance round expects the current 15-exercise pack, got '+exercises.length+'.');
if(new Set(exercises.map(x=>x.name)).size!==exercises.length) fail('Duplicate canonical exercise names.');

const aliasOwner=new Map();
for(const ex of exercises){
  const row=indexById.get(ex.id);
  if(!row) fail(ex.id+': missing index row.');
  const names=[ex.name,...ex.aliases];
  for(const name of names){
    const key=norm(name);
    const previous=aliasOwner.get(key);
    if(previous&&previous!==ex.id) fail('Alias collision: '+name+' -> '+previous+' / '+ex.id);
    aliasOwner.set(key,ex.id);
  }
  if(ex.contentStatus!=='reviewed') fail(ex.id+': content is not reviewed.');
  if(ex.media?.status!=='ready') fail(ex.id+': media is not ready.');
  if(planned.exercises.find(x=>x.id===ex.id)?.status!=='ready') fail(ex.id+': plan status is not ready.');
  if((ex.executionSteps||[]).length<5) fail(ex.id+': fewer than five technique steps.');
  if((ex.commonMistakes||[]).length<3) fail(ex.id+': fewer than three common mistakes.');
}

function allMuscles(item){
  return [...new Set([...(item.primaryMuscles||[]),...(item.secondaryMuscles||[]),...(item.stabilizers||[])])];
}
function muscleLabel(id){return muscleById.get(id)?.label||id;}
function muscleGroupLabel(id){
  const muscle=muscleById.get(id);
  return muscle?.group?groupById.get(muscle.group)?.label||'':'';
}
function searchText(item){
  const muscleIds=allMuscles(item);
  const labels=[
    ...muscleIds.map(muscleLabel),
    ...muscleIds.map(muscleGroupLabel),
    ...(item.equipment||[]).map(id=>equipmentById.get(id)?.label||id),
    patternById.get(item.movementPattern)?.label||item.movementPattern,
    difficultyById.get(item.difficulty)?.label||item.difficulty,
    ...(item.goals||[]).map(id=>goalById.get(id)?.label||id)
  ];
  return norm([item.name,...(item.aliases||[]),...labels].join(' '));
}
function search(q){const n=norm(q);return index.exercises.filter(item=>searchText(item).includes(n)).map(x=>x.id);}
function filter({muscle='',equipment='',pattern=''}){
  return index.exercises.filter(item=>
    (!muscle||allMuscles(item).includes(muscle))&&
    (!equipment||(item.equipment||[]).includes(equipment))&&
    (!pattern||item.movementPattern===pattern)
  ).map(x=>x.id);
}
function hasAll(actual,expected,label){
  for(const id of expected) if(!actual.includes(id)) fail(label+' missing '+id+'; got '+actual.join(', '));
}

hasAll(search('press banca'),['bench-press-barbell'],'canonical search');
hasAll(search('bench press'),['bench-press-barbell'],'English alias search');
hasAll(search('jalon al pecho'),['lat-pulldown'],'accent-insensitive alias search');
hasAll(search('pecho'),['bench-press-barbell','incline-dumbbell-press','cable-fly','parallel-bar-dip'],'muscle-group search');
hasAll(search('espalda'),['lat-pulldown','seated-cable-row','one-arm-dumbbell-row'],'back group search');
hasAll(search('barra'),['bench-press-barbell','overhead-press-barbell','barbell-curl','back-squat-barbell'],'equipment search');

const triceps=filter({muscle:'triceps-brachii'});
hasAll(triceps,['bench-press-barbell','incline-dumbbell-press','overhead-press-barbell','triceps-cable-pushdown','parallel-bar-dip'],'secondary-muscle filter');
const barbell=filter({equipment:'barbell'});
hasAll(barbell,['bench-press-barbell','overhead-press-barbell','barbell-curl','back-squat-barbell'],'barbell filter');
const squat=filter({pattern:'squat'});
hasAll(squat,['back-squat-barbell','leg-press'],'movement-pattern filter');

const primaryTabs=[...html.matchAll(/<button\b[^>]*class="[^"]*\btab-btn\b[^"]*"[^>]*id="tab-([^"]+)"/g)].map(m=>m[1]);
if(primaryTabs.length!==6) fail('Primary navigation must expose exactly six tabs in this acceptance round; got '+primaryTabs.length+'.');
if(!primaryTabs.includes('ejercicios')) fail('Exercise Library tab missing from primary navigation.');
if(!css.includes('grid-template-columns:repeat(6,minmax(0,1fr))')) fail('Desktop six-column nav CSS missing.');
if(!css.includes('grid-template-columns:repeat(6,1fr)')) fail('Mobile six-column nav CSS missing.');
if(!html.includes('id="exerciseLibrarySearch"')||!html.includes('id="exerciseLibraryMuscleFilter"')||!html.includes('id="exerciseLibraryEquipmentFilter"')||!html.includes('id="exerciseLibraryPatternFilter"')) fail('Browser search/filter controls missing.');
if(!ui.includes("role=\"tablist\"")||!ui.includes("role=\"tab\"")||!ui.includes("role=\"tabpanel\"")) fail('Exercise sheet ARIA tab semantics missing.');
for(const key of ['ArrowLeft','ArrowRight','Home','End']) if(!ui.includes(key)) fail('Exercise sheet keyboard navigation missing '+key+'.');
if(!ui.includes("train.setAttribute('inert','')")) fail('Training is not isolated behind the technical sheet.');
if(!toolsJs.includes("trainOverlay')?.removeAttribute('inert')")) fail('Training inert state is not restored on close.');
if(!ui.includes('exerciseLibraryWarmOffline')) fail('Offline warmup trigger missing.');
if(!sw.includes("d.type==='library-warmup'")) fail('Service worker warmup message handler missing.');

const swShell=sw.slice(sw.indexOf('const SHELL=['),sw.indexOf('];',sw.indexOf('const SHELL=[')));
if(swShell.includes('assets/exercise-library/')||swShell.includes('exercise-library/exercises/')) fail('Exercise assets still block critical app-shell install.');
if(!sw.includes('const LIBRARY_OFFLINE=')) fail('Library offline manifest missing.');

let assetBytes=0;
let assetCount=0;
const referenced=new Set();
for(const ex of exercises){
  const refs=[ex.media.thumbnail,ex.media.hero,ex.media.muscleMap,...ex.executionSteps.map(x=>x.asset),...ex.commonMistakes.map(x=>x.asset)];
  if(new Set(refs).size!==refs.length) fail(ex.id+': duplicate asset reference inside exercise.');
  for(const rel of refs){
    if(!rel||!rel.startsWith('assets/exercise-library/'+ex.id+'/')) fail(ex.id+': asset outside canonical folder: '+rel);
    if(referenced.has(rel)) fail('Asset referenced by multiple exercises: '+rel);
    referenced.add(rel);
    const abs=path.join(root,rel);
    if(!fs.existsSync(abs)) fail(ex.id+': missing asset '+rel);
    const stat=fs.statSync(abs);
    assetBytes+=stat.size;assetCount++;
    if(stat.size<250) fail(rel+': suspiciously small SVG.');
    if(stat.size>300*1024) fail(rel+': exceeds 300 KiB asset budget.');
    const svg=fs.readFileSync(abs,'utf8');
    if(!svg.includes('<svg')||!svg.includes('viewBox=')) fail(rel+': invalid SVG structure.');
    if(!svg.includes('role="img"')||!svg.includes('aria-label=')) fail(rel+': SVG lacks image semantics.');
    if(!svg.includes('data-style="anatomical-v2"')) fail(rel+': asset is not on Anatomical v2 visual system.');
    if(!svg.includes('<linearGradient')) fail(rel+': asset lost dimensional shading.');
    if(/<script\b|<foreignObject\b|\son[a-z]+\s*=/i.test(svg)) fail(rel+': unsafe active SVG content.');
    if(/<text\b/i.test(svg)) fail(rel+': essential text must stay in UI, not SVG.');
    if(!sw.includes(rel)) fail(rel+': missing from offline warmup manifest.');
  }
}
if(assetCount<160) fail('Expected a complete visual pack; only '+assetCount+' SVG refs found.');
if(assetBytes>1100*1024) fail('First Pack visual assets exceed 1.1 MiB acceptance budget: '+assetBytes+' bytes.');

function visualMuscleFamily(id){
  if(['anterior-deltoid','lateral-deltoid'].includes(id)) return 'deltoid';
  if(['biceps-brachii','brachialis'].includes(id)) return 'elbow-flexors';
  if(['latissimus-dorsi','rhomboids','middle-trapezius','upper-trapezius','erector-spinae'].includes(id)) return 'back';
  if(['quadriceps'].includes(id)) return 'quadriceps';
  if(['hamstrings'].includes(id)) return 'hamstrings';
  if(['gastrocnemius'].includes(id)) return 'calf';
  if(['triceps-brachii'].includes(id)) return 'triceps';
  if(['pectoralis-major'].includes(id)) return 'chest';
  if(['gluteus-maximus'].includes(id)) return 'glutes';
  return id;
}
function secondaryNeedsDistinctOrange(ex){
  const primaryFamilies=new Set((ex.taxonomy?.primaryMuscles||[]).map(visualMuscleFamily));
  const secondary=ex.taxonomy?.secondaryMuscles||[];
  return secondary.some(id=>!primaryFamilies.has(visualMuscleFamily(id)));
}
for(const ex of exercises){
  const hero=read(ex.media.hero).toLowerCase();
  const muscleMap=read(ex.media.muscleMap).toLowerCase();
  if(!hero.includes('#e94f48')) fail(ex.id+': hero is missing the standard primary coral #e94f48.');
  if(secondaryNeedsDistinctOrange(ex) && !(hero+muscleMap).includes('#f47a4a')) fail(ex.id+': visual pack is missing the standard secondary orange #f47a4a.');
}

if(!version.includes("1.1.0-alpha.2")||pkg.version!=='1.1.0-alpha.2'||lock.version!=='1.1.0-alpha.2'||lock.packages?.['']?.version!=='1.1.0-alpha.2') fail('Development version/cache isolation is inconsistent.');

console.log('LiftEngine Exercise Library acceptance OK · 15 exercises · '+assetCount+' Anatomical v2 SVG refs · '+Math.round(assetBytes/1024)+' KiB visuals · search/filter/offline/modal/navigation accepted');
