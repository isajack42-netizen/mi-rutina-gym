import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

const read=p=>fs.readFileSync(p,'utf8');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('OK · '+name);}
function element(){return {dataset:{},style:{},classList:{add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return '';},addEventListener(){},appendChild(){},remove(){},querySelector(){return element();},querySelectorAll(){return []},innerHTML:'',value:'',focus(){}};}
function harness(){
  const values=new Map([['gymLastUid','test-user']]), nodes=new Map();
  const localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size;}};
  const ctx={console:{log(){},warn(){},error(){}},localStorage,indexedDB:new IDBFactory(),structuredClone,Date,Math,Map,Set,Blob,URL,HTMLElement:class{},navigator:{},location:{reload(){}},addEventListener(){},setTimeout:()=>1,clearTimeout(){},clearInterval(){},setInterval:()=>1,requestAnimationFrame(){},getComputedStyle:()=>({getPropertyValue:()=>''}),document:{body:element(),documentElement:element(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},querySelector:()=>element(),querySelectorAll:()=>[],createElement:()=>element(),addEventListener(){}}};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
  for(const f of ['config','storage','core','settings','logbook','metrics','dashboard','tools','routines','training','recovery'])vm.runInContext(read('js/'+f+'.js'),ctx,{filename:f+'.js'});
  const run=code=>vm.runInContext(code,ctx);
  run(`toast=()=>{};refreshAll=()=>{};renderTrain=()=>{};renderTrainCTA=()=>{};closeTrainUI=()=>{};closeModal=()=>{};showUndo=()=>{};appAlert=async()=>true;appConfirm=async()=>true;applyTheme=()=>{};stopTimer=()=>{};notifCancel=()=>{};`);
  return {ctx,run,values,nodes};
}
async function seeded(){
  const h=harness();await h.run('load()');await h.run('loadRecoveryJournal()');
  h.run(`data={'2026-10-05':[{id:1,name:'Press',isCardio:false,sets:[{setNumber:1,reps:10,weight:40,rir:2,done:true},{setNumber:2,reps:9,weight:40,rir:2,done:false}],trainingDraft:true}]};data=sanitizeData(data);categories={'2026-10-05':'Push'};weights=[{date:'2026-10-05',weight:78}];markDayDirty('2026-10-05');markSettingsDirty();`);
  await h.run('persistLocal()');return h;
}
await test('failed local save cannot report success or start a cloud push',async()=>{
  const h=await seeded();h.run(`LiftLocalDB.commit=async()=>{throw new Error('QuotaExceededError')};cloudReady=true;fb={};cloudMode='v2';window.pushes=0;saveCloudV2Changes=async()=>{pushes++};`);
  assert.equal(await h.run("saveToFirebase({days:['2026-10-05']})"),false);
  assert.equal(h.run('pushes'),0);assert.equal(h.run('localDirtyDays.has("2026-10-05")'),true);assert.match(h.run('localSaveError'),/Quota/);
});
await test('IndexedDB transaction atomically aborts days, settings and metadata',async()=>{
  const h=await seeded(),before=await h.ctx.LiftLocalDB.getAllDays();
  await assert.rejects(h.ctx.LiftLocalDB.commit({replace:true,records:[{date:'2026-10-06',entries:[]}],settings:{bad:()=>{}},meta:[['probe',true]]}));
  assert.deepEqual(await h.ctx.LiftLocalDB.getAllDays(),before);assert.equal(await h.ctx.LiftLocalDB.getMeta('probe'),null);
});
await test('delete + undo preserves body weight, settings and full series',async()=>{
  const h=await seeded(),before=h.run('JSON.stringify(data)');
  assert.equal(await h.run(`recoverableChange('Eliminar registro',{days:['2026-10-05']},()=>{delete data['2026-10-05'];})`),true);
  const id=h.run('recoveryItems.at(-1).id');await h.ctx.undoRecovery(id);
  assert.equal(h.run('JSON.stringify(data)'),before);assert.equal(h.run('weights[0].weight'),78);
});
await test('undo refuses to overwrite later edits',async()=>{
  const h=await seeded();await h.run(`recoverableChange('Eliminar',{days:['2026-10-05']},()=>{delete data['2026-10-05'];})`);
  const id=h.run('recoveryItems.at(-1).id');h.run("weights[0].weight=77;");await h.ctx.undoRecovery(id);
  assert.equal(h.run("data['2026-10-05']"),undefined);assert.equal(h.run('weights[0].weight'),77);
});
await test('checkpoint failure blocks destructive mutation',async()=>{
  const h=await seeded();h.run("LiftLocalDB.setMeta=async()=>{throw new Error('Quota')};");
  assert.equal(await h.run(`recoverableChange('Eliminar',{days:['2026-10-05']},()=>{delete data['2026-10-05'];})`),false);
  assert.equal(h.run("data['2026-10-05'].length"),1);
});
await test('failed destructive commit rolls memory back to its saved checkpoint',async()=>{
  const h=await seeded();h.run("LiftLocalDB.commit=async()=>{throw new Error('Quota')};");
  assert.equal(await h.run(`recoverableChange('Eliminar',{days:['2026-10-05']},()=>{delete data['2026-10-05'];})`),false);
  assert.equal(Number(h.run("data['2026-10-05'][0].sets[1].reps")),9);
});
await test('session older than 12 hours retains typed but unchecked series',async()=>{
  const h=await seeded();h.run(`train={date:'2026-10-05',order:[1],idx:0,startedAt:Date.now()-13*3600e3};openTraining=()=>{};resumeTrainingIfAny();`);
  assert.equal(h.run("data['2026-10-05'][0].sets.length"),2);assert.equal(h.run('train.order[0]'),1);
});
await test('reload recovers session and dirty tombstones without localStorage markers',async()=>{
  const h=await seeded();h.run(`train={date:'2026-10-05',routine:'Push',order:[1],idx:0,startedAt:Date.now()};markDayDirty('2026-10-04');`);await h.run('persistLocal()');
  h.run(`localStorage.removeItem(dirtyDaysKey());localStorage.removeItem(dirtySettingsKey());localStorage.removeItem(PENDING_KEY);train=null;`);
  await h.run('load()');assert.equal(h.run('train.order[0]'),1);assert.equal(h.run("cloudDirtyDays.has('2026-10-04')"),true);assert.equal(Number(h.run("data['2026-10-05'][0].sets[1].reps")),9);
});
await test('legacy fallback returns true only after atomic snapshot write',async()=>{
  const h=harness();h.run(`localStoreReady=false;train=null;`);assert.equal(await h.run('persistLocal()'),true);assert.ok(h.values.has('gymAtomicSnapshotV1'));
  h.run(`localStorage.setItem=()=>{throw new Error('Quota')};`);assert.equal(await h.run('persistLocal()'),false);
});
await test('a delayed local commit never clears a newer mutation',async()=>{
  const h=await seeded();h.run(`window.commitOriginal=LiftLocalDB.commit;window.releaseCommit=null;LiftLocalDB.commit=async args=>{await new Promise(r=>{releaseCommit=r});return commitOriginal(args)};markDayDirty('2026-10-05');`);
  const pending=h.run('persistLocal()');await Promise.resolve();h.run(`data['2026-10-05'][0].sets[0].reps=11;markDayDirty('2026-10-05');releaseCommit();`);await pending;
  assert.equal(h.run("localDirtyDays.has('2026-10-05')"),true);
});
await test('full restore + undo removes replacement dates and recovers originals',async()=>{
  const h=await seeded();await h.run(`recoverableChange('Restaurar',{allDays:true,settings:true,training:true},()=>{data={};categories={};weights=[{date:'2026-10-06',weight:75}];})`);
  const id=h.run('recoveryItems.at(-1).id');await h.ctx.undoRecovery(id);
  const days=await h.ctx.LiftLocalDB.getAllDays();assert.deepEqual(days.map(x=>x.date),['2026-10-05']);assert.equal(h.run('weights[0].weight'),78);
});
await test('canceling a cloud conflict retains the local version and pending marker',async()=>{
  const h=await seeded();h.run(`chooseCloudConflict=async()=>{throw new Error('cancelada')};`);
  await assert.rejects(h.run(`resolveDayConflict('2026-10-05',{deleted:true,revision:2})`),/cancelada/);
  assert.equal(h.run("data['2026-10-05'].length"),1);assert.equal(h.run("cloudDirtyDays.has('2026-10-05')"),true);
});
await test('choosing cloud preserves a recoverable local copy and accepts tombstone',async()=>{
  const h=await seeded();h.run(`chooseCloudConflict=async()=>false;`);
  assert.equal(await h.run(`resolveDayConflict('2026-10-05',{deleted:true,revision:2})`),'cloud');
  assert.equal(h.run("data['2026-10-05']"),undefined);assert.equal(Number(h.run("recoveryItems.at(-1).before.days['2026-10-05'].entries[0].sets[1].reps")),9);
});
await test('edits during a conflict dialog prevent stale replacement',async()=>{
  const h=await seeded();h.run(`chooseCloudConflict=async()=>{data['2026-10-05'][0].sets[0].reps=12;return false;};`);
  await assert.rejects(h.run(`resolveDayConflict('2026-10-05',{deleted:true,revision:2})`),/cambió/);
  assert.equal(h.run("data['2026-10-05'][0].sets[0].reps"),12);
});
await test('late cloud acknowledgment does not clear edits made during the push',async()=>{
  const h=await seeded();h.run(`cloudSettingsDirty=0;cloudMeta.days={};saveCloudMeta=()=>{};loadCloudMeta=()=>{};fb={db:{},doc:()=>({}),serverTimestamp:()=>0,runTransaction:async(_,fn)=>{await fn({get:async()=>({exists:()=>false}),set:()=>{}});data['2026-10-05'][0].sets[0].reps=12;markDayDirty('2026-10-05');}};`);
  await h.run('saveCloudV2Changes()');assert.equal(h.run("cloudDirtyDays.has('2026-10-05')"),true);assert.equal(h.run("data['2026-10-05'][0].sets[0].reps"),12);
});
await test('network rejection retains cloud dirty markers',async()=>{
  const h=await seeded();h.run(`cloudReady=true;cloudMode='v2';fb={db:{},doc:()=>({}),runTransaction:async()=>{throw new Error('offline')}};`);
  assert.equal(await h.run('saveToFirebase()'),false);assert.equal(h.run("cloudDirtyDays.has('2026-10-05')"),true);
});
await test('downloaded scoped recovery can be imported without replacing other days',async()=>{
  const h=await seeded();await h.run(`recoverableChange('Eliminar',{days:['2026-10-05']},()=>{delete data['2026-10-05'];})`);
  const item=JSON.parse(h.run('JSON.stringify(recoveryItems.at(-1))'));h.run(`weights.push({date:'2026-10-06',weight:76});`);
  await h.ctx.importRecoveryFile({...item,type:'liftengine-recovery'});
  assert.equal(h.run("data['2026-10-05'].length"),1);assert.equal(h.run("weights.find(x=>x.date==='2026-10-06').weight"),76);
});
await test('two tabs start only under the same exclusive storage lock',async()=>{
  const h=harness();let requested,callback;h.ctx.navigator.locks={request:(name,fn)=>{requested=name;callback=fn;return new Promise(()=>{});}};
  let starts=0;h.ctx.startWithStorageLock(async()=>{starts++});assert.equal(starts,0);assert.equal(requested,'liftengine-local-writer');callback();await Promise.resolve();assert.equal(starts,1);
});
await test('closing the app without an active training session can flush safely',async()=>{
  const h=await seeded();h.run('appOwnsStorage=true;reliabilityLoaded=true;train=null;flushLocalOnHide();');await h.run('localPersistChain');
});
await test('finished session can be undone including its unchecked repetitions',async()=>{
  const h=await seeded();h.run("train={date:'2026-10-05',routine:'Push',order:[1],idx:0,startedAt:Date.now()};");
  await h.ctx.trainEnd(false);assert.equal(h.run('train'),null);assert.equal(h.run("data['2026-10-05'][0].sets.length"),1);
  await h.ctx.undoRecovery(h.run('recoveryItems.at(-1).id'));
  assert.equal(h.run('train.order[0]'),1);assert.equal(h.run("data['2026-10-05'][0].sets[1].done"),false);
});
await test('settings conflict uses fresh settings for its retry',async()=>{
  const h=await seeded();h.run(`window.attempts=0;window.written=null;fb={db:{},doc:()=>({}),serverTimestamp:()=>0,getDoc:async()=>({exists:()=>true,data:()=>({revision:2,weeklySessionTarget:2})}),runTransaction:async(_,fn)=>{attempts++;if(attempts===1)throw new Error('LIFTENGINE_SETTINGS_CONFLICT');await fn({get:async()=>({exists:()=>true,data:()=>({revision:2})}),set:(_,value)=>{written=value}});}};resolveSettingsConflict=async()=>{weeklySessionTarget=4;return true;};`);
  assert.equal(await h.run('writeSettingsV2()'),true);assert.equal(h.run('written.weeklySessionTarget'),4);assert.equal(h.run('written.revision'),3);
});
await test('two devices converge after a same-day conflict without losing the rejected copy',async()=>{
  const a=await seeded(),b=await seeded();let remote=null;
  const transport={db:{},doc:()=>({}),serverTimestamp:()=>0,getDoc:async()=>({exists:()=>!!remote,data:()=>structuredClone(remote)}),runTransaction:async(_,fn)=>{let next;await fn({get:async()=>({exists:()=>!!remote,data:()=>structuredClone(remote)}),set:(_,value)=>{next=structuredClone(value);}});if(next)remote=next;}};
  a.ctx.transport=transport;b.ctx.transport=transport;a.run('fb=transport;');b.run('fb=transport;');
  assert.equal(await a.run("writeDayV2('2026-10-05')"),true);
  b.run("data['2026-10-05'][0].sets[0].reps='12';chooseCloudConflict=async()=>true;");assert.equal(await b.run("writeDayV2('2026-10-05')"),true);
  assert.equal(remote.revision,2);assert.equal(remote.entries[0].sets[0].reps,'12');
  a.run('chooseCloudConflict=async()=>false;');assert.equal(await a.run("writeDayV2('2026-10-05')"),true);
  assert.equal(a.run("data['2026-10-05'][0].sets[0].reps"),'12');assert.equal(a.run("recoveryItems.at(-1).before.days['2026-10-05'].entries[0].sets[0].reps"),'10');
});
await test('accepting a remote tombstone in a pull does not resurrect rejected drafts',async()=>{
  const h=await seeded();h.run(`loadCloudMeta=()=>{};saveCloudMeta=()=>{};chooseCloudConflict=async()=>false;saveCloudV2Changes=async()=>{};cloudMeta.settings={revision:1,hash:settingsHash()};cloudSettingsDirty=0;fetchCloudDaysV2=async()=>({full:false,remote:new Map([['2026-10-05',{deleted:true,revision:2}]])});`);
  await h.run('syncCloudV2({revision:1,...buildSettingsSnapshot()})');assert.equal(h.run("data['2026-10-05']"),undefined);
});
await test('invalid routine edit never renames or removes the existing routine',async()=>{
  const h=await seeded();h.run("customRoutines={Push:[{name:'Press',sets:3}]};");const input=h.ctx.document.getElementById('editRoutineName');input.value='Nuevo';input.getAttribute=()=> 'Push';
  await h.ctx.saveRoutine();assert.equal(h.run('customRoutines.Push.length'),1);assert.equal(h.run('customRoutines.Nuevo'),undefined);
});
await test('recovery journal remains available after reload and is account scoped',async()=>{
  const h=await seeded();await h.run(`recoverableChange('Eliminar',{days:['2026-10-05']},()=>{delete data['2026-10-05'];})`);await h.run('localPersistChain');
  h.run('recoveryItems=[];');await h.run('loadRecoveryJournal()');assert.equal(h.run('recoveryItems.length'),1);
  h.run("DOC_ID='different-user';");await h.run('loadRecoveryJournal()');assert.equal(h.run('recoveryItems.length'),0);
});
await test('offline service worker never mixes scripts from different releases',async()=>{
  const handlers={},cache={match:async()=>undefined,put:async()=>{}};
  const sw={self:{LIFTENGINE_VERSION:'6.11.0',location:{origin:'https://test.invalid'},addEventListener:(n,f)=>handlers[n]=f},importScripts(){},caches:{open:async()=>cache},URL,AbortController,Response,fetch:async()=>{throw new Error('offline')},setTimeout:()=>1,clearTimeout(){}};
  vm.createContext(sw);vm.runInContext(read('sw.js'),sw);
  let response;handlers.fetch({request:{method:'GET',url:'https://test.invalid/js/core.js?v=6.12.0',mode:'cors'},respondWith:p=>response=p});
  assert.equal((await response).type,'error');
  const cached=new Response('known release');cache.match=async request=>request.url?.includes('6.11.0')?cached:undefined;
  handlers.fetch({request:{method:'GET',url:'https://test.invalid/js/core.js?v=6.11.0',mode:'cors'},respondWith:p=>response=p});assert.equal(await (await response).text(),'known release');
});
console.log(`LiftEngine reliability OK · ${passed} scenarios · fake IndexedDB + controlled cloud transport`);
