import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');

test('root README exists and contains the expected project entry points',()=>{
 const text=read('README.md');
 for(const phrase of ['Universal Security Standard','Start here','Task catalogue','Build and validate','Release status','SECURITY.md','CONTRIBUTING.md'])assert.ok(text.includes(phrase),'README missing '+phrase);
});
test('all local Markdown links in README resolve to repository paths',()=>{
 const text=read('README.md');
 const links=[...text.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1]).filter(x=>!/^https?:|^mailto:|^#/.test(x)).map(x=>decodeURIComponent(x.split('#')[0])).filter(Boolean);
 for(const link of new Set(links))assert.ok(fs.existsSync(path.resolve(ROOT,link)),'Broken README link: '+link);
});
test('security and contribution guidance are present',()=>{
 for(const file of ['SECURITY.md','CONTRIBUTING.md','.gitignore','.github/PULL_REQUEST_TEMPLATE.md'])assert.ok(fs.existsSync(path.join(ROOT,file)),'Missing '+file);
 const security=read('SECURITY.md');
 assert.ok(security.includes('privately'));
 assert.ok(security.includes('public issue'));
 const contributing=read('CONTRIBUTING.md');
 assert.ok(contributing.includes('source/traceability-matrix.csv'));
});
test('supplement index links resolve and every implementation supplement is indexed',()=>{
 const index=read('supplements/README.md');
 const links=[...index.matchAll(/\\]\\(([^)]+)\\)/g)].map(x=>x[1]).filter(x=>!/^https?:|^mailto:|^#/.test(x));
 for(const link of links)assert.ok(fs.existsSync(path.resolve(ROOT,'supplements',link)),'Broken supplement link: '+link);
 for(const name of ['authentication-federation.md','ssrf-outbound-requests.md','api-graphql-websocket-grpc.md','cryptography-key-management.md','data-lifecycle-privacy.md','container-cloud-runtime.md','ai-agent-security.md'])assert.ok(index.includes(name),'Supplement index missing '+name);
});
test('stack profiles remain explicitly unverified until application evidence exists',()=>{
 for(const file of ['stacks/nodejs-express.md','stacks/python-fastapi.md','stacks/laravel-php.md','stacks/react-typescript.md','stacks/flutter-dart.md','stacks/go.md','stacks/rust.md','stacks/java-spring.md'])assert.match(read(file),/REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION/);
});
test('review correction log records unresolved owner-only release blockers',()=>{
 const log=read('REVIEW-CORRECTION-LOG.md');
 assert.match(log,/P1.5 - Repository protection and licensing/);
 assert.match(log,/P2.8 - Control IDs not implemented/);
 assert.match(log,/P3.12 - Broken Markdown/);
 assert.match(log,/Nothing in this correction series has been merged into main/);
});
test('severity rubric preserves M17 non-waivable release policy',()=>{
 const rubric=read('assurance/severity-classification.md');
 assert.match(rubric,/P0\/P1 cannot be accepted, waived, relabelled or silently downgraded/);
 assert.match(rubric,/CVSS v4.0/);
});
test('README license notice matches whether a license file exists',()=>{
 const hasLicense=fs.existsSync(path.join(ROOT,'LICENSE'));
 const text=read('README.md');
 if(hasLicense)assert.ok(!text.includes('No license has been added'));
 else assert.ok(text.includes('No license has been added'));
});

test('release trust bootstrap documentation and checksum tooling are present',()=>{
 for(const file of ['SECURITY-ROOT.md','CONSUMING.md','tools/checksums.mjs','tests/checksums.test.mjs','.github/CODEOWNERS','.security/README.md','templates/uss-version.example']) {
  assert.ok(fs.existsSync(path.join(ROOT,file)),'Missing '+file);
 }
 const root=read('SECURITY-ROOT.md');
 assert.ok(root.includes('independently trusted source'));
 assert.ok(root.includes('USS-SHA256SUMS'));
 const consuming=read('CONSUMING.md');
 assert.ok(consuming.includes('Do not read or follow a vendored'));
 assert.ok(consuming.includes('sha256sums_sha256'));
});


test('M21 documents current Local Network Access terminology and does not require legacy PNA preflight headers',()=>{
 const m21=read('modules/m21-cors-browser-boundary.md');
 assert.match(m21,/Local Network Access \(LNA\)/);
 assert.match(m21,/Draft Community Group Report dated 7 August 2026/);
 assert.match(m21,/\`local-network\`/);
 assert.match(m21,/\`loopback-network\`/);
 assert.match(m21,/must NOT rely on those legacy headers/);
 assert.match(m21,/wicg\.github\.io\/local-network-access/);
 assert.doesNotMatch(m21,/must explicitly inspect and validate incoming \`Access-Control-Request-Private-Network\` preflight headers/);
 assert.doesNotMatch(m21,/unconditionally respond with \`Access-Control-Allow-Private-Network: true\`/);
});
