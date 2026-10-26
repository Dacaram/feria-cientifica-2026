(()=>{
  const module=decodeURIComponent(location.pathname).split('/').filter(Boolean).slice(-2)[0];
  const names={Defensa:'DEFENSA DE ALMENDRINO',Aterrizaje:'ATERRIZAJE ESPACIAL',Peso_espacial:'PESO ESPACIAL',Edad_planetaria:'CUMPLEAÑOS PLANETARIOS',Adivina_el_planeta:'DETECTIVE DE PLANETAS',Maqueta:'SISTEMA SOLAR',Tunel_del_tiempo:'TÚNEL DEL TIEMPO'};
  document.body.classList.add('experience-'+module.toLowerCase());
  if(Object.hasOwn(names,module)){
    const guard=document.createElement('div');
    guard.id='portrait-only-guard';guard.setAttribute('role','status');guard.hidden=true;
    guard.textContent='↻ Gira el celular a vertical para continuar esta misión.';
    Object.assign(guard.style,{position:'fixed',inset:'0',zIndex:'2147483647',background:'#080d26',color:'#edf6ff',padding:'30px',alignItems:'center',justifyContent:'center',textAlign:'center',font:'600 20px system-ui'});
    document.body.append(guard);
    const mobile=matchMedia('(pointer: coarse)');
    const update=()=>{const blocked=mobile.matches&&innerWidth>innerHeight;guard.hidden=!blocked;guard.style.display=blocked?'flex':'none';if(blocked){document.querySelectorAll('audio,video').forEach(p=>p.pause());window.dispatchEvent(new Event('blur'));}};
    addEventListener('resize',update);addEventListener('orientationchange',update);update();
    if(screen.orientation?.lock)screen.orientation.lock('portrait').catch(()=>{});
  }
  const nav=document.createElement('nav');nav.className='app-navigation';nav.setAttribute('aria-label','Navegación de la aplicación');
  const back=document.createElement('a');back.href='../../index.html';back.textContent='← Misiones';
  const label=document.createElement('span');label.textContent=names[module]||'FERIA CIENTÍFICA 2026';
  nav.append(back,label);document.body.prepend(nav);
  // Intro-only decoration: the approved game canvas stays visible during play.
  const card=document.getElementById('card');
  if(card){const update=()=>document.body.classList.toggle('showing-intro',!!card.querySelector('h1'));update();new MutationObserver(update).observe(card,{childList:true,subtree:true});}
})();
