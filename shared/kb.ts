/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// Keyword + alias retrieval over the shop book.
// Scores each entry against title, aliases and text. Aliases carry the other
// names a term goes by (welt = piping = cording), so they weigh the most.

export interface KbChunk {
  id: string;
  topic: string;
  title: string;
  aliases: string[];
  text: string;
}

const STOP = new Set(
  (
    'a an the and or but if of to in on at for with by from as is are was were be been being it its this that these those ' +
    'what which who whom how why when where do does did done can could would should will shall may might must i me my we our ' +
    'you your he she they them their there here about into over under than then so not no yes just also any some much many ' +
    'very really more most up down out off again get got have has had make made like want need tell know please hi hello hey ' +
    'thanks thank ok okay stitch'
  ).split(/\s+/),
);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Very small stemmer: enough to match "springs"/"spring", "tufted"/"tufting". */
export function stem(w: string): string {
  if (w.length <= 3) return w;
  for (const suf of ['ings', 'ing', 'edly', 'ed', 'ies', 'es', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, -suf.length);
      return suf === 'ies' ? base + 'y' : base;
    }
  }
  return w;
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

interface Indexed {
  chunk: KbChunk;
  titleTokens: Set<string>;
  aliasPhrases: string[];
  aliasTokens: Set<string>;
  textCounts: Map<string, number>;
}

function index(chunks: KbChunk[]): Indexed[] {
  return chunks.map((chunk) => {
    const textCounts = new Map<string, number>();
    for (const t of tokens(chunk.text)) textCounts.set(t, (textCounts.get(t) ?? 0) + 1);
    const aliasPhrases = [chunk.title, ...(chunk.aliases ?? [])]
      .map((a) => normalize(a.replace(/\(.*?\)/g, ' ')))
      .filter((a) => a.length >= 3);
    return {
      chunk,
      titleTokens: new Set(tokens(chunk.title)),
      aliasPhrases,
      aliasTokens: new Set((chunk.aliases ?? []).flatMap((a) => tokens(a))),
      textCounts,
    };
  });
}

export interface Retriever {
  search(question: string, k?: number): { chunk: KbChunk; score: number }[];
}

export function createRetriever(chunks: KbChunk[]): Retriever {
  const idx = index(chunks);
  // Document frequency, so common words ("fabric", "sofa") count for less.
  const df = new Map<string, number>();
  for (const d of idx) for (const t of d.textCounts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const N = idx.length || 1;
  const idf = (t: string) => Math.log(1 + N / (1 + (df.get(t) ?? 0)));

  return {
    search(question: string, k = 8) {
      const qNorm = ' ' + normalize(question) + ' ';
      const qTokens = [...new Set(tokens(question))];
      if (!qTokens.length) return [];
      const scored = idx.map((d) => {
        let score = 0;
        // Whole alias / title phrase present in the question.
        for (const p of d.aliasPhrases) {
          if (qNorm.includes(' ' + p + ' ')) score += 6 + p.split(' ').length * 2;
        }
        for (const t of qTokens) {
          const w = idf(t);
          if (d.titleTokens.has(t)) score += 3 * w;
          if (d.aliasTokens.has(t)) score += 2 * w;
          const c = d.textCounts.get(t);
          if (c) score += Math.min(c, 4) * 0.5 * w;
        }
        return { chunk: d.chunk, score };
      });
      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },
  };
}

/** Pick 6 to 8 entries: always up to 6, then up to 8 while scores stay close to the best. */
export function pickTopChunks(results: { chunk: KbChunk; score: number }[], min = 6, max = 8) {
  if (!results.length) return [];
  const best = results[0].score;
  // Drop very weak matches (noise from common words).
  const useful = results.filter((r) => r.score >= Math.max(1.5, best * 0.12));
  return useful.filter((r, i) => i < min || (i < max && r.score >= best * 0.35)).map((r) => r.chunk);
}
