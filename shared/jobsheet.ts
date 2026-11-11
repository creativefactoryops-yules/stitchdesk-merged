// Pulls job details out of what the client types or says.
// "width is 75 and depth is 45" -> width 75, depth 45.
// Deterministic on purpose: the job sheet must not depend on the AI being online.

import { matchPiece, pieceById } from './estimator.js';
import { EMPTY_SHEET, type ChatTurn, type JobSheet, type Units } from './types.js';

const NUM = '(\\d{1,4}(?:[.,]\\d{1,2})?)';
const UNIT = '\\s*(?:("|”|in\\b|inch(?:es)?\\b|cm\\b|centimet(?:er|re)s?\\b))?';

const DIM_WORDS: Record<'width' | 'depth' | 'height', { names: string[]; adjectives: string[]; letter: string }> = {
  width: { names: ['width', 'wide', 'length', 'long'], adjectives: ['wide', 'long', 'across'], letter: 'w' },
  depth: { names: ['depth', 'deep'], adjectives: ['deep'], letter: 'd' },
  height: { names: ['height', 'high', 'tall'], adjectives: ['high', 'tall'], letter: 'h' },
};

const FABRICS = [
  'faux leather', 'vegan leather', 'faux suede', 'performance fabric', 'performance velvet', 'outdoor fabric', 'marine vinyl',
  'velvet', 'leather', 'vinyl', 'linen', 'cotton', 'boucle', 'bouclé', 'chenille', 'tweed', 'wool', 'mohair', 'microfiber',
  'microfibre', 'crypton', 'sunbrella', 'canvas', 'denim', 'corduroy', 'damask', 'brocade', 'jacquard', 'suede', 'polyester',
  'nylon', 'olefin', 'silk', 'tapestry', 'herringbone', 'houndstooth', 'plaid', 'tartan', 'mohair', 'naugahyde',
];

const COLOURS = [
  'black', 'white', 'cream', 'ivory', 'beige', 'tan', 'camel', 'cognac', 'brown', 'chocolate', 'grey', 'gray', 'charcoal',
  'navy', 'blue', 'teal', 'green', 'emerald', 'olive', 'sage', 'forest', 'mustard', 'yellow', 'gold', 'orange', 'rust',
  'terracotta', 'red', 'burgundy', 'oxblood', 'wine', 'pink', 'blush', 'purple', 'plum', 'lavender', 'oatmeal', 'natural',
];

const NOTE_HINTS = [
  'pet', 'cat', 'dog', 'kid', 'child', 'spring', 'sag', 'tear', 'torn', 'rip', 'stain', 'smell', 'frame', 'broken', 'wobbl',
  'tuft', 'button', 'welt', 'piping', 'skirt', 'nailhead', 'pickup', 'pick up', 'deliver', 'deadline', 'by christmas',
  'heirloom', 'grandm', 'antique', 'leg', 'cushion', 'foam', 'down', 'feather', 'channel',
];

const toNum = (s: string) => parseFloat(s.replace(',', '.'));

function unitFrom(tok: string | undefined): Units | null {
  if (!tok) return null;
  const t = tok.toLowerCase();
  if (t.startsWith('c')) return 'cm';
  return 'in';
}

function detectUnits(text: string): Units | null {
  const t = text.toLowerCase();
  if (/\d\s*(cm\b|centimet)/.test(t) || /\b(in )?(cm|centimet(?:er|re)s?|metric)\b/.test(t)) return 'cm';
  if (/\d\s*("|”|inch|in\b)/.test(t) || /\b(inches|inch|imperial)\b/.test(t)) return 'in';
  return null;
}

function setDim(sheet: JobSheet, key: 'width' | 'depth' | 'height', raw: string, unitTok?: string) {
  const v = toNum(raw);
  if (!(v > 0 && v < 2000)) return;
  sheet[key] = v;
  const u = unitFrom(unitTok);
  if (u) sheet.units = u;
}

/** Merge details found in one client message into the sheet. Returns a new sheet. */
export function extractJobSheet(text: string, prev: JobSheet = EMPTY_SHEET, askedAbout?: 'width' | 'depth' | 'height' | null): JobSheet {
  const sheet: JobSheet = { ...prev, notes: [...prev.notes] };
  const t = text.toLowerCase().replace(/[’']/g, "'");

  const piece = matchPiece(t);
  if (piece) sheet.piece = piece;

  const found = new Set<string>();

  // "75 x 45 x 30", "75 by 45"
  const triple = new RegExp(`${NUM}${UNIT}\\s*(?:x|×|by)\\s*${NUM}${UNIT}(?:\\s*(?:x|×|by)\\s*${NUM}${UNIT})?`, 'i').exec(t);
  if (triple) {
    setDim(sheet, 'width', triple[1], triple[2] || triple[4] || triple[6]);
    setDim(sheet, 'depth', triple[3], triple[4] || triple[2] || triple[6]);
    found.add('width').add('depth');
    if (triple[5]) {
      setDim(sheet, 'height', triple[5], triple[6] || triple[4] || triple[2]);
      found.add('height');
    }
  }

  for (const key of ['width', 'depth', 'height'] as const) {
    if (found.has(key)) continue;
    const { names, adjectives, letter } = DIM_WORDS[key];
    // "width is 75", "width: 75cm", "width of about 75"
    const named = new RegExp(`\\b(?:${names.join('|')})\\b\\s*(?:is|=|:|of|about|around|roughly|approx\\.?|maybe|\\s)*\\s*${NUM}${UNIT}`, 'i').exec(t);
    // "75 wide", "75 inches deep"
    const adj = new RegExp(`${NUM}${UNIT}\\s*(?:${adjectives.join('|')})\\b`, 'i').exec(t);
    // "W75", "w: 75"
    const short = new RegExp(`(?<![a-z'])${letter}(?:\\s*[:=]\\s*)?${NUM}${UNIT}(?![a-z])`, 'i').exec(t);
    const m = named ?? adj ?? short;
    if (m) {
      setDim(sheet, key, m[1], m[2]);
      found.add(key);
    }
  }

  // A bare number answering a direct question ("75" after "What's the width?").
  if (!found.size && askedAbout) {
    const bare = new RegExp(`^\\s*(?:it'?s|about|around|roughly|maybe)?\\s*${NUM}${UNIT}\\s*\\.?\\s*$`, 'i').exec(t);
    if (bare) setDim(sheet, askedAbout, bare[1], bare[2]);
  }

  const units = detectUnits(t);
  if (units) sheet.units = units;

  // Fabric, with a colour word in front when there is one ("green velvet").
  for (const f of FABRICS) {
    const i = t.indexOf(f);
    if (i >= 0) {
      const before = t.slice(Math.max(0, i - 20), i).trim().split(/\s+/).pop() ?? '';
      sheet.fabric = (COLOURS.includes(before) ? before + ' ' : '') + f;
      break;
    }
  }

  // Short notes: sentences that carry useful job details.
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const s = sentence.trim();
    const low = s.toLowerCase();
    if (s.length < 6 || s.endsWith('?')) continue; // questions are not job details
    if (NOTE_HINTS.some((h) => low.includes(h)) && !sheet.notes.includes(s)) {
      sheet.notes.push(s.length > 160 ? s.slice(0, 157) + '…' : s);
    }
  }
  if (sheet.notes.length > 8) sheet.notes = sheet.notes.slice(-8);
  return sheet;
}

/** Which single dimension did Stitch just ask for? Used for bare-number answers. */
export function lastAskedDimension(stitchText: string | undefined): 'width' | 'depth' | 'height' | null {
  if (!stitchText) return null;
  const t = stitchText.toLowerCase();
  const hits = (['width', 'depth', 'height'] as const).filter((k) => DIM_WORDS[k].names.some((n) => new RegExp(`\\b${n}\\b`).test(t)));
  return hits.length === 1 ? hits[0] : null;
}

/** Rebuild the sheet from a whole conversation (client turns only, in order). */
export function sheetFromHistory(turns: ChatTurn[], start: JobSheet = EMPTY_SHEET): JobSheet {
  let sheet = start;
  let lastStitch: string | undefined;
  for (const turn of turns) {
    if (turn.role === 'stitch') lastStitch = turn.text;
    else sheet = extractJobSheet(turn.text, sheet, lastAskedDimension(lastStitch));
  }
  return sheet;
}

export function missingFields(sheet: JobSheet): string[] {
  const out: string[] = [];
  if (!sheet.piece) out.push('piece');
  if (sheet.width == null) out.push('width');
  if (sheet.depth == null) out.push('depth');
  if (sheet.height == null) out.push('height');
  if (!sheet.units && (sheet.width != null || sheet.depth != null || sheet.height != null)) out.push('units');
  if (!sheet.fabric) out.push('fabric');
  return out;
}

export function describeSheet(sheet: JobSheet): string {
  const u = sheet.units ?? 'units not confirmed';
  const dim = (v: number | null) => (v == null ? 'unknown' : String(v));
  return [
    `piece: ${sheet.piece ? pieceById(sheet.piece).label : 'unknown'}`,
    `width: ${dim(sheet.width)}`,
    `depth: ${dim(sheet.depth)}`,
    `height: ${dim(sheet.height)}`,
    `units: ${u}`,
    `fabric: ${sheet.fabric ?? 'unknown'}`,
    `notes: ${sheet.notes.length ? sheet.notes.join(' | ') : 'none'}`,
  ].join('\n');
}
