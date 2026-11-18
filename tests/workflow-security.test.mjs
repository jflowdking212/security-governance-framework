import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflowDir=path.join(ROOT,'.github/workflows');
const read=name=>fs.readFileSync(path.join(workflowDir,name),'utf8');

test('all direct GitHub Actions and reusable workflows are pinned to full commit SHAs',()=>{
 for(const file of fs.readdirSync(workflowDir).filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'))){
  const text=read(file);
  for(const match of text.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)){
   const ref=match[1].split('@').at(-1);
   assert.match(ref,/^[a-f0-9]{40}$/i,file+' has an unpinned action/workflow: '+match[1]);
  }
 }
});
test('security scan workflow includes full-history secret scanning and disables PR comments',()=>{
 const text=read('security-scans.yml');
 assert.match(text,/fetch-depth:\s*0/);
 assert.match(text,/gitleaks\/gitleaks-action@[a-f0-9]{40}/);
 assert.match(text,/GITLEAKS_ENABLE_COMMENTS:\s*"false"/);
});
test('security scan workflow pins Semgrep version and runs a fail-on-findings scan',()=>{
 const text=read('security-scans.yml');
 assert.match(text,/semgrep\/semgrep:1\.186\.0/);
 assert.match(text,/semgrep scan --config p\/default --error --metrics=off tools\//);
});
test('CodeQL is configured for the repository tooling language',()=>{
 const text=read('security-scans.yml');
 assert.match(text,/github\/codeql-action\/init@[a-f0-9]{40}/);
 assert.match(text,/github\/codeql-action\/analyze@[a-f0-9]{40}/);
 assert.match(text,/languages:\s*javascript-typescript/);
 assert.match(text,/build-mode:\s*none/);
});
test('dependency scanners fail closed on newly introduced high-risk findings',()=>{
 const text=read('security-scans.yml');
 assert.match(text,/osv-scanner-reusable\.yml@[a-f0-9]{40}/);
 assert.match(text,/fail-on-vuln:\s*true/);
 assert.match(text,/actions\/dependency-review-action@[a-f0-9]{40}/);
 assert.match(text,/fail-on-severity:\s*high/);
 assert.match(text,/warn-only:\s*false/);
});
test('USS validation workflow includes structured evidence validation',()=>{
 assert.match(read('uss-validation.yml'),/validate-evidence\.mjs --file templates\/security-evidence\.example\.json/);
});
