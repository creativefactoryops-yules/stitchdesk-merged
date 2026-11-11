/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// POST /api/chat
// Body: { history: ChatTurn[] (full conversation, newest last), sheet?: JobSheet, shopSlug?: string, shop?: {...demo shop} }
// Returns: { reply, sheet, offline, model?, sources }

import { createRetriever, pickTopChunks, type KbChunk } from '../shared/kb.js';
import { KB_DATA } from '../shared/kbData.js';
import { extractJobSheet, lastAskedDimension, sheetFromHistory } from '../shared/jobsheet.js';
import { buildSystemInstruction, faqToChunks, OFFLINE_MESSAGE, toGeminiContents } from '../shared/prompt.js';
import { EMPTY_SHEET, type ChatTurn, type FaqEntry, type JobSheet } from '../shared/types.js';
import { env, loadShopFromSupabase, rateLimited, readBody, sendJson, type Req, type Res, type ServerShop } from './_lib.js';

const MODEL = 'gemini-flash-lite-latest';
const TIMEOUT_MS = 12_000;
const retriever = createRetriever(KB_DATA);

interface Body {
  history?: ChatTurn[];
  sheet?: JobSheet;
  shopSlug?: string;
  shop?: { name?: string; city?: string; hours?: string; etransferEmail?: string; faq?: FaqEntry[] };
}

function cleanHistory(h: unknown): ChatTurn[] {
  if (!Array.isArray(h)) return [];
  return h
    .filter((t) => t && typeof t === 'object' && typeof (t as ChatTurn).text === 'string')
    .map((t) => ({ role: (t as ChatTurn).role === 'user' ? 'user' : 'stitch', text: (t as ChatTurn).text.slice(0, 2000) }) as ChatTurn)
    .slice(-40);
}

/** Retrieval: the newest question, plus the one before it so follow-ups ("what else is it called?") still match. */
export function retrieveFor(history: ChatTurn[], faq: FaqEntry[], sheet: JobSheet): KbChunk[] {
  const userTurns = history.filter((t) => t.role === 'user');
  const latest = userTurns[userTurns.length - 1]?.text ?? '';
  const prev = userTurns[userTurns.length - 2]?.text ?? '';
  const query = `${latest} ${latest.length < 60 ? prev : ''} ${sheet.piece ?? ''} ${sheet.fabric ?? ''}`;
  const shopHits = faq.length ? createRetriever(faqToChunks(faq)).search(latest || query, 3).filter((r) => r.score >= 4) : [];
  const general = pickTopChunks(retriever.search(query, 12), 6, 8);
  return [...shopHits.map((r) => r.chunk), ...general].slice(0, 8);
}

function cleanSheet(s: unknown): JobSheet | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 && v < 2000 ? v : null);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null);
  return {
    piece: str(o.piece),
    width: n(o.width),
    depth: n(o.depth),
    height: n(o.height),
    units: o.units === 'in' || o.units === 'cm' ? o.units : null,
    fabric: str(o.fabric),
    notes: Array.isArray(o.notes) ? o.notes.filter((x) => typeof x === 'string').slice(-8).map((x) => String(x).slice(0, 160)) : [],
  };
}

export function buildSheet(history: ChatTurn[], sent: unknown): JobSheet {
  const base = cleanSheet(sent);
  if (!base) return sheetFromHistory(history, { ...EMPTY_SHEET });
  const lastUserIdx = history.map((t) => t.role).lastIndexOf('user');
  const prevStitch = history.slice(0, lastUserIdx).reverse().find((t) => t.role === 'stitch');
  return extractJobSheet(history[lastUserIdx].text, base, lastAskedDimension(prevStitch?.text));
}

async function callGemini(system: string, contents: unknown, key: string): Promise<string> {
  const base = env('GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta';
  const r = await fetch(`${base}/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('Gemini empty');
  return text;
}

export default async function handler(req: Req, res: Res) {
  if (req.method === 'GET') return sendJson(res, 200, { ok: true, model: MODEL, ai: Boolean(env('GEMINI_API_KEY')) });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (rateLimited(req)) return sendJson(res, 429, { error: 'Too many messages, slow down a little.' });

  let body: Body;
  try {
    body = await readBody<Body>(req);
  } catch {
    return sendJson(res, 400, { error: 'Bad JSON' });
  }
  const history = cleanHistory(body.history);
  if (!history.some((t) => t.role === 'user')) return sendJson(res, 400, { error: 'history needs at least one client message' });

  // Shop: from Supabase when configured, otherwise the demo shop the browser sent.
  let shop: ServerShop | null = body.shopSlug ? await loadShopFromSupabase(body.shopSlug) : null;
  if (!shop) {
    shop = {
      name: String(body.shop?.name ?? 'the shop').slice(0, 120),
      city: body.shop?.city ? String(body.shop.city).slice(0, 80) : undefined,
      hours: body.shop?.hours ? String(body.shop.hours).slice(0, 200) : undefined,
      etransferEmail: body.shop?.etransferEmail ? String(body.shop.etransferEmail).slice(0, 120) : undefined,
      faq: Array.isArray(body.shop?.faq) ? body.shop!.faq!.slice(0, 200) : [],
    };
  }

  // Job sheet: the browser's sheet (which may hold manual edits) plus whatever the newest message adds.
  // With no sheet sent, it is rebuilt from the whole conversation, so nothing is lost either way.
  const sheet = buildSheet(history, body.sheet);
  const chunks = retrieveFor(history, shop.faq, sheet);
  const system = buildSystemInstruction({ shop, sheet, history: history.slice(0, -1), chunks });
  const contents = toGeminiContents(history);
  const sources = chunks.map((c) => c.title);

  const key = env('GEMINI_API_KEY');
  if (!key) return sendJson(res, 200, { reply: OFFLINE_MESSAGE, sheet, offline: true, reason: 'no_key', sources });
  try {
    const reply = await callGemini(system, contents, key);
    return sendJson(res, 200, { reply, sheet, offline: false, model: MODEL, sources });
  } catch (e) {
    console.error('chat: gemini failed', (e as Error).message);
    return sendJson(res, 200, { reply: OFFLINE_MESSAGE, sheet, offline: true, reason: 'ai_error', sources });
  }
}
