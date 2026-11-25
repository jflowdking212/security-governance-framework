#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CATALOG=JSON.parse(fs.readFileSync(path.join(ROOT,'assurance/control-catalog.json'),'utf8'));
const TITLES=new Map(CATALOG.controls.map(c=>[c.id,c.title]));
const VALID_STATUS=new Set(['PASS','FAIL','UNKNOWN','NOT_APPLICABLE']);
const CLOSED_FINDING=new Set(['VERIFIED','CLOSED','RESOLVED']);
const SUCCESS_RESULT=new Set(['passed','verified','compliant','ok','success']);

function parseArgs(argv){
 const files=[];let out=null,staleDays=90;
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--file'){if(!argv[i+1])throw new Error('--file requires a path');files.push(path.resolve(argv[++i]));}
  else if(a==='--out'){if(!argv[i+1])throw new Error('--out requires a path');out=path.resolve(argv[++i]);}
  else if(a==='--stale-days'){const n=Number(argv[++i]);if(!Number.isInteger(n)||n<1||n>3650)throw new Error('--stale-days must be an integer from 1 to 3650');staleDays=n;}
  else if(a==='--help'){console.log('Usage: node tools/assurance-pulse.mjs --file <assessment.json> [--file <assessment.json> ...] [--out <report.md>] [--stale-days 90]');process.exit(0);}
  else throw new Error('Unknown argument: '+a);
 }
 if(!files.length)throw new Error('At least one --file is required');
 return {files,out,staleDays};
}
function evidenceFreshness(control,cutoff){
 const evidence=Array.isArray(control.evidence)?control.evidence:[];
 if(!evidence.length)return {count:0,stale:0,missingDate:0};
 let stale=0,missingDate=0;
 for(const item of evidence){
  const d=Date.parse(item?.observed_at||'');
  if(!Number.isFinite(d)){missingDate++;continue;}
  if(d<cutoff)stale++;
 }
 return {count:evidence.length,stale,missingDate};
}
function summarise(file,staleDays){
 let report;
 try{report=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){throw new Error(file+': cannot read valid JSON: '+e.message);}
 if(!report||typeof report!=='object'||!report.project||typeof report.project.repository!=='string'||!Array.isArray(report.controls)||!Array.isArray(report.findings))throw new Error(file+': expected project.repository, controls[] and findings[]');
 if(!/^[a-f0-9]{40}$/.test(report.project.commit||''))throw new Error(file+': project.commit must be a full 40-character lowercase commit SHA');
 const seen=new Set(),counts={PASS:0,FAIL:0,UNKNOWN:0,NOT_APPLICABLE:0},unverifiedPass=[],staleControls=[],missingDateControls=[];
 const cutoff=Date.now()-staleDays*86400000;
 for(const c of report.controls){
  if(!c||typeof c.control_id!=='string'||!TITLES.has(c.control_id))throw new Error(file+': unknown or invalid control_id '+String(c?.control_id));
  if(seen.has(c.control_id))throw new Error(file+': duplicate control_id '+c.control_id);
  seen.add(c.control_id);
  if(!VALID_STATUS.has(c.status))throw new Error(file+': invalid status for '+c.control_id);
  counts[c.status]++;
  const fresh=evidenceFreshness(c,cutoff);
  if(c.status==='PASS'&&(!fresh.count||!Array.isArray(c.evidence)||c.evidence.some(e=>!SUCCESS_RESULT.has(String(e?.result||'').toLowerCase()))))unverifiedPass.push(c.control_id);
  if(fresh.stale)staleControls.push({id:c.control_id,count:fresh.stale});
  if(fresh.missingDate)missingDateControls.push({id:c.control_id,count:fresh.missingDate});
 }
 const findings=report.findings.map(f=>{
  if(!f||typeof f.id!=='string'||!/^P[0-3]$/.test(f.severity||''))throw new Error(file+': finding must have an id and severity P0-P3');
  return {id:f.id,severity:f.severity,status:String(f.status||'OPEN').toUpperCase(),title:String(f.title||'Untitled finding')};
 });
 const open=findings.filter(f=>!CLOSED_FINDING.has(f.status));
 const critical=open.filter(f=>f.severity==='P0'||f.severity==='P1');
 const accepted=open.filter(f=>f.status==='ACCEPTED');
 const assessed=counts.PASS+counts.FAIL+counts.NOT_APPLICABLE;
 let state='HEALTHY_REVIEW';
 if(critical.length)state='BLOCKED_P0_P1';
 else if(counts.FAIL||counts.UNKNOWN||unverifiedPass.length||staleControls.length||missingDateControls.length)state='ATTENTION_REQUIRED';
 return {repository:report.project.repository,commit:report.project.commit,assessedAt:report.project.assessed_at||'NOT RECORDED',state,counts,assessed,total:report.controls.length,unverifiedPass,staleControls,missingDateControls,findings,open,critical,accepted};
}
function render(rows,staleDays){
 const totals={PASS:0,FAIL:0,UNKNOWN:0,NOT_APPLICABLE:0,openFindings:0,p0p1:0,unverifiedPass:0,staleEvidence:0};
 for(const r of rows){for(const k of Object.keys(r.counts))totals[k]+=r.counts[k];totals.openFindings+=r.open.length;totals.p0p1+=r.critical.length;totals.unverifiedPass+=r.unverifiedPass.length;totals.staleEvidence+=r.staleControls.reduce((n,x)=>n+x.count,0);}
 const lines=['# USS Assurance Pulse','', '**Purpose:** operational visibility into evidenced strengths, defects, unknowns and remediation. This report is not a certification or release approval.','',`Evidence freshness threshold: ${staleDays} days.`,'','## Portfolio summary','','| Project | Assessed commit | State | PASS | FAIL | UNKNOWN | N/A | Open findings | P0/P1 |','|---|---|---|---:|---:|---:|---:|---:|---:|'];
 for(const r of rows)lines.push(`| ${r.repository} | \`${r.commit.slice(0,12)}\` | **${r.state}** | ${r.counts.PASS} | ${r.counts.FAIL} | ${r.counts.UNKNOWN} | ${r.counts.NOT_APPLICABLE} | ${r.open.length} | ${r.critical.length} |`);
 lines.push('', '## Portfolio totals','','| Measure | Count |','|---|---:|',`| PASS controls | ${totals.PASS} |`,`| FAIL controls | ${totals.FAIL} |`,`| UNKNOWN controls | ${totals.UNKNOWN} |`,`| Not applicable | ${totals.NOT_APPLICABLE} |`,`| Open findings | ${totals.openFindings} |`,`| Open P0/P1 findings | ${totals.p0p1} |`,`| PASS without sufficient success evidence | ${totals.unverifiedPass} |`,`| Stale evidence items | ${totals.staleEvidence} |`,'','## Project details','');
 for(const r of rows){
  lines.push(`### ${r.repository}`,'',`- Application commit: \`${r.commit}\``,`- Assessment date: ${r.assessedAt}`,`- State: **${r.state}**`,`- Controls assessed: ${r.assessed}/${r.total}`,`- PASS without sufficient evidence: ${r.unverifiedPass.length? r.unverifiedPass.join(', '):'None'}`,`- Stale evidence: ${r.staleControls.length?r.staleControls.map(x=>x.id+' ('+x.count+')').join(', '):'None detected'}`,`- Evidence missing observation date: ${r.missingDateControls.length?r.missingDateControls.map(x=>x.id+' ('+x.count+')').join(', '):'None detected'}`,'');
  if(r.findings.length){lines.push('| Finding | Severity | Status | Title |','|---|---|---|---|');for(const f of r.findings)lines.push(`| ${f.id} | ${f.severity} | ${f.status} | ${f.title.replaceAll('|','\\|')} |`);lines.push('');}
  else lines.push('No findings recorded. This does not mean the application has no defects; confirm assessment scope and evidence.','');
 }
 lines.push('## Interpretation','','- UNKNOWN is not PASS. Unassessed controls remain visible.','- PASS without sufficient successful evidence is highlighted separately.','- P0/P1 findings block the affected production release or change.','- A high PASS count never offsets critical findings.','- Re-run the evidence validator before relying on a report: node tools/validate-evidence.mjs --file <assessment.json>.','- This pulse summarises submitted evidence. It does not discover vulnerabilities by itself.');
 return lines.join('\n')+'\n';
}
try{
 const args=parseArgs(process.argv.slice(2));
 const rows=args.files.map(f=>summarise(f,args.staleDays));
 if(new Set(rows.map(r=>r.repository)).size!==rows.length)throw new Error('Duplicate repository supplied; provide one current assessment per project');
 const markdown=render(rows,args.staleDays);
 if(args.out){fs.mkdirSync(path.dirname(args.out),{recursive:true});fs.writeFileSync(args.out,markdown);console.log('USS Assurance Pulse written: '+args.out);}
 else process.stdout.write(markdown);
}catch(e){console.error('USS Assurance Pulse failed: '+e.message);process.exit(2);}
