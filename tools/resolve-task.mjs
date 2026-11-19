import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CALLER_CWD=process.cwd();
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(ROOT);
const manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
const args=process.argv.slice(2);
const usage='Usage: node tools/resolve-task.mjs --task <key> [--keywords "domain terms"] | --module <Mxx> | --keywords "domain terms"';

function fail(message){
 console.error(message);
 process.exit(2);
}

if(args.length===1&&args[0]==='--help'){
 console.log(usage);
 console.log('Use --task code-change as the secure coding baseline and add --keywords to widen routing.');
 console.log('Tasks: '+Object.keys(manifest.tasks).join(', '));
 process.exit(0);
}

const options=new Map();
const allowed=new Set(['--task','--module','--keywords']);
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(!allowed.has(flag))fail('Unknown option: '+flag+'\n'+usage);
 if(options.has(flag))fail('Duplicate option: '+flag);
 const value=args[i+1];
 if(value===undefined||value.startsWith('--')||!value.trim())fail('Missing value for '+flag+'\n'+usage);
 options.set(flag,value.trim());
 i++;
}

const task=options.get('--task')??null;
const moduleId=options.get('--module')??null;
const keywords=options.get('--keywords')??null;
if(moduleId&&(task||keywords))fail('--module cannot be combined with --task or --keywords.');
if(!task&&!moduleId&&!keywords){
 console.log(usage);
 console.log('Tasks: '+Object.keys(manifest.tasks).join(', '));
 process.exit(args.length?2:0);
}

const seeds=[];
if(task){
 if(!Object.hasOwn(manifest.tasks,task)||!Array.isArray(manifest.tasks[task])){
  fail('Unknown task: '+task+'\nAvailable: '+Object.keys(manifest.tasks).join(', '));
 }
 seeds.push(...manifest.tasks[task]);
}
if(moduleId){
 const selected=manifest.modules.find(m=>m.id===moduleId);
 if(!selected)fail('Unknown module: '+moduleId);
 seeds.push(selected.id);
}

let keywordModuleIds=[];
if(keywords){
 const words=keywords.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
 if(!words.length)fail('No searchable keywords supplied.');
 const norm=x=>x.toLowerCase().replace(/s$/,'');
 const candidates=new Set();
 words.forEach((word,index)=>{
  candidates.add(norm(word));
  if(index+1<words.length)candidates.add(norm(word+'-'+words[index+1]));
 });
 const matchedTriggers=new Set();
 for(const m of manifest.modules)for(const trigger of m.triggers)if(candidates.has(norm(trigger)))matchedTriggers.add(norm(trigger));
 keywordModuleIds=manifest.modules.filter(m=>m.triggers.some(trigger=>candidates.has(norm(trigger)))).map(m=>m.id);
 const matchedParts=new Set([...matchedTriggers].flatMap(trigger=>trigger.split('-')));
 const unmatched=words.filter(word=>!matchedParts.has(norm(word))&&!matchedTriggers.has(norm(word)));
 if(!keywordModuleIds.length&&!task)fail('No trigger match. Choose a task key from: '+Object.keys(manifest.tasks).join(', '));
 if(unmatched.length)console.error('WARNING: keywords not matched to any trigger: '+unmatched.join(', ')+'. Review these terms and widen routing manually if they describe another security boundary.');
 if(!keywordModuleIds.length&&task)console.error('WARNING: no keyword trigger matched; only the selected task modules will be loaded.');
 seeds.push(...keywordModuleIds);
}

const map=new Map(manifest.modules.map(m=>[m.id,m]));
const state=new Map(),out=[];
function visit(id,trail=[]){
 if(state.get(id)==='done')return;
 if(state.get(id)==='visiting')throw new Error('Dependency cycle: '+[...trail,id].join(' -> '));
 const m=map.get(id);
 if(!m)throw new Error('Unknown module '+id);
 state.set(id,'visiting');
 for(const dependency of m.dependencies)visit(dependency,[...trail,id]);
 state.set(id,'done');
 out.push(m);
}
for(const id of new Set(seeds))visit(id);

const selector=task?'task '+task:moduleId?'module '+moduleId:'keyword search';
console.log('USS '+manifest.version+' | '+selector+(keywords?' + keywords':'')+' | modules '+out.map(m=>m.id).join(', '));
if(keywordModuleIds.length)console.log('Keyword modules: '+keywordModuleIds.join(', '));
const callerRelativePath=m=>path.relative(CALLER_CWD,path.resolve(ROOT,m.path)).split(path.sep).join('/')||'.';
for(const m of out)console.log(m.id+' '+callerRelativePath(m)+' | sources: '+m.source_sections.join(', '));
