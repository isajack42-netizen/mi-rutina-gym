// LiftEngine · almacenamiento local IndexedDB (v5.6)
'use strict';
(function(){
  const DB_NAME='liftengine-local';
  const DB_VERSION=1;
  const DAY_STORE='days';
  const SETTINGS_STORE='settings';
  const META_STORE='meta';
  let dbPromise=null;

  function supported(){ return typeof indexedDB!=='undefined'; }
  function requestPromise(req){ return new Promise((resolve,reject)=>{ req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error||new Error('IndexedDB request failed')); }); }
  function txDone(tx){ return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed')); tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted')); }); }
  function open(){
    if(!supported()) return Promise.reject(new Error('IndexedDB no disponible'));
    if(dbPromise) return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(DAY_STORE)) db.createObjectStore(DAY_STORE,{keyPath:'date'});
        if(!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE,{keyPath:'id'});
        if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE,{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>{dbPromise=null;reject(req.error||new Error('No se pudo abrir IndexedDB'));};
      req.onblocked=()=>console.warn('LiftEngine · IndexedDB bloqueada por otra pestaña');
    });
    return dbPromise;
  }
  async function getAllDays(){ const db=await open(), tx=db.transaction(DAY_STORE,'readonly'); return requestPromise(tx.objectStore(DAY_STORE).getAll()); }
  async function putDays(records){
    if(!records?.length) return;
    const db=await open(), tx=db.transaction(DAY_STORE,'readwrite'), store=tx.objectStore(DAY_STORE);
    records.forEach(r=>store.put(r)); await txDone(tx);
  }
  async function deleteDays(dates){
    if(!dates?.length) return;
    const db=await open(), tx=db.transaction(DAY_STORE,'readwrite'), store=tx.objectStore(DAY_STORE);
    dates.forEach(d=>store.delete(d)); await txDone(tx);
  }
  async function replaceDays(records){
    const db=await open(), tx=db.transaction(DAY_STORE,'readwrite'), store=tx.objectStore(DAY_STORE);
    store.clear(); (records||[]).forEach(r=>store.put(r)); await txDone(tx);
  }
  async function getSettings(){ const db=await open(), tx=db.transaction(SETTINGS_STORE,'readonly'); return (await requestPromise(tx.objectStore(SETTINGS_STORE).get('main')))||null; }
  async function putSettings(value){ const db=await open(), tx=db.transaction(SETTINGS_STORE,'readwrite'); tx.objectStore(SETTINGS_STORE).put({id:'main',...value}); await txDone(tx); }
  async function getMeta(key){ const db=await open(), tx=db.transaction(META_STORE,'readonly'); const v=await requestPromise(tx.objectStore(META_STORE).get(key)); return v? v.value : null; }
  async function setMeta(key,value){ const db=await open(), tx=db.transaction(META_STORE,'readwrite'); tx.objectStore(META_STORE).put({key,value}); await txDone(tx); }
  async function clearAll(){
    if(!supported()) return;
    const db=await open(), tx=db.transaction([DAY_STORE,SETTINGS_STORE,META_STORE],'readwrite');
    tx.objectStore(DAY_STORE).clear(); tx.objectStore(SETTINGS_STORE).clear(); tx.objectStore(META_STORE).clear(); await txDone(tx);
  }
  async function countDays(){ const db=await open(), tx=db.transaction(DAY_STORE,'readonly'); return requestPromise(tx.objectStore(DAY_STORE).count()); }

  globalThis.LiftLocalDB={supported,open,getAllDays,putDays,deleteDays,replaceDays,getSettings,putSettings,getMeta,setMeta,clearAll,countDays};
})();
