// LiftEngine · avisos de descanso y optimización de teclado móvil
'use strict';
// ===== AVISOS DEL SISTEMA PARA EL DESCANSO =====
function isIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); }
function isStandalone(){ return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true; }
function notifState(){
  if(!('Notification' in window)||!('serviceWorker' in navigator)) return 'unsupported';
  if(isIOS()&&!isStandalone()) return 'needs-install';
  if(Notification.permission==='denied') return 'denied';
  if(Notification.permission==='granted') return PreviewLocalStorage.getItem('gymNotif')==='0'?'off':'on';
  return 'off';
}
function notifBody(){ try{ const e=train&&trainCur(); return e?('Siguiente serie · '+e.name):'Hora de tu siguiente serie'; }catch(_){ return 'Hora de tu siguiente serie'; } }
async function swReg(){ return Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error('sw')),2500))]); }
async function notifShow(title,body){
  try{ const reg=await swReg(); await reg.showNotification(title,{body,tag:'liftengine-rest',renotify:true,vibrate:[200,100,200,100,200],icon:'icons/icon-192.png',badge:'icons/icon-192.png'}); }catch(e){}
}
async function notifSchedule(){
  if(notifState()!=='on') return;
  try{ const reg=await swReg(); if(reg.active) reg.active.postMessage({type:'rest-start',endAt:window.timerEndAt,title:'Descanso terminado',body:notifBody()}); }catch(e){}
}
async function notifCancel(){ try{ const reg=await swReg(); if(reg.active) reg.active.postMessage({type:'rest-cancel'}); }catch(e){} }
async function notifClear(){ try{ const reg=await swReg(); (await reg.getNotifications({tag:'liftengine-rest'})).forEach(n=>n.close()); }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) notifClear(); });
window.toggleNotifications=async function(silent){
  const st=notifState();
  if(st==='unsupported'){ toast('Tu navegador no admite notificaciones'); return; }
  if(st==='needs-install'){ await appAlert('En iPhone las notificaciones solo funcionan con la app instalada.\n\nSafari → Compartir → Añadir a pantalla de inicio, y ábrela desde ese icono.','Instala LiftEngine'); return; }
  if(st==='denied'){ await appAlert('Las notificaciones están bloqueadas para esta página.\n\nActívalas en los ajustes del sistema o del navegador (Notificaciones → LiftEngine / Chrome).','Notificaciones bloqueadas'); return; }
  if(st==='on'){ try{PreviewLocalStorage.setItem('gymNotif','0')}catch(e){} notifCancel(); }
  else{
    const p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(p==='granted'){ try{PreviewLocalStorage.setItem('gymNotif','1')}catch(e){} notifShow('Avisos activados','Te avisaremos cuando termine tu descanso.'); }
    else toast('Permiso no concedido');
  }
  if(!silent) renderSettingsModal();
};
async function notifOffer(){
  if(notifState()!=='off'||Notification.permission!=='default'||PreviewLocalStorage.getItem('gymNotifAsked')) return;
  try{ PreviewLocalStorage.setItem('gymNotifAsked','1'); }catch(e){}
  if(await appConfirm('¿Quieres recibir avisos de descanso? En segundo plano funcionan cuando el sistema mantiene activa la PWA.',{title:'Avisos de descanso',confirmText:'Activar'})) toggleNotifications(true);
}

// ===== TECLADO NUMÉRICO EN MÓVIL (inputmode) =====
const NUM_SEL={'.set-weight,#cardioDist,#mwWeight,#calcTarget,#calcBar,#mmWaist,#mmChest,#mmArm,#mmThigh,#mmHip,.tr-w':'decimal',
               '.set-reps,.set-rir,#cardioTime,.re-sets,.tr-r,.tr-rir':'numeric'};
let numPadQueued=false;
function applyNumPad(){
  numPadQueued=false;
  for(const [sel,mode] of Object.entries(NUM_SEL)) document.querySelectorAll(sel).forEach(el=>{
    if(el.getAttribute('inputmode')===mode) return;
    el.setAttribute('inputmode',mode); el.setAttribute('enterkeyhint','next'); el.setAttribute('autocomplete','off');
  });
}
new MutationObserver(()=>{ if(!numPadQueued){numPadQueued=true;requestAnimationFrame(applyNumPad)} }).observe(document.body,{childList:true,subtree:true});
applyNumPad();
document.addEventListener('focusin',e=>{ const t=e.target; if(t&&t.matches&&t.matches('input[inputmode]')) setTimeout(()=>{try{t.select()}catch(_){}},0); });

