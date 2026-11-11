import { describe, expect, it } from 'vitest';
import { extractJobSheet, missingFields, sheetFromHistory } from '../shared/jobsheet.js';
import { EMPTY_SHEET } from '../shared/types.js';

describe('job sheet extraction', () => {
  it('reads "width is 75 and depth is 45"', () => {
    const s = extractJobSheet('width is 75 and depth is 45');
    expect(s.width).toBe(75);
    expect(s.depth).toBe(45);
    expect(s.height).toBeNull();
    expect(s.units).toBeNull();
  });
  it('reads W x D x H with units', () => {
    const s = extractJobSheet("It's a sofa, 84 x 36 x 32 inches");
    expect(s).toMatchObject({ piece: 'sofa', width: 84, depth: 36, height: 32, units: 'in' });
  });
  it('reads "190 cm wide, 90 deep"', () => {
    const s = extractJobSheet('The couch is 190 cm wide, 90 deep and 85 tall');
    expect(s).toMatchObject({ width: 190, depth: 90, height: 85, units: 'cm' });
  });
  it('reads fabric with its colour', () => {
    expect(extractJobSheet('I want it in green velvet').fabric).toBe('green velvet');
  });
  it('keeps earlier details when later messages add more', () => {
    const s = sheetFromHistory([
      { role: 'user', text: 'I have an armchair' },
      { role: 'stitch', text: 'Nice. What is the width?' },
      { role: 'user', text: '32' },
      { role: 'stitch', text: 'And how deep is it?' },
      { role: 'user', text: 'depth is 34 inches, the springs sag' },
    ]);
    expect(s).toMatchObject({ piece: 'armchair', width: 32, depth: 34, units: 'in' });
    expect(s.notes.join(' ')).toMatch(/springs sag/);
  });
  it('does not treat "I\'d 30" as a depth', () => {
    expect(extractJobSheet("I'd 30 like a quote").depth).toBeNull();
  });
  it('lists missing fields in order', () => {
    expect(missingFields(EMPTY_SHEET)).toEqual(['piece', 'width', 'depth', 'height', 'fabric']);
    expect(missingFields({ ...EMPTY_SHEET, piece: 'sofa', width: 80 })).toEqual(['depth', 'height', 'units', 'fabric']);
  });
});

describe('server sheet merge', () => {
  it('keeps manual edits from the browser and adds the newest message', async () => {
    const { buildSheet } = await import('../api/chat.js');
    const s = buildSheet(
      [
        { role: 'user', text: 'I have a sofa' },
        { role: 'stitch', text: 'Great. How wide is it? What is the width?' },
        { role: 'user', text: '80' },
      ],
      { piece: 'sofa', width: null, depth: 30, height: null, units: 'in', fabric: 'linen', notes: [] },
    );
    expect(s).toMatchObject({ piece: 'sofa', width: 80, depth: 30, units: 'in', fabric: 'linen' });
  });
  it('does not save questions as job notes', () => {
    expect(extractJobSheet('What is welt?').notes).toEqual([]);
  });
});
