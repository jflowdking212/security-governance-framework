export function renderSourceMarkdown(text){
 return text.split('\n').map(line=>{
  let rendered=line
   .replace(/^(\s*)\\- /,'$1- ')
   .replace(/^(\s*)\\---\s*$/,'$1---')
   .replace(/^(\s*)(\d+)\\\./,'$1$2.')
   .replace(/\\`/g,'`')
   .replace(/\*\*\\\*\*(.*?)\\\*\*\*\*/g,'**$1**');
  return rendered;
 }).join('\n');
}
