// Regenerates shared/kbData.ts from shared/stitch-kb-all.json.
// Usage: node scripts/gen-kb.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../shared/stitch-kb-all.json', import.meta.url), 'utf8'));
const out = `// AUTO-GENERATED from stitch-kb-all.json (${data.length} shop-book entries). Do not edit by hand.\n// Regenerate: node scripts/gen-kb.mjs\nimport type { KbChunk } from './kb.js';\n\nexport const KB_DATA: KbChunk[] = ${JSON.stringify(data, null, 0)};\n`;
writeFileSync(new URL('../shared/kbData.ts', import.meta.url), out);
console.log(`Wrote ${data.length} entries`);
