// Local stand-in for Vercel: serves /api/* with the same handlers, and the built app from dist/.
// Usage:  npm run dev:api            (API on http://localhost:8787, Vite dev proxies /api to it)
//         SERVE_DIST=1 npm run dev:api   (also serves dist/ with SPA fallback, for smoke tests)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import chat from '../api/chat.js';
import render from '../api/render.js';
import health from '../api/health.js';
import type { Req, Res } from '../api/_lib.js';

// Load .env.local / .env if present (simple KEY=VALUE lines).
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const routes: Record<string, (req: Req, res: Res) => unknown> = {
  '/api/chat': chat,
  '/api/render': render,
  '/api/health': health,
};

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const PORT = Number(process.env.PORT ?? 8787);
const DIST = join(process.cwd(), 'dist');

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = routes[url.pathname];
  if (route) {
    try {
      await route(req as Req, res);
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end('{"error":"server error"}');
    }
    return;
  }
  if (process.env.SERVE_DIST) {
    let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!file.startsWith(DIST)) file = join(DIST, 'index.html');
    try {
      if (!(await stat(file)).isFile()) throw new Error();
    } catch {
      file = join(DIST, 'index.html');
    }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
    return;
  }
  res.statusCode = 404;
  res.end('not found');
}).listen(PORT, () => console.log(`Stitch local API on http://localhost:${PORT}`));
