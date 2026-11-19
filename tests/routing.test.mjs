import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const TEST_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(TEST_ROOT,'manifest.json'),'utf8'));
const map=new Map(manifest.modules.map(m=>[m.id,m]));
const run=args=>spawnSync(process.execPath,[path.join(TEST_ROOT,'tools/resolve-task.mjs'),...args],{encoding:'utf8',cwd:TEST_ROOT});
const read=relative=>fs.readFileSync(path.join(TEST_ROOT,relative),'utf8');
const closure=ids=>{
 const seen=new Set();
 const visit=id=>{if(seen.has(id))return;seen.add(id);map.get(id).dependencies.forEach(visit);};
 ids.forEach(visit);
 return seen;
};
const AUDIT=new Set(['security-audit','full-audit','production-release']);

test('mandatory self-audit (M13) and core policy (M01) are reachable from every task',()=>{
 for(const [task,ids] of Object.entries(manifest.tasks)){
  const resolved=closure(ids);
  assert.ok(resolved.has('M01'),task+' lacks M01');
  assert.ok(resolved.has('M13'),task+' lacks M13');
 }
});
test('routine tasks never pull audit-only modules (M14/M16/M20)',()=>{
 for(const [task,ids] of Object.entries(manifest.tasks)){
  if(AUDIT.has(task))continue;
  const resolved=closure(ids);
  for(const id of ['M14','M16','M20'])assert.ok(!resolved.has(id),task+' over-fetches '+id);
 }
});
test('public-security-communication does not pull the full library',()=>{
 const resolved=closure(manifest.tasks['public-security-communication']);
 assert.ok(resolved.size<=12,'resolved '+resolved.size+' modules');
 assert.ok(!resolved.has('M14'));
});
test('audit and production-release tasks resolve every module',()=>{
 for(const task of ['full-audit','production-release']){
  const resolved=closure(manifest.tasks[task]);
  for(const id of map.keys())assert.ok(resolved.has(id),task+' omits '+id);
 }
});
test('security-audit covers every domain module without relying on audit-module dependencies',()=>{
 const resolved=closure(manifest.tasks['security-audit']);
 for(const id of ['M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','M21'])assert.ok(resolved.has(id),'omits '+id);
});
test('code-change baseline includes general application security controls but excludes specialist domains',()=>{
 const resolved=closure(manifest.tasks['code-change']);
 for(const id of ['M01','M02','M03','M04','M05','M08','M09','M10','M12','M13'])assert.ok(resolved.has(id),'baseline omits '+id);
 for(const id of ['M06','M07','M11','M14','M16','M20'])assert.ok(!resolved.has(id),'baseline over-fetches '+id);
 let bytes=0;
 for(const id of resolved)bytes+=read(map.get(id).path).length;
 assert.ok(bytes<=100*1024,'baseline exceeds routine routing budget: '+Math.round(bytes/1024)+' KB');
});
test('authentication task includes CSRF/cookie and rate-limit controls',()=>{
 const resolved=closure(manifest.tasks.authentication);
 for(const id of ['M02','M04','M05'])assert.ok(resolved.has(id));
});
test('database and data tasks include data-layer integrity controls',()=>{
 for(const task of ['database','data-protection']){
  const resolved=closure(manifest.tasks[task]);
  assert.ok(resolved.has('M04')&&resolved.has('M09'),task);
 }
});
test('layer-5 and layer-12 checks are reachable without loading M14',()=>{
 assert.match(read(map.get('M09').path),/Layer 5 — Database, Financial & Transaction Integrity/);
 const operations=read(map.get('M10').path);
 assert.match(operations,/Layer 12 — Backup, Disaster Recovery/);
 assert.match(operations,/never been restore-tested/);
});
test('keyword routing does not match by substring',()=>{
 const email=run(['--keywords','email login']);
 assert.equal(email.status,0,email.stderr);
 assert.ok(!email.stdout.includes('M11 '),'email pulled M11');
 assert.match(email.stderr,/email/);
 const decision=run(['--keywords','decision']);
 assert.equal(decision.status,2);
});
test('task and keyword routing are additive for specialist domains',()=>{
 const r=run(['--task','code-change','--keywords','payment webhook']);
 assert.equal(r.status,0,r.stderr);
 for(const id of ['M01','M04','M05','M06','M08','M10','M13'])assert.ok(r.stdout.includes(id+' '),'missing '+id);
 assert.match(r.stdout,/Keyword modules: M06/);
});
test('keyword lookup warns about unmatched words instead of silently under-fetching',()=>{
 const r=run(['--keywords','payment xyzzy']);
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stderr,/xyzzy/);
});
test('payment and tax modules carry the directive preamble',()=>{
 for(const id of ['M06','M07']){
  const text=read(map.get(id).path);
  assert.match(text,/Do not treat a working payment integration as a secure payment integration/);
  assert.match(text,/FAIL CLOSED & PROVE/);
 }
});
test('source 19.8 P0/P1 exception is annotated as superseded by the owner policy',()=>{
 const text=read(map.get('M20').path);
 const i=text.indexOf('unless the directive explicitly allows');
 assert.ok(i>0);
 assert.ok(text.slice(i,i+800).includes('SUPERSEDED'));
});
test('P0/P1 risk-acceptance clauses and CVSS mapping remain explicit',()=>{
 for(const module of manifest.modules){
  if(['M17','M20'].includes(module.id))continue;
  const lines=read(module.path).split(/\r?\n/);
  for(let i=0;i<lines.length;i++)if(/risk[- ]accept/i.test(lines[i]))assert.ok(lines.slice(i,i+4).join('\n').includes('OWNER POLICY OVERRIDE (OWNER:RELEASE-POLICY)'),module.id+' line '+(i+1)+' lacks local override');
 }
 assert.match(read(map.get('M17').path),/CVSS Critical\/High labels are triage signals, not automatic USS P0\/P1 classifications/);
});
test('generated task indexes remain in sync with manifest routing',()=>{
 const index=read('MODULE-INDEX.md');
 for(const task of Object.keys(manifest.tasks))assert.ok(index.includes('`'+task+'`'),'MODULE-INDEX missing '+task);
 for(const [name,ids] of Object.entries(manifest.bundles)){
  const bundle=read(manifest.bundle_paths[name]);
  for(const id of closure(ids))assert.ok(bundle.includes('| '+id+' '),name+' index missing '+id);
 }
});

test('M06 contains comprehensive payment and webhook security controls',()=>{
 const text=read(map.get('M06').path);
 assert.match(text,/Timing-safe comparison/);
 assert.match(text,/crypto\.timingSafeEqual|hash_equals/);
 assert.match(text,/raw, untouched request byte stream/);
 assert.match(text,/Replay protection/);
 assert.match(text,/Atomic idempotency/);
 assert.match(text,/PCI DSS cardholder data minimisation/);
 assert.match(text,/CVV\/CVC\/CID/);
 assert.match(text,/Payment provider tokenisation/);
 assert.match(text,/Sensitive data logging prohibition/);
});

test('M12 contains comprehensive supply-chain and CI/CD security controls',()=>{
 const text=read(map.get('M12').path);
 assert.match(text,/Untrusted pull requests & fork contributions/);
 assert.match(text,/pull_request_target risks and prohibition/);
 assert.match(text,/Workflow injection prevention/);
 assert.match(text,/Untrusted branch and commit metadata/);
 assert.match(text,/Secret exposure and containment/);
 assert.match(text,/Least-privilege GitHub permissions/);
 assert.match(text,/Checkout credential persistence/);
 assert.match(text,/Secure workflow_run handling/);
});
