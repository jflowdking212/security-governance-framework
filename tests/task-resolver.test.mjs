import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const run=args=>spawnSync(process.execPath,['tools/resolve-task.mjs',...args],{encoding:'utf8'});
function closure(ids){const map=new Map(manifest.modules.map(m=>[m.id,m])),seen=new Set(),out=[];function visit(id){if(seen.has(id))return;const m=map.get(id);for(const d of m.dependencies)visit(d);seen.add(id);out.push(m)}for(const id of ids)visit(id);return out}
test('every task key resolves with its full dependency closure',()=>{for(const [task,ids] of Object.entries(manifest.tasks)){const r=run(['--task',task]);assert.equal(r.status,0,task+': '+r.stderr);for(const m of closure(ids))assert.ok(r.stdout.includes(m.id+' '+m.path),task+' missing '+m.id)}});
test('full audit resolves every module',()=>{const r=run(['--task','full-audit']);assert.equal(r.status,0,r.stderr);for(const m of manifest.modules)assert.ok(r.stdout.includes(m.id+' '+m.path))});
test('single-module lookup includes transitive dependencies',()=>{const r=run(['--module','M03']);assert.equal(r.status,0,r.stderr);for(const id of ['M01','M02','M03','M08'])assert.ok(r.stdout.includes(id+' '))});
test('keyword lookup finds webhook controls and dependencies',()=>{const r=run(['--keywords','payment webhook']);assert.equal(r.status,0,r.stderr);for(const id of ['M01','M03','M04','M05','M06','M08','M10'])assert.ok(r.stdout.includes(id+' '))});
test('unknown task fails safely',()=>{const r=run(['--task','not-a-task']);assert.notEqual(r.status,0)});
