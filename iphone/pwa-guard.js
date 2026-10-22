(()=>{
  function check(){
    document.documentElement.style.visibility='hidden';
    FeriaStore.prepared().then(ready=>{
      if(!ready){location.replace(new URL('../../index.html',location.href));return;}
      document.documentElement.style.visibility='';
    }).catch(()=>location.replace(new URL('../../index.html',location.href)));
  }
  check();window.addEventListener('pageshow',event=>{if(event.persisted)check();});
  const media=new Set(),contexts=new Set();
  for(const name of ['AudioContext','webkitAudioContext']){const Original=window[name];if(Original)window[name]=new Proxy(Original,{construct(C,args){const context=new C(...args);contexts.add(context);return context;}});}
  const Original=window.Audio;window.Audio=new Proxy(Original,{construct(C,args){const audio=new C(...args);media.add(audio);return audio;}});
  function pause(){document.querySelectorAll('audio,video').forEach(p=>p.pause());media.forEach(p=>p.pause());contexts.forEach(c=>{if(c.state==='running')c.suspend().catch(()=>{});});window.dispatchEvent(new Event('blur'));}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);
})();
