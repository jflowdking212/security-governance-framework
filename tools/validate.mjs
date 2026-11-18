import fs from 'node:fs/promises';
import path from 'node:path';
const m=JSON.parse(await fs.readFile('manifest.json','utf8')),errors=[];
const exists=async p=>{try{await fs.access(p);return true}catch{return false}};
const ids=m.modules.map(x=>x.id),idSet=new Set(ids);
if(idSet.size!==ids.length)errors.push('Duplicate module IDs');
const map=new Map(m.modules.map(x=>[x.id,x]));
for(const x of m.modules){if(!await exists(x.path))errors.push('Missing module '+x.path);else{const c=await fs.readFile(x.path,'utf8');if(!c.startsWith('# '+x.id+' '))errors.push('Wrong module heading '+x.path);if(!c.includes('**Source sections:**'))errors.push('Missing source metadata '+x.path)}for(const d of x.dependencies)if(!idSet.has(d))errors.push('Unknown dependency '+d+' in '+x.id)}
const state=new Map();
function visit(id,trail=[]){if(state.get(id)==='done')return;if(state.get(id)==='visiting'){errors.push('Dependency cycle '+[...trail,id].join(' -> '));return}state.set(id,'visiting');for(const d of map.get(id)?.dependencies??[])visit(d,[...trail,id]);state.set(id,'done')}
for(const id of ids)visit(id);
for(const [task,mods] of Object.entries(m.tasks)){for(const id of mods)if(!idSet.has(id))errors.push('Task '+task+' references unknown module '+id)}
for(const [bundle,mods] of Object.entries(m.bundles)){for(const id of mods)if(!idSet.has(id))errors.push('Bundle '+bundle+' references unknown module '+id)}
const moduleText=(await Promise.all(m.modules.map(x=>fs.readFile(x.path,'utf8')))).join('\n');
for(const ref of m.required_source_sections)if(!moduleText.includes(ref))errors.push('Required source section absent from module metadata: '+ref);
const matrix=await fs.readFile('source/traceability-matrix.csv','utf8');
for(const ref of m.required_source_sections)if(!matrix.includes(ref))errors.push('Traceability matrix missing '+ref);
for(const s of Object.values(m.sources)){if(!await exists(s.root))errors.push('Missing root source '+s.root);if(!await exists(s.archive))errors.push('Missing archived source '+s.archive);else if(await exists(s.root)){const a=await fs.readFile(s.root,'utf8'),b=await fs.readFile(s.archive,'utf8');if(a!==b)errors.push('Source archive differs from root original: '+s.root)}}
const global=await fs.readFile(m.sources.global.archive,'utf8'),anti=await fs.readFile(m.sources.antigravity.archive,'utf8');
const marker='# EMBEDDED CANONICAL GLOBAL DIRECTIVE — v4',pos=anti.indexOf(marker);
if(pos<0)errors.push('Anti-Gravity embedded canonical marker missing');else{const norm=x=>x.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean).join('\n');if(norm(anti.slice(pos+marker.length))!==norm(global))errors.push('Embedded global directive does not match standalone canonical source')}
if(m.rules.p0_release!=='BLOCK'||m.rules.p1_release!=='BLOCK'||m.rules.agent_may_waive_p0_p1!==false||m.rules.unknown_is_pass!==false)errors.push('Release policy invariant failed');
for(const p of [m.kernel,m.agent_entrypoint,m.module_index,'source/traceability-matrix.csv','README.md','MODULE-INDEX.md','REVIEW-PROMPT-FOR-CLAUDE.md','REVIEW-CLAUDE.md','RELEASE-CHECKLIST.md','CHANGELOG.md','VERSION','SECURITY.md','CONTRIBUTING.md','.gitignore','.github/PULL_REQUEST_TEMPLATE.md'])if(!await exists(p))errors.push('Missing required project file '+p);
const readme=await fs.readFile('README.md','utf8');
const readmeLinks=[...readme.matchAll(/\\]\\(([^)]+)\\)/g)].map(x=>x[1]).filter(x=>!/^https?:|^mailto:|^#/.test(x)).map(x=>decodeURIComponent(x.split('#')[0])).filter(Boolean);
for(const link of new Set(readmeLinks))if(!await exists(link))errors.push('README links to missing local path '+link);
for(const p of Object.values(m.bundle_paths)){if(!await exists(p))errors.push('Missing task index '+p);else{const c=await fs.readFile(p,'utf8');if(/placeholder|build instructions/i.test(c))errors.push('Placeholder bundle index '+p)}}
for(const [name,ids] of Object.entries(m.bundle_paths)){const task=name;const idx=await fs.readFile(ids,'utf8');for(const id of m.bundles[task]??[])if(!idx.includes(id))errors.push('Bundle index '+task+' missing module '+id)}

for(const task of Object.keys(m.bundle_paths)){
 const output='dist/bundles/'+task+'.md';
 if(!await exists(output)){errors.push('Missing compiled bundle '+output);continue}
 const text=await fs.readFile(output,'utf8');
 const visited=new Set(),ordered=[];
 function collect(id){if(visited.has(id))return;const item=map.get(id);if(!item)return;for(const d of item.dependencies)collect(d);visited.add(id);ordered.push(item)}
 for(const id of m.bundles[task]??[])collect(id);
 for(const item of ordered)if(!text.includes('# '+item.id+' '))errors.push('Compiled bundle '+task+' missing '+item.id);
}

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('USS validation passed: '+m.modules.length+' modules, '+m.required_source_sections.length+' source references, dependency graph, archive equality, embedded directive equivalence, release policy, and task indexes.');
