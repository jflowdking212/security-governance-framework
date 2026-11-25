import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CALLER_CWD=process.cwd();
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(ROOT);
const manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
const args=process.argv.slice(2);
const usage='Usage: node tools/resolve-task.mjs [--task <key>] [--module <Mxx>] [--keywords "domain terms"] [--supplement <id|slug|path>] [--stack <id|slug|path>] [--strict]';

function fail(message){
 console.error(message);
 process.exit(2);
}

if(args.length===0){
 console.error(usage);
 console.error('Tasks: '+Object.keys(manifest.tasks).join(', '));
 process.exit(2);
}

if(args.length===1&&args[0]==='--help'){
 console.log(usage);
 console.log('Use --task code-change as the secure coding baseline and add --keywords to widen routing.');
 console.log('Tasks: '+Object.keys(manifest.tasks).join(', '));
 process.exit(0);
}

const options=new Map();
const booleanFlags=new Set(['--strict']);
const allowed=new Set(['--task','--module','--keywords','--supplement','--stack','--strict']);
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(!allowed.has(flag))fail('Unknown option: '+flag+'\n'+usage);
 if(options.has(flag))fail('Duplicate option: '+flag);
 if(booleanFlags.has(flag)){
  options.set(flag,'true');
  continue;
 }
 const value=args[i+1];
 if(value===undefined||value.startsWith('--')||!value.trim())fail('Missing value for '+flag+'\n'+usage);
 options.set(flag,value.trim());
 i++;
}

const isStrict=options.has('--strict');
const task=options.get('--task')??null;
const moduleId=options.get('--module')??null;
const keywords=options.get('--keywords')??null;
const supplementArg=options.get('--supplement')??null;
const stackArg=options.get('--stack')??null;

if(moduleId&&(task||keywords||supplementArg||stackArg))fail('--module cannot be combined with --task, --keywords, --supplement, or --stack.');

if(!task&&!moduleId&&!keywords&&!supplementArg&&!stackArg){
 if(isStrict){
  fail('Strict mode: no task, module, keywords, or supplement selector provided.\n'+usage);
 }
 console.error(usage);
 console.error('Tasks: '+Object.keys(manifest.tasks).join(', '));
 process.exit(2);
}

const supplements=manifest.supplements||[];
const supplementsById=new Map(supplements.map(s=>[s.id.toLowerCase(),s]));
const supplementsBySlug=new Map(supplements.map(s=>[s.slug.toLowerCase(),s]));
const supplementsByPath=new Map(supplements.map(s=>[s.path.toLowerCase(),s]));
const supplementsByFilename=new Map(supplements.map(s=>[path.basename(s.path).toLowerCase(),s]));

function findSupplement(q){
 const norm=q.toLowerCase().trim();
 return supplementsById.get(norm)
  ||supplementsBySlug.get(norm)
  ||supplementsByPath.get(norm)
  ||supplementsByFilename.get(norm)
  ||null;
}

function assertSupplementExists(s){
 const absPath=path.resolve(ROOT,s.path);
 if(!fsSync.existsSync(absPath)){
  fail('Referenced supplement file does not exist on disk: '+s.path);
 }
}

const stacks=manifest.stacks||[];
const stacksById=new Map(stacks.map(s=>[s.id.toLowerCase(),s]));
const stacksBySlug=new Map(stacks.map(s=>[s.slug.toLowerCase(),s]));
const stacksByPath=new Map(stacks.map(s=>[s.path.toLowerCase(),s]));
const stacksByFilename=new Map(stacks.map(s=>[path.basename(s.path).toLowerCase(),s]));

function findStack(q){
 const norm=q.toLowerCase().trim();
 return stacksById.get(norm)
  ||stacksBySlug.get(norm)
  ||stacksByPath.get(norm)
  ||stacksByFilename.get(norm)
  ||stacks.find(s=>s.name.toLowerCase()===norm||(s.triggers&&s.triggers.includes(norm)))
  ||null;
}

function assertStackExists(s){
 const absPath=path.resolve(ROOT,s.path);
 if(!fsSync.existsSync(absPath)){
  fail('Referenced stack profile file does not exist on disk: '+s.path);
 }
}

const seeds=[];
const selectedSupplements=new Map();
const selectedStacks=new Map();

if(stackArg){
 const queries=stackArg.split(',').map(s=>s.trim()).filter(Boolean);
 for(const q of queries){
  const s=findStack(q);
  if(!s)fail('Unknown stack profile: '+q+'\nAvailable: '+stacks.map(x=>x.id).join(', '));
  assertStackExists(s);
  selectedStacks.set(s.id,s);
  if(s.related_modules)seeds.push(...s.related_modules);
 }
}

if(task){
 if(!Object.hasOwn(manifest.tasks,task)||!Array.isArray(manifest.tasks[task])){
  fail('Unknown task: '+task+'\nAvailable: '+Object.keys(manifest.tasks).join(', '));
 }
 seeds.push(...manifest.tasks[task]);
 if(manifest.task_supplements&&Object.hasOwn(manifest.task_supplements,task)){
  for(const sid of manifest.task_supplements[task]){
   const s=findSupplement(sid);
   if(!s)fail('Task '+task+' references unknown supplement '+sid);
   assertSupplementExists(s);
   selectedSupplements.set(s.id,s);
  }
 }
}

if(moduleId){
 const selected=manifest.modules.find(m=>m.id===moduleId);
 if(!selected)fail('Unknown module: '+moduleId);
 seeds.push(selected.id);
}

if(supplementArg){
 const queries=supplementArg.split(',').map(s=>s.trim()).filter(Boolean);
 for(const q of queries){
  const s=findSupplement(q);
  if(!s)fail('Unknown supplement: '+q);
  assertSupplementExists(s);
  selectedSupplements.set(s.id,s);
  if(!task&&!moduleId){
   if(s.related_modules)seeds.push(...s.related_modules);
  }
 }
}

let keywordModuleIds=[];
let keywordSupplementIds=[];
if(keywords){
 const words=keywords.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
 if(!words.length)fail('No searchable keywords supplied.');
 const norm=x=>x.toLowerCase().replace(/s$/,'');
 const candidates=new Set();
 words.forEach((word,index)=>{
  candidates.add(norm(word));
  if(index+1<words.length)candidates.add(norm(word+'-'+words[index+1]));
 });

 const matchedModuleTriggers=new Set();
 for(const m of manifest.modules){
  for(const trigger of m.triggers){
   if(candidates.has(norm(trigger)))matchedModuleTriggers.add(norm(trigger));
  }
 }
 keywordModuleIds=manifest.modules.filter(m=>m.triggers.some(trigger=>candidates.has(norm(trigger)))).map(m=>m.id);

 const matchedSupplementTriggers=new Set();
 for(const s of supplements){
  for(const trigger of (s.triggers||[])){
   if(candidates.has(norm(trigger))){
    matchedSupplementTriggers.add(norm(trigger));
    assertSupplementExists(s);
    selectedSupplements.set(s.id,s);
    keywordSupplementIds.push(s.id);
   }
  }
 }

 const matchedStackTriggers=new Set();
 for(const s of stacks){
  for(const trigger of (s.triggers||[])){
   if(candidates.has(norm(trigger))){
    matchedStackTriggers.add(norm(trigger));
    assertStackExists(s);
    selectedStacks.set(s.id,s);
   }
  }
 }

 const allMatchedTriggers=new Set([...matchedModuleTriggers,...matchedSupplementTriggers,...matchedStackTriggers]);
 const matchedParts=new Set([...allMatchedTriggers].flatMap(trigger=>trigger.split('-')));
 const unmatched=words.filter(word=>!matchedParts.has(norm(word))&&!allMatchedTriggers.has(norm(word)));

 if(!keywordModuleIds.length&&!keywordSupplementIds.length&&!selectedStacks.size&&!task&&!supplementArg&&!stackArg){
  fail('No trigger match. Choose a task key from: '+Object.keys(manifest.tasks).join(', '));
 }

 if(isStrict){
  if(unmatched.length){
   fail('Strict mode: unmatched keywords: '+unmatched.join(', '));
  }
  if(!keywordModuleIds.length&&!keywordSupplementIds.length&&!selectedStacks.size){
   fail('Strict mode: no keywords matched any trigger.');
  }
 } else {
  if(unmatched.length)console.error('WARNING: keywords not matched to any trigger: '+unmatched.join(', ')+'. Review these terms and widen routing manually if they describe another security boundary.');
  if(!keywordModuleIds.length&&!keywordSupplementIds.length&&!selectedStacks.size&&task)console.error('WARNING: no keyword trigger matched; only the selected task modules will be loaded.');
 }

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

const selector=task?'task '+task:moduleId?'module '+moduleId:supplementArg?'supplement '+supplementArg:stackArg?'stack '+stackArg:'keyword search';
console.log('USS '+manifest.version+' | '+selector+(keywords?' + keywords':'')+' | modules '+out.map(m=>m.id).join(', '));
if(keywordModuleIds.length)console.log('Keyword modules: '+keywordModuleIds.join(', '));
const callerRelativePath=p=>path.relative(CALLER_CWD,path.resolve(ROOT,p)).split(path.sep).join('/')||'.';
for(const m of out)console.log(m.id+' '+callerRelativePath(m.path)+' | sources: '+m.source_sections.join(', '));

const outSupplements=[...selectedSupplements.values()];
if(outSupplements.length){
 console.log('Supplements: '+outSupplements.map(s=>s.id).join(', '));
 for(const s of outSupplements){
  console.log(s.id+' '+callerRelativePath(s.path)+' | '+s.title);
 }
}

const outStacks=[...selectedStacks.values()];
if(outStacks.length){
 console.log('Stack profiles: '+outStacks.map(s=>s.id).join(', '));
 for(const s of outStacks){
  console.log(s.id+' '+callerRelativePath(s.path)+' | '+s.name+' ('+(s.status||'REFERENCE_ONLY')+')');
 }
}
