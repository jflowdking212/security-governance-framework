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
 // Release assessments must not carry the template's placeholder metadata.
 report.project.repository='acme/example-app';
 report.project.commit='a'.repeat(40);
 report.project.reviewer='Independent Reviewer';
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
 assert.notEqual(release.status,0);
 assert.match(release.stderr,/placeholder|UNASSIGNED|does not support release review/);
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
  report.findings=[{id:'F-001',severity:'P1',status:'ACCEPTED',title:'Unresolved high-severity defect',severity_rationale:'Fixture rationale: impact, reachability and blast radius recorded.',control_ids:[report.controls[0].control_id],risk_acceptance:{approved_by:'Owner',rationale:'Temporary exception',approved_at:'2026-11-18T00:00:00Z',expires_at:'2026-12-18T00:00:00Z'}}];
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
  report.findings=[{id:'F-002',severity:'P1',status:'OPEN',title:'Unresolved critical-path defect',severity_rationale:'Fixture rationale: impact, reachability and blast radius recorded.',control_ids:[report.controls[0].control_id]}];
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
  report.findings=[{id:'F-003',severity:'P2',status:'ACCEPTED',title:'Documented medium-severity residual risk',severity_rationale:'Fixture rationale: impact, reachability and blast radius recorded.',control_ids:[report.controls[0].control_id],risk_acceptance:{approved_by:'Owner',rationale:'Compensating control is in place; remediation is scheduled.',approved_at:'2026-11-18T00:00:00Z',expires_at:'2026-12-18T00:00:00Z'}}];
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

function mutated(change,{pass=true}={}){
 return withReport(report=>{if(pass)markAllPass(report);change(report);});
}
function expectInvalid(change,pattern,args=[]){
 const fixture=mutated(change);
 try{
  const result=run(fixture.file,args);
  assert.equal(result.status,2,'expected structural rejection, got exit '+result.status+': '+result.stdout);
  assert.match(result.stderr,pattern);
 }finally{fixture.cleanup();}
}
test('non-ISO or impossible dates are rejected in assessment and evidence',()=>{
 for(const bad of ['1','May 1','2026-13-01','2026-02-31','2026-11-18T25:00:00Z','yesterday'])expectInvalid(r=>{r.project.assessed_at=bad;},/assessed_at/);
 expectInvalid(r=>{r.controls[0].evidence[0].observed_at='May 1';},/observed_at/);
});
test('a VERIFIED finding cannot rest on free-text verification evidence',()=>{
 expectInvalid(r=>{r.findings=[{id:'F-010',severity:'P1',status:'VERIFIED',title:'x',severity_rationale:'r',control_ids:[r.controls[0].control_id],verification_evidence:['trust me']}];},/non-object evidence item/);
 expectInvalid(r=>{r.findings=[{id:'F-011',severity:'P2',status:'VERIFIED',title:'x',severity_rationale:'r',control_ids:[r.controls[0].control_id],verification_evidence:[{kind:'hearsay',reference:'x',observed_at:'2026-11-18',result:'ok'}]}];},/invalid evidence kind/);
 expectInvalid(r=>{r.findings=[{id:'F-012',severity:'P2',status:'VERIFIED',title:'x',severity_rationale:'r',control_ids:[r.controls[0].control_id]}];},/requires verification_evidence/);
});
test('every finding must record a severity rationale',()=>{
 expectInvalid(r=>{r.findings=[{id:'F-013',severity:'P3',status:'OPEN',title:'x',control_ids:[r.controls[0].control_id]}];},/severity_rationale/);
});
test('a finding references only controls that are in scope, and finding IDs must exist',()=>{
 expectInvalid(r=>{r.findings=[{id:'F-014',severity:'P3',status:'OPEN',title:'x',severity_rationale:'r',control_ids:['USS-DOES-NOT-EXIST']}];},/out-of-scope control/);
 expectInvalid(r=>{r.controls[0].status='FAIL';r.controls[0].finding_ids=['F-MISSING'];},/missing finding/);
});
test('P0 and P1 can never be risk-accepted, whatever the dates',()=>{
 for(const severity of ['P0','P1'])expectInvalid(r=>{r.findings=[{id:'F-015',severity,status:'ACCEPTED',title:'x',severity_rationale:'r',control_ids:[r.controls[0].control_id],risk_acceptance:{approved_by:'Owner',rationale:'r',approved_at:'2026-11-18T00:00:00Z',expires_at:'2099-01-01T00:00:00Z'}}];},/cannot be risk-accepted/);
});
test('P2/P3 acceptance must be time-bounded and cannot be expired in a release assessment',()=>{
 const acceptance=(approved,expires)=>({approved_by:'Owner',rationale:'r',approved_at:approved,expires_at:expires});
 expectInvalid(r=>{r.findings=[{id:'F-016',severity:'P3',status:'ACCEPTED',title:'x',severity_rationale:'r',control_ids:[r.controls[0].control_id],risk_acceptance:acceptance('2026-11-18T00:00:00Z','2026-11-01T00:00:00Z')}];},/must expire after/);
 expectInvalid(r=>{r.project.assessed_at='2020-02-01T00:00:00Z';r.findings=[{id:'F-017',severity:'P3',status:'ACCEPTED',title:'x',severity_rationale:'r',control_ids:[r.controls[0].control_id],risk_acceptance:acceptance('2020-01-01T00:00:00Z','2020-06-01T00:00:00Z')}];},/has expired/,['--release']);
});
test('a FAIL control whose linked findings are all VERIFIED is inconsistent',()=>{
 expectInvalid(r=>{const id=r.controls[0].control_id;r.controls[0].status='FAIL';r.controls[0].evidence=[];r.controls[0].finding_ids=['F-018'];r.findings=[{id:'F-018',severity:'P2',status:'VERIFIED',title:'x',severity_rationale:'r',control_ids:[id],verification_evidence:[{kind:'test',reference:'t',observed_at:'2026-11-18',result:'ok'}]}];},/FAIL but every linked finding is VERIFIED/);
});
test('release assessments reject template placeholder metadata and routine type',()=>{
 const base={};
 expectInvalid(r=>{r.project.commit='0'.repeat(40);},/placeholder \(all zeros\)/,['--release']);
 expectInvalid(r=>{r.project.repository='example/consumer-application';},/template placeholder/,['--release']);
 expectInvalid(r=>{r.project.reviewer='UNASSIGNED';},/UNASSIGNED/,['--release']);
 expectInvalid(r=>{r.assessment_type='routine';},/not routine/,['--release']);
});
test('NOT_APPLICABLE requires rationale, approver and approval date',()=>{
 expectInvalid(r=>{r.controls[0].status='NOT_APPLICABLE';r.controls[0].evidence=[];},/NOT_APPLICABLE control/);
});
test('evidence validator rejects malformed top-level input safely',()=>{
 for(const content of ['[]','null','"x"','{}','{"schema_version":"1.0.0"']){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-evidence-bad-'));
  const file=path.join(dir,'a.json');fs.writeFileSync(file,content);
  try{const result=run(file);assert.notEqual(result.status,0,content);assert.doesNotMatch(result.stderr,/TypeError|at .*\.mjs/,'unhandled exception for '+content)}finally{fs.rmSync(dir,{recursive:true,force:true})}
 }
});
