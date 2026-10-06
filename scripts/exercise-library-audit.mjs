import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lib = path.join(root, 'exercise-library');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = msg => { throw new Error('[Exercise Library] ' + msg); };
const norm = s => String(s).trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const uniqIds = arr => new Set(arr.map(x => x.id));

const taxonomy = readJson(path.join(lib, 'taxonomy.json'));
const planned = readJson(path.join(lib, 'planned-exercises.json'));
const index = readJson(path.join(lib, 'index.json'));
const exerciseDir = path.join(lib, 'exercises');
const files = fs.readdirSync(exerciseDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) fail('No exercise files found.');

const muscleIds = uniqIds(taxonomy.muscles);
const patternIds = uniqIds(taxonomy.movementPatterns);
const equipmentIds = uniqIds(taxonomy.equipment);
const difficultyIds = uniqIds(taxonomy.difficulties);
const goalIds = uniqIds(taxonomy.goals);
const plannedIds = uniqIds(planned.exercises);
const indexIds = uniqIds(index.exercises || []);

if (plannedIds.size !== planned.exercises.length) fail('Duplicate IDs in planned-exercises.json.');
if (indexIds.size !== (index.exercises || []).length) fail('Duplicate IDs in index.json.');

const ids = new Set();
const aliasOwner = new Map();
const exercises = [];

for (const file of files) {
  const ex = readJson(path.join(exerciseDir, file));
  exercises.push(ex);

  if (ex.schemaVersion !== 1) fail(file + ': unsupported schemaVersion.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ex.id || '')) fail(file + ': invalid id.');
  if (file !== ex.id + '.json') fail(file + ': filename must match exercise id.');
  if (ids.has(ex.id)) fail(file + ': duplicate exercise id.');
  ids.add(ex.id);
  if (!plannedIds.has(ex.id)) fail(file + ': exercise is not registered in planned-exercises.json.');
  const indexItem=(index.exercises||[]).find(x=>x.id===ex.id);
  if(!indexItem) fail(file + ': exercise is missing from index.json.');
  if(indexItem.name!==ex.name) fail(file + ': index canonical name does not match.');
  if(JSON.stringify(indexItem.aliases||[])!==JSON.stringify(ex.aliases||[])) fail(file + ': index aliases do not match.');

  if (!ex.name || !Array.isArray(ex.aliases) || ex.locale !== 'es-MX') fail(file + ': identity fields incomplete.');
  const localNames = [ex.name, ...ex.aliases].map(norm);
  if (new Set(localNames).size !== localNames.length) fail(file + ': duplicate canonical name/alias.');

  for (const raw of [ex.name, ...ex.aliases]) {
    const key = norm(raw);
    const owner = aliasOwner.get(key);
    if (owner && owner !== ex.id) fail('Alias/name collision: "' + raw + '" -> ' + owner + ' / ' + ex.id);
    aliasOwner.set(key, ex.id);
  }

  const t = ex.taxonomy || {};
  for (const id of [...(t.primaryMuscles || []), ...(t.secondaryMuscles || []), ...(t.stabilizers || [])]) {
    if (!muscleIds.has(id)) fail(file + ': unknown muscle ' + id);
  }
  if (!patternIds.has(t.movementPattern)) fail(file + ': unknown movement pattern.');
  for (const id of t.equipment || []) if (!equipmentIds.has(id)) fail(file + ': unknown equipment ' + id);
  if (!difficultyIds.has(t.difficulty)) fail(file + ': unknown difficulty.');
  for (const id of t.goals || []) if (!goalIds.has(id)) fail(file + ': unknown goal ' + id);

  if (!Array.isArray(ex.executionSteps) || ex.executionSteps.length < 4 || ex.executionSteps.length > 8) fail(file + ': expected 4-8 execution steps.');
  ex.executionSteps.forEach((s, i) => {
    if (s.step !== i + 1) fail(file + ': execution steps must be sequential.');
  });

  if (!Array.isArray(ex.commonMistakes) || ex.commonMistakes.length < 2 || ex.commonMistakes.length > 6) fail(file + ': expected 2-6 common mistakes.');
  const mistakeIds = ex.commonMistakes.map(x => x.id);
  if (new Set(mistakeIds).size !== mistakeIds.length) fail(file + ': duplicate mistake id.');

  for (const group of ['variants','substitutions','relatedExercises']) {
    if (!Array.isArray(ex[group])) fail(file + ': ' + group + ' must be an array.');
    for (const rel of ex[group]) {
      if (!plannedIds.has(rel.exerciseId)) fail(file + ': relation points to unplanned id ' + rel.exerciseId);
      if (rel.exerciseId === ex.id) fail(file + ': self relation in ' + group);
    }
  }

  const media = ex.media || {};
  if (!['planned','in-progress','ready'].includes(media.status)) fail(file + ': invalid media status.');
  const base = 'assets/exercise-library/' + ex.id + '/';
  const assetPaths=[];
  for (const key of ['thumbnail','hero','muscleMap']) {
    const p = media[key];
    if (p && (!p.startsWith(base) || p.includes('..'))) fail(file + ': invalid media path ' + key);
    if(p) assetPaths.push(p);
  }
  for(const step of ex.executionSteps||[]) if(step.asset) assetPaths.push(step.asset);
  for(const mistake of ex.commonMistakes||[]) if(mistake.asset) assetPaths.push(mistake.asset);
  if(media.status==='ready'){
    if(assetPaths.length < 3 + ex.executionSteps.length + ex.commonMistakes.length) fail(file + ': ready media pack is incomplete.');
    for(const rel of assetPaths){
      const abs=path.join(root,rel);
      if(!fs.existsSync(abs)) fail(file + ': ready asset missing: ' + rel);
      const bytes=fs.statSync(abs).size;
      if(bytes<=0||bytes>300*1024) fail(file + ': asset outside pilot size budget: ' + rel);
      if(rel.endsWith('.svg')){
        const svg=fs.readFileSync(abs,'utf8');
        if(!svg.includes('<svg')||!svg.includes('viewBox=')) fail(file + ': invalid SVG asset: ' + rel);
        if(/<text\b/i.test(svg)) fail(file + ': SVG contains embedded text: ' + rel);
      }
    }
  }
}

const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const routines=fs.readFileSync(path.join(root,'js/routines.js'),'utf8');
const training=fs.readFileSync(path.join(root,'js/training.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'js/exercise-library.js'),'utf8');

if(!app.includes("'exercise-library'")) fail('exercise-library.js is not in runtime loader.');
if(!sw.includes("q('exercise-library/index.json')")||!sw.includes("q('exercise-library/taxonomy.json')")||!sw.includes('exercise-library/planned-exercises.json')) fail('library metadata is not precached.');
for(const ex of exercises){
  if(ex.media?.status!=='ready') continue;
  const required=['exercise-library/exercises/'+ex.id+'.json',ex.media.thumbnail,ex.media.hero,ex.media.muscleMap,...ex.executionSteps.map(x=>x.asset),...ex.commonMistakes.map(x=>x.asset)];
  for(const p of required) if(!sw.includes(p)) fail(ex.id+': ready resource missing from offline shell: '+p);
}
if(!routines.includes('exerciseLibraryButtonHtml')) fail('routine integration is missing.');
if(!training.includes('exerciseLibraryButtonHtml')) fail('training integration is missing.');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!html.includes('id="tab-ejercicios"')||!html.includes('id="exerciseLibraryBrowserList"')) fail('Exercise Library browser tab is missing.');
if(!ui.includes('renderExerciseLibraryBrowser')||!ui.includes('exerciseLibraryInitFilters')) fail('Exercise Library browser logic is missing.');
for(const marker of ['Visión general','Técnica','Músculos','Variantes','Errores comunes','exerciseLibraryTabKey','exercise-step-media','exercise-mistake-media']){
  if(!ui.includes(marker)) fail('pilot UI marker missing: '+marker);
}
console.log('LiftEngine exercise library OK · ' + exercises.length + ' exercise(s) · ' + planned.exercises.length + ' planned · ' + taxonomy.muscles.length + ' muscles · ' + exercises.filter(x=>x.media?.status==='ready').length + ' ready offline packs');
