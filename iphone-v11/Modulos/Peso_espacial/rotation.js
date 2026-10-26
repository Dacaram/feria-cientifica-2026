/* Artistic rotating globes projected from the existing illustrations.
   Unobserved hemispheres are stylized, not scientific surface maps. */
(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let globes=[],observer,frame=0,last=0;
const N=112,TAU=Math.PI*2;
function projection(index){const radius=index===5?29:46,points=[];for(let y=0;y<N;y++)for(let x=0;x<N;x++){let nx=(x-55.5)/radius,ny=(y-55.5)/radius,r2=nx*nx+ny*ny;if(r2>1)continue;let z=Math.sqrt(1-r2);points.push({at:(y*N+x)*4,lat:ny,lon:Math.atan2(nx,z),light:index===8||index>=12?1:Math.max(.13,.28+.8*(-.35*nx-.25*ny+.8*z))});}return points;}
function seamlessTexture(index){
 const data=new Uint8ClampedArray(256*256*4),star=index===8||index>=12;
 const base=index===10?[153,144,129]:index===11?[185,170,148]:index===8?[255,237,199]:index===12?[174,218,255]:[214,235,255];
 const craters=Array.from({length:24},(_,i)=>({lon:(i*2.39996)%TAU,lat:Math.sin(i*7.13)*1.18,r:.055+(i%5)*.027}));
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const lon=x/256*TAU,lat=(y/255-.5)*Math.PI;
  let shade=1+.07*Math.sin(9*lon+3*Math.sin(lat*5))+.045*Math.cos(17*lon-7*lat)+.025*Math.sin(39*lon+19*lat);
  if(star)shade=1+.045*Math.sin(13*lon+4*Math.sin(lat*7))+.025*Math.cos(31*lon-17*lat);
  else for(const c of craters){const dl=Math.atan2(Math.sin(lon-c.lon),Math.cos(lon-c.lon))*Math.cos(lat);const r=Math.hypot(dl,lat-c.lat)/c.r;if(r<1.2){shade-=.17*Math.exp(-r*r*3);shade+=.1*Math.exp(-(((r-.92)/.16)**2));}}
  const q=(y*256+x)*4;for(let k=0;k<3;k++)data[q+k]=Math.max(star?110:45,Math.min(255,base[k]*shade));data[q+3]=255;
 }return data;
}
function prepare(img,index){const holder=document.createElement('div');holder.className='rotating-body'+((index===8||index>=12)?' stellar':'');img.replaceWith(holder);holder.append(img);const canvas=document.createElement('canvas');canvas.width=canvas.height=N;canvas.className='globe-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',img.alt+' en rotación ilustrativa');holder.append(canvas);const g={holder,img,canvas,index,ctx:canvas.getContext('2d'),visible:false,ready:false,points:projection(index),phase:0};globes.push(g);observer.observe(holder);}
function load(g){if(g.ready||g.loading)return;g.loading=true;const source=new Image();source.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,256,256);g.tex=ctx.getImageData(0,0,256,256).data;g.seamless=g.index===8||g.index>=10;if(g.seamless)g.tex=seamlessTexture(g.index);
// Find the equatorial globe boundary; Saturn's rings need a smaller disk crop.
let left=128,right=128;const bright=x=>{const p=(128*256+x)*4;return g.tex[p]+g.tex[p+1]+g.tex[p+2]>100};while(left>12&&bright(left-1))left--;while(right<244&&bright(right+1))right++;g.cx=(left+right)/2;g.cy=128;g.r=g.index===5?58:Math.max(50,(right-left)/2*.96);g.buffer=g.ctx.createImageData(N,N);g.ready=true;g.img.style.display='none';g.canvas.style.display='block';draw(g);wake();}catch(e){g.loading=false;}};source.src=g.img.src;}
function rings(ctx,front){ctx.save();ctx.translate(56,56);ctx.rotate(-.31);ctx.scale(1,.29);for(let r=43;r<=52;r+=1){ctx.beginPath();ctx.strokeStyle=r%3===0?'#8b8067':'#d9ca9d';ctx.globalAlpha=.7;ctx.lineWidth=1.2;ctx.arc(0,0,r,front?0:Math.PI,front?Math.PI:TAU);ctx.stroke();}ctx.restore();}
function draw(g){const out=g.buffer.data,t=g.tex;out.fill(0);for(const p of g.points){let lon=p.lon+g.phase;let sx=Math.round(g.cx+g.r*Math.sin(lon)*Math.sqrt(1-p.lat*p.lat)),sy=Math.round(g.cy+g.r*p.lat);if(g.seamless){sx=Math.floor(((lon/TAU)%1+1)%1*256);sy=Math.round((Math.asin(p.lat)/Math.PI+.5)*255);}sx=Math.max(0,Math.min(255,sx));sy=Math.max(0,Math.min(255,sy));let q=(sy*256+sx)*4;out[p.at]=t[q]*p.light;out[p.at+1]=t[q+1]*p.light;out[p.at+2]=t[q+2]*p.light;out[p.at+3]=255;}g.ctx.clearRect(0,0,N,N);if(g.index===5)rings(g.ctx,false);g.ctx.putImageData(g.buffer,0,0);if(g.index===5){/* draw rings behind with destination-over, then front */g.ctx.save();g.ctx.globalCompositeOperation='destination-over';rings(g.ctx,false);g.ctx.restore();rings(g.ctx,true);}}
function tick(time){frame=0;if(document.hidden)return;if(time-last>=90){let dt=last?Math.min(time-last,200):90;last=time;globes.forEach(g=>{if(g.visible&&g.ready&&!reduce.matches){g.phase=(g.phase+dt*TAU/42000)%TAU;draw(g);}});}if(!reduce.matches&&globes.some(g=>g.visible&&g.ready))frame=requestAnimationFrame(tick);}
function wake(){if(!frame&&!document.hidden&&!reduce.matches){last=0;frame=requestAnimationFrame(tick);}}
function mount(){observer?.disconnect();globes=[];if(frame)cancelAnimationFrame(frame);frame=0;observer=new IntersectionObserver(entries=>{entries.forEach(e=>{let g=globes.find(g=>g.holder===e.target);if(g){g.visible=e.isIntersecting;if(g.visible)load(g);}});wake();},{threshold:.05});document.querySelectorAll('#cards .astro-image').forEach((img,i)=>prepare(img,i));}
if(!('IntersectionObserver'in window))return;
new MutationObserver(mount).observe(document.querySelector('#cards'),{childList:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});reduce.addEventListener('change',wake);mount();
})();
