import test from 'node:test';
import assert from 'node:assert/strict';
import {findProhibitedGitattributes} from '../tools/gitattributes-policy.mjs';

test('accepts the repository LF policy and ordinary text normalization', () => {
  const source = [
    '# diff filter merge export-ignore linguist-generated are only mentioned here',
    '* text=auto',
    '*.mjs text eol=lf',
    '*.pub text eol=lf',
    'SHA256SUMS text eol=lf',
  ].join('\n');
  assert.deepEqual(findProhibitedGitattributes(source), []);
});

for (const attribute of [
  'diff',
  '-diff',
  '!diff',
  'binary',
  'filter=custom-filter',
  'merge=custom-merge',
  '-text',
  '!text',
  'export-ignore',
  'export-subst',
  'export-custom-policy',
  'linguist-generated',
  'linguist-language=JavaScript',
]) {
  test('rejects prohibited .gitattributes token: ' + attribute, () => {
    const findings = findProhibitedGitattributes('*.sample ' + attribute);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 1);
    assert.equal(findings[0].attribute, attribute);
  });
}

test('parses only attribute tokens, not the path pattern', () => {
  assert.deepEqual(findProhibitedGitattributes('diff/filter/linguist-generated text eol=lf'), []);
});

test('ignores blank lines and full-line comments even when they mention prohibited names', () => {
  assert.deepEqual(findProhibitedGitattributes('\n  # filter diff -text export-foo linguist-generated\n'), []);
});

test('reports multiple prohibited tokens with exact source line numbers', () => {
  const findings = findProhibitedGitattributes([
    '*.one text eol=lf',
    '*.two export-ignore linguist-generated',
    '*.three !diff -text',
  ].join('\n'));
  assert.deepEqual(findings, [
    {line: 2, attribute: 'export-ignore'},
    {line: 2, attribute: 'linguist-generated'},
    {line: 3, attribute: '!diff'},
    {line: 3, attribute: '-text'},
  ]);
});
