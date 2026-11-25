const EXACT_PROHIBITED = new Set(['diff', 'binary', 'filter', 'merge']);

export function findProhibitedGitattributes(source) {
  const findings = [];
  const lines = String(source).split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;

    const tokens = line.split(/\s+/);
    for (const token of tokens.slice(1)) {
      const modifier = token[0] === '-' || token[0] === '!' ? token[0] : '';
      const attribute = (modifier ? token.slice(1) : token).split('=', 1)[0];

      const prohibited =
        EXACT_PROHIBITED.has(attribute) ||
        (attribute === 'text' && Boolean(modifier)) ||
        attribute.startsWith('export-') ||
        attribute.startsWith('linguist');

      if (prohibited) {
        findings.push({ line: index + 1, attribute: token });
      }
    }
  }

  return findings;
}
