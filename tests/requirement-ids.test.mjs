import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAllRequirements,extractRequirements,normaliseStatement} from '../tools/requirement-ids.mjs';

test('requirement IDs are unique, family-prefixed and cover every module',async()=>{
 const all=await loadAllRequirements();
 assert.ok(all.length>500);
 assert.equal(new Set(all.map(r=>r.id)).size,all.length);
 for(const r of all)assert.match(r.id,/^USS-[A-Z]+\.[0-9a-f]{8}(-\d+)?$/);
 assert.equal(new Set(all.map(r=>r.module)).size,22);
});

test('IDs are deterministic across runs',async()=>{
 const a=(await loadAllRequirements()).map(r=>r.id),b=(await loadAllRequirements()).map(r=>r.id);
 assert.deepEqual(a,b);
});

test('ID ignores formatting but changes when wording changes',()=>{
 const id=t=>extractRequirements(t,'USS-X','M99')[0].id;
 assert.equal(id('- Never   log **secrets**.'),id('* never log secrets.'));
 assert.notEqual(id('- Never log secrets.'),id('- Always log secrets.'));
 assert.equal(normaliseStatement('1. A  `B`'),'a b');
});

test('repeated statements get a numbered suffix instead of colliding',()=>{
 const r=extractRequirements('- Same rule here.\n- Same rule here.','USS-X','M99');
 assert.equal(r.length,2);assert.notEqual(r[0].id,r[1].id);
});
