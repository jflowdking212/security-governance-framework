// Converts converter-escaped source Markdown (e.g. "\- ", "1\.", "\---", "\*\*bold\*\*") into readable Markdown.
// Content preserving: only Markdown escape characters are removed, never words. tests/markdown-rendering.test.mjs
// proves this for every line of the preserved source directives.
export function renderSourceMarkdown(text){
 return text.split('\n').map(line=>{
  let rendered=line
   .replace(/^(\s*)\\- /,'$1- ')
   .replace(/^(\s*)\\---\s*$/,'$1---')
   .replace(/^(\s*)\\> /,'$1> ')
   .replace(/^(\s*)(\d+)\\\./,'$1$2.')
   .replace(/\\`/g,'`')
   .replace(/\*\*\\\*\\\*(.*?)\\\*\\\*\*\*/g,'**$1**');
  // Backslash escapes are literal inside code spans, so "`\*`" would display a stray backslash.
  rendered=rendered.replace(/`[^`]*`/g,span=>span.replace(/\\([*_])/g,'$1'));
  return rendered;
 }).join('\n');
}
