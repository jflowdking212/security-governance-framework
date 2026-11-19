import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const TEST_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(TEST_ROOT,'manifest.json'),'utf8'));
const resolver=path.join(TEST_ROOT,'tools/resolve-task.mjs');
const run=(args,cwd=TEST_ROOT,entry=resolver)=>spawnSync(process.execPath,[entry,...args],{encoding:'utf8',cwd});
function closure(ids){
 const map=new Map(manifest.modules.map(m=>[m.id,m])),seen=new Set(),out=[];
 function visit(id){
  if(seen.has(id))return;
  const m=map.get(id);
  for(const dependency of m.dependencies)visit(dependency);
  seen.add(id);out.push(m);
 }
 for(const id of ids)visit(id);
 return out;
}

test('every task key resolves with its full dependency closure',()=>{
 for(const [task,ids] of Object.entries(manifest.tasks)){
  const r=run(['--task',task]);
  assert.equal(r.status,0,task+': '+r.stderr);
  for(const m of closure(ids))assert.ok(r.stdout.includes(m.id+' '+m.path),task+' missing '+m.id);
 }
});
test('full audit resolves every module',()=>{
 const r=run(['--task','full-audit']);
 assert.equal(r.status,0,r.stderr);
 for(const m of manifest.modules)assert.ok(r.stdout.includes(m.id+' '+m.path));
});
test('single-module lookup includes transitive dependencies',()=>{
 const r=run(['--module','M03']);
 assert.equal(r.status,0,r.stderr);
 for(const id of ['M01','M02','M03','M08'])assert.ok(r.stdout.includes(id+' '));
});
test('keyword lookup finds webhook controls and dependencies',()=>{
 const r=run(['--keywords','payment webhook']);
 assert.equal(r.status,0,r.stderr);
 for(const id of ['M01','M03','M04','M05','M06','M08','M10'])assert.ok(r.stdout.includes(id+' '));
});
test('code-change provides a secure coding baseline',()=>{
 const r=run(['--task','code-change']);
 assert.equal(r.status,0,r.stderr);
 for(const id of ['M01','M02','M03','M04','M05','M08','M09','M10','M12','M13'])assert.ok(r.stdout.includes(id+' '),'missing baseline module '+id);
 for(const id of ['M06','M07','M11','M14','M16','M20'])assert.ok(!r.stdout.includes(id+' '),'unexpected specialist module '+id);
});
test('task and keyword routing combine instead of one silently overriding the other',()=>{
 const r=run(['--task','code-change','--keywords','payment webhook']);
 assert.equal(r.status,0,r.stderr);
 for(const id of ['M01','M04','M05','M06','M08','M10','M13'])assert.ok(r.stdout.includes(id+' '),'missing '+id);
 assert.match(r.stdout,/Keyword modules: M06/);
});
test('unmatched keywords are reported when a valid task is also supplied',()=>{
 const r=run(['--task','secrets','--keywords','unmappedterm']);
 assert.equal(r.status,0,r.stderr);
 assert.ok(r.stdout.includes('M08 '));
 assert.match(r.stderr,/unmappedterm/);
});
test('keyword lookup does not match by substring',()=>{
 const r=run(['--keywords','email login']);
 assert.equal(r.status,0,r.stderr);
 assert.ok(!r.stdout.includes('M11 '),'email incorrectly selected M11');
 assert.match(r.stderr,/email/);
});
test('inherited object property names are rejected as task keys',()=>{
 for(const name of ['constructor','toString','hasOwnProperty','__proto__']){
  const r=run(['--task',name]);
  assert.equal(r.status,2,name+' should be rejected');
  assert.match(r.stderr,/Unknown task/);
 }
});
test('inherited object property names are rejected as module IDs',()=>{
 const r=run(['--module','constructor']);
 assert.equal(r.status,2);
 assert.match(r.stderr,/Unknown module/);
});
test('malformed and ambiguous CLI arguments fail closed',()=>{
 const cases=[
  [['--task'],/Missing value/],
  [['--task','--module','M03'],/Missing value/],
  [['--task','payments','--task','secrets'],/Duplicate option/],
  [['--task','payments','--unknown','x'],/Unknown option/],
  [['--module','M03','--keywords','payment'],/cannot be combined/],
  [['--keywords','   '],/Missing value/]
 ];
 for(const [args,pattern] of cases){
  const r=run(args);
  assert.equal(r.status,2,args.join(' '));
  assert.match(r.stderr,pattern);
 }
});
test('vendored resolver runs from a consuming project root and prints caller-relative module paths',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uss-vendor-consumer-'));
 try{
  const vendorRoot=path.join(temp,'vendor','uss');
  fs.mkdirSync(path.join(vendorRoot,'tools'),{recursive:true});
  fs.copyFileSync(resolver,path.join(vendorRoot,'tools','resolve-task.mjs'));
  fs.copyFileSync(path.join(TEST_ROOT,'manifest.json'),path.join(vendorRoot,'manifest.json'));
  fs.cpSync(path.join(TEST_ROOT,'modules'),path.join(vendorRoot,'modules'),{recursive:true});
  if(fs.existsSync(path.join(TEST_ROOT,'supplements'))){
   fs.cpSync(path.join(TEST_ROOT,'supplements'),path.join(vendorRoot,'supplements'),{recursive:true});
  }
  const r=run(['--task','payments'],temp,'vendor/uss/tools/resolve-task.mjs');
  assert.equal(r.status,0,r.stderr);
  const payment=manifest.modules.find(m=>m.id==='M06');
  const callerPath='vendor/uss/'+payment.path;
  assert.ok(r.stdout.includes('M06 '+callerPath+' |'),r.stdout);
  assert.ok(fs.existsSync(path.join(temp,callerPath)));
 }finally{
  fs.rmSync(temp,{recursive:true,force:true});
 }
});
test('unknown task fails safely',()=>{
 const r=run(['--task','not-a-task']);
 assert.equal(r.status,2);
});

test('resolver with --supplement finds supplement by ID, slug, and relative path',()=>{
 for(const flag of ['S01','authentication-federation','supplements/authentication-federation.md']){
  const r=run(['--supplement',flag]);
  assert.equal(r.status,0,flag+': '+r.stderr);
  assert.ok(r.stdout.includes('S01 supplements/authentication-federation.md | Authentication and federation'),flag);
  assert.ok(r.stdout.includes('M02 modules/m02-authentication-sessions.md'),flag+' should seed related modules');
 }
});

test('resolver rejects unknown supplement reference',()=>{
 const r=run(['--supplement','non-existent-supplement']);
 assert.equal(r.status,2);
 assert.match(r.stderr,/Unknown supplement/);
});

test('resolver rejects nonexistent supplement file path on disk',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uss-bad-supp-'));
 try{
  const customManifest=JSON.parse(JSON.stringify(manifest));
  customManifest.supplements.push({
   id:'S99',
   slug:'missing-file',
   title:'Missing',
   path:'supplements/does-not-exist.md',
   triggers:['missing'],
   related_modules:[]
  });
  fs.mkdirSync(path.join(temp,'tools'),{recursive:true});
  fs.copyFileSync(resolver,path.join(temp,'tools','resolve-task.mjs'));
  fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(customManifest,null,2));
  fs.cpSync(path.join(TEST_ROOT,'modules'),path.join(temp,'modules'),{recursive:true});
  const r=run(['--supplement','S99'],temp,'tools/resolve-task.mjs');
  assert.equal(r.status,2);
  assert.match(r.stderr,/Referenced supplement file does not exist on disk/);
 }finally{
  fs.rmSync(temp,{recursive:true,force:true});
 }
});

test('resolver prevents duplicate supplement loading',()=>{
 const r=run(['--task','authentication','--supplement','S01','--keywords','oauth']);
 assert.equal(r.status,0,r.stderr);
 const occurrences=(r.stdout.match(/S01 supplements\/authentication-federation\.md/g)||[]).length;
 assert.equal(occurrences,1,'Supplement S01 was duplicated in output');
});

test('resolver strict mode fails closed on unmatched keywords',()=>{
 const r=run(['--strict','--task','secrets','--keywords','unmappedterm']);
 assert.equal(r.status,2);
 assert.match(r.stderr,/Strict mode: unmatched keywords/);
});

test('resolver strict mode fails closed on empty selector',()=>{
 const r=run(['--strict']);
 assert.equal(r.status,2);
 assert.match(r.stderr,/Strict mode: no task, module, keywords, or supplement selector provided/);
});

test('resolver strict mode passes when all keywords match',()=>{
 const r=run(['--strict','--task','code-change','--keywords','payment webhook']);
 assert.equal(r.status,0,r.stderr);
 assert.ok(r.stdout.includes('M06 '));
});

test('resolver normal mode allows unmatched keywords with warning',()=>{
 const r=run(['--task','secrets','--keywords','unmappedterm']);
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stderr,/WARNING: keywords not matched to any trigger/);
});

test('resolver keyword search identifies applicable supplement triggers',()=>{
 const r=run(['--keywords','graphql']);
 assert.equal(r.status,0,r.stderr);
 assert.ok(r.stdout.includes('S03 supplements/api-graphql-websocket-grpc.md'));
});
