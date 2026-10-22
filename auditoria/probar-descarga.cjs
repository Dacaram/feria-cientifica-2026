const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');global.self=globalThis;require('../iphone/offline-download.js');
class MemoryCache{
  constructor(){this.data=new Map();}
  async match(key){return this.data.get(String(key))?.clone();}
  async put(key,response){this.data.set(String(key),new Response(await response.arrayBuffer(),{headers:response.headers}));}
  async delete(key){return this.data.delete(String(key));}
}
function stream(data,{signal,interval=5,block=512,dropAfter=Infinity,headers={}}={}){
  let timer,closed=false;
  return new Response(new ReadableStream({start(controller){let offset=0;
    const fail=()=>{if(!closed){closed=true;clearInterval(timer);controller.error(new DOMException('Connection interrupted','AbortError'));}};
    signal?.addEventListener('abort',fail,{once:true});
    timer=setInterval(()=>{if(closed)return;if(offset>=dropAfter){fail();return;}if(offset===data.length){closed=true;clearInterval(timer);controller.close();return;}const end=Math.min(data.length,offset+block);controller.enqueue(data.subarray(offset,end));offset=end;},interval);
  },cancel(){closed=true;clearInterval(timer);}}),{status:headers['Content-Range']?206:200,headers:{'Content-Type':'audio/mpeg',...headers}});
}
(async()=>{
  const data=Uint8Array.from({length:16384},(_,i)=>i%251),item={url:'Audios/test.mp3',bytes:data.length,sha256:await FeriaOffline.hash(data)},url='http://localhost/iphone/'+item.url;
  const report={clockNote:'El límite original de 45 s se reduce a 40 ms para reproducir el fallo sin esperar 90 s.'};
  let oldAttempts=0,receivedBeforeAbort=0;const oldCaches=new Map();
  const storage={async open(name){if(!oldCaches.has(name))oldCaches.set(name,new MemoryCache());return oldCaches.get(name);},async keys(){return [...oldCaches.keys()]},async delete(name){return oldCaches.delete(name)}};
  const shell=await storage.open('feria2026:/iphone/:shell:v5');await shell.put('http://localhost/iphone/recursos-offline.json',new Response(JSON.stringify({bytes:data.length,files:[item]})));
  const context=vm.createContext({URL,Response,Headers,AbortController,DOMException,importScripts(){},FeriaConfig:{cacheVersion:'v5'},FeriaStore:{activated:async()=>true,set:async()=>{}},caches:storage,
    self:{location:{href:'http://localhost/iphone/service-worker.js'},addEventListener(){},clients:{matchAll:async()=>[]}},
    setTimeout:(fn,delay)=>setTimeout(fn,delay===45000?40:delay),clearTimeout,
    fetch:async(_url,{signal})=>{oldAttempts++;signal.addEventListener('abort',()=>{receivedBeforeAbort++});return stream(data,{signal});}});
  const baseline=execFileSync('git',['-C',root,'show','add12d7:iphone/service-worker.js'],{encoding:'utf8'});vm.runInContext(baseline,context);
  await assert.rejects(vm.runInContext('downloadAll()',context));assert.equal(oldAttempts,2);assert.equal(receivedBeforeAbort,2);report.originalDeadline={attempts:oldAttempts,cancelledDespiteContinuousData:true};
  let cache=new MemoryCache(),parts=new MemoryCache(),progress=[];const started=Date.now();
  await FeriaOffline.download(item,url,{cache,parts,idleTimeout:40,partSize:1024,retryDelay:1,maxAttempts:1,onProgress:n=>progress.push(n),fetcher:async(_url,{signal})=>stream(data,{signal})});
  assert(Date.now()-started>40);assert(progress.some(n=>n>0&&n<item.bytes));assert.deepEqual(new Uint8Array(await(await cache.match(url)).arrayBuffer()),data);report.continuousSlowTransfer={completed:true,progressBeforeCompletion:true};
  cache=new MemoryCache();parts=new MemoryCache();let failedRequests=0;
  await assert.rejects(FeriaOffline.download(item,url,{cache,parts,partSize:1024,maxAttempts:1,fetcher:async(_url,{signal})=>{failedRequests++;return stream(data,{signal,dropAfter:6144});}}));
  const ranges=[];await FeriaOffline.download(item,url,{cache,parts,partSize:1024,maxAttempts:1,fetcher:async(_url,{signal,headers})=>{const offset=Number(/^bytes=(\d+)-$/.exec(headers.Range)[1]);ranges.push(offset);return stream(data.subarray(offset),{signal,headers:{'Content-Range':`bytes ${offset}-${data.length-1}/${data.length}`}});}});
  assert.deepEqual(ranges,[6144]);assert.equal(parts.data.size,0);assert.deepEqual(new Uint8Array(await(await cache.match(url)).arrayBuffer()),data);report.resume={rangeStart:ranges[0],partialDataPreserved:true};
  cache=new MemoryCache();parts=new MemoryCache();await assert.rejects(FeriaOffline.download(item,url,{cache,parts,partSize:1024,maxAttempts:1,fetcher:async(_url,{signal})=>stream(data,{signal,dropAfter:4096})}));
  await FeriaOffline.download(item,url,{cache,parts,partSize:1024,maxAttempts:1,fetcher:async(_url,{signal})=>stream(data,{signal})});assert.deepEqual(new Uint8Array(await(await cache.match(url)).arrayBuffer()),data);report.serverWithoutRange={correctFullFile:true};
  await assert.rejects(FeriaOffline.download(item,url,{cache:new MemoryCache(),parts:new MemoryCache(),idleTimeout:20,maxAttempts:1,fetcher:async(_url,{signal})=>stream(data,{signal,interval:1000})}),e=>e.reason==='timeout');report.silentConnection={detected:true};
  const corrupt=data.slice();corrupt[0]^=1;const badCache=new MemoryCache(),badParts=new MemoryCache();await assert.rejects(FeriaOffline.download(item,url,{cache:badCache,parts:badParts,partSize:1024,maxAttempts:1,fetcher:async(_url,{signal})=>stream(corrupt,{signal})}),e=>e.reason==='integrity');assert.equal(await badCache.match(url),undefined);assert.equal(badParts.data.size,0);report.corruptTransfer={rejected:true};
  let requests=0;const fullParts=new MemoryCache();fullParts.put=async()=>{throw new DOMException('No space','QuotaExceededError')};await assert.rejects(FeriaOffline.download(item,url,{cache:new MemoryCache(),parts:fullParts,partSize:1024,fetcher:async(_url,{signal})=>{requests++;return stream(data,{signal})}}),e=>e.reason==='storage');assert.equal(requests,1);report.storageFull={identifiedWithoutRepeatedDownloads:true};
  const reused=new MemoryCache();assert.equal(await FeriaOffline.copyVerified(new Response(data),item,reused,url),true);assert.equal(await FeriaOffline.copyVerified(new Response(corrupt),item,new MemoryCache(),url),false);report.previousVersionReuse={verifiedBySHA256:true};
  fs.writeFileSync(path.join(__dirname,'descarga-unitaria.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
