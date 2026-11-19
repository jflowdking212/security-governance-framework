import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Statement-level requirement identifiers, derived (never hand-assigned) from the generated modules.
//
//   <control-family>.<8 hex>   e.g. USS-PAY.3f9a1c2e
//
// The hex part is the SHA-256 prefix of the normalised statement text, so an ID is stable across
// formatting, renderer and line-number changes but changes whenever the requirement wording changes.
// A changed ID is therefore a visible signal that a pinned requirement was edited. Nothing is committed:
// the index is recomputed from modules/ on demand, so it cannot go stale.
//
// Scope note: every content line (bullet, numbered item, paragraph, control sentence) receives an ID.
// Not every line is normative; use the module heading shown by --module to see the context.

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function normaliseStatement(line){
 return line
  .replace(/^\s*(?:[-*]\s+|\d+\.\s+)/,'')
  .replace(/[\\*`>]/g,'')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();
}

export function extractRequirements(moduleText,family,moduleId){
 const out=[],seen=new Map();
 let heading='(module header)',inFence=false;
 for(const raw of moduleText.split(/\r?\n/)){
  const line=raw.trimEnd();
  if(/^\s*```/.test(line)){inFence=!inFence;continue;}
  if(inFence)continue;
  const t=line.trim();
  if(!t||/^-{3,}$/.test(t)||/^\*\*Source sections:\*\*/.test(t)||/^\*\*Generated from:\*\*/.test(t))continue;
  if(/^#{1,6}\s/.test(t)){heading=t.replace(/^#+\s*/,'');continue;}
  if(/^\*\*#{1,6}\s.*\*\*$/.test(t)){heading=t.replace(/^\*\*#+\s*/,'').replace(/\*\*$/,'');continue;}
  const norm=normaliseStatement(line);
  if(norm.length<4)continue;
  const hash=crypto.createHash('sha256').update(norm).digest('hex').slice(0,8);
  const base=family+'.'+hash,count=(seen.get(base)??0)+1;
  seen.set(base,count);
  out.push({id:count===1?base:base+'-'+count,module:moduleId,family,heading,text:line.trim()});
 }
 return out;
}

export async function loadAllRequirements(root=ROOT){
 const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 const catalog=JSON.parse(await fs.readFile(path.join(root,'assurance/control-catalog.json'),'utf8'));
 const familyOf=new Map(catalog.controls.map(c=>[c.module_id,c.id]));
 const all=[];
 for(const m of manifest.modules){
  const family=familyOf.get(m.id);
  if(!family)throw new Error('No control family for '+m.id);
  all.push(...extractRequirements(await fs.readFile(path.join(root,m.path),'utf8'),family,m.id));
 }
 const ids=new Set();
 for(const r of all){
  if(ids.has(r.id))throw new Error('Duplicate requirement ID '+r.id+' (modules must not repeat a statement under the same family)');
  ids.add(r.id);
 }
 return all;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const usage='Usage: node tools/requirement-ids.mjs --count | --module <Mxx> | --lookup <ID>';
 const flag=args[0],value=args[1];
 if(!['--count','--module','--lookup'].includes(flag)||(flag!=='--count'&&!value)||args.length>(flag==='--count'?1:2)){console.error(usage);process.exit(2);}
 const all=await loadAllRequirements();
 if(flag==='--count'){
  const per=new Map();for(const r of all)per.set(r.module,(per.get(r.module)??0)+1);
  for(const [m,n] of per)console.log(m+' '+n);
  console.log('Total '+all.length);
 }else if(flag==='--module'){
  const rows=all.filter(r=>r.module===value);
  if(!rows.length){console.error('Unknown module or no requirements: '+value);process.exit(2);}
  for(const r of rows)console.log(r.id+' | '+r.heading+' | '+r.text.slice(0,140));
 }else{
  const hit=all.find(r=>r.id===value);
  if(!hit){console.error('Unknown requirement ID: '+value);process.exit(2);}
  console.log(JSON.stringify(hit,null,2));
 }
}
