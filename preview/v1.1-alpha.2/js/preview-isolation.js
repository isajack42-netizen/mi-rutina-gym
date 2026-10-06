// LiftEngine preview isolation · alpha.2 · no cloud writes, isolated browser storage
'use strict';
(function(){
  const PREFIX='liftengine-preview-v1.1-alpha.2:';
  const PREVIEW_DB='liftengine-preview-v1.1-alpha.2';
  const STABLE_DB='liftengine-local';
  const nativeStorage=window.localStorage;
  const nativeIndexedDB=window.indexedDB;
  const keys=()=>{const out=[];for(let i=0;i<nativeStorage.length;i++){const k=nativeStorage.key(i);if(k&&k.startsWith(PREFIX))out.push(k);}return out;};
  const store={
    getItem(key){return nativeStorage.getItem(PREFIX+String(key));},
    setItem(key,value){nativeStorage.setItem(PREFIX+String(key),String(value));},
    removeItem(key){nativeStorage.removeItem(PREFIX+String(key));},
    clear(){keys().forEach(k=>nativeStorage.removeItem(k));},
    key(index){const k=keys()[index];return k?k.slice(PREFIX.length):null;},
    get length(){return keys().length;}
  };
  globalThis.PreviewLocalStorage=store;
  globalThis.LIFTENGINE_PREVIEW_MODE=true;
  const safeLocalKey=k=>k&&k.startsWith('gym')&&!/(LastUid|Pending|Synced|Updated|Dirty|Cloud|Train|Recovery|Backup|Atomic|IndexedDBPrimary)/i.test(k);
  function cloneLocalPreferences(){
    for(let i=0;i<nativeStorage.length;i++){
      const k=nativeStorage.key(i);
      if(safeLocalKey(k)&&store.getItem(k)===null){
        const value=nativeStorage.getItem(k);
        if(value!==null)store.setItem(k,value);
      }
    }
    store.setItem('gymLastUid','preview-local');
  }
  function openDb(name,create){
    return new Promise((resolve,reject)=>{
      const req=nativeIndexedDB.open(name,1);
      req.onupgradeneeded=()=>{
        if(!create)return;
        const db=req.result;
        if(!db.objectStoreNames.contains('days'))db.createObjectStore('days',{keyPath:'date'});
        if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings',{keyPath:'id'});
        if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('IndexedDB preview error'));
    });
  }
  function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Preview transaction failed'));tx.onabort=()=>reject(tx.error||new Error('Preview transaction aborted'));});}
  function getAll(db,name){
    if(!db.objectStoreNames.contains(name))return Promise.resolve([]);
    return new Promise((resolve,reject)=>{
      const req=db.transaction(name,'readonly').objectStore(name).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error||new Error('Preview seed read failed'));
    });
  }
  async function stableDbExists(){
    if(typeof nativeIndexedDB?.databases!=='function')return true;
    try{return (await nativeIndexedDB.databases()).some(db=>db.name===STABLE_DB);}catch(_){return true;}
  }
  async function cloneStableDb(){
    if(!nativeIndexedDB||store.getItem('__seededDb')==='1')return;
    if(!(await stableDbExists())){store.setItem('__seededDb','1');return;}
    let source=null,target=null;
    try{
      source=await openDb(STABLE_DB,false);
      const snapshot={};
      for(const name of ['days','settings','meta'])snapshot[name]=await getAll(source,name);
      target=await openDb(PREVIEW_DB,true);
      for(const name of ['days','settings','meta']){
        if(!target.objectStoreNames.contains(name))continue;
        const tx=target.transaction(name,'readwrite'),os=tx.objectStore(name);
        os.clear();snapshot[name].forEach(row=>os.put(row));await txDone(tx);
      }
      store.setItem('__seededDb','1');
    }catch(error){console.warn('LiftEngine Preview · no se pudo clonar el estado estable:',error);}
    finally{try{source?.close();target?.close();}catch(_){}}
  }
  cloneLocalPreferences();
  globalThis.LIFTENGINE_PREVIEW_READY=cloneStableDb();
})();