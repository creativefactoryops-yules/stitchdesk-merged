// Checks that every class used in the restored old screens exists in src/old/old-chat.css (the lifted CSS).
import { readFileSync } from 'node:fs';
const css = readFileSync('src/old/old-chat.css', 'utf8');
const files = ['src/old/OldShell.tsx', 'src/pages/client/ChatPanel.tsx', 'src/components/Footer.tsx'];
const ok = new Set(['sr-only', 'skip-link', 'footer-links', 'oc', 'oc-footer', 'site-footer', 'wrap', 'muted', 'no-print', 'sd-card', 'sd-close', 'sd-row', 'sd-btn2', 'sd-fine', 'portal-old', 'no-scrollbar' /* used by the old app too, never defined there */]);
const esc = (c) => c.replace(/([\[\]#\/:.!%()'])/g, '\\$1').replace(/,/g, '\\2c ');
let missing = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const str = (m[1] ?? m[2]).replace(/\$\{[^}]*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\}/g, ' $1 $2 ').replace(/\$\{[^}]*\}/g, ' ');
    for (const c of str.split(/\s+/).filter(Boolean)) {
      if (ok.has(c)) continue;
      if (!css.includes('.' + esc(c)) ) missing.add(`${c}  (${f})`);
    }
  }
}
console.log(missing.size ? 'MISSING:\n' + [...missing].join('\n') : 'all classes present');
