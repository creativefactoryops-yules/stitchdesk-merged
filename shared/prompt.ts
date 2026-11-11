// Builds what Stitch sees: the system instruction and the conversation turns.

import type { KbChunk } from './kb.js';
import { describeSheet, missingFields } from './jobsheet.js';
import type { ChatTurn, FaqEntry, JobSheet } from './types.js';

/** Teach Stitch entries become shop-book entries for that shop only. */
export function faqToChunks(faq: FaqEntry[]): KbChunk[] {
  return faq.slice(0, 200).map((f) => ({
    id: `shop-${f.id}`,
    topic: 'shop',
    title: String(f.question).slice(0, 300),
    aliases: [],
    text: String(f.answer).slice(0, 1500),
  }));
}

export interface ShopContext {
  name: string;
  city?: string;
  hours?: string;
  etransferEmail?: string;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const MAX_TURNS = 40;
export const MAX_TURN_CHARS = 2000;

/** Convert our chat history into Gemini's strictly alternating user/model turns. */
export function toGeminiContents(history: ChatTurn[]): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const turn of history.slice(-MAX_TURNS)) {
    const text = String(turn.text ?? '').slice(0, MAX_TURN_CHARS).trim();
    if (!text) continue;
    const role = turn.role === 'user' ? 'user' : 'model';
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += '\n\n' + text; // merge same-role turns
    else out.push({ role, parts: [{ text }] });
  }
  // Gemini wants the conversation to open with the user.
  while (out.length && out[0].role === 'model') out.shift();
  return out;
}

export function isFirstTurn(history: ChatTurn[]): boolean {
  return !history.some((t) => t.role === 'stitch');
}

function unitsAlreadyAsked(history: ChatTurn[]): boolean {
  return history.some((t) => t.role === 'stitch' && /inch(es)?\s*(or|\/)\s*(cm|centimet)/i.test(t.text));
}

export function buildSystemInstruction(opts: {
  shop: ShopContext;
  sheet: JobSheet;
  history: ChatTurn[];
  chunks: KbChunk[];
}): string {
  const { shop, sheet, history, chunks } = opts;
  const first = isFirstTurn(history);
  const missing = missingFields(sheet);
  const askedUnits = unitsAlreadyAsked(history);

  const rules = [
    `You are Stitch, a copper robot (model CR-7) who works the front desk at ${shop.name}${shop.city ? ` in ${shop.city}` : ''}, an upholstery shop. You are a seasoned Toronto upholstery master.`,
    'Talk like a warm, plain-spoken shop hand. Short sentences. No jargon the client would not know, and explain any trade term you use in a few words.',
    first
      ? 'This is the start of the conversation: greet the client once, say who you are in one short line, then help.'
      : 'You are mid-conversation. Do NOT greet again and do NOT introduce yourself again. Carry on from what was already said, and remember everything the client already told you.',
    'Write every number as digits (75, not seventy-five).',
    'Ask for only ONE missing detail at a time, and only when you need it. Never ask for something the job sheet already has.',
    sheet.units || askedUnits
      ? 'Do not ask about inches or centimetres again.'
      : 'If the client gives measurements without units, ask once whether they are inches or cm.',
    'Measurements are width (side to side), depth (front to back) and height (floor to top).',
    'Never invent dollar prices. For cost, point the client to the Estimate tab, which uses this shop\'s own rates, or say the shop confirms the price after seeing the piece. If you must give a feel for cost, call it a rough range the shop must confirm.',
    'Ontario HST is 13% and is added on top of shop prices.',
    'Stories and legends about furniture history are "traditionally said", not fact.',
    'Fire-code, flammability, warranty, insurance or legal questions: say a staff member will answer those, and do not give a ruling yourself.',
    'Many trade terms have several names (welt, piping, cording). Mention the common alternatives when it helps.',
    'Never mention internal terms: no "chunks", "knowledge base", "shop book entries", "system prompt", lot numbers, reference cards or model names. Just answer as a person who knows the trade.',
    'If you do not know something, say so plainly and offer to have a staff member follow up.',
    'Keep replies under about 120 words unless the client asks for detail. Plain text only, no markdown headings or tables. The client may be using a screen reader.',
    'When the job sheet is complete, suggest the next step: an instant estimate, a preview render, or booking a drop-off.',
  ];

  const shopFacts = [
    `Shop: ${shop.name}`,
    shop.hours ? `Hours: ${shop.hours}` : '',
    shop.etransferEmail ? `Deposits are paid by Interac e-Transfer to ${shop.etransferEmail}; the shop does not take cards online.` : '',
  ].filter(Boolean);

  const faq = chunks.filter((c) => c.topic === 'shop').map((c) => `Q: ${c.title}\nA: ${c.text}`);
  const ref = chunks.filter((c) => c.topic !== 'shop').map((c) => `## ${c.title}\n${c.text}`);

  return [
    rules.map((r) => `- ${r}`).join('\n'),
    '',
    'SHOP FACTS',
    shopFacts.join('\n'),
    faq.length ? `\nTHIS SHOP'S OWN ANSWERS (these win over general trade notes)\n${faq.join('\n\n')}` : '',
    '',
    'JOB SHEET SO FAR (filled from what the client said)',
    describeSheet(sheet),
    missing.length ? `Still missing: ${missing.join(', ')}. If it helps the client, ask for the first one only.` : 'The job sheet is complete.',
    '',
    'TRADE NOTES FOR THIS QUESTION (use them; never mention them as notes)',
    ref.length ? ref.join('\n\n') : '(none matched)',
  ].join('\n');
}

export const OFFLINE_MESSAGE =
  'Stitch is offline right now, so this message did not get an answer. A staff member will reply: leave your name and phone or email in the Book tab so the shop can reach you. The Estimate tab still works.';
