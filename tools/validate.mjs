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
const readmeLinks=[...readme.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1]).filter(x=>!/^https?:|^mailto:|^#/.test(x)).map(x=>decodeURIComponent(x.split('#')[0])).filter(Boolean);
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


const norm1=x=>x.replace(/\s+/g,' ').trim();
const allModules=norm1(moduleText);
const titleOnly=new Set(['**# GLOBAL DIRECTIVE: APPLICATION SECURITY & PENETRATION AUDITING PROTOCOL**','**## 1. Defensive Architecture & Hardening Standards**','# GLOBAL PAYMENT WEBHOOK SECURITY & REVENUE TAX COMPLIANCE DIRECTIVE'].map(norm1));
for(const [label,text] of [['global',global],['payment',await fs.readFile(m.sources.payment.archive,'utf8')]]){
 text.split(/\r?\n/).forEach((line,i)=>{const t=norm1(line);if(t.length<4||titleOnly.has(t))return;if(!allModules.includes(t))errors.push('Source line not present in any module ('+label+':'+(i+1)+'): '+t.slice(0,100))});
}
const contract=anti.slice(anti.indexOf('## Anti-Gravity Execution Contract'),pos).split(/\r?\n/);
const m22=norm1(await fs.readFile(map.get('M22').path,'utf8'));
for(const line of contract){const t=norm1(line);if(t.length>3&&!m22.includes(t))errors.push('Execution contract line missing from M22: '+t.slice(0,100))}
const read=async id=>fs.readFile(map.get(id).path,'utf8');
const count=(text,re)=>(text.match(re)||[]).length;
const expectCount=(label,actual,want)=>{if(actual!==want)errors.push(label+': expected '+want+' found '+actual)};
expectCount('M13 self-audit vectors',count(await read('M13'),/^\d+\\\. \*\*/gm),16);
expectCount('M14 assurance layers',count(await read('M14'),/^\*\*### Layer \d+ /gm),13);
expectCount('M01 decision principles',count(await read('M01'),/^\d+\\\. \*\*\\\*\\\*/gm),21);
expectCount('M06 payment controls A1-A16',count(await read('M06'),/^## A\d+\./gm),16);
expectCount('M07 tax controls B1-B12',count(await read('M07'),/^## B\d+\./gm),12);
expectCount('M22 execution contract items',count(await read('M22'),/^\d+\. /gm),15);
for(const x of m.modules){const c=await fs.readFile(x.path,'utf8'),h=(c.match(/\*\*Source sections:\*\* (.*?)\s*$/m)||[])[1]??'';if(h!==x.source_sections.join(', '))errors.push('Manifest source_sections differ from module header for '+x.id)}
const rows=matrix.split(/\r?\n/).filter(l=>l.trim()).slice(1).map(l=>l.split(','));
for(const [src,ref,,dest] of rows)for(const d of dest.split(';')){if(d==='adapters')continue;const x=map.get(d);if(!x)errors.push('Matrix row '+ref+' names unknown module '+d);else if(!x.source_sections.includes(ref))errors.push('Matrix row '+ref+' not declared by '+d)}
for(const x of m.modules)for(const ref of x.source_sections)if(!rows.some(r=>r[1]===ref&&r[3].split(';').includes(x.id)))errors.push('Module '+x.id+' ref '+ref+' has no matrix row');
const closureOf=ids=>{const seen=new Set(),out=[];const visit=id=>{if(seen.has(id))return;seen.add(id);for(const d of map.get(id).dependencies)visit(d);out.push(id)};ids.forEach(visit);return out};
const AUDIT_TASKS=new Set(['security-audit','full-audit','production-release']),AUDIT_ONLY=['M14','M16','M20'],ROUTINE_MAX_KB=100;
for(const [task,taskIds] of Object.entries(m.tasks)){
 const cl=closureOf(taskIds);
 if(!cl.includes('M01'))errors.push('Task '+task+' does not load M01');
 if(!cl.includes('M13'))errors.push('Task '+task+' does not load mandatory self-audit M13');
 if(!AUDIT_TASKS.has(task)){for(const a of AUDIT_ONLY)if(cl.includes(a))errors.push('Routine task '+task+' over-fetches audit-only module '+a);
  let bytes=0;for(const id of cl)bytes+=(await fs.readFile(map.get(id).path,'utf8')).length;if(bytes>ROUTINE_MAX_KB*1024)errors.push('Routine task '+task+' resolves to '+(bytes/1024).toFixed(0)+' KB (budget '+ROUTINE_MAX_KB+' KB)')}
}
for(const t of ['full-audit','production-release']){const cl=closureOf(m.tasks[t]);for(const id of ids)if(!cl.includes(id))errors.push(t+' omits module '+id)}
const secAudit=closureOf(m.tasks['security-audit']);for(const id of ids.filter(i=>!['M18','M19','M22'].includes(i)))if(!secAudit.includes(id))errors.push('security-audit omits applicable module '+id);
for(const x of m.modules){const c=await fs.readFile(x.path,'utf8');if(/unless the directive explicitly allows/i.test(c)&&!c.includes('SUPERSEDED'))errors.push('Module '+x.id+' contains the 19.8 P0/P1 exception without an owner-policy supersession note')}
for(const x of m.modules){
 if(['M17','M20'].includes(x.id))continue;
 const lines=(await read(x.id)).split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  if(!/risk[- ]accept/i.test(lines[i]))continue;
  const local=lines.slice(i,i+4).join('\n');
  if(!local.includes('OWNER POLICY OVERRIDE (OWNER:RELEASE-POLICY)'))errors.push('Module '+x.id+' has a risk-acceptance clause without an adjacent P0/P1 owner-policy override (line '+(i+1)+')');
 }
}
for(const f of ['KERNEL.md','AGENTS.md','adapters/gemini.md','adapters/claude.md','adapters/chatgpt.md','README.md']){const c=await fs.readFile(f,'utf8');if(!/P0\/P1|P0 and P1/.test(c)||!/waive/i.test(c))errors.push(f+' does not state that P0/P1 cannot be waived');if(/risk acceptance[^.]*P[01]/i.test(c)&&!/only to P2\/P3|cannot be waived|non-waivable|never/i.test(c))errors.push(f+' may allow P0/P1 risk acceptance')}
for(const [name,list] of Object.entries(m.bundles))if(JSON.stringify(list)!==JSON.stringify(m.tasks[name]))errors.push('Bundle '+name+' differs from task '+name+' (bundles must mirror tasks)');

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('USS validation passed: '+m.modules.length+' modules, '+m.required_source_sections.length+' source references, dependency graph, archive equality, embedded directive equivalence, release policy, and task indexes.');
