'use strict';
const stages=[
{name:'Luna',bg:'moon',g:22,thrust:110,fuel:15,padX:225,padW:155,x:225,vx:0,vy:5,safeV:18,safeX:12},
{name:'Marte',bg:'mars',g:49.9,thrust:145,fuel:13,padX:300,padW:125,x:130,vx:6,vy:12,safeV:14,safeX:9},
{name:'Venus',bg:'earth',g:132,thrust:235,fuel:11,padX:135,padW:100,x:320,vx:-9,vy:20,safeV:11,safeX:7},
{name:'Tierra',bg:'rocks',g:22,thrust:110,fuel:4.5,padX:325,padW:69,x:90,vx:-12,vy:30,safeV:6,safeX:3.5},
{name:'Planeta Almendrino',bg:'base',g:22,thrust:110,fuel:3.8,padX:110,padW:56,x:345,vx:24,vy:43,safeV:3.5,safeX:1.8}];
const groundY=635,halfWidth=20,halfHeight=25;
function makeFlight(c){return {x:c.x,y:185,vx:c.vx,vy:c.vy,fuel:c.fuel,time:0,result:null,reason:''}}
function physicsStep(s,c,input,dt){if(s.result)return;s.time+=dt;let burn=Math.min(dt,s.fuel);let ax=0,ay=c.g;if(s.fuel>0){if(input.thrust){ay-=c.thrust*burn/dt}if(input.left!==input.right)ax=(input.left?-1:1)*68*burn/dt;if(input.thrust||input.left!==input.right)s.fuel=Math.max(0,s.fuel-burn*(input.thrust?1:0.42));}s.vx+=ax*dt;s.vy+=ay*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.x<halfWidth){s.x=halfWidth;s.vx=Math.max(0,s.vx)}if(s.x>450-halfWidth){s.x=450-halfWidth;s.vx=Math.min(0,s.vx)}if(s.y<170){s.y=170;s.vy=Math.max(0,s.vy)}if(s.y+halfHeight>=groundY){s.y=groundY-halfHeight;let aligned=Math.abs(s.x-c.padX)+halfWidth<=c.padW/2;let soft=s.vy>=0&&s.vy<=c.safeV&&Math.abs(s.vx)<=c.safeX;s.result=aligned&&soft?'landed':'crashed';s.reason=!aligned?'Fuera de la plataforma':s.vy>c.safeV?'Descenso demasiado rápido':Math.abs(s.vx)>c.safeX?'Demasiado movimiento lateral':'Aterrizaje suave';}}
if(typeof module!=='undefined')module.exports={stages,makeFlight,physicsStep,groundY,halfWidth,halfHeight};
