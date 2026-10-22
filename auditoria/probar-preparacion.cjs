const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('node:assert/strict'),{webkit,chromium}=require('playwright');
const useChromium=process.env.FERIA_BROWSER==='chromium',engine=useChromium?chromium:webkit;
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8774/iphone/';
let offline=false,interrupt=true;const requests=[];
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,base).pathname);requests.push(pathname);
  if(offline){req.socket.destroy();return;}
  if(interrupt&&pathname.endsWith('/Peso_espacial/assets/astro-00.webp')){res.writeHead(503);res.end('Interrupted for test');return;}
  let file=path.join(root,pathname);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
const options={headless:true,...(useChromium?{executablePath:process.env.FERIA_CHROME}:{}),viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'};
let context;
(async()=>{
  await new Promise(r=>server.listen(8774,'127.0.0.1',r));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'feria-preparacion-')),report={engine:useChromium?'Chromium':'WebKit',errors:[]};
  context=await engine.launchPersistentContext(profile,options);let page=context.pages()[0];
  const watch=p=>p.on('pageerror',e=>report.errors.push(e.message));watch(page);
  console.log('Comprobando acceso inicial');await page.goto(base);await page.waitForFunction(()=>navigator.serviceWorker.controller,{},{timeout:15000});console.log('Worker listo');
  assert.equal(await page.locator('#experiencias').count(),0);
  assert.equal(requests.some(url=>/\/(Visuales|Modulos|Audios)\//.test(url)),false);
  report.beforeQR={games:0,heavyResourcesRequested:0,standalone:await page.evaluate(()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)};
  assert.equal(report.beforeQR.standalone,false);console.log('Sin QR: correcto');
  await page.goto(base+'Modulos/Defensa/index.html');await page.waitForURL(base+'index.html');assert.equal(await page.locator('#experiencias').count(),0);
  // Only the isolated test profile is activated. The QR hash/version stay unchanged.
  await page.evaluate(()=>FeriaStore.set('activation',{digest:FeriaConfig.activationHash,version:FeriaConfig.activationVersion}));
  await page.reload();await page.locator('#download-offline').waitFor({state:'visible',timeout:120000});
  assert.equal(await page.locator('#experiencias').count(),0);assert.equal(await page.evaluate(()=>FeriaStore.prepared()),false);
  report.interrupted={games:0,cached:await page.evaluate(async()=>{const cache=await caches.open('feria2026:/iphone/:full:'+FeriaConfig.cacheVersion);return(await cache.keys()).length;})};
  if(!useChromium)await page.screenshot({path:path.resolve(root,'../preparando-feria.png')});
  assert(report.interrupted.cached>0);console.log('Interrupción y bloqueo: correctos');
  await page.goto(base+'Modulos/Aterrizaje/index.html');await page.waitForURL(base+'index.html');assert.equal(await page.locator('#experiencias').count(),0);
  await page.locator('#download-offline').waitFor({state:'visible',timeout:120000});interrupt=false;await page.locator('#download-offline').click();
  await page.locator('#experiencias').waitFor({state:'visible',timeout:120000});assert.equal(await page.locator('.experiences>a').count(),7);assert.equal(await page.evaluate(()=>FeriaStore.prepared()),true);
  report.ready={games:7,version:await page.evaluate(()=>FeriaConfig.cacheVersion)};console.log('Preparación completa');
  await page.screenshot({path:path.resolve(root,'../preparacion-web'+(useChromium?'-chromium':'')+'.png'),fullPage:false});
  // A complete browser restart with the same persistent profile must retain access.
  await context.close();offline=true;context=await engine.launchPersistentContext(profile,options);page=context.pages()[0];watch(page);
  await page.goto(base);await page.locator('#experiencias').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.evaluate(()=>FeriaStore.activated()),true);assert.equal(await page.evaluate(()=>FeriaStore.prepared()),true);report.afterBrowserRestart={activated:true,prepared:true,network:false};
  report.modules=[];
  const plan=JSON.parse(fs.readFileSync(path.join(root,'iphone/recursos-offline.json')));
  for(const mod of fs.readdirSync(path.join(root,'iphone/Modulos'))){const response=await page.goto(base+'Modulos/'+mod+'/index.html');await page.waitForFunction(()=>document.documentElement.style.visibility!=='hidden');assert.equal(response.status(),200);report.modules.push(mod);}
  report.media=await page.evaluate(async()=>{
    const response=await fetch('../../recursos-offline.json'),plan=await response.json(),images=plan.files.filter(x=>/\.(png|jpg|webp)$/.test(x.url)),audio=plan.files.filter(x=>x.url.endsWith('.mp3')),bad=[];
    for(const item of images){const img=new Image();img.src=new URL('../../'+item.url,location.href);try{await img.decode()}catch{bad.push(item.url)}}
    for(const item of audio){const r=await fetch(new URL('../../'+item.url,location.href),{headers:{Range:'bytes=0-99'}});if(r.status!==206||(await r.arrayBuffer()).byteLength!==100)bad.push(item.url);}
    return{images:images.length,audios:audio.length,bad};
  });assert.deepEqual(report.media.bad,[]);assert.equal(report.media.audios,27);report.stations=await page.evaluate(()=>stations.length);assert.equal(report.stations,23);
  await page.evaluate(async()=>{const cache=await caches.open('feria2026:/iphone/:full:'+FeriaConfig.cacheVersion);await cache.delete(new URL('../../Visuales/saturno.png',location.href));});
  await page.goto(base+'Modulos/Defensa/index.html');await page.waitForURL(base+'index.html');await page.locator('#download-offline').waitFor({state:'visible',timeout:120000});assert.equal(await page.locator('#experiencias').count(),0);assert.equal(await page.evaluate(()=>FeriaStore.activated()),true);
  offline=false;await page.locator('#download-offline').click();await page.locator('#experiencias').waitFor({state:'visible',timeout:120000});report.storageRepair={blockedUntilRepaired:true,activationRetained:true};
  await context.close();context=null;
  // Android browsing uses exactly the same activation/preparation flow; no install gate.
  context=await engine.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'feria-android-')),{...options,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});page=context.pages()[0];watch(page);await page.goto(base);await page.waitForFunction(()=>document.getElementById('activate-app').disabled===false);assert.equal(await page.locator('#experiencias').count(),0);assert.equal(await page.locator('#activate-app').isVisible(),true);report.androidWeb={qrRequired:true,installationRequired:false};
  assert.deepEqual(report.errors,[]);report.resources=plan.files.length;
  fs.writeFileSync(path.join(__dirname,'preparacion-web'+(useChromium?'-chromium':'')+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await context.close();context=null;server.close();
})().catch(async error=>{console.error(error);if(context){for(const p of context.pages())try{console.log('Estado:',p.url(),await p.locator('body').innerText());}catch{}}await context?.close();server.close();process.exitCode=1;});
