const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8778/iphone/',target='Audios/Maqueta/maqueta_01.mp3';
const requests=[];let first=true,resumeStarted=0,servedBytes=0,browser;
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,base).pathname);let file=path.join(root,pathname);
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const data=fs.readFileSync(file),type=({'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream';
  res.setHeader('Content-Type',type);
  if(!pathname.endsWith('/'+target)){res.end(data);return;}
  const range=/^bytes=(\d+)-$/.exec(req.headers.range||''),offset=range?Number(range[1]):0,isFirst=first;first=false;
  requests.push({offset,at:Date.now()});res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',data.length-offset);
  if(range){resumeStarted=Date.now();res.statusCode=206;res.setHeader('Content-Range',`bytes ${offset}-${data.length-1}/${data.length}`);}
  let sent=offset,blocks=0;
  const timer=setInterval(()=>{
    if(isFirst&&blocks===8){clearInterval(timer);res.destroy();return;}
    if(sent===data.length){clearInterval(timer);res.end();return;}
    const end=Math.min(sent+65536,data.length);res.write(data.subarray(sent,end));servedBytes+=end-sent;sent=end;blocks++;
  },isFirst?30:950);
  res.on('close',()=>clearInterval(timer));
});
(async()=>{
  await new Promise(resolve=>server.listen(8778,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.FERIA_CHROME});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  await page.addInitScript(()=>{window.progressSamples=[];document.addEventListener('DOMContentLoaded',()=>{const node=document.getElementById('offline-percent');if(node)new MutationObserver(()=>window.progressSamples.push({at:Date.now(),value:parseFloat(node.textContent.replace(',','.'))})).observe(node,{childList:true});});});
  await page.goto(base);await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.evaluate(()=>FeriaStore.set('activation',{digest:FeriaConfig.activationHash,version:FeriaConfig.activationVersion}));await page.reload();
  for(let i=0;i<200&&!resumeStarted;i++)await new Promise(resolve=>setTimeout(resolve,100));assert(resumeStarted>0,'The interrupted audio must request a byte range');assert(requests[1].offset>0);
  console.log('Audio interrumpido y reanudado desde',requests[1].offset,'bytes. Probando una transferencia de más de 45 segundos.');
  await page.waitForFunction(()=>parseFloat(document.getElementById('offline-percent').textContent.replace(',','.'))>0);
  assert.equal(await page.locator('#experiencias').count(),0);
  await page.screenshot({path:path.resolve(root,'../progreso-datos-moviles.png')});
  await page.locator('#experiencias').waitFor({state:'visible',timeout:100000});const resumedSeconds=(Date.now()-resumeStarted)/1000;
  assert(resumedSeconds>45);assert.equal(requests.length,2);assert.equal(await page.evaluate(()=>FeriaStore.prepared()),true);
  const samples=await page.evaluate(()=>window.progressSamples);assert(samples.some(s=>s.value>0&&s.value<100));assert(samples.filter(s=>s.at-resumeStarted>45000&&s.value<100).length>0);
  const report={engine:'Chrome desktop, viewport móvil',simulation:'Un corte de conexión y un audio que sigue enviando datos durante más de 45 segundos',requests:requests.map(r=>({offset:r.offset})),resumedSeconds,servedBytes,originalBytes:fs.statSync(path.join(root,'iphone',target)).size,percentageUpdates:samples.length,progressBeforeCompletion:true,completed:true,qrPreserved:await page.evaluate(()=>FeriaStore.activated())};
  fs.writeFileSync(path.join(__dirname,'datos-moviles.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();server.close();
})().catch(async error=>{console.error(error);await browser?.close();server.close();process.exitCode=1});
