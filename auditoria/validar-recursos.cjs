const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../iphone');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(root),names=new Set(files.map(f=>path.relative(root,f).replaceAll('\\','/'))),issues=[];
function check(f,ref){if(path.basename(f)==='navigation.js')f=path.join(root,'Modulos/Defensa/index.html');if(!ref||/^(?:https?:|data:|blob:|#|javascript:)/i.test(ref)||/[${}]/.test(ref))return;const target=path.resolve(path.dirname(f),decodeURIComponent(ref.split(/[?#]/)[0]));if(!fs.existsSync(target))issues.push({file:path.relative(root,f),ref,problem:'missing'});else if(!names.has(path.relative(root,target).replaceAll('\\','/'))&&fs.statSync(target).isFile())issues.push({file:path.relative(root,f),ref,problem:'case'});}
for(const f of files.filter(f=>/\.(html|css|js)$/.test(f))){const text=fs.readFileSync(f,'utf8');for(const m of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g))check(f,m[1]);for(const m of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/g))check(f,m[1]);}
const plan=JSON.parse(fs.readFileSync(path.join(root,'recursos-offline.json'))),listed=new Set(plan.files.map(f=>decodeURIComponent(f.url))),sizes=[];
for(const item of plan.files){const f=path.join(root,decodeURIComponent(item.url));if(!fs.existsSync(f))issues.push({offline:item.url,problem:'missing'});else if(fs.statSync(f).size!==item.bytes)sizes.push(item.url);}
const omitted=[...names].filter(n=>!listed.has(n)&&!['recursos-offline.json','service-worker.js','.htaccess'].includes(n));
const protectedFiles=files.filter(f=>/\.mp3$/.test(f)||/stations\.js$/.test(f)||/feria-config\.js$/.test(f)).map(f=>({file:path.relative(root,f).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}));
const result={files:files.length,images:files.filter(f=>/\.(png|jpg|webp)$/.test(f)).length,mp3:files.filter(f=>/\.mp3$/.test(f)).length,modules:fs.readdirSync(path.join(root,'Modulos')),issues,offline:{listed:plan.files.length,omitted,sizes,bytes:plan.bytes},protectedFiles};
fs.writeFileSync(path.join(__dirname,'recursos-estatica.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,protectedFiles:undefined},null,2));
