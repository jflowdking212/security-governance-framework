import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const m=JSON.parse(read('manifest.json'));
const ids=m.modules.map(x=>x.id),idSet=new Set(ids),map=new Map(m.modules.map(x=>[x.id,x]));

test('module IDs are unique and the modular library is populated',()=>{
 assert.equal(ids.length,22);
 assert.equal(idSet.size,ids.length);
});
test('all declared module files and dependency references exist',()=>{
 for(const module of m.modules){
  assert.ok(fs.existsSync(path.join(ROOT,module.path)),module.path);
  for(const dependency of module.dependencies)assert.ok(idSet.has(dependency),module.id+' -> '+dependency);
 }
});
test('dependency graph is acyclic',()=>{
 const done=new Set(),visiting=new Set();
 function visit(id){
  if(done.has(id))return;
  assert.ok(!visiting.has(id),'cycle at '+id);
  visiting.add(id);
  for(const dependency of map.get(id).dependencies)visit(dependency);
  visiting.delete(id);
  done.add(id);
 }
 for(const id of ids)visit(id);
 assert.equal(done.size,ids.length);
});
test('task and bundle module references resolve',()=>{
 for(const [task,modules] of Object.entries(m.tasks))for(const id of modules)assert.ok(idSet.has(id),task+' -> '+id);
 for(const [task,modules] of Object.entries(m.bundles))for(const id of modules)assert.ok(idSet.has(id),task+' -> '+id);
});
test('all required source sections are present in module metadata',()=>{
 const text=m.modules.map(module=>read(module.path)).join('\n');
 for(const ref of m.required_source_sections)assert.ok(text.includes(ref),'missing '+ref);
});
test('traceability matrix covers every required source section',()=>{
 const csv=read('source/traceability-matrix.csv');
 for(const ref of m.required_source_sections)assert.ok(csv.includes(ref),'matrix missing '+ref);
});
test('tracked task indexes contain the full dependency closure',()=>{
 for(const task of Object.keys(m.bundle_paths)){
  const text=read(m.bundle_paths[task]);
  const seen=new Set();
  function visit(id){
   if(seen.has(id))return;
   const module=map.get(id);
   for(const dependency of module.dependencies)visit(dependency);
   seen.add(id);
  }
  for(const id of m.bundles[task])visit(id);
  for(const id of seen)assert.ok(text.includes('| '+id+' '),task+' index missing '+id);
 }
});
test('P0/P1 are non-waivable release blockers',()=>{
 assert.equal(m.rules.p0_release,'BLOCK');
 assert.equal(m.rules.p1_release,'BLOCK');
 assert.equal(m.rules.agent_may_waive_p0_p1,false);
 assert.deepEqual(m.rules.risk_acceptance_applies_to,['P2','P3']);
 assert.equal(m.rules.unknown_is_pass,false);
});
test('root source files and preserved archive copies are identical',()=>{
 for(const source of Object.values(m.sources))assert.equal(read(source.root),read(source.archive));
});
test('embedded global directive equals standalone canonical source',()=>{
 const anti=read(m.sources.antigravity.archive),global=read(m.sources.global.archive);
 const marker='# EMBEDDED CANONICAL GLOBAL DIRECTIVE — v4',i=anti.indexOf(marker);
 assert.ok(i>=0);
 const norm=text=>text.replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean).join('\n');
 assert.equal(norm(anti.slice(i+marker.length)),norm(global));
});
