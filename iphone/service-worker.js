importScripts('./feria-config.js','./feria-storage.js');
const BASE=new URL('./',self.location.href),PREFIX='feria2026:'+BASE.pathname+':';
const SHELL=PREFIX+'shell:'+FeriaConfig.cacheVersion,FULL=PREFIX+'full:'+FeriaConfig.cacheVersion;
const SHELL_FILES=['index.html','setup.css','pwa.css','app-pwa.js','scanner-ui.js','feria-config.js','feria-storage.js','manifest.webmanifest','recursos-offline.json','vendor/qr-scanner.min.js','vendor/qr-scanner-worker.min.js','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'];
let downloadPromise=null;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(SHELL);await cache.addAll(SHELL_FILES.map(file=>new URL(file,BASE).href));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX+'shell:')&&name!==SHELL)await caches.delete(name);await self.clients.claim();})()));
async function find(url){return (await (await caches.open(FULL)).match(url))||(await (await caches.open(SHELL)).match(url));}
async function notify(data){for(const client of await self.clients.matchAll({includeUncontrolled:true,type:'window'}))if(client.url.startsWith(BASE.href))client.postMessage(data);}
async function manifest(){const response=await find(new URL('recursos-offline.json',BASE).href)||await fetch(new URL('recursos-offline.json',BASE));if(!response.ok)throw Error('No se encontró la lista de recursos');return response.json();}
async function readyStatus(){const plan=await manifest(),cache=await caches.open(FULL);let ready=true;for(const item of plan.files)if(!(await cache.match(new URL(item.url,BASE).href))){ready=false;break;}if(ready&&await FeriaStore.activated())await FeriaStore.set('offline-version',FeriaConfig.cacheVersion);return {ready,megabytes:Math.ceil(plan.bytes/1048576)};}
async function downloadAll(){
  if(!await FeriaStore.activated())throw Error('Activa la app primero');
  const plan=await manifest(),cache=await caches.open(FULL),shell=await caches.open(SHELL);let done=0,bytes=0,next=0,failure=null;
  async function fetchFile(url){
    for(let attempt=0;attempt<2;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
      try{const response=await fetch(url,{cache:'reload',credentials:'same-origin',signal:controller.signal});if(!response.ok||response.status!==200)throw Error('Descarga incompleta');await cache.put(url,response);return;}
      catch(error){if(attempt===1)throw error;}
      finally{clearTimeout(timer);}
    }
  }
  async function downloadNext(){
    while(!failure&&next<plan.files.length){const item=plan.files[next++],url=new URL(item.url,BASE).href;
      try{if(!await cache.match(url)){const response=await shell.match(url);if(response)await cache.put(url,response);else await fetchFile(url);}
        done++;bytes+=item.bytes;await notify({type:'OFFLINE_PROGRESS',done,total:plan.files.length,percent:Math.floor(bytes/plan.bytes*100)});
      }catch(error){failure=error;}
    }
  }
  await Promise.all([downloadNext(),downloadNext(),downloadNext()]);if(failure)throw failure;
  await FeriaStore.set('offline-version',FeriaConfig.cacheVersion);
  for(const name of await caches.keys())if(name.startsWith(PREFIX+'full:')&&name!==FULL)await caches.delete(name);
  await notify({type:'OFFLINE_READY'});
}
self.addEventListener('message',event=>{
  if(event.data?.type==='OFFLINE_STATUS')event.waitUntil(readyStatus().then(state=>event.source?.postMessage({type:'OFFLINE_STATUS',...state})).catch(()=>event.source?.postMessage({type:'OFFLINE_ERROR'})));
  if(event.data?.type==='DOWNLOAD_OFFLINE'){
    if(!downloadPromise)downloadPromise=downloadAll().catch(()=>notify({type:'OFFLINE_ERROR'})).finally(()=>{downloadPromise=null;});
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
