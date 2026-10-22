(()=>{
  const script=typeof document!=='undefined'?document.currentScript:null;
  const base=new URL('./',script?script.src:self.location.href).pathname;
  const name='almendros-feria2026:'+base;
  let pending;
  function open(){
    if(!pending)pending=new Promise((resolve,reject)=>{
      const request=indexedDB.open(name,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('settings');
      request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();pending=null;};resolve(request.result);};
      request.onerror=()=>{pending=null;reject(request.error);};
    });
    return pending;
  }
  async function get(key){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction('settings').objectStore('settings').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function set(key,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No se pudo guardar'));});}
  async function activated(){try{const record=await get('activation');return record?.digest===FeriaConfig.activationHash&&record?.version===FeriaConfig.activationVersion;}catch(e){return false;}}
  async function accept(value){if(typeof value!=='string'||value.length>256)return false;const data=new TextEncoder().encode(value);const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==FeriaConfig.activationHash)return false;await set('activation',{digest,version:FeriaConfig.activationVersion,at:new Date().toISOString()});return activated();}
  self.FeriaStore={get,set,activated,accept};
})();
