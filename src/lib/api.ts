/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import type { ChatTurn, JobSheet, FaqEntry } from '../../shared/types';
import { OFFLINE_MESSAGE } from '../../shared/prompt';
import { dreamPrompt, photoPrompt, pollinationsUrl, RENDER_LABEL, type DreamAnswers } from '../../shared/render';

export interface ChatResult {
  reply: string;
  sheet: JobSheet | null;
  offline: boolean;
}

/** Sends the WHOLE conversation so Stitch remembers it. Offline notices are not sent back as Stitch turns. */
export async function askStitch(opts: {
  history: (ChatTurn & { offline?: boolean })[];
  sheet: JobSheet;
  shopSlug: string;
  shop: { name: string; city?: string; hours?: string; etransferEmail?: string; faq?: FaqEntry[] };
}): Promise<ChatResult> {
  const history = opts.history.filter((t) => !t.offline).map(({ role, text }) => ({ role, text }));
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, sheet: opts.sheet, shopSlug: opts.shopSlug, shop: opts.shop }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    return { reply: String(d.reply ?? OFFLINE_MESSAGE), sheet: d.sheet ?? null, offline: Boolean(d.offline) };
  } catch {
    return { reply: OFFLINE_MESSAGE, sheet: null, offline: true };
  }
}

export interface RenderResult {
  imageUrl: string;
  label: string;
  method: string;
  usedPhoto: boolean;
  note?: string;
}

async function postRender(body: unknown): Promise<RenderResult | null> {
  try {
    const r = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
    if (!r.ok) return null;
    return (await r.json()) as RenderResult;
  } catch {
    return null;
  }
}

export async function renderDream(answers: DreamAnswers): Promise<RenderResult> {
  return (
    (await postRender({ mode: 'dream', answers })) ?? {
      imageUrl: pollinationsUrl(dreamPrompt(answers)),
      label: RENDER_LABEL,
      method: 'pollinations',
      usedPhoto: false,
    }
  );
}

export async function renderFromPhoto(opts: { image: string; piece: string; fabric: string; colour: string; style: string }): Promise<RenderResult> {
  return (
    (await postRender({ mode: 'photo', ...opts })) ?? {
      imageUrl: pollinationsUrl(photoPrompt(opts)),
      label: RENDER_LABEL,
      method: 'pollinations-text-fallback',
      usedPhoto: false,
      note: 'Made from your description, not your photo: the photo service is not reachable from here.',
    }
  );
}
