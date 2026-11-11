import { describe, expect, it } from 'vitest';
import { buildSystemInstruction, toGeminiContents } from '../shared/prompt.js';
import { EMPTY_SHEET } from '../shared/types.js';

describe('conversation memory', () => {
  const history = [
    { role: 'user' as const, text: 'Hi, I have a sofa' },
    { role: 'stitch' as const, text: 'Hey, I am Stitch. What is the width?' },
    { role: 'user' as const, text: '80 inches' },
  ];
  it('sends every turn, alternating user/model', () => {
    const c = toGeminiContents(history);
    expect(c.map((x) => x.role)).toEqual(['user', 'model', 'user']);
    expect(c[0].parts[0].text).toContain('sofa');
  });
  it('drops a leading model turn and merges repeats', () => {
    const c = toGeminiContents([
      { role: 'stitch', text: 'welcome' },
      { role: 'user', text: 'a' },
      { role: 'user', text: 'b' },
    ]);
    expect(c).toEqual([{ role: 'user', parts: [{ text: 'a\n\nb' }] }]);
  });
  it('only allows the intro on the first turn', () => {
    const first = buildSystemInstruction({ shop: { name: 'X' }, sheet: EMPTY_SHEET, history: [], chunks: [] });
    const later = buildSystemInstruction({ shop: { name: 'X' }, sheet: EMPTY_SHEET, history: history.slice(0, 2), chunks: [] });
    expect(first).toMatch(/greet the client once/);
    expect(later).toMatch(/Do NOT greet again/);
  });
  it('asks about units only once', () => {
    const asked = buildSystemInstruction({
      shop: { name: 'X' },
      sheet: { ...EMPTY_SHEET, width: 80 },
      history: [{ role: 'user', text: '80' }, { role: 'stitch', text: 'Is that inches or cm?' }],
      chunks: [],
    });
    expect(asked).toMatch(/Do not ask about inches or centimetres again/);
  });
});
