'use strict';
// Melodía original sintetizada. Sin grabaciones ni recursos externos.
const audioSystem=(()=>{
let ac,musicBus,fxBus,timer,beat=0,unlocked=false;
const MUSIC_GAIN=.55,FX_GAIN=.22;
let music=true,effects=true;
try{music=localStorage.getItem('alm-music')!=='off';effects=localStorage.getItem('alm-effects')!=='off'}catch(e){}
function gains(){
  if(musicBus)musicBus.gain.value=music&&state!=='paused'?MUSIC_GAIN:0;
  if(fxBus)fxBus.gain.value=effects?FX_GAIN:0;
}
function tone(freq,duration,volume,bus,type='sine',delay=0,end=freq){
  if(!ac||ac.state!=='running')return;
  const t=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(volume,t+.012);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(bus);o.start(t);o.stop(t+duration+.02);
}
function tick(){
  gains();
  if(!unlocked||!ac||ac.state!=='running'||document.hidden||state==='paused'||!music)return;
  const active=state==='playing'||state==='countdown';
  const stride=active?(stage===5?1:stage>=3?2:3):4;
  if(beat++%stride)return;
  const melody=[0,7,12,10,7,3,5,7,0,7,15,12,10,7,5,3];
  const i=Math.floor(beat/stride)%16;
  // Una octava más alta para que la melodía se oiga en parlantes de teléfono.
  const root=active?220:164.8138;
  tone(root*Math.pow(2,melody[i]/12),.28,.24,musicBus,'triangle');
  if(i%4===0)tone(root/2,.45,.19,musicBus,'sine');
}
async function unlock(){
  try{
    if(!ac){
      const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
      ac=new A();musicBus=ac.createGain();fxBus=ac.createGain();
      musicBus.connect(ac.destination);fxBus.connect(ac.destination);
    }
    gains();
    await ac.resume();
    unlocked=ac.state==='running';
    if(!unlocked)return;
    if(!timer)timer=setInterval(tick,125);
    tick();
  }catch(e){unlocked=false;}
}
function effect(kind){
  if(!effects||!ac||document.hidden)return;
  if(kind==='shot')tone(700,.07,.035,fxBus,'triangle',0,240);
  if(kind==='hit')tone(180,.15,.22,fxBus,'sawtooth',0,35);
  if(kind==='power')[440,660,880].forEach((f,i)=>tone(f,.16,.18,fxBus,'sine',i*.07));
  if(kind==='clear'||kind==='win')[261.63,329.63,392,523.25].forEach((f,i)=>tone(f,.35,.2,fxBus,'triangle',i*.12));
  if(kind==='lose')[220,174.61,130.81].forEach((f,i)=>tone(f,.4,.2,fxBus,'triangle',i*.2));
}
function controls(){return `<div class="row audio-controls"><button id="musicToggle" aria-pressed="${music}">Música: ${music?'sí':'no'}</button><button id="fxToggle" aria-pressed="${effects}">Efectos: ${effects?'sí':'no'}</button></div>`;}
function bind(){
  const m=document.getElementById('musicToggle'),f=document.getElementById('fxToggle');
  if(m)m.onclick=()=>{
    music=!music;gains();
    try{localStorage.setItem('alm-music',music?'on':'off')}catch(e){}
    m.textContent='Música: '+(music?'sí':'no');m.setAttribute('aria-pressed',music);
    unlock();
  };
  if(f)f.onclick=()=>{
    effects=!effects;gains();
    try{localStorage.setItem('alm-effects',effects?'on':'off')}catch(e){}
    f.textContent='Efectos: '+(effects?'sí':'no');f.setAttribute('aria-pressed',effects);
    unlock();
  };
}
function suspend(){
  unlocked=false;
  if(musicBus)musicBus.gain.value=0;
  if(ac&&ac.state==='running')ac.suspend().catch(()=>{});
}
// Android puede suspender Web Audio al ir a segundo plano. Un toque lo reactiva.
document.addEventListener('pointerdown',()=>{if(ac&&ac.state!=='running')unlock();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
window.addEventListener('app-pause',suspend);
window.addEventListener('pagehide',()=>{suspend();if(timer){clearInterval(timer);timer=null;}});
return {unlock,effect,controls,bind};
})();
