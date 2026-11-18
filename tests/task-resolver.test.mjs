import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=args=>spawnSync(process.execPath,['tools/resolve-task.mjs',...args],{encoding:'utf8'});
test('payments task resolves only its dependency closure',()=>{const r=run(['--task','payments']);assert.equal(r.status,0,r.stderr);for(const id of ['M01','M03','M04','M05','M06','M07','M08','M09','M10','M14','M15','M17','M19'])assert.ok(r.stdout.includes(id),id);assert.ok(!r.stdout.includes('M18 '))});
test('full audit resolves every module',()=>{const r=run(['--task','full-audit']);assert.equal(r.status,0,r.stderr);for(let i=1;i<=22;i++)assert.ok(r.stdout.includes('M'+String(i).padStart(2,'0')+' '))});
test('single-module lookup includes dependencies',()=>{const r=run(['--module','M03']);assert.equal(r.status,0,r.stderr);assert.ok(r.stdout.includes('M01 '));assert.ok(r.stdout.includes('M02 '));assert.ok(r.stdout.includes('M03 '))});
test('unknown task fails safely',()=>{const r=run(['--task','not-a-task']);assert.notEqual(r.status,0)});
