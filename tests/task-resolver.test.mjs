import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const TEST_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(TEST_ROOT,'manifest.json'),'utf8'));
const run=(args,cwd=process.cwd(),entry=path.join(TEST_ROOT,'tools/resolve-task.mjs'))=>spawnSync(process.execPath,[entry,...args],{encoding:'utf8',cwd});
function closure(ids){const map=new Map(manifest.modules.map(m=>[m.id,m])),seen=new Set(),out=[];function visit(id){if(seen.has(id))return;const m=map.get(id);for(const d of m.dependencies)visit(d);seen.add(id);out.push(m)}for(const id of ids)visit(id);return out}
test('every task key resolves with its full dependency closure',()=>{for(const [task,ids] of Object.entries(manifest.tasks)){const r=run(['--task',task]);assert.equal(r.status,0,task+': '+r.stderr);for(const m of closure(ids))assert.ok(r.stdout.includes(m.id+' '+m.path),task+' missing '+m.id)}});
test('full audit resolves every module',()=>{const r=run(['--task','full-audit']);assert.equal(r.status,0,r.stderr);for(const m of manifest.modules)assert.ok(r.stdout.includes(m.id+' '+m.path))});
test('single-module lookup includes transitive dependencies',()=>{const r=run(['--module','M03']);assert.equal(r.status,0,r.stderr);for(const id of ['M01','M02','M03','M08'])assert.ok(r.stdout.includes(id+' '))});
test('keyword lookup finds webhook controls and dependencies',()=>{const r=run(['--keywords','payment webhook']);assert.equal(r.status,0,r.stderr);for(const id of ['M01','M03','M04','M05','M06','M08','M10'])assert.ok(r.stdout.includes(id+' '))});
test('vendored resolver runs from a consuming project root and prints caller-relative module paths',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uss-vendor-consumer-'));
 try{
  const vendorRoot=path.join(temp,'vendor','uss');
  fs.mkdirSync(path.join(vendorRoot,'tools'),{recursive:true});
  fs.copyFileSync(path.join(TEST_ROOT,'tools','resolve-task.mjs'),path.join(vendorRoot,'tools','resolve-task.mjs'));
  fs.copyFileSync(path.join(TEST_ROOT,'manifest.json'),path.join(vendorRoot,'manifest.json'));
  fs.cpSync(path.join(TEST_ROOT,'modules'),path.join(vendorRoot,'modules'),{recursive:true});
  const r=run(['--task','payments'],temp,'vendor/uss/tools/resolve-task.mjs');
  assert.equal(r.status,0,r.stderr);
  const payment=manifest.modules.find(m=>m.id==='M06');
  const callerPath='vendor/uss/'+payment.path;
  assert.ok(r.stdout.includes('M06 '+callerPath+' |'),r.stdout);
  assert.ok(fs.existsSync(path.join(temp,callerPath)));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('unknown task fails safely',()=>{const r=run(['--task','not-a-task']);assert.notEqual(r.status,0)});
