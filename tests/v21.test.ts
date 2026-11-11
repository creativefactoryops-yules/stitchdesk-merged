/* © 2026 Yules · CreativeFactory.studio · buildyou. All rights reserved. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSystemInstruction, isFirstTurn, toGeminiContents } from '../shared/prompt';
import { EMPTY_SHEET } from '../shared/types';
import { COPYRIGHT, FOOTER_LINKS } from '../src/components/Footer';

const GREETING = "Hey, it's Stitch. What type of furniture are we looking at — sofa, chair, commercial, headboard, auto, or marine? I'm here at the shop, spool's running.";

describe('v2.1 old greeting is turn one', () => {
  const history = [
    { role: 'stitch' as const, text: GREETING },
    { role: 'user' as const, text: 'I have a sofa' },
  ];
  it('counts as the intro, so Stitch does not greet again', () => {
    expect(isFirstTurn(history.slice(0, 1))).toBe(false);
    const sys = buildSystemInstruction({ shop: { name: 'Maple' }, sheet: EMPTY_SHEET, history: history.slice(0, 1), chunks: [] });
    expect(sys).toContain('Do NOT greet again');
    expect(sys).not.toContain('greet the client once');
  });
  it('Gemini still gets a conversation that opens with the client', () => {
    const c = toGeminiContents(history);
    expect(c[0].role).toBe('user');
    expect(c).toHaveLength(1);
  });
  it('asks for Canadian spelling and repeating measurements back', () => {
    const sys = buildSystemInstruction({ shop: { name: 'Maple' }, sheet: EMPTY_SHEET, history: [], chunks: [] });
    expect(sys).toMatch(/Canadian spelling/);
    expect(sys).toMatch(/repeat it back with its units/);
  });
});

describe('v2.1 footer and licence', () => {
  it('has the exact copyright line', () => {
    expect(COPYRIGHT).toBe('© 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved.');
  });
  it('uses only the confirmed links, exactly', () => {
    expect(FOOTER_LINKS.map((l) => l.href)).toEqual([
      'https://force-folio.netlify.app',
      'https://ko-fi.com/creativefactorystudio',
      'https://www.instagram.com/creativefactory.studio/',
      'https://dev.to/yules',
      'https://medium.com/@yules_buildyou',
      'https://github.com/creativefactoryops-yules',
      'https://www.threads.net/@creativefactory.studio',
    ]);
    expect(FOOTER_LINKS.some((l) => /facebook|tiktok|twitter|x\.com/i.test(l.href))).toBe(false);
  });
  it('ships a proprietary LICENSE and the author meta', () => {
    expect(readFileSync('LICENSE', 'utf8')).toMatch(/All rights reserved/);
    expect(readFileSync('index.html', 'utf8')).toContain('<meta name="author" content="Yules · CreativeFactory.studio" />');
  });
});

describe('no internal jargon in client-facing screens', () => {
  it('the restored chat and shell do not say chunks, lot numbers, 85.6mm or Truper', () => {
    for (const f of ['src/pages/client/ChatPanel.tsx', 'src/old/OldShell.tsx', 'src/components/Footer.tsx']) {
      const s = readFileSync(f, 'utf8');
      expect(s).not.toMatch(/chunk|lot #|85\.6|truper|445|offline brain/i);
    }
  });
});
