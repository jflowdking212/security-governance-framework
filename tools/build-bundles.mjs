import fs from 'node:fs/promises';
import path from 'node:path';
const manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
const modules=new Map(manifest.modules.map(m=>[m.id,m]));
function resolve(ids){
 const state=new Map(),ordered=[];
 function visit(id,trail=[]){
  if(id==='ASSURANCE')return;
  if(state.get(id)==='done')return;
  if(state.get(id)==='visiting')throw new Error('Dependency cycle: '+[...trail,id].join(' -> '));
  const item=modules.get(id);if(!item)throw new Error('Unknown module ID: '+id);
  state.set(id,'visiting');
  for(const dep of item.dependencies)visit(dep,[...trail,id]);
  state.set(id,'done');ordered.push(item);
 }
 for(const id of ids)visit(id);
 return ordered;
}
const args=process.argv.slice(2),taskAt=args.indexOf('--task');
let targets;
if(taskAt>=0){const name=args[taskAt+1];if(!manifest.tasks[name])throw new Error('Unknown task '+name+'. Available: '+Object.keys(manifest.tasks).join(', '));targets={[name]:manifest.tasks[name]};}
else targets=manifest.bundle_paths;
const outDir=path.resolve('dist/bundles');
await fs.mkdir(outDir,{recursive:true});
for(const [name,ids] of Object.entries(targets)){
 const resolved=resolve(ids);
 const parts=['# USS '+name+' bundle','Version: '+manifest.version,'Task modules: '+ids.join(', '),'Resolved dependency order: '+resolved.map(m=>m.id).join(', '),'Generated from manifest.json. Do not edit manually.'];
 for(const item of resolved){parts.push('\n---\n\n'+(await fs.readFile(item.path,'utf8')));}
 const output=path.join(outDir,name+'.md');
 await fs.writeFile(output,parts.join('\n\n')+'\n');
 console.log(name+': '+resolved.map(m=>m.id).join(', ')+' -> '+path.relative(process.cwd(),output));
}
