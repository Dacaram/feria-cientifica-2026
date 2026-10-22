const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const repository=path.resolve(__dirname,'..'),root=path.join(repository,'iphone');
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
const names=walk(root).filter(file=>!['recursos-offline.json','service-worker.js','.htaccess','.gitkeep'].includes(path.basename(file)));
const paths=names.map(file=>path.relative(repository,file).split(path.sep).join('/'));
// Hash the bytes Git will publish, including its Windows line-ending normalization.
const ids=execFileSync('git',['hash-object','--stdin-paths'],{cwd:repository,input:paths.join('\n')+'\n',encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim().split(/\r?\n/);
const blobHash=bytes=>crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const files=names.map((file,index)=>{
  let data=fs.readFileSync(file);
  if(blobHash(data)!==ids[index]){data=Buffer.from(data.toString('utf8').replace(/\r\n/g,'\n'));if(blobHash(data)!==ids[index])throw Error('Revisa los filtros Git de '+paths[index]);}
  return {url:path.relative(root,file).split(path.sep).map(encodeURIComponent).join('/'),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
});
const version=/"cacheVersion":"([^"]+)"/.exec(fs.readFileSync(path.join(root,'feria-config.js'),'utf8'))[1];
const result={version,bytes:files.reduce((sum,file)=>sum+file.bytes,0),files};
fs.writeFileSync(path.join(root,'recursos-offline.json'),JSON.stringify(result,null,2));console.log({version,files:files.length,bytes:result.bytes});
