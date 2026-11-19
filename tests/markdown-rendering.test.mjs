import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderSourceMarkdown} from '../tools/render-source-markdown.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('escaped source bullets, bold markers, numbered lists, rules and code spans render as Markdown',()=>{
 const source="\\- **\\*\\*Label:\\*\\*** item\n**\\*\\*Heading\\*\\***\n1\\. Numbered item\n\\---\n\\`code\\`";
 const rendered=renderSourceMarkdown(source);
 assert.equal(rendered,"- **Label:** item\n**Heading**\n1. Numbered item\n---\n`code`");
});
test('generated authentication module uses readable Markdown list and emphasis',()=>{
 const module=fs.readFileSync(path.join(ROOT,'modules/m02-authentication-sessions.md'),'utf8');
 assert.match(module,/^- \*\*Cryptographic Storage:\*\*/m);
 assert.match(module,/^- \*\*Session Tokens & Cookies:\*\*/m);
 assert.doesNotMatch(module,/^\\- /m);
 assert.doesNotMatch(module,/\\\*\\\*/);
});
test('generated core module has active numbered-list markers',()=>{
 const module=fs.readFileSync(path.join(ROOT,'modules/m01-engineering-workflow.md'),'utf8');
 assert.match(module,/^1\. /m);
 assert.doesNotMatch(module,/^\d+\\\./m);
});
test('escaped blockquote markers and escapes inside code spans are rendered without stray backslashes',()=>{
 assert.equal(renderSourceMarkdown('\\> **Note**'),'> **Note**');
 assert.equal(renderSourceMarkdown('Deny `Access-Control-Allow-Origin: \\*` always'),'Deny `Access-Control-Allow-Origin: *` always');
});
test('renderer is content preserving for every line of every preserved source directive',()=>{
 const strip=s=>s.replace(/[\\*`\s]/g,'');
 for(const f of ['GLOBAL_DIRECTIVE_APPLICATION_SECURITY_UPDATED_2026-10-02_v4.md','global_payment_webhook_tax_security_directive.md','ANTIGRAVITY_IDE_GLOBAL_SECURITY_DIRECTIVE_v4.md']){
  const lines=fs.readFileSync(path.join(ROOT,'source/original-directives',f),'utf8').split(/\r?\n/);
  lines.forEach((line,i)=>assert.equal(strip(renderSourceMarkdown(line)),strip(line),f+':'+(i+1)+' content changed by renderer'));
 }
});
test('generated modules contain no stray escape artefacts',()=>{
 for(const f of fs.readdirSync(path.join(ROOT,'modules'))){
  const t=fs.readFileSync(path.join(ROOT,'modules',f),'utf8');
  assert.doesNotMatch(t,/^\s*\\[->]/m,f+' has an escaped list or quote marker');
  assert.doesNotMatch(t,/`[^`]*\\[*_][^`]*`/,f+' has a backslash escape inside a code span');
  assert.doesNotMatch(t,/^\s*\d+\\\./m,f+' has an escaped numbered-list marker');
 }
});
