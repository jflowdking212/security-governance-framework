import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const CALLER_CWD=process.cwd();
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(ROOT);
const manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
const args=process.argv.slice(2);
function value(flag){const i=args.indexOf(flag);return i<0?null:args[i+1]??null;}
const task=value('--task'),module=value('--module'),keywords=value('--keywords');
let ids=[];
if(task){if(!manifest.tasks[task]){console.error('Unknown task: '+task+'\nAvailable: '+Object.keys(manifest.tasks).join(', '));process.exit(2)}ids=manifest.tasks[task];}
else if(module){if(!manifest.modules.some(m=>m.id===module))throw new Error('Unknown module '+module);ids=[module];}
else if(keywords){
 // Exact (plural-insensitive) token or adjacent-pair matching avoids false positives such as "email" -> "ai" and "decision" -> "ci".
 const words=keywords.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
 const norm=x=>x.replace(/s$/,'');
 const candidates=new Set();
 words.forEach((w,i)=>{candidates.add(norm(w));if(i+1<words.length)candidates.add(norm(w+'-'+words[i+1]))});
 const matched=new Set();
 for(const m of manifest.modules)for(const t of m.triggers)if(candidates.has(norm(t)))matched.add(norm(t));
 ids=manifest.modules.filter(m=>m.triggers.some(t=>candidates.has(norm(t)))).map(m=>m.id);
 const unmatched=words.filter(w=>![...matched].some(t=>t===norm(w)||t.split('-').includes(norm(w))));
 if(!ids.length){console.error('No trigger match. Choose a task key from: '+Object.keys(manifest.tasks).join(', '));process.exit(2)}
 if(unmatched.length)console.error('WARNING: keywords not matched to any trigger: '+unmatched.join(', ')+'. Keyword mode is module-level only; prefer --task and widen when unsure.')
}else{
 console.log('Usage: node tools/resolve-task.mjs --task <key> | --module <Mxx> | --keywords "payment webhook"');
 console.log('Tasks: '+Object.keys(manifest.tasks).join(', '));process.exit(0);
}
const map=new Map(manifest.modules.map(m=>[m.id,m])),state=new Map(),out=[];
function visit(id,trail=[]){if(state.get(id)==='done')return;if(state.get(id)==='visiting')throw new Error('Dependency cycle: '+[...trail,id].join(' -> '));const m=map.get(id);if(!m)throw new Error('Unknown module '+id);state.set(id,'visiting');for(const d of m.dependencies)visit(d,[...trail,id]);state.set(id,'done');out.push(m)}
for(const id of ids)visit(id);
console.log('USS '+manifest.version+' | modules '+out.map(m=>m.id).join(', '));
const callerRelativePath=m=>path.relative(CALLER_CWD,path.resolve(ROOT,m.path)).split(path.sep).join('/')||'.';
for(const m of out)console.log(m.id+' '+callerRelativePath(m)+' | sources: '+m.source_sections.join(', '));
