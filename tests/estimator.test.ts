import { describe, expect, it } from 'vitest';
import { estimate, estimateYards, matchPiece, quoteTotals } from '../shared/estimator.js';
import type { ShopRates } from '../shared/types.js';

const rates: ShopRates = {
  fabricLowPerYd: 30,
  fabricHighPerYd: 80,
  labour: { sofa: 650, armchair: 380 },
  foamHr: 180,
  foamStandard: 120,
  supplies: 60,
};

describe('yardage', () => {
  it('matches the live app sofa formula, rounded up to the half yard', () => {
    // live app: (82 + 2*34 + 12) / 36 * 2.5 + 2 = 13.25 -> 13.5
    expect(estimateYards('sofa', 82, 34, 'in')).toBe(13.5);
  });
  it('converts cm to inches first', () => {
    expect(estimateYards('sofa', 82 * 2.54, 34 * 2.54, 'cm')).toBe(13.5);
  });
  it('adds 15% for a patterned fabric', () => {
    // 13.25 * 1.15 = 15.2375 -> 15.5
    expect(estimateYards('sofa', 82, 34, 'in', true)).toBe(15.5);
  });
  it('returns 0 for missing sizes', () => {
    expect(estimateYards('sofa', 0, 34, 'in')).toBe(0);
  });
});

describe('estimate range', () => {
  it('adds labour, foam, supplies and 13% HST', () => {
    const e = estimate({ pieceId: 'sofa', width: 82, depth: 34, units: 'in', foam: 'hr' }, rates);
    expect(e.yards).toBe(13.5);
    expect(e.fabricLow).toBe(405); // 13.5 * 30
    expect(e.fabricHigh).toBe(1080); // 13.5 * 80
    expect(e.subtotalLow).toBe(405 + 650 + 180 + 60);
    expect(e.hstLow).toBe(Math.round(1295 * 0.13));
    expect(e.totalLow).toBe(1295 + 168);
    expect(e.totalHigh).toBe(1970 + Math.round(1970 * 0.13));
  });
  it('uses a chosen swatch price for both ends', () => {
    const e = estimate({ pieceId: 'sofa', width: 82, depth: 34, units: 'in', foam: 'none', fabricPerYd: 50 }, rates);
    expect(e.fabricLow).toBe(e.fabricHigh);
    expect(e.foam).toBe(0);
  });
});

describe('quote totals', () => {
  it('is exact to the cent', () => {
    const q = quoteTotals({ yards: 12.5, fabricPerYd: 42.99, labour: 650, foam: 180, supplies: 45.5 });
    expect(q.fabric).toBe(537.38);
    expect(q.subtotal).toBe(1412.88);
    expect(q.hst).toBe(183.67);
    expect(q.total).toBe(1596.55);
  });
  it('applies a discount before HST', () => {
    const q = quoteTotals({ yards: 10, fabricPerYd: 40, labour: 500, foam: 0, supplies: 0, discount: 100 });
    expect(q.subtotal).toBe(800);
    expect(q.hst).toBe(104);
    expect(q.total).toBe(904);
  });
});

describe('piece matching', () => {
  it('finds pieces in plain talk', () => {
    expect(matchPiece("my grandma's old couch")).toBe('sofa');
    expect(matchPiece('a wingback chair from the 70s')).toBe('wingback');
    expect(matchPiece('6 dining chairs')).toBe('dining_chair');
    expect(matchPiece('sofa cushions are flat')).toBe('sofa');
  });
});
