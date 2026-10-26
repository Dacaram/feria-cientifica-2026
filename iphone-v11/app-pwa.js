import {makeScanner} from './scanner-ui.js';
const button=document.getElementById('activate-app'),message=document.getElementById('activation-message');
const activationStep=document.getElementById('activation-step'),preparation=document.getElementById('preparation');
const offlinePanel=document.getElementById('offline-panel'),offlineStatus=document.getElementById('offline-status'),progress=document.getElementById('offline-progress'),download=document.getElementById('download-offline');
const percentage=document.getElementById('offline-percent'),size=document.getElementById('offline-size');
let active=false,registration=null,downloading=false,attempted=false,entered=false,entering=false;
let totalBytes=0,lastBytes=0,lastReceivedAt=Date.now(),lastRun=null,lastSequence=-1,closedRun=null;
const format=n=>n.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
function showProgress(data){
  totalBytes=data.totalBytes||totalBytes;
  if(data.receivedBytes!==undefined&&data.receivedBytes!==lastBytes){lastBytes=data.receivedBytes;lastReceivedAt=Date.now();}
  const value=Number.isFinite(data.percent)?data.percent:0;progress.value=value;percentage.textContent=value.toLocaleString('es-CL',{minimumFractionDigits:value<1?2:1,maximumFractionDigits:value<1?2:1})+' %';
  const received=lastBytes<1000000?format(lastBytes/1000)+' KB':format(lastBytes/1000000)+' MB';
  size.textContent=totalBytes?received+' de '+format(totalBytes/1000000)+' MB':'';
}
function worker(){return registration?.active||navigator.serviceWorker?.controller;}
async function enterFeria(){
  if(entered||entering)return;entering=true;
  try{
    if(!await FeriaStore.prepared())throw Error('Recursos incompletos');
    offlineStatus.textContent='Todo listo. Abriendo la feria…';showProgress({percent:100,totalBytes,receivedBytes:totalBytes});
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
  offlineStatus.textContent='Conectando para preparar la feria…';lastReceivedAt=Date.now();
  try{navigator.storage?.persist?.().catch(()=>{});}catch(e){}
  target.postMessage({type:'DOWNLOAD_OFFLINE',version:FeriaConfig.cacheVersion});
}
async function refreshActivation(){
  active=await FeriaStore.activated();activationStep.hidden=active;offlinePanel.hidden=!active;button.disabled=false;
  if(!active){message.textContent='Activa tu acceso con el QR de la feria.';return;}
  if(entered){if(!await FeriaStore.prepared())location.reload();return;}
  worker()?.postMessage({type:'OFFLINE_STATUS',version:FeriaConfig.cacheVersion});
}
const scanner=makeScanner(refreshActivation);
button.addEventListener('click',()=>scanner.start());download.addEventListener('click',beginDownload);
function workerMessage(data){
  if(!active||data.version!==FeriaConfig.cacheVersion)return;
  totalBytes=data.totalBytes||totalBytes;
  if(data.type==='OFFLINE_PROGRESS'){
    if(data.runId===closedRun)return;
    if(data.runId!==lastRun){lastRun=data.runId;lastSequence=-1;}
    if(Number.isFinite(data.sequence)&&data.sequence<=lastSequence)return;lastSequence=data.sequence;
    downloading=true;download.hidden=true;showProgress(data);
    offlineStatus.textContent=data.phase==='retrying'?'Reconectando… Continuaremos desde lo guardado.':'Descargando imágenes, juegos y audios. Mantén esta pantalla abierta hasta terminar.';
  }
  if(data.type==='OFFLINE_READY'){closedRun=data.runId;downloading=false;enterFeria();}
  if(data.type==='OFFLINE_ERROR'){
    closedRun=data.runId;
    if(data.receivedBytes!==undefined)showProgress(data);
    const messages={storage:'No hay espacio suficiente para guardar la feria. Libera espacio y vuelve a intentarlo.',timeout:'La conexión dejó de responder. Pulsa Reintentar preparación; continuaremos desde lo guardado.',resource:'No se pudo descargar un recurso de la feria. Lo guardado se conserva; vuelve a intentarlo.',integrity:'Un archivo llegó incompleto. Pulsa Reintentar preparación para recuperarlo.'};
    showError(messages[data.reason]||'Se interrumpió la conexión. Pulsa Reintentar preparación; continuaremos desde lo guardado.');
  }
  if(data.type==='OFFLINE_STATUS'&&!downloading){if(data.ready)enterFeria();else if(!attempted)beginDownload();}
}
async function setupWorker(){
  if(!('serviceWorker'in navigator)||!isSecureContext){showError('Abre la dirección HTTPS de la feria para guardar sus recursos.');download.disabled=true;return;}
  try{
    navigator.serviceWorker.addEventListener('message',event=>workerMessage(event.data));
    let controller=navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{const next=navigator.serviceWorker.controller;if(controller&&next!==controller){location.reload();return;}controller=next;worker()?.postMessage({type:'OFFLINE_STATUS',version:FeriaConfig.cacheVersion});});
    registration=await navigator.serviceWorker.getRegistration(new URL('./',location.href));
    try{registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});}catch(e){if(!registration?.active)throw e;}
    if(!registration.active)registration=await navigator.serviceWorker.ready;
    await refreshActivation();
  }catch(e){showError('No se pudo preparar la feria. Comprueba la conexión y recarga la página.');}
}
window.addEventListener('pageshow',refreshActivation);
setInterval(()=>{if(downloading&&!entered&&Date.now()-lastReceivedAt>15000)offlineStatus.textContent='Esperando la conexión… Lo guardado se conserva.';},5000);
await refreshActivation();await setupWorker();
