import {makeScanner} from './scanner-ui.js';
const button=document.getElementById('activate-app'),message=document.getElementById('activation-message');
const activationStep=document.getElementById('activation-step'),preparation=document.getElementById('preparation');
const offlinePanel=document.getElementById('offline-panel'),offlineStatus=document.getElementById('offline-status'),progress=document.getElementById('offline-progress'),download=document.getElementById('download-offline');
let active=false,registration=null,downloading=false,attempted=false,entered=false,entering=false;
function worker(){return registration?.active||navigator.serviceWorker?.controller;}
async function enterFeria(){
  if(entered||entering)return;entering=true;
  try{
    if(!await FeriaStore.prepared())throw Error('Recursos incompletos');
    offlineStatus.textContent='Todo listo. Abriendo la feria…';progress.value=100;
    await Promise.all(['menu.css','ios-adaptaciones.css'].map(href=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('No se pudo preparar la presentación'));};document.head.append(link);})));
    const template=document.getElementById('feria-content'),content=document.importNode(template.content,true);
    await Promise.all([...content.querySelectorAll('img')].map(img=>img.decode()));
    document.body.append(content);template.remove();preparation.hidden=true;
    document.body.classList.remove('preparing-feria');document.body.classList.add('iphone-home');entered=true;
  }catch(e){showError('Faltan recursos para abrir la feria. Comprueba la conexión y vuelve a intentarlo.');}
  finally{entering=false;}
}
function showError(text){downloading=false;download.disabled=false;download.hidden=false;offlineStatus.textContent=text;}
async function beginDownload(){
  if(!active||downloading||entered)return;
  const target=worker();if(!target){showError('No se pudo preparar la descarga. Recarga la página con conexión.');return;}
  attempted=true;downloading=true;download.hidden=true;download.disabled=true;
  offlineStatus.textContent='Preparando la feria… Mantén esta pantalla abierta hasta terminar.';
  try{await navigator.storage?.persist?.();}catch(e){}
  target.postMessage({type:'DOWNLOAD_OFFLINE'});
}
async function refreshActivation(){
  active=await FeriaStore.activated();activationStep.hidden=active;offlinePanel.hidden=!active;button.disabled=false;
  if(!active){message.textContent='Activa tu acceso con el QR de la feria.';return;}
  if(entered){if(!await FeriaStore.prepared())location.reload();return;}
  worker()?.postMessage({type:'OFFLINE_STATUS'});
}
const scanner=makeScanner(refreshActivation);
button.addEventListener('click',()=>scanner.start());download.addEventListener('click',beginDownload);
function workerMessage(data){
  if(!active)return;
  if(data.type==='OFFLINE_PROGRESS'){
    downloading=true;download.hidden=true;progress.value=data.percent;
    offlineStatus.textContent='Preparando la feria… '+data.percent+' %. Mantén esta pantalla abierta hasta terminar.';
  }
  if(data.type==='OFFLINE_READY'){downloading=false;enterFeria();}
  if(data.type==='OFFLINE_ERROR')showError('La preparación quedó incompleta. Comprueba tu conexión y pulsa Reintentar preparación. Lo guardado se conserva.');
  if(data.type==='OFFLINE_STATUS'&&!downloading){if(data.ready)enterFeria();else if(!attempted)beginDownload();}
}
async function setupWorker(){
  if(!('serviceWorker'in navigator)||!isSecureContext){showError('Abre la dirección HTTPS de la feria para guardar sus recursos.');download.disabled=true;return;}
  try{
    navigator.serviceWorker.addEventListener('message',event=>workerMessage(event.data));
    let controller=navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{const next=navigator.serviceWorker.controller;if(controller&&next!==controller){location.reload();return;}controller=next;worker()?.postMessage({type:'OFFLINE_STATUS'});});
    registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href));
    try{registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});}catch(e){if(!registration?.active)throw e;}
    if(!registration.active)registration=await navigator.serviceWorker.ready;
    await refreshActivation();
  }catch(e){showError('No se pudo preparar la feria. Comprueba la conexión y recarga la página.');}
}
window.addEventListener('pageshow',refreshActivation);
await refreshActivation();await setupWorker();
