import {makeScanner} from './scanner-ui.js';
const button=document.getElementById('activate-app'),message=document.getElementById('activation-message');
const offlinePanel=document.getElementById('offline-panel'),offlineStatus=document.getElementById('offline-status'),progress=document.getElementById('offline-progress'),download=document.getElementById('download-offline');
let active=false,registration=null,downloading=false;
async function refreshActivation(){
  active=await FeriaStore.activated();document.body.classList.toggle('activation-required',!active);
  if(active){const template=document.getElementById('locked-experiences');if(template)template.replaceWith(template.content.cloneNode(true));button.innerHTML='¡Comencemos la aventura! <span aria-hidden="true">↓</span>';message.textContent='¡App activada! El mismo QR de la feria ya habilitó las siete experiencias en este dispositivo.';offlinePanel.hidden=false;}
  else message.textContent='Escanea una sola vez el QR de la feria para habilitar las siete experiencias. En iPhone, añade primero esta app a tu pantalla de inicio.';
}
const scanner=makeScanner(refreshActivation);
button.addEventListener('click',()=>{if(active)document.getElementById('experiencias').scrollIntoView({behavior:'smooth'});else scanner.start();});
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)document.getElementById('install-guide').hidden=true;
function workerMessage(data){
  if(data.type==='OFFLINE_PROGRESS'){downloading=true;download.disabled=true;progress.hidden=false;progress.value=data.percent;offlineStatus.textContent=`Guardando ${data.done} de ${data.total} recursos (${data.percent} %). Mantén la app abierta.`;}
  if(data.type==='OFFLINE_READY'){downloading=false;download.disabled=false;download.textContent='Comprobar descarga';progress.hidden=false;progress.value=100;offlineStatus.textContent='Todo listo sin Internet: juegos, imágenes y 27 audios guardados en este dispositivo.';}
  if(data.type==='OFFLINE_ERROR'){downloading=false;download.disabled=false;offlineStatus.textContent='La descarga quedó incompleta. Comprueba tu conexión y el espacio disponible; pulsa de nuevo para continuar.';}
  if(data.type==='OFFLINE_STATUS'&&!downloading){if(data.ready)workerMessage({type:'OFFLINE_READY'});else{download.disabled=false;download.textContent='Guardar juegos y audios';offlineStatus.textContent=`Guarda los juegos y audios para usarlos sin Internet: aproximadamente ${data.megabytes} MB.`;}}
}
async function setupWorker(){
  if(!('serviceWorker' in navigator)||!isSecureContext){download.disabled=true;offlineStatus.textContent='Para guardar la app sin Internet, ábrela desde un hosting con HTTPS.';return;}
  try{
    navigator.serviceWorker.addEventListener('message',event=>workerMessage(event.data));
    registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href));
    try{registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});}catch(e){if(!registration?.active)throw e;}
    if(!registration.active)await navigator.serviceWorker.ready;
    (registration.active||navigator.serviceWorker.controller)?.postMessage({type:'OFFLINE_STATUS'});
  }
  catch(e){download.disabled=true;offlineStatus.textContent='No se pudo preparar el modo sin Internet. Recarga la página con conexión o comprueba la configuración del hosting.';}
}
download.addEventListener('click',async()=>{
  if(!active||downloading)return;
  try{await navigator.storage?.persist?.();}catch(e){}
  const worker=registration?.active||navigator.serviceWorker?.controller;
  if(!worker){offlineStatus.textContent='La app todavía se está preparando. Espera un momento y vuelve a intentarlo.';return;}
  download.disabled=true;offlineStatus.textContent='Comprobando los recursos guardados…';worker.postMessage({type:'DOWNLOAD_OFFLINE'});
});
window.addEventListener('pageshow',refreshActivation);
await refreshActivation();setupWorker();
