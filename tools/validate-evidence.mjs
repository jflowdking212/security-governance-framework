import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const usage='Usage: node tools/validate-evidence.mjs --file <assessment.json> [--expected-commit <40-char-sha>] [--release] [--require-full-audit]';
const errors=[];
function failUsage(message){
 console.error(message+'\n'+usage);
 process.exit(2);
}
function isObject(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function nonEmpty(value){
 return typeof value==='string'&&value.trim().length>0;
}
// Strict ISO 8601 (date or date-time with explicit zone). Date.parse alone accepts values such as "1" or "May 1".
const ISO_DATE=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
function validDate(value){
 if(!nonEmpty(value))return false;
 const match=ISO_DATE.exec(value);
 if(!match||Number.isNaN(Date.parse(value)))return false;
 const [year,month,day]=[Number(match[1]),Number(match[2]),Number(match[3])];
 const calendar=new Date(Date.UTC(year,month-1,day));
 return calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day&&(match[4]===undefined||Number(match[4])<24)&&(match[5]===undefined||Number(match[5])<60);
}
function stableIdentityKey(value){
 if(!nonEmpty(value))return null;
 const identity=value.trim();
 const separator=identity.indexOf(':');
 if(separator<=0||separator===identity.length-1)return null;
 const provider=identity.slice(0,separator);
 const subject=identity.slice(separator+1);
 if(!/^[a-z][a-z0-9+.-]*$/i.test(provider)||!subject.trim())return null;
 if(provider.toLowerCase()==='github'&&!/^\d+$/.test(subject))return null;
 // Provider names are case-insensitive; the issuer-scoped subject is preserved exactly.
 return provider.toLowerCase()+':'+subject;
}

const EVIDENCE_KINDS=['test','code-review','configuration','infrastructure','log','external-attestation','build-artifact'];
const SUCCESS_RESULTS=['passed','verified','compliant','ok','success'];
const FAILURE_RESULTS=['failed','non-compliant','violation','fail','failure'];
const EVIDENCE_RESULTS=[...SUCCESS_RESULTS,...FAILURE_RESULTS];

function isPlaceholderReference(value){
 if(!nonEmpty(value))return true;
 const norm=value.trim().toLowerCase().replace(/\s+/g,' ');
 if(norm.startsWith('https://')){
  try{
   const host=new URL(norm).hostname;
   if(host==='localhost'||host==='example.com'||host.endsWith('.example.com')||host==='example.org'||host.endsWith('.example.org')||host==='example.net'||host.endsWith('.example.net')||host.endsWith('.invalid')||host.endsWith('.test'))return true;
  }catch{return true;}
 }
 return ['n/a','n / a','na','none','unknown','tbd','todo','pending','x','.','see above','http://','https://','-','--','null','undefined','?'].includes(norm)||/^-+$/.test(norm);
}

const MAX_UNSIGNED_64 = 18446744073709551615n;
function isRunReference(reference){
 const match=/^run:([1-9]\d{0,19})$/i.exec(reference);
 if(!match)return false;
 return BigInt(match[1])<=MAX_UNSIGNED_64;
}

function isPlaceholderToken(value){
 let decoded;
 try{decoded=decodeURIComponent(value);}catch{return true;}
 const norm=decoded.trim().toLowerCase().replace(/\s+/g,' ');
 const stem=norm.split('.')[0];
 const placeholders=['n/a','na','none','unknown','tbd','todo','pending','placeholder','example','sample','null','undefined','x','-','--'];
 return placeholders.includes(norm)||placeholders.includes(stem)||/^-+$/.test(norm);
}

function validEvidenceReference(value){
 if(!nonEmpty(value)||isPlaceholderReference(value))return false;
 // URL parsing silently normalizes some whitespace/control characters. Reject
 // them before parsing so the submitted evidence string is unambiguous.
 if(/[\s\u0000-\u001f\u007f]/u.test(value))return false;
 const reference=value.trim();
 if(isRunReference(reference))return true;
 if(/^https:\/\//i.test(reference)){
  try{
   const url=new URL(reference);
   if(url.protocol!=='https:'||!url.hostname||url.username||url.password)return false;
   const hostname=url.hostname.toLowerCase();
   const ipHost=hostname.replace(/^\[|\]$/g,'');
   if(isIP(ipHost)!==0)return false;
   if(!hostname.includes('.')||hostname.endsWith('.'))return false;
   if(/\.(?:localhost|local|internal|lan|home|test|invalid|example)$/i.test(hostname))return false;
   const segments=url.pathname.split('/').filter(Boolean);
   if(!segments.length||segments.some(isPlaceholderToken))return false;
   if(url.hash&&isPlaceholderToken(url.hash.slice(1)))return false;
   return true;
  }catch{return false;}
 }
 const separator=reference.indexOf('#');
 if(separator<=0||separator===reference.length-1)return false;
 const relativePath=reference.slice(0,separator);
 const anchor=reference.slice(separator+1);
 if(relativePath.startsWith('/')||relativePath.includes('\\')||relativePath.split('/').some(part=>!part||part==='.'||part==='..'||isPlaceholderToken(part)))return false;
 if(isPlaceholderToken(anchor))return false;
 return /^[A-Za-z0-9._/-]+$/.test(relativePath)&&/^[A-Za-z0-9._:-]+$/.test(anchor);
}

function checkApproval(label,approval,project,assessedAt){
 if(!isObject(approval)){addError(label+' requires an approval object.');return;}
 if(!nonEmpty(approval.approved_by))addError(label+' requires approved_by.');
 if(!nonEmpty(approval.rationale))addError(label+' requires rationale.');
 const reviewerIdentity=stableIdentityKey(project?.reviewer_identity);
 const approverIdentity=stableIdentityKey(approval.approved_by_identity);
 if(!reviewerIdentity)addError(label+' requires project.reviewer_identity as a stable issuer-scoped identity.');
 if(!approverIdentity)addError(label+' requires approved_by_identity as a stable issuer-scoped identity.');
 else if(reviewerIdentity&&approverIdentity===reviewerIdentity)addError(label+' cannot be approved by the same identity that performed the assessment (self-approval).');
 if(!validDate(approval.approved_at))addError(label+' requires a valid ISO 8601 approved_at date/time.');
 else{
  const approvedAt=Date.parse(approval.approved_at);
  if(approvedAt>Date.now())addError(label+' approved_at cannot be in the future.');
  if(assessedAt&&validDate(assessedAt)&&approvedAt>Date.parse(assessedAt))addError(label+' approved_at cannot be later than the assessment date.');
 }
}

// Shared by control evidence and finding verification_evidence so a VERIFIED finding cannot rest on free text.
function checkEvidenceItem(label,evidence,parentStatus=null,assessedAt=null){
 if(!isObject(evidence)){addError(label+' contains a non-object evidence item.');return;}
 if(!EVIDENCE_KINDS.includes(evidence.kind))addError(label+' has invalid evidence kind '+String(evidence.kind));
 if(!nonEmpty(evidence.reference))addError(label+' evidence reference must be non-empty.');
 else if(isPlaceholderReference(evidence.reference))addError(label+' evidence reference cannot be a placeholder ('+String(evidence.reference)+').');
 else if(!validEvidenceReference(evidence.reference))addError(label+' evidence reference must be an immutable HTTPS URL, repository-relative path#anchor, or run:<id> reference.');
 if(!validDate(evidence.observed_at))addError(label+' evidence observed_at must be a valid ISO 8601 date/time.');
 else{
  const obsTime=Date.parse(evidence.observed_at);
  if(obsTime>Date.now())addError(label+' evidence observed_at cannot be in the future: '+String(evidence.observed_at));
  if(assessedAt&&validDate(assessedAt)&&obsTime>Date.parse(assessedAt)){
   addError(label+' evidence observed_at ('+String(evidence.observed_at)+') cannot be later than the assessment date ('+String(assessedAt)+').');
  }
 }
 if(!nonEmpty(evidence.result))addError(label+' evidence result must be non-empty.');
 else{
  const res=String(evidence.result).trim().toLowerCase();
  if(!EVIDENCE_RESULTS.includes(res)){
   addError(label+' has invalid evidence result: '+String(evidence.result)+' (must be one of: '+EVIDENCE_RESULTS.join(', ')+').');
  }else{
   if(parentStatus==='PASS'&&!SUCCESS_RESULTS.includes(res)){
    addError(label+' marked PASS cannot be supported by non-passing or failed evidence result: '+String(evidence.result));
   }
   if(parentStatus==='VERIFIED'&&!SUCCESS_RESULTS.includes(res)){
    addError(label+' marked VERIFIED cannot be supported by non-passing or failed verification evidence result: '+String(evidence.result));
   }
  }
 }
}
function addError(message){
 errors.push(message);
}
const options=new Set();
let file=null,release=false,requireFullAudit=false,expectedCommit=null;
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(flag==='--expected-commit'){
  if(expectedCommit!==null)failUsage('Duplicate option: --expected-commit');
  const value=args[i+1];
  if(value===undefined||value.startsWith('--')||!value.trim())failUsage('Missing value for --expected-commit');
  expectedCommit=value.trim();
  i++;
  continue;
 }
 if(flag==='--release'){
  if(release)failUsage('Duplicate option: --release');
  release=true;
  continue;
 }
 if(flag==='--require-full-audit'){
  if(requireFullAudit)failUsage('Duplicate option: --require-full-audit');
  requireFullAudit=true;
  continue;
 }
 if(flag==='--help'){
  console.log(usage);
  process.exit(0);
 }
 if(flag!=='--file')failUsage('Unknown option: '+flag);
 if(options.has(flag))failUsage('Duplicate option: '+flag);
 const value=args[i+1];
 if(value===undefined||value.startsWith('--')||!value.trim())failUsage('Missing value for --file');
 options.add(flag);
 file=value;
 i++;
}
if(!file)failUsage('Missing required --file');
if(expectedCommit!==null&&!/^[a-f0-9]{40}$/.test(expectedCommit))addError('--expected-commit must be a full 40-character lowercase hexadecimal Git commit SHA.');
if(release&&!expectedCommit)addError('--release requires --expected-commit <40-character audited commit SHA>.');

let manifest,catalog,assessment;
try{
 manifest=JSON.parse(await fs.readFile(path.join(ROOT,'manifest.json'),'utf8'));
 catalog=JSON.parse(await fs.readFile(path.join(ROOT,'assurance/control-catalog.json'),'utf8'));
}catch(error){
 console.error('Unable to load USS manifest/control catalog: '+error.message);
 process.exit(2);
}
const moduleMap=new Map(manifest.modules.map(module=>[module.id,module]));
const catalogIds=new Set(),catalogModules=new Set();
if(!Array.isArray(catalog.controls))addError('Control catalog must contain a controls array.');
else{
 if(catalog.controls.length!==manifest.modules.length)addError('Control catalog must define exactly one family for every manifest module.');
 for(const control of catalog.controls){
  if(!isObject(control)){addError('Control catalog contains a non-object entry.');continue;}
  if(!/^USS-[A-Z0-9-]+$/.test(control.id??''))addError('Invalid control family ID: '+String(control.id));
  if(catalogIds.has(control.id))addError('Duplicate control family ID: '+control.id);
  catalogIds.add(control.id);
  if(!moduleMap.has(control.module_id))addError('Control '+control.id+' references unknown module '+control.module_id);
  if(catalogModules.has(control.module_id))addError('More than one control family maps to '+control.module_id);
  catalogModules.add(control.module_id);
  const module=moduleMap.get(control.module_id);
  if(module&&control.module_path!==module.path)addError('Control '+control.id+' module_path does not match manifest module '+control.module_id);
  if(!nonEmpty(control.title)||!nonEmpty(control.verification_guidance))addError('Control '+control.id+' is missing title or verification guidance.');
 }
 for(const module of manifest.modules)if(!catalogModules.has(module.id))addError('Control catalog has no family for '+module.id);
}
try{
 const resolved=path.resolve(process.cwd(),file);
 assessment=JSON.parse(await fs.readFile(resolved,'utf8'));
}catch(error){
 console.error('Unable to read assessment JSON: '+error.message);
 process.exit(2);
}
if(!isObject(assessment))addError('Assessment root must be a JSON object.');
if(assessment?.schema_version!=='1.0.0')addError('schema_version must be 1.0.0.');
if(assessment?.standard_version!==manifest.version)addError('standard_version must match the USS manifest version '+manifest.version+'.');

const project=assessment?.project;
if(!isObject(project))addError('project must be an object.');
else{
 for(const field of ['repository','scope','reviewer'])if(!nonEmpty(project[field]))addError('project.'+field+' must be a non-empty string.');
 if(!/^[a-f0-9]{40}$/.test(project.commit??''))addError('project.commit must be a full 40-character lowercase hexadecimal Git commit SHA.');
 if(expectedCommit&&project.commit!==expectedCommit)addError('project.commit must exactly match the audited commit supplied with --expected-commit.');
 if(!validDate(project.assessed_at))addError('project.assessed_at must be a valid ISO date/time.');
 else if(Date.parse(project.assessed_at)>Date.now())addError('Assessment date project.assessed_at cannot be in the future: '+project.assessed_at);
}
const assessmentType=assessment?.assessment_type;
if(!['routine','full-audit','production-release'].includes(assessmentType))addError('assessment_type must be routine, full-audit or production-release.');

const scope=assessment?.scope;
const scopeIds=Array.isArray(scope?.control_ids)?scope.control_ids:[];
if(!scopeIds.length)addError('scope.control_ids must list at least one control family.');
if(new Set(scopeIds).size!==scopeIds.length)addError('scope.control_ids contains duplicate control IDs.');
for(const id of scopeIds)if(!catalogIds.has(id))addError('Scope references unknown control ID '+id);
const requiresFull=requireFullAudit||release||assessmentType==='full-audit'||assessmentType==='production-release';
if(requiresFull){
 if(scopeIds.length!==catalogIds.size||[...catalogIds].some(id=>!scopeIds.includes(id)))addError('Full audit/production-release assessments must include every control family in the catalog.');
}

const controlEntries=Array.isArray(assessment?.controls)?assessment.controls:[];
if(!Array.isArray(assessment?.controls))addError('controls must be an array.');
const controlMap=new Map();
for(const control of controlEntries){
 if(!isObject(control)){addError('Assessment contains a non-object control entry.');continue;}
 const id=control.control_id;
 if(!catalogIds.has(id))addError('Assessment references unknown control ID '+String(id));
 if(controlMap.has(id))addError('Duplicate assessment control '+id);
 controlMap.set(id,control);
 if(!scopeIds.includes(id))addError('Control '+id+' is not listed in scope.control_ids.');
 if(!['PASS','FAIL','UNKNOWN','NOT_APPLICABLE'].includes(control.status))addError('Control '+id+' has invalid status '+String(control.status));
 if(!Array.isArray(control.evidence))addError('Control '+id+' evidence must be an array.');
 else{
  for(const evidence of control.evidence)checkEvidenceItem('Control '+id,evidence,control.status,project?.assessed_at);
 }
 if(control.status==='PASS'){
  if(!Array.isArray(control.evidence)||control.evidence.length===0)addError('PASS control '+id+' requires at least one evidence item.');
  else if(control.evidence.some(e=>!SUCCESS_RESULTS.includes(String(e?.result).trim().toLowerCase()))){
   addError('PASS control '+id+' must be supported by successful evidence results only.');
  }
 }
 if(control.status==='NOT_APPLICABLE'){
  checkApproval('NOT_APPLICABLE control '+id,{
   approved_by:control.approved_by,
   approved_by_identity:control.approved_by_identity,
   rationale:control.rationale,
   approved_at:control.approved_at
  },project,project?.assessed_at);
 }
 if(control.status==='FAIL'&&(!Array.isArray(control.finding_ids)||control.finding_ids.length===0))addError('FAIL control '+id+' must reference at least one finding_id.');
}
for(const id of scopeIds)if(!controlMap.has(id))addError('Scoped control '+id+' has no assessment entry.');

const findingEntries=Array.isArray(assessment?.findings)?assessment.findings:[];
if(!Array.isArray(assessment?.findings))addError('findings must be an array.');
const findingMap=new Map();
for(const finding of findingEntries){
 if(!isObject(finding)){addError('Assessment contains a non-object finding.');continue;}
 if(!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(finding.id??''))addError('Finding has invalid id '+String(finding.id));
 if(findingMap.has(finding.id))addError('Duplicate finding ID '+finding.id);
 findingMap.set(finding.id,finding);
 if(!['P0','P1','P2','P3'].includes(finding.severity))addError('Finding '+finding.id+' has invalid severity.');
 if(!['OPEN','REMEDIATED','VERIFIED','ACCEPTED'].includes(finding.status))addError('Finding '+finding.id+' has invalid status.');
 if(!nonEmpty(finding.title))addError('Finding '+finding.id+' requires a title.');
 if(!Array.isArray(finding.control_ids)||finding.control_ids.length===0)addError('Finding '+finding.id+' must reference control_ids.');
 else for(const id of finding.control_ids)if(!scopeIds.includes(id))addError('Finding '+finding.id+' references out-of-scope control '+id);
 if(!nonEmpty(finding.severity_rationale))addError('Finding '+finding.id+' requires a severity_rationale (impact, reachability, blast radius and confidence; see assurance/severity-classification.md).');
 if(finding.status==='VERIFIED'){
  if(!Array.isArray(finding.verification_evidence)||finding.verification_evidence.length===0)addError('VERIFIED finding '+finding.id+' requires verification_evidence.');
  else for(const evidence of finding.verification_evidence)checkEvidenceItem('Finding '+finding.id+' verification',evidence,'VERIFIED',project?.assessed_at);
 }
 if(finding.status==='ACCEPTED'){
  if(['P0','P1'].includes(finding.severity))addError('P0/P1 finding '+finding.id+' cannot be risk-accepted.');
  const approval=finding.risk_acceptance;
  checkApproval('Risk acceptance for '+finding.id,approval,project,project?.assessed_at);
  if(!isObject(approval)||!validDate(approval.expires_at))addError('Accepted finding '+finding.id+' requires a valid ISO 8601 expires_at date/time.');
  else if(validDate(project?.assessed_at)&&Date.parse(approval.expires_at)<=Date.parse(project.assessed_at))addError('Risk acceptance for '+finding.id+' must expire after the assessment date.');
  else if(validDate(approval.approved_at)&&Date.parse(approval.expires_at)<=Date.parse(approval.approved_at))addError('Risk acceptance for '+finding.id+' must expire after it was approved.');
  else if(release&&Date.parse(approval.expires_at)<=Date.now())addError('Risk acceptance for '+finding.id+' has expired; a release assessment cannot rely on an expired acceptance.');
 }
}
for(const control of controlEntries){
 for(const findingId of control.finding_ids??[])if(!findingMap.has(findingId))addError('Control '+control.control_id+' references missing finding '+findingId);
 const linkedFindings=(control.finding_ids??[]).map(id=>findingMap.get(id)).filter(Boolean);
 if(control.status==='FAIL'&&linkedFindings.length&&linkedFindings.every(f=>f.status==='VERIFIED'))addError('Control '+control.control_id+' is FAIL but every linked finding is VERIFIED; re-assess the control and record evidence for its new status.');
}
if(release){
 if(/^0+$/.test(project?.commit??''))addError('Release assessment project.commit is a placeholder (all zeros).');
 if(/^example\//i.test(project?.repository??''))addError('Release assessment project.repository is still the template placeholder.');
 if(/^unassigned$/i.test(String(project?.reviewer??'').trim()))addError('Release assessment project.reviewer is UNASSIGNED.');
 if(!stableIdentityKey(project?.reviewer_identity))addError('Release assessment project.reviewer_identity must be a stable issuer-scoped identity.');
 if(assessmentType==='routine')addError('A release assessment must be full-audit or production-release, not routine.');
}
const p0p1Open=[...findingMap.values()].filter(f=>['P0','P1'].includes(f.severity)&&f.status!=='VERIFIED');
const unresolvedFindings=[...findingMap.values()].filter(f=>['OPEN','REMEDIATED'].includes(f.status));
const nonPassingControls=controlEntries.filter(control=>{
 if(control.status==='UNKNOWN')return true;
 if(control.status!=='FAIL')return false;
 const linked=(control.finding_ids??[]).map(id=>findingMap.get(id));
 return !linked.length||linked.some(f=>!f||['OPEN','REMEDIATED'].includes(f.status));
});
const passCount=controlEntries.filter(c=>c.status==='PASS').length;
const naCount=controlEntries.filter(c=>c.status==='NOT_APPLICABLE').length;
const unknownCount=controlEntries.filter(c=>c.status==='UNKNOWN').length;
const failCount=controlEntries.filter(c=>c.status==='FAIL').length;
const decision=p0p1Open.length?'BLOCKED_P0_P1':(nonPassingControls.length||unresolvedFindings.length?'NOT_READY':'READY_FOR_OWNER_REVIEW');

if(errors.length){
 console.error('Evidence validation failed:');
 for(const error of errors)console.error('- '+error);
 process.exit(2);
}
console.log('USS evidence structure valid.');
console.log('Controls: '+controlEntries.length+' | PASS '+passCount+' | NOT_APPLICABLE '+naCount+' | UNKNOWN '+unknownCount+' | FAIL '+failCount);
console.log('Findings: '+findingEntries.length+' | unresolved P0/P1 '+p0p1Open.length+' | open/remediated '+unresolvedFindings.length);
console.log('Computed assessment state: '+decision+'. This is not an owner release approval.');
if(release&&decision!=='READY_FOR_OWNER_REVIEW'){
 console.error('--release requested but the evidence does not support release review.');
 process.exit(1);
}
