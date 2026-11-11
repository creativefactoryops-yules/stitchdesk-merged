/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// Yardage and cost estimator.
// The sofa formula is the one the live Stitch app used:
//   yards = (W + 2*D + 12) / 36 * 2.5 + 2      (W and D in inches, 54" plain fabric)
// Other pieces use the same shape with their own factor and allowance.
// Everything here is approximate and confirmed after the shop inspects the piece.

import { HST_RATE, type ShopRates, type Units } from './types.js';

export interface PieceDef {
  id: string;
  label: string;
  factor: number;
  allowance: number;
  foamShare: number; // share of a sofa's foam cost
  words: string[]; // words a client might use
}

export const PIECES: PieceDef[] = [
  { id: 'sofa', label: 'Sofa', factor: 2.5, allowance: 2, foamShare: 1, words: ['sofa', 'couch', 'settee', 'chesterfield', 'davenport'] },
  { id: 'loveseat', label: 'Loveseat', factor: 2.3, allowance: 1.5, foamShare: 0.8, words: ['loveseat', 'love seat'] },
  { id: 'sectional', label: 'Sectional', factor: 2.6, allowance: 3, foamShare: 1.8, words: ['sectional', 'l shape', 'l-shaped', 'corner sofa'] },
  { id: 'armchair', label: 'Armchair', factor: 1.6, allowance: 1.5, foamShare: 0.45, words: ['armchair', 'arm chair', 'club chair', 'accent chair', 'recliner', 'chair'] },
  { id: 'wingback', label: 'Wingback chair', factor: 1.8, allowance: 2, foamShare: 0.5, words: ['wingback', 'wing back', 'wing chair'] },
  { id: 'ottoman', label: 'Ottoman', factor: 0.8, allowance: 0.5, foamShare: 0.3, words: ['ottoman', 'footstool', 'pouf', 'pouffe', 'footrest'] },
  { id: 'dining_chair', label: 'Dining chair seat', factor: 0.3, allowance: 0.25, foamShare: 0.1, words: ['dining chair', 'kitchen chair', 'dining seat', 'chair seat'] },
  { id: 'headboard', label: 'Headboard', factor: 0.9, allowance: 0.5, foamShare: 0.3, words: ['headboard', 'head board'] },
  { id: 'bench', label: 'Bench', factor: 0.7, allowance: 0.5, foamShare: 0.3, words: ['bench', 'banquette', 'window seat'] },
  { id: 'car_seat', label: 'Car seat', factor: 0.8, allowance: 0.5, foamShare: 0.3, words: ['car seat', 'auto seat', 'truck seat', 'motorcycle seat'] },
  { id: 'boat_cushion', label: 'Boat cushion', factor: 0.8, allowance: 0.5, foamShare: 0.4, words: ['boat', 'marine', 'boat cushion', 'boat seat'] },
];

export const pieceById = (id: string | null | undefined): PieceDef =>
  PIECES.find((p) => p.id === id) ?? PIECES[0];

/** Match free text ("my grandma's old couch") to a piece id. Longest phrase wins. */
export function matchPiece(text: string): string | null {
  const t = ' ' + text.toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let best: { id: string; len: number } | null = null;
  for (const p of PIECES) {
    for (const w of p.words) {
      if (t.includes(' ' + w + ' ') || t.includes(' ' + w + 's ') || t.includes(' ' + w + 'es ')) {
        if (!best || w.length > best.len) best = { id: p.id, len: w.length };
      }
    }
  }
  return best?.id ?? null;
}

export const toInches = (v: number, units: Units | null | undefined) =>
  units === 'cm' ? v / 2.54 : v;

const roundUpHalf = (n: number) => Math.ceil(n * 2) / 2;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Yards of 54" plain fabric. Pattern repeat adds 15%. Rounded up to the nearest half yard. */
export function estimateYards(
  pieceId: string,
  width: number,
  depth: number,
  units: Units | null | undefined = 'in',
  patterned = false,
): number {
  const p = pieceById(pieceId);
  const W = toInches(width, units);
  const D = toInches(depth, units);
  if (!(W > 0) || !(D > 0)) return 0;
  let yards = ((W + 2 * D + 12) / 36) * p.factor + p.allowance;
  if (patterned) yards *= 1.15;
  return roundUpHalf(yards);
}

export type FoamChoice = 'none' | 'standard' | 'hr';

export interface EstimateInput {
  pieceId: string;
  width: number;
  depth: number;
  units: Units | null;
  foam: FoamChoice;
  patterned?: boolean;
  /** When the client picked a swatch with a known price, low = high = that price. */
  fabricPerYd?: number | null;
}

export interface Estimate {
  yards: number;
  fabricLow: number;
  fabricHigh: number;
  labour: number;
  foam: number;
  supplies: number;
  subtotalLow: number;
  subtotalHigh: number;
  hstLow: number;
  hstHigh: number;
  totalLow: number;
  totalHigh: number;
}

export function estimate(input: EstimateInput, rates: ShopRates): Estimate {
  const p = pieceById(input.pieceId);
  const yards = estimateYards(p.id, input.width, input.depth, input.units, input.patterned);
  const lowRate = input.fabricPerYd ?? rates.fabricLowPerYd;
  const highRate = input.fabricPerYd ?? rates.fabricHighPerYd;
  const fabricLow = Math.round(yards * lowRate);
  const fabricHigh = Math.round(yards * highRate);
  const labour = Math.round(rates.labour[p.id] ?? rates.labour.sofa ?? 0);
  const foamBase = input.foam === 'hr' ? rates.foamHr : input.foam === 'standard' ? rates.foamStandard : 0;
  const foam = Math.round(foamBase * p.foamShare);
  const supplies = Math.round(rates.supplies * Math.max(0.25, p.foamShare));
  const subtotalLow = fabricLow + labour + foam + supplies;
  const subtotalHigh = fabricHigh + labour + foam + supplies;
  const hstLow = Math.round(subtotalLow * HST_RATE);
  const hstHigh = Math.round(subtotalHigh * HST_RATE);
  return {
    yards,
    fabricLow,
    fabricHigh,
    labour,
    foam,
    supplies,
    subtotalLow,
    subtotalHigh,
    hstLow,
    hstHigh,
    totalLow: subtotalLow + hstLow,
    totalHigh: subtotalHigh + hstHigh,
  };
}

export interface QuoteLines {
  yards: number;
  fabricPerYd: number;
  labour: number;
  foam: number;
  supplies: number;
  discount?: number;
}

export interface QuoteTotals {
  fabric: number;
  subtotal: number;
  hst: number;
  total: number;
}

/** Exact quote math, to the cent. HST 13% on the subtotal after discount. */
export function quoteTotals(q: QuoteLines): QuoteTotals {
  const fabric = round2(q.yards * q.fabricPerYd);
  const subtotal = round2(fabric + q.labour + q.foam + q.supplies - (q.discount ?? 0));
  const hst = round2(subtotal * HST_RATE);
  return { fabric, subtotal, hst, total: round2(subtotal + hst) };
}

export const money = (n: number, cents = false) =>
  n.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
