import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflowDir=path.join(ROOT,'.github/workflows');
const read=name=>fs.readFileSync(path.join(workflowDir,name),'utf8');
function assertPinnedActions(text,label){
 for(const line of text.split('\n')){
  const trimmed=line.trim();
  if(!trimmed.startsWith('uses:'))continue;
  const reference=trimmed.split(/\s+/)[1].split('@').at(-1);
  assert.match(reference,/^[a-f0-9]{40}$/i,label+' has an unpinned action: '+trimmed);
 }
}

test('all direct GitHub Actions and reusable workflows are pinned to full commit SHAs',()=>{
 for(const file of fs.readdirSync(workflowDir).filter(name=>name.endsWith('.yml')||name.endsWith('.yaml')))assertPinnedActions(read(file),file);
});
test('security scan workflow includes full-history secret scanning and disables PR comments',()=>{
 const text=read('security-scans.yml');
 assert.ok(text.includes('fetch-depth: 0'));
 assert.ok(text.includes('gitleaks/gitleaks-action@'));
 assert.ok(text.includes('GITLEAKS_ENABLE_COMMENTS: "false"'));
});
test('security scan workflow pins Semgrep version and runs a fail-on-findings scan',()=>{
 const text=read('security-scans.yml');
 assert.ok(text.includes('semgrep/semgrep:1.186.0'));
 assert.ok(text.includes('semgrep scan --config p/default --error --metrics=off tools/'));
});
test('CodeQL is configured for the repository tooling language',()=>{
 const text=read('security-scans.yml');
 assert.ok(text.includes('github/codeql-action/init@'));
 assert.ok(text.includes('github/codeql-action/analyze@'));
 assert.ok(text.includes('languages: javascript-typescript'));
 assert.ok(text.includes('build-mode: none'));
});
test('OSV dependency scanning is pinned and fails on detected vulnerabilities',()=>{
 const text=read('security-scans.yml');
 assert.ok(text.includes('osv-scanner-reusable.yml@'));
 assert.ok(text.includes('fail-on-vuln: true'));
});
test('consumer workflow template pins actions and documents language adaptation',()=>{
 const text=fs.readFileSync(path.join(ROOT,'templates/ci/consumer-security-scans.yml'),'utf8');
 assertPinnedActions(text,'consumer template');
 assert.ok(text.includes('semgrep scan --config p/default --error --metrics=off .'));
 const guide=fs.readFileSync(path.join(ROOT,'templates/ci/README.md'),'utf8');
 assert.ok(guide.includes('Change the CodeQL languages'));
});
test('USS validation workflow includes structured evidence validation',()=>{
 assert.ok(read('uss-validation.yml').includes('validate-evidence.mjs --file templates/security-evidence.example.json'));
});
