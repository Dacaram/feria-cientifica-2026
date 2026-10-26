// Reglas explícitas por etapa V.9 revisión 2
// Feria Científica 2026 V.9
// Orientación por misión y reinicio completo v4
// Actualización Selenita: pantalla móvil completa v2
importScripts('./feria-config.js','./feria-storage.js','./offline-download.js');
const BASE=new URL('./',self.location.href),PREFIX='feria2026:'+BASE.pathname+':';
const SHELL=PREFIX+'shell:'+FeriaConfig.cacheVersion,FULL=PREFIX+'full:'+FeriaConfig.cacheVersion;
const SHELL_FILES=['index.html','setup.css','pwa.css','app-pwa.js','scanner-ui.js','feria-config.js','feria-storage.js','offline-download.js','manifest.webmanifest','recursos-offline.json','vendor/qr-scanner.min.js','vendor/qr-scanner-worker.min.js','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'];
let downloadPromise=null,downloadState=null,sequence=0;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(SHELL);await cache.addAll(SHELL_FILES.map(file=>new Request(new URL(file,BASE).href,{cache:'reload'})));const updates=await Promise.all(['Modulos/Rescate_Selenita/index.html','navigation.js','recursos-offline.json'].map(async file=>{const url=new URL(file,BASE).href;const response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok)throw Error('No se pudo actualizar '+file);return {url,response};}));const full=await caches.open(FULL);for(const {url,response} of updates)await full.put(url,response);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX+'shell:')&&name!==SHELL)await caches.delete(name);await self.clients.claim();})()));
async function find(url){return (await (await caches.open(FULL)).match(url))||(await (await caches.open(SHELL)).match(url));}
async function notify(data){for(const client of await self.clients.matchAll({includeUncontrolled:true,type:'window'}))if(client.url.startsWith(BASE.href))try{client.postMessage({version:FeriaConfig.cacheVersion,...data});}catch(e){}}
async function manifest(){const response=await find(new URL('recursos-offline.json',BASE).href)||await fetch(new URL('recursos-offline.json',BASE));if(!response.ok)throw Error('No se encontró la lista de recursos');return response.json();}
async function readyStatus(){const plan=await manifest(),cache=await caches.open(FULL);let ready=true;for(const item of plan.files)if(!(await cache.match(new URL(item.url,BASE).href))){ready=false;break;}if(ready&&await FeriaStore.activated())await FeriaStore.set('offline-version',FeriaConfig.cacheVersion);return {ready,totalBytes:plan.bytes,megabytes:Math.ceil(plan.bytes/1048576)};}
async function downloadAll(){
  if(!await FeriaStore.activated())throw Error('Activa la app primero');
  const plan=await manifest(),cache=await caches.open(FULL),shell=await caches.open(SHELL),parts=await caches.open(PREFIX+'parts');
  const previous=await Promise.all((await caches.keys()).filter(name=>name.startsWith(PREFIX+'full:')&&name!==FULL).map(name=>caches.open(name)));
  const inFlight=new Map(),job=new AbortController(),runId=Date.now()+':'+Math.random();let done=0,bytes=0,next=0,failure=null,lastUpdate=0;
  function emit(force=false,phase='downloading'){
    if(!force&&Date.now()-lastUpdate<150)return;lastUpdate=Date.now();
    let receivedBytes=bytes,savedBytes=bytes;for(const state of inFlight.values()){receivedBytes+=state.received;savedBytes+=state.saved;}
    downloadState={runId,done,total:plan.files.length,totalBytes:plan.bytes,receivedBytes,savedBytes,percent:Math.min(99.9,Math.floor(receivedBytes/plan.bytes*10000)/100),phase,sequence:++sequence};
    notify({type:'OFFLINE_PROGRESS',...downloadState}).catch(()=>{});
  }
  emit(true);
  async function downloadNext(){
    while(!failure&&next<plan.files.length){const item=plan.files[next++],url=new URL(item.url,BASE).href;
      try{
        inFlight.set(item.url,{received:0,saved:0});
        let found=!!await cache.match(url);
        if(!found)found=await FeriaOffline.copyVerified(await shell.match(url),item,cache,url);
        if(!found)for(const old of previous)if(await FeriaOffline.copyVerified(await old.match(url),item,cache,url)){found=true;break;}
        if(!found)await FeriaOffline.download(item,url,{cache,parts,signal:job.signal,
          onProgress:(received,saved)=>{inFlight.set(item.url,{received,saved});emit();},
          onRetry:()=>emit(true,'retrying')});
        done++;bytes+=item.bytes;inFlight.delete(item.url);emit(true);
      }catch(error){if(!failure){error.file=item.url;if(error.name==='QuotaExceededError')error.reason='storage';failure=error;job.abort();}}
    }
  }
  await Promise.all([downloadNext(),downloadNext(),downloadNext()]);if(failure)throw failure;
  await FeriaStore.set('offline-version',FeriaConfig.cacheVersion);
  for(const name of await caches.keys())if(name.startsWith(PREFIX+'full:')&&name!==FULL)await caches.delete(name);
  downloadState=null;await notify({type:'OFFLINE_READY',totalBytes:plan.bytes,runId});
}
self.addEventListener('message',event=>{
  if(['OFFLINE_STATUS','DOWNLOAD_OFFLINE'].includes(event.data?.type)&&event.data.version!==FeriaConfig.cacheVersion){
    if(event.source?.type==='window'&&event.source.url.startsWith(BASE.href))event.waitUntil(event.source.navigate(event.source.url));return;
  }
  if(event.data?.type==='OFFLINE_STATUS'){
    if(downloadPromise&&downloadState)event.source?.postMessage({type:'OFFLINE_PROGRESS',version:FeriaConfig.cacheVersion,...downloadState});
    else event.waitUntil(readyStatus().then(state=>event.source?.postMessage({type:'OFFLINE_STATUS',version:FeriaConfig.cacheVersion,...state})).catch(()=>event.source?.postMessage({type:'OFFLINE_ERROR',version:FeriaConfig.cacheVersion,reason:'storage'})));
  }
  if(event.data?.type==='DOWNLOAD_OFFLINE'){
    if(!downloadPromise)downloadPromise=downloadAll().catch(async error=>{
      const reason=error.reason||'network';try{await FeriaStore.set('last-offline-error',{reason,file:error.file||null,at:new Date().toISOString()});}catch(e){}
      await notify({type:'OFFLINE_ERROR',reason,...downloadState});
    }).finally(()=>{downloadPromise=null;downloadState=null;});
    else if(downloadState)event.source?.postMessage({type:'OFFLINE_PROGRESS',version:FeriaConfig.cacheVersion,...downloadState});
    event.waitUntil(downloadPromise);
  }
});
async function ranged(request,response){
  const data=await response.arrayBuffer(),size=data.byteLength,header=request.headers.get('range');
  const match=/^bytes=(\d*)-(\d*)$/.exec(header||'');
  const invalid=()=>new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`,'Accept-Ranges':'bytes'}});
  if(!match||(!match[1]&&!match[2]))return invalid();
  let start,end;
  if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid();start=Math.max(0,size-suffix);end=size-1;}
  else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return invalid();
  const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.set('Content-Length',String(end-start+1));headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Accept-Ranges','bytes');
  return new Response(request.method==='HEAD'?null:data.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(!url.href.startsWith(BASE.href)||!['GET','HEAD'].includes(request.method))return;
  event.respondWith((async()=>{
    if(url.pathname.startsWith(new URL('Modulos/',BASE).pathname)){
      if(request.mode==='navigate'&&!await FeriaStore.prepared())return Response.redirect(new URL('index.html',BASE).href,302);
      if(!await FeriaStore.activated())return new Response('Activa la app con el QR de la feria.',{status:403});
    }
    const lookup=new URL(url);if(lookup.pathname===BASE.pathname)lookup.pathname+='index.html';lookup.search='';
    const cached=await find(lookup.href);
    if(cached){
      if(request.headers.has('range'))return ranged(request,cached);
      if(request.method==='HEAD')return new Response(null,{status:200,headers:cached.headers});
      return cached;
    }
    try{return await fetch(request);}catch(e){
      if(request.mode==='navigate')return new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recursos pendientes</title><body style="background:#080d26;color:white;font:18px system-ui;padding:30px"><h1>Nos falta preparar este viaje</h1><p>Conéctate a Internet, vuelve al menú y pulsa «Guardar juegos y audios».</p><a style="color:#a0ffde" href="'+new URL('index.html',BASE).href+'">Volver al menú</a></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
      return new Response('Recurso pendiente de descargar.',{status:503});
    }
  })());
});
