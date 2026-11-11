/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// GET /api/health: which optional services are switched on (never returns the keys).
import { env, sendJson, supabaseEnv, type Req, type Res } from './_lib.js';

export default function handler(_req: Req, res: Res) {
  sendJson(res, 200, {
    ok: true,
    ai: Boolean(env('GEMINI_API_KEY')),
    photoRender: Boolean(env('CF_ACCOUNT_ID') && env('CF_API_TOKEN')),
    database: Boolean(supabaseEnv()),
  });
}
