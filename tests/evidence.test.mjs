import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const validator=path.join(ROOT,'tools/validate-evidence.mjs');
const template=JSON.parse(fs.readFileSync(path.join(ROOT,'templates/security-evidence.example.json'),'utf8'));
const run=(file,args=[])=>spawnSync(process.execPath,[validator,'--file',file,...args],{encoding:'utf8',cwd:ROOT});
function withReport(change){
 const report=structuredClone(template);
 change(report);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-evidence-'));
 const file=path.join(dir,'assessment.json');
 fs.writeFileSync(file,JSON.stringify(report,null,2));
 return {file,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
function markAllPass(report){
 for(const control of report.controls){
  control.status='PASS';
  control.evidence=[{kind:'test',reference:'tests/evidence.test.mjs#fixture',observed_at:'2026-11-18T00:00:00Z',result:'passed'}];
  delete control.notes;
 }
}

test('control catalog maps every module to one stable family ID',()=>{
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'assurance/control-catalog.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8'));
 assert.equal(catalog.controls.length,manifest.modules.length);
 assert.equal(new Set(catalog.controls.map(x=>x.id)).size,catalog.controls.length);
 assert.deepEqual(new Set(catalog.controls.map(x=>x.module_id)),new Set(manifest.modules.map(x=>x.id)));
});
test('example evidence template validates but is not release-ready',()=>{
 const file=path.join(ROOT,'templates/security-evidence.example.json');
 const result=run(file);
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/Computed assessment state: NOT_READY/);
 const release=run(file,['--release']);
 assert.equal(release.status,1);
 assert.match(release.stderr,/does not support release review/);
});
test('complete evidence-backed assessment passes the structural and release checks',()=>{
 const fixture=withReport(report=>markAllPass(report));
 try{
  const result=run(fixture.file,['--release']);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/READY_FOR_OWNER_REVIEW/);
 }finally{fixture.cleanup();}
});
test('UNKNOWN is never treated as PASS',()=>{
 const fixture=withReport(report=>markAllPass(report));
 try{
  fixture.report;
  const report=JSON.parse(fs.readFileSync(fixture.file,'utf8'));
  report.controls[0].status='UNKNOWN';
  report.controls[0].evidence=[];
  fs.writeFileSync(fixture.file,JSON.stringify(report));
  const result=run(fixture.file,['--release']);
  assert.equal(result.status,1);
  assert.match(result.stdout,/NOT_READY/);
 }finally{fixture.cleanup();}
});
test('P0/P1 risk acceptance is rejected even when an approval is supplied',()=>{
 const fixture=withReport(report=>{
  markAllPass(report);
  report.controls[0].status='FAIL';
  report.controls[0].evidence=[];
  report.controls[0].finding_ids=['F-001'];
  report.findings=[{id:'F-001',severity:'P1',status:'ACCEPTED',title:'Unresolved high-severity defect',control_ids:[report.controls[0].control_id],risk_acceptance:{approved_by:'Owner',rationale:'Temporary exception',approved_at:'2026-11-18T00:00:00Z',expires_at:'2026-12-18T00:00:00Z'}}];
 });
 try{
  const result=run(fixture.file);
  assert.equal(result.status,2);
  assert.match(result.stderr,/cannot be risk-accepted/);
 }finally{fixture.cleanup();}
});
test('open P1 finding blocks release',()=>{
 const fixture=withReport(report=>{
  markAllPass(report);
  report.controls[0].status='FAIL';
  report.controls[0].evidence=[];
  report.controls[0].finding_ids=['F-002'];
  report.findings=[{id:'F-002',severity:'P1',status:'OPEN',title:'Unresolved critical-path defect',control_ids:[report.controls[0].control_id]}];
 });
 try{
  const result=run(fixture.file,['--release']);
  assert.equal(result.status,1);
  assert.match(result.stdout,/BLOCKED_P0_P1/);
 }finally{fixture.cleanup();}
});
test('P2/P3 risk acceptance can be recorded with owner, rationale and expiry',()=>{
 const fixture=withReport(report=>{
  markAllPass(report);
  report.controls[0].status='FAIL';
  report.controls[0].evidence=[];
  report.controls[0].finding_ids=['F-003'];
  report.findings=[{id:'F-003',severity:'P2',status:'ACCEPTED',title:'Documented medium-severity residual risk',control_ids:[report.controls[0].control_id],risk_acceptance:{approved_by:'Owner',rationale:'Compensating control is in place; remediation is scheduled.',approved_at:'2026-11-18T00:00:00Z',expires_at:'2026-12-18T00:00:00Z'}}];
 });
 try{
  const result=run(fixture.file,['--release']);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/READY_FOR_OWNER_REVIEW/);
 }finally{fixture.cleanup();}
});
test('PASS without evidence is rejected',()=>{
 const fixture=withReport(report=>{
  markAllPass(report);
  report.controls[0].evidence=[];
 });
 try{
  const result=run(fixture.file);
  assert.equal(result.status,2);
  assert.match(result.stderr,/requires at least one evidence item/);
 }finally{fixture.cleanup();}
});
test('NOT_APPLICABLE without rationale and approval is rejected',()=>{
 const fixture=withReport(report=>{
  markAllPass(report);
  report.controls[0].status='NOT_APPLICABLE';
  report.controls[0].evidence=[];
 });
 try{
  const result=run(fixture.file);
  assert.equal(result.status,2);
  assert.match(result.stderr,/requires rationale/);
 }finally{fixture.cleanup();}
});
test('unknown control IDs and incomplete full audits are rejected',()=>{
 const unknown=withReport(report=>{
  report.scope.control_ids[0]='USS-UNKNOWN';
  report.controls[0].control_id='USS-UNKNOWN';
 });
 const incomplete=withReport(report=>{
  report.scope.control_ids.pop();
  report.controls.pop();
 });
 try{
  const a=run(unknown.file);
  assert.equal(a.status,2);
  assert.match(a.stderr,/unknown control ID/);
  const b=run(incomplete.file);
  assert.equal(b.status,2);
  assert.match(b.stderr,/must include every control family/);
 }finally{
  unknown.cleanup();
  incomplete.cleanup();
 }
});
