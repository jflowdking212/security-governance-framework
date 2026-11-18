import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(ROOT);
const source={
 global:'source/original-directives/GLOBAL_DIRECTIVE_APPLICATION_SECURITY_UPDATED_2026-10-02_v4.md',
 payment:'source/original-directives/global_payment_webhook_tax_security_directive.md',
 antigravity:'source/original-directives/ANTIGRAVITY_IDE_GLOBAL_SECURITY_DIRECTIVE_v4.md'
};
const [gText,pText,aText]=await Promise.all(Object.values(source).map(p=>fs.readFile(p,'utf8')));
const g=gText.split(/\r?\n/),p=pText.split(/\r?\n/),a=aText.split(/\r?\n/);
function between(lines,start,end){
 const i=lines.findIndex(x=>x.includes(start));
 if(i<0)throw new Error('Missing source heading: '+start);
 const j=end==='$END'?lines.length:lines.findIndex((x,n)=>n>i&&x.includes(end));
 if(j<0)throw new Error('Missing end heading: '+end);
 return lines.slice(i,j).join('\n').trim();
}
const b=between(g,'B. Authentication, Authorization & Session Management','C. Input Validation');
const bLines=b.split('\n'),blocks=[];let current=[];
for(const line of bLines){
 if(/^\\-\s+\*\*/.test(line.trimStart())){if(current.length)blocks.push(current.join('\n'));current=[line]}
 else if(current.length)current.push(line);
}
if(current.length)blocks.push(current.join('\n'));
const auth=blocks.filter(x=>/Cryptographic Storage|Session Tokens & Cookies|Authentication Abuse Controls/.test(x));
const authz=blocks.filter(x=>/Broken Object Level Authorization|Role-Based Access Control|Tenant Isolation/.test(x));
if(blocks.length!==6||auth.length!==3||authz.length!==3)throw new Error('Unable to split source section 1.B without loss');
const bHeading=bLines.slice(0,bLines.findIndex(x=>/^\\-\s+\*\*/.test(x.trimStart()))).join('\n').trim();
const layer13=between(g,'Layer 13 — AI/LLM Security & Governance','4. Production-Readiness Evidence Rule');
// Domain modules carry their verbatim assurance checks so routine tasks do not need audit-only M14.
const layer=n=>n===13?layer13:between(g,'### Layer '+n+' —','### Layer '+(n+1)+' —');
const paymentPreamble=between(p,'**Scope:**','---');
const ra190='never use risk acceptance to bypass a P0/P1 release block unless the directive explicitly allows that category of human risk acceptance and the accountable owner explicitly accepts it.';
function annotateRiskAcceptance(text){
 const lines=text.split('\n'),i=lines.findIndex(x=>x.includes(ra190));
 if(i<0)throw new Error('Source 19.8 risk-acceptance bullet not found');
 lines.splice(i+1,0,'','> **OWNER POLICY OVERRIDE (OWNER:RELEASE-POLICY):** The exception clause in the bullet above is SUPERSEDED. No category of human risk acceptance exists that permits releasing with an open P0/P1 finding. Read the bullet as: "never use risk acceptance to bypass a P0/P1 release block."');
 return lines.join('\n');
}

const p0p1RiskAcceptanceOverride='> **OWNER POLICY OVERRIDE (OWNER:RELEASE-POLICY):** This risk-acceptance pathway applies only to P2/P3 findings. It must never be used to approve, waive, downgrade, relabel, or release with an open P0/P1 finding. Any P0/P1 finding remains a hard production-release blocker until remediated and verified.';
function annotateRiskAcceptanceClause(text,anchor){
 const lines=text.split('\n'),i=lines.findIndex(x=>x.includes(anchor));
 if(i<0)throw new Error('Missing risk-acceptance clause for owner-policy override: '+anchor);
 lines.splice(i+1,0,'',p0p1RiskAcceptanceOverride);
 return lines.join('\n');
}

function moduleText(id,title,refs,body){
 return '# '+id+' '+title+'\n\n**Source sections:** '+refs.join(', ')+'  \n**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.\n\n---\n\n'+body+'\n';
}
const specs=[
['m01-engineering-workflow.md','M01','Core operating policy and secure engineering',['GLOBAL:Core','GLOBAL:13','GLOBAL:14'],between(g,'Core Persona & Operating Constraints','1. Defensive Architecture & Hardening Standards')+'\n\n'+between(g,'13. Global Security Decision Principles','14. Definition of Secure Engineering Done')+'\n\n'+between(g,'14. Definition of Secure Engineering Done','15. Revenue Tax & Indirect Tax Compliance Guardrail')],
['m02-authentication-sessions.md','M02','Authentication, identity and sessions',['GLOBAL:1.B authentication','GLOBAL:3:Layer1'],bHeading+'\n\n'+auth.join('\n\n')+'\n\n'+layer(1)],
['m03-authorization-tenancy.md','M03','Authorisation, roles and tenant isolation',['GLOBAL:1.B authorisation','GLOBAL:3:Layer2'],bHeading+'\n\n'+authz.join('\n\n')+'\n\n'+layer(2)],
['m04-input-injection-web.md','M04','Injection, input validation and client security',['GLOBAL:1.A','GLOBAL:1.C','GLOBAL:3:Layer3'],between(g,'A. Injection & Data Layer','B. Authentication, Authorization & Session Management')+'\n\n'+between(g,'C. Input Validation, Output Encoding & Client Security','D. Network, Transport & API Hygiene')+'\n\n'+layer(3)],
['m05-api-network-transport.md','M05','Network, transport and API hygiene',['GLOBAL:1.D'],between(g,'D. Network, Transport & API Hygiene','E. Payment, Webhook & External Event Integrity')],
['m06-payments-webhooks.md','M06','Payments, webhooks and external event integrity',['GLOBAL:1.E','PAYMENT:PREAMBLE','PAYMENT:A1-A16','PAYMENT:WEBHOOK-NEGATIVE-TESTS','GLOBAL:3:Layer6'],paymentPreamble+'\n\n'+between(g,'E. Payment, Webhook & External Event Integrity','F. Secret Lifecycle')+'\n\n'+between(p,'# PART A — PAYMENT & WEBHOOK SECURITY','# PART B — REVENUE TAX / INDIRECT TAX COMPLIANCE')+'\n\n'+layer(6)],
['m07-tax-compliance.md','M07','Revenue tax and indirect-tax compliance',['GLOBAL:15','PAYMENT:PREAMBLE','PAYMENT:B1-B12','PAYMENT:AI-TAX-SAFETY','PAYMENT:TAX-VERIFICATION'],paymentPreamble+'\n\n'+between(g,'15. Revenue Tax & Indirect Tax Compliance Guardrail','16. Financial Integration & Revenue Compliance Release Gate')+'\n\n'+between(p,'# PART B — REVENUE TAX / INDIRECT TAX COMPLIANCE','# GLOBAL FINANCIAL RELEASE GATE')],
['m08-secrets.md','M08','Secrets, credentials and lifecycle management',['GLOBAL:1.F','GLOBAL:17'],between(g,'F. Secret Lifecycle, Rotation & Centralized Secret Management Maturity','G. Error Handling, Environment Isolation & Security Audit Trails')+'\n\n'+between(g,'17. Secret Management & Rotation Release Gate','18. Error Handling, Environment Isolation & Audit Trail Release Gate')],
['m09-data-protection.md','M09','Data protection, privacy and residency',['GLOBAL:3:Layer4','GLOBAL:3:Layer5'],layer(4)+'\n\n'+layer(5)],
['m10-operations-audit-ir.md','M10','Operations, environment isolation, audit and incident response',['GLOBAL:1.G','GLOBAL:11','GLOBAL:18','GLOBAL:3:Layer10','GLOBAL:3:Layer11','GLOBAL:3:Layer12'],between(g,'G. Error Handling, Environment Isolation & Security Audit Trails','2. Mandatory In-Line Penetration Check (Self-Audit)')+'\n\n'+between(g,'11. Monitoring, Incident Response & Vulnerability Management','12. Required Final Security Reporting Contract')+'\n\n'+between(g,'18. Error Handling, Environment Isolation & Audit Trail Release Gate','19. Audit-First, Risk-Prioritized Engineering & Remediation Control')+'\n\n'+layer(10)+'\n\n'+layer(11)+'\n\n'+layer(12)],
['m11-ai-llm-security.md','M11','AI/LLM security and governance',['GLOBAL:3:Layer13','PAYMENT:AI-TAX-SAFETY'],layer13+'\n\n'+between(p,'# AI AGENT TAX SAFETY RULE','# REQUIRED TAX / REVENUE VERIFICATION')],
['m12-supply-chain-cicd-infra.md','M12','CI/CD, infrastructure and software supply chain',['GLOBAL:8','GLOBAL:21','GLOBAL:3:Layer7','GLOBAL:3:Layer8','GLOBAL:3:Layer9'],annotateRiskAcceptanceClause(between(g,'8. CI/CD Security Standard','9. Enterprise Security Evidence Pack')+'\n\n'+between(g,'21. Dependency, Lockfile & Software Supply-Chain Maintenance Control','$END')+'\n\n'+layer(7)+'\n\n'+layer(8)+'\n\n'+layer(9),'unresolved Critical/High findings are reviewed for reachability/applicability and either remediated, mitigated, or explicitly risk-accepted according to the directive;')],
['m13-self-audit.md','M13','Mandatory in-line penetration self-audit',['GLOBAL:2'],between(g,'2. Mandatory In-Line Penetration Check (Self-Audit)','3. APES-STYLE 13-LAYER PRODUCTION SECURITY ASSURANCE')],
['m14-assurance-model.md','M14','13-layer production security assurance model',['GLOBAL:3'],between(g,'3. APES-STYLE 13-LAYER PRODUCTION SECURITY ASSURANCE','4. Production-Readiness Evidence Rule')],
['m15-evidence-reporting.md','M15','Production evidence, assurance pack and reporting',['GLOBAL:4','GLOBAL:9','GLOBAL:12'],between(g,'4. Production-Readiness Evidence Rule','5. Audit → Remediate')+'\n\n'+between(g,'9. Enterprise Security Evidence Pack','10. Public Security Communication')+'\n\n'+between(g,'12. Required Final Security Reporting Contract','13. Global Security Decision Principles')],
['m16-audit-penetration-testing.md','M16','Audit, remediation and authorised penetration testing',['GLOBAL:5','GLOBAL:6'],between(g,'5. Audit → Remediate → Penetration Test → Re-Audit Lifecycle','6. Authorized Penetration Testing Boundary')+'\n\n'+between(g,'6. Authorized Penetration Testing Boundary','7. Security Finding Severity & Release Gating')],
['m17-severity-release-gates.md','M17','Security finding severity and release gates',['GLOBAL:7','OWNER:RELEASE-POLICY'],between(g,'7. Security Finding Severity & Release Gating','8. CI/CD Security Standard')+'\n\n## Owner-approved policy clarification\n\nP0 (Critical) and P1 (High) findings are absolute production-release blockers. No AI agent, developer, reviewer, or project operator may waive, downgrade, relabel, or silently accept a P0/P1 finding. A risk-acceptance note does not convert either severity into PASS. The blocker is cleared only after remediation and evidence-based verification, or after the owner changes this global policy through a separately reviewed, versioned amendment.\n\n## CVSS severity mapping\n\nCVSS Critical/High labels are triage signals, not automatic USS P0/P1 classifications. A CVSS Critical/High finding maps to P0/P1 only when the vulnerable code path is reachable or exploitation is demonstrated in the deployed context, and the resulting impact meets the P0/P1 definitions above. If reachability or exploitability is unknown, keep the finding unresolved and assess it; absence of evidence is not evidence of non-reachability. If the vulnerable path is demonstrated not to be reachable or exploitable in the deployed context, document the evidence and classify the residual risk on its actual impact rather than the CVSS label alone.'],
['m18-public-security-communication.md','M18','Public security communication',['GLOBAL:10'],between(g,'10. Public Security Communication','11. Monitoring, Incident Response & Vulnerability Management')],
['m19-financial-release-gate.md','M19','Financial integration and revenue compliance release gate',['GLOBAL:16','PAYMENT:GLOBAL-FINANCIAL-RELEASE-GATE'],annotateRiskAcceptanceClause(between(g,'16. Financial Integration & Revenue Compliance Release Gate','17. Secret Management & Rotation Release Gate')+'\n\n'+between(p,'# GLOBAL FINANCIAL RELEASE GATE','$END'),'No unresolved applicable Critical/High vulnerability may be silently approved without mitigation or explicit risk acceptance.')],
['m20-audit-first-remediation.md','M20','Audit-first, risk-prioritised engineering and remediation',['GLOBAL:19','GLOBAL:19.8-superseded-in-part','OWNER:RELEASE-POLICY'],annotateRiskAcceptance(between(g,'19. Audit-First, Risk-Prioritized Engineering & Remediation Control','20. CORS & Browser Cross-Origin Trust Boundary'))+'\n\n## Owner-approved policy clarification\n\nP0 and P1 findings are non-waivable production-release blockers. Risk acceptance under the source section on risk acceptance applies only to non-blocking findings. No agent or project operator may use the risk-acceptance process to waive, downgrade, or silently accept a P0/P1 finding.'],
['m21-cors-browser-boundary.md','M21','CORS and browser cross-origin trust boundary',['GLOBAL:20'],between(g,'20. CORS & Browser Cross-Origin Trust Boundary','21. Dependency, Lockfile & Software Supply-Chain Maintenance Control')],
['m22-agent-execution-contract.md','M22','Agent execution contract and policy adherence',['ANTIGRAVITY:EXECUTION-CONTRACT'],between(a,'## Anti-Gravity Execution Contract','# EMBEDDED CANONICAL GLOBAL DIRECTIVE')]
];
const manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
for(const [file,id,title,refs,body] of specs){
 const expected=manifest.modules.find(x=>x.id===id);
 if(!expected||expected.path!=='modules/'+file)throw new Error('Manifest mismatch for '+id);
 await fs.writeFile(expected.path,moduleText(id,title,refs,body));
}
console.log('Rebuilt '+specs.length+' modules from preserved source directives.');
