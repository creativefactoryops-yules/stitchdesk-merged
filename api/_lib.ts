// Small helpers shared by the /api functions. Files starting with "_" are not routes on Vercel.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FaqEntry } from '../shared/types.js';

export type Req = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };
export type Res = ServerResponse;

export function sendJson(res: Res, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export async function readBody<T = Record<string, unknown>>(req: Req): Promise<T> {
  if (req.body && typeof req.body === 'object') return req.body as T;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}') as T;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 6_000_000) throw new Error('Body too large');
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return (raw ? JSON.parse(raw) : {}) as T;
}

/** Best-effort per-IP limiter. Serverless instances do not share memory, so this only slows abuse. */
const hits = new Map<string, number[]>();
export function rateLimited(req: Req, max = 30, windowMs = 60_000): boolean {
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'x').split(',')[0].trim();
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function supabaseEnv() {
  const url = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY') ?? env('VITE_SUPABASE_ANON_KEY');
  return url && anon ? { url, anon } : null;
}

export interface ServerShop {
  name: string;
  city?: string;
  hours?: string;
  etransferEmail?: string;
  faq: FaqEntry[];
}

/** In Supabase mode, read the shop's public profile and Teach Stitch answers by slug. */
export async function loadShopFromSupabase(slug: string): Promise<ServerShop | null> {
  const sb = supabaseEnv();
  if (!sb || !slug) return null;
  try {
    const r = await fetch(`${sb.url}/rest/v1/rpc/public_shop`, {
      method: 'POST',
      headers: { apikey: sb.anon, Authorization: `Bearer ${sb.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      shop?: { name: string; city?: string; hours?: string; etransfer_email?: string };
      faq?: { id: string; question: string; answer: string }[];
    } | null;
    if (!data?.shop) return null;
    return {
      name: data.shop.name,
      city: data.shop.city,
      hours: data.shop.hours,
      etransferEmail: data.shop.etransfer_email,
      faq: data.faq ?? [],
    };
  } catch {
    return null;
  }
}
