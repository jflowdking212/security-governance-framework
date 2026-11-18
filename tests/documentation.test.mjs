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
test('README license notice matches whether a license file exists',()=>{
 const hasLicense=fs.existsSync(path.join(ROOT,'LICENSE'));
 const text=read('README.md');
 if(hasLicense)assert.ok(!text.includes('No license has been added'));
 else assert.ok(text.includes('No license has been added'));
});
