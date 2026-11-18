import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('root README exists and contains the expected project entry points',()=>{
 const text=fs.readFileSync('README.md','utf8');
 for(const phrase of ['Universal Security Standard','Start here','Task catalogue','Build and validate','Release status','SECURITY.md','CONTRIBUTING.md'])assert.ok(text.includes(phrase),'README missing '+phrase);
});
test('all local Markdown links in README resolve to repository paths',()=>{
 const text=fs.readFileSync('README.md','utf8');
 const links=[...text.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1]).filter(x=>!/^https?:|^mailto:|^#/.test(x)).map(x=>decodeURIComponent(x.split('#')[0])).filter(Boolean);
 for(const link of new Set(links))assert.ok(fs.existsSync(path.resolve(link)),'Broken README link: '+link);
});
test('security and contribution guidance are present',()=>{
 for(const file of ['SECURITY.md','CONTRIBUTING.md','.gitignore','.github/PULL_REQUEST_TEMPLATE.md'])assert.ok(fs.existsSync(file),'Missing '+file);
 const security=fs.readFileSync('SECURITY.md','utf8');
 assert.ok(security.includes('privately'));
 assert.ok(security.includes('public issue'));
 const contributing=fs.readFileSync('CONTRIBUTING.md','utf8');
 assert.ok(contributing.includes('source/traceability-matrix.csv'));
});
test('README license notice matches whether a license file exists',()=>{
 const hasLicense=fs.existsSync('LICENSE');
 const text=fs.readFileSync('README.md','utf8');
 if(hasLicense)assert.ok(!text.includes('No license has been added'));
 else assert.ok(text.includes('No license has been added'));
});
