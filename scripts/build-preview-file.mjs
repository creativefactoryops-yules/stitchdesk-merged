// Builds ONE self-contained HTML file of the demo-mode app (inline JS + CSS, hash routing).
// It runs from a phone's file manager or any static host with no server.
// Usage: npm run build:preview-file   ->   ../preview/index.html
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const outDir = join(root, 'dist-preview');
const target = resolve(root, process.env.PREVIEW_OUT ?? '../preview/index.html');

process.env.VITE_HASH_ROUTER = '1';
// Demo mode: make sure no database keys leak into the preview.
process.env.VITE_SUPABASE_URL = '';
process.env.VITE_SUPABASE_ANON_KEY = '';

await build({
  root,
  base: './',
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, assetsInlineLimit: 100000000, cssCodeSplit: false, modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } } },
});

const assets = join(outDir, 'assets');
let html = readFileSync(join(outDir, 'index.html'), 'utf8');
for (const f of readdirSync(assets)) {
  const body = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) {
    const re = new RegExp(`<script type="module" crossorigin src="\\./assets/${f.replace('.', '\\.')}"></script>`);
    html = html.replace(re, () => `<script type="module">${body.replace(/<\/script/gi, '<\\/script')}</script>`);
  } else if (f.endsWith('.css')) {
    const re = new RegExp(`<link rel="stylesheet" crossorigin href="\\./assets/${f.replace('.', '\\.')}">`);
    html = html.replace(re, () => `<style>${body}</style>`);
  }
}
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(svg)}">`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('An asset was not inlined');
mkdirSync(resolve(target, '..'), { recursive: true });
writeFileSync(target, html);
rmSync(outDir, { recursive: true, force: true });
console.log(`Wrote ${target} (${(html.length / 1024).toFixed(0)} KB)`);
