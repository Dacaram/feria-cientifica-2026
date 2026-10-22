(()=>{
  const module=decodeURIComponent(location.pathname).split('/').filter(Boolean).slice(-2)[0];
  const names={Defensa:'DEFENSA DE ALMENDRINO',Aterrizaje:'ATERRIZAJE ESPACIAL',Peso_espacial:'PESO ESPACIAL',Edad_planetaria:'CUMPLEAÑOS PLANETARIOS',Adivina_el_planeta:'DETECTIVE DE PLANETAS',Maqueta:'SISTEMA SOLAR',Tunel_del_tiempo:'TÚNEL DEL TIEMPO'};
  document.body.classList.add('experience-'+module.toLowerCase());
  const nav=document.createElement('nav');nav.className='app-navigation';nav.setAttribute('aria-label','Navegación de la aplicación');
  const back=document.createElement('a');back.href='../../index.html';back.textContent='← Misiones';
  const label=document.createElement('span');label.textContent=names[module]||'FERIA CIENTÍFICA 2026';
  nav.append(back,label);document.body.prepend(nav);
  // Intro-only decoration: the approved game canvas stays visible during play.
  const card=document.getElementById('card');
  if(card){const update=()=>document.body.classList.toggle('showing-intro',!!card.querySelector('h1'));update();new MutationObserver(update).observe(card,{childList:true,subtree:true});}
})();
