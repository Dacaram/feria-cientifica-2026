/* Resumable, verified downloads. The timeout measures silence, not total duration. */
(()=>{
  function failure(code,message){const error=new Error(message);error.reason=code;return error;}
  async function hash(data){const digest=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
  function headersFor(type,size){return {'Content-Type':type||'application/octet-stream','Content-Length':String(size)};}
  async function copyVerified(response,item,cache,url){
    if(!response)return false;
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==item.bytes||await hash(bytes)!==item.sha256)return false;
    await cache.put(url,new Response(bytes,{headers:headersFor(response.headers.get('Content-Type'),bytes.byteLength)}));return true;
  }
  async function download(item,url,{cache,parts,onProgress=()=>{},onRetry=()=>{},signal,fetcher=fetch,idleTimeout=45000,partSize=262144,retryDelay=2000,maxAttempts=3}={}){
    if(!item.sha256||!Number.isSafeInteger(item.bytes)||item.bytes<0)throw failure('resource','Lista de recursos inválida');
    const key=offset=>new URL('__offline_parts/'+item.sha256+'/'+offset,url).href;
    let chunks=[],saved=0,contentType='application/octet-stream';
    const report=received=>onProgress(received,saved);
    async function clearParts(){for(let offset=0;offset<item.bytes;offset+=partSize)await parts.delete(key(offset));}
    async function restore(){
      chunks=[];saved=0;
      while(saved<item.bytes){const response=await parts.match(key(saved));if(!response)break;const data=new Uint8Array(await response.arrayBuffer());
        if(data.byteLength!==Math.min(partSize,item.bytes-saved)){await parts.delete(key(saved));break;}
        contentType=response.headers.get('X-Feria-Type')||contentType;chunks.push(data);saved+=data.byteLength;
      }
      report(saved);
    }
    await restore();
    for(let attempt=0;attempt<maxAttempts;attempt++){
      if(signal?.aborted)throw failure('cancelled','Descarga detenida');
      const controller=new AbortController();let idle=false,timer;
      const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
      async function waiting(task){
        timer=setTimeout(()=>{idle=true;controller.abort();},idleTimeout);
        try{return await task();}finally{clearTimeout(timer);}
      }
      try{
        if(saved<item.bytes){
          const offset=saved,headers=offset?{Range:'bytes='+offset+'-'}:{};
          const response=await waiting(()=>fetcher(url,{cache:'no-store',credentials:'same-origin',headers,signal:controller.signal}));
          if(response.status!==200&&response.status!==206){const error=failure('resource','HTTP '+response.status);error.status=response.status;throw error;}
          let skip=0;
          if(response.status===206){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range')||'');
            if(!range||Number(range[1])!==offset||Number(range[3])!==item.bytes)throw failure('integrity','Respuesta parcial inválida');
          }else skip=offset; // Servers without Range support: discard the already stored prefix.
          contentType=response.headers.get('Content-Type')||contentType;
          const reader=response.body?.getReader();if(!reader)throw failure('resource','Este navegador no permite preparar la descarga');
          let pending=new Uint8Array(Math.min(partSize,item.bytes-saved)),used=0,received=saved;
          while(true){
            const {done,value}=await waiting(()=>reader.read());if(done)break;
            let start=0;if(skip){const count=Math.min(skip,value.byteLength);skip-=count;start=count;}
            if(received+value.byteLength-start>item.bytes)throw failure('integrity','Tamaño inesperado');
            received+=value.byteLength-start;report(received);
            while(start<value.byteLength){
              const count=Math.min(pending.byteLength-used,value.byteLength-start);pending.set(value.subarray(start,start+count),used);used+=count;start+=count;
              if(used===pending.byteLength){
                await parts.put(key(saved),new Response(pending,{headers:{'Content-Type':'application/octet-stream','X-Feria-Type':contentType}}));
                chunks.push(pending);saved+=pending.byteLength;used=0;report(received);
                pending=new Uint8Array(Math.min(partSize,item.bytes-saved));
              }
            }
          }
          if(saved!==item.bytes||used!==0||skip!==0)throw failure('network','El archivo quedó incompleto');
        }
        const body=new Uint8Array(item.bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
        if(await hash(body)!==item.sha256){await clearParts();chunks=[];saved=0;throw failure('integrity','El archivo no coincide con el original');}
        await cache.put(url,new Response(body,{headers:headersFor(contentType,item.bytes)}));
        await clearParts();report(item.bytes);return;
      }catch(cause){
        controller.abort();
        if(signal?.aborted)throw failure('cancelled','Descarga detenida');
        const error=cause.name==='QuotaExceededError'?failure('storage','No hay espacio disponible'):idle?failure('timeout','La conexión dejó de responder'):cause;
        if(!error.reason)error.reason='network';
        const permanent=error.reason==='storage'||error.reason==='resource'&&error.status&&error.status<500&&![408,429].includes(error.status);
        if(permanent||attempt+1===maxAttempts)throw error;
        await restore();onRetry(attempt+1,error.reason);
        await new Promise(resolve=>setTimeout(resolve,retryDelay*(attempt+1)));
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
    }
  }
  self.FeriaOffline={hash,copyVerified,download};
})();
