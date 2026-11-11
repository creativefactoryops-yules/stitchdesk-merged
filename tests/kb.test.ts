import { describe, expect, it } from 'vitest';
import { createRetriever, pickTopChunks } from '../shared/kb.js';
import { KB_DATA } from '../shared/kbData.js';
import { retrieveFor } from '../api/chat.js';

const r = createRetriever(KB_DATA);
const top = (q: string) => pickTopChunks(r.search(q, 12));

describe('KB retrieval', () => {
  it('has all 365 entries', () => {
    expect(KB_DATA.length).toBe(365);
  });
  it('finds welt through its other names (alias scoring)', () => {
    expect(top('what is piping on a cushion?')[0].title.toLowerCase()).toContain('welt');
    expect(top('can you do cording on the arms')[0].title.toLowerCase()).toContain('welt');
  });
  it('answers the questions the old brain missed', () => {
    const qs: [string, RegExp][] = [
      ['What does eight-way hand tied mean and what else is it called?', /eight|8-way|hand.?tied/i],
      ['What is a channel back and how is it done?', /channel/i],
      ['What is a Chesterfield and where does the name come from?', /chesterfield/i],
      ['What is the difference between a tight back and a loose pillow back?', /back/i],
    ];
    for (const [q, re] of qs) {
      const titles = top(q).map((c) => c.title);
      expect(titles.some((t) => re.test(t)), `${q} -> ${titles.join(' | ')}`).toBe(true);
    }
  });
  it('returns 6 to 8 entries for a normal question', () => {
    const n = top('How do I reupholster a car seat with vinyl?').length;
    expect(n).toBeGreaterThanOrEqual(6);
    expect(n).toBeLessThanOrEqual(8);
  });
  it('returns nothing for empty questions', () => {
    expect(top('hi')).toEqual([]);
  });
  it('puts a shop Teach Stitch answer first when it matches', () => {
    const chunks = retrieveFor(
      [{ role: 'user', text: 'Do you offer pickup and delivery?' }],
      [{ id: '1', question: 'Do you offer pickup and delivery?', answer: 'Yes, inside the GTA.' }],
      { piece: null, width: null, depth: null, height: null, units: null, fabric: null, notes: [] },
    );
    expect(chunks[0].topic).toBe('shop');
    expect(chunks.length).toBeLessThanOrEqual(8);
  });
});
