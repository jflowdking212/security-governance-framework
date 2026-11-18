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
