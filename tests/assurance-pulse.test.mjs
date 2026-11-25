import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tool=path.join(ROOT,'tools/assurance-pulse.mjs');
const template=JSON.parse(fs.readFileSync(path.join(ROOT,'templates/security-evidence.example.json'),'utf8'));
function fixture(change=()=>{}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-pulse-'));
 const file=path.join(dir,'assessment.json');
 const report=structuredClone(template);
 report.project.repository='acme/example-app';
 report.project.commit='a'.repeat(40);
 report.project.assessed_at='2026-11-25T00:00:00Z';
 change(report);
 fs.writeFileSync(file,JSON.stringify(report));
 return {dir,file,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
function run(args){return spawnSync(process.execPath,[tool,...args],{cwd:ROOT,encoding:'utf8'});}
test('pulse reports PASS, FAIL and UNKNOWN separately and highlights unverified PASS',()=>{
 const f=fixture(r=>{
  r.controls[0].status='PASS';r.controls[0].evidence=[{result:'passed',observed_at:'2026-11-24T00:00:00Z'}];
  r.controls[1].status='FAIL';r.controls[2].status='UNKNOWN';
  r.controls[3].status='PASS';r.controls[3].evidence=[];
 });
 try{const x=run(['--file',f.file]);assert.equal(x.status,0,x.stderr);assert.match(x.stdout,/| PASS | FAIL | UNKNOWN |/);assert.match(x.stdout,/PASS without sufficient success evidence \| 1/);assert.match(x.stdout,/ATTENTION_REQUIRED/);}finally{f.cleanup();}
});
test('open P0/P1 findings produce BLOCKED_P0_P1',()=>{
 const f=fixture(r=>{r.findings=[{id:'F-1',severity:'P1',status:'OPEN',title:'Critical issue'}];});
 try{const x=run(['--file',f.file]);assert.equal(x.status,0,x.stderr);assert.match(x.stdout,/BLOCKED_P0_P1/);}finally{f.cleanup();}
});
test('unknown control IDs and duplicate control IDs are rejected',()=>{
 const a=fixture(r=>{r.controls[0].control_id='USS-NOT-REAL';});
 const b=fixture(r=>{r.controls.push(structuredClone(r.controls[0]));});
 try{assert.equal(run(['--file',a.file]).status,2);assert.equal(run(['--file',b.file]).status,2);}finally{a.cleanup();b.cleanup();}
});
test('malformed commit identity is rejected',()=>{
 const f=fixture(r=>{r.project.commit='main';});
 try{const x=run(['--file',f.file]);assert.equal(x.status,2);assert.match(x.stderr,/40-character/);}finally{f.cleanup();}
});
test('duplicate project reports are rejected',()=>{
 const a=fixture(),b=fixture();
 try{const x=run(['--file',a.file,'--file',b.file]);assert.equal(x.status,2);assert.match(x.stderr,/Duplicate repository/);}finally{a.cleanup();b.cleanup();}
});
test('pulse can write a markdown report to a requested path',()=>{
 const f=fixture();
 try{const out=path.join(f.dir,'reports','pulse.md');const x=run(['--file',f.file,'--out',out]);assert.equal(x.status,0,x.stderr);assert.ok(fs.readFileSync(out,'utf8').includes('USS Assurance Pulse'));}finally{f.cleanup();}
});
