import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
const args=process.argv.slice(2);
function value(flag){const i=args.indexOf(flag);return i<0?null:args[i+1]??null;}
const task=value('--task'),module=value('--module'),keywords=value('--keywords');
let ids=[];
if(task){if(!manifest.tasks[task]){console.error('Unknown task: '+task+'\nAvailable: '+Object.keys(manifest.tasks).join(', '));process.exit(2)}ids=manifest.tasks[task];}
else if(module){if(!manifest.modules.some(m=>m.id===module))throw new Error('Unknown module '+module);ids=[module];}
else if(keywords){
 const words=keywords.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
 ids=manifest.modules.filter(m=>m.triggers.some(t=>words.some(w=>w===t||w.includes(t)||t.includes(w)))).map(m=>m.id);
 if(!ids.length){console.error('No trigger match. Choose a task key from: '+Object.keys(manifest.tasks).join(', '));process.exit(2)}
}else{
 console.log('Usage: node tools/resolve-task.mjs --task <key> | --module <Mxx> | --keywords "payment webhook"');
 console.log('Tasks: '+Object.keys(manifest.tasks).join(', '));process.exit(0);
}
const map=new Map(manifest.modules.map(m=>[m.id,m])),state=new Map(),out=[];
function visit(id,trail=[]){if(state.get(id)==='done')return;if(state.get(id)==='visiting')throw new Error('Dependency cycle: '+[...trail,id].join(' -> '));const m=map.get(id);if(!m)throw new Error('Unknown module '+id);state.set(id,'visiting');for(const d of m.dependencies)visit(d,[...trail,id]);state.set(id,'done');out.push(m)}
for(const id of ids)visit(id);
console.log('USS '+manifest.version+' | modules '+out.map(m=>m.id).join(', '));
for(const m of out)console.log(m.id+' '+m.path+' | sources: '+m.source_sections.join(', '));
