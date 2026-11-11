// One-off: lifts the old live build's CSS and images (ref/live-index.html) into v2.1, scoped under .oc.
// Run: node scripts/extract-old-look.mjs ../ref/live-index.html
// Images go to /tmp at full size; the copies in src/old/ were resized for the phone (hero 400px wide, HUD 600px, webp)
// with: magick stitch-hero.png -resize 400x -strip -quality 90 stitch-hero.webp  (same for the HUD at 600x, quality 85).
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
const src = readFileSync(process.argv[2] ?? '../ref/live-index.html', 'utf8');
const tw = src.match(/<style>([\s\S]*?)<\/style>/)[1];
const comp = src.match(/d\("style", \{ children: `([\s\S]*?)` \}\)/)?.[1] ?? (() => { const i = src.indexOf("@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono"); return src.slice(i, src.indexOf('`', i)); })();
const sub = src.match(/<style>\n(#sd-sub-banner[\s\S]*?)<\/style>/)[1];
const compNoImport = comp.replace(/@import url\([^)]*\);/, '');
const root = postcss.parse(tw + '\n' + compNoImport + '\n' + sub);
// body{line-height:inherit} would undo html's line-height on .oc; both map to .oc, so drop the body rule.
root.walkRules((r) => {
  if (r.selector.trim() === 'body') { r.remove(); return; }
  if (r.parent && r.parent.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
  r.selectors = r.selectors.map((s) => {
    s = s.trim();
    if (s === 'html' || s === ':host' || s === 'body') return '.oc';
    if (s.startsWith('#sd-')) return '.oc ' + s;
    if (s === '::backdrop') return '.oc ::backdrop';
    return '.oc ' + s;
  });
});
const header = `/* © 2026 Yules · CreativeFactory.studio · buildyou. All rights reserved.
   Old Stitch chat look (live build of 2026-05), lifted verbatim from the compiled CSS and scoped under .oc so it
   cannot leak into the rest of the app. Contains Tailwind CSS v3.4.18 output (MIT License, https://tailwindcss.com).
   Font: JetBrains Mono (SIL Open Font License 1.1), loaded from Google Fonts in index.html. */\n`;
writeFileSync('src/old/old-chat.css', header + root.toString());
const img = (name) => src.match(new RegExp(`var ${name} = "data:image/(\\w+);base64,([^"]+)"`)) ?? src.match(new RegExp(`${name}="data:image/(\\w+);base64,([^"]+)"`));
for (const [v, file] of [['mp', 'stitch-hero'], ['hp', 'stitch-avatar'], ['ku', 'stitch-hud']]) {
  const m = img(v);
  if (!m) { console.log('missing', v); continue; }
  writeFileSync(`/tmp/${file}.${m[1]}`, Buffer.from(m[2], 'base64'));
  console.log(file, m[1], Buffer.from(m[2], 'base64').length);
}
