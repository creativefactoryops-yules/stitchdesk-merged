# StitchDesk — merged voice app (Vercel)

The StitchDesk voice receptionist + estimator, merged from 46 unique builds
audited 2026-11-07 (audit: `../stitchdesk-batch-2026-11-07/VOICE-AUDIT-2026-11-07.md`).

Base: the live stitch-bot voice app (cleanest source), proven on Yules's phone.
Voice: Web Speech Recognition in, speechSynthesis out. Estimator: real yardage
math. Suppliers Vault: 28+ verified GTA suppliers. AR measure: 85.6mm ref card.

## The brain — honest status

- `api/ask-stitch.js` is the real brain: 80 Truper knowledge chunks
  (`api/truper-chunks.json`), IDF-weighted retrieval, top 5 chunks to Gemini.
  It answers with the model name and chunk ids, and the page shows them
  ("GEMINI - gemini-2.5-flash - 5 Truper chunks").
- It needs `GEMINI_API_KEY` set in the Vercel project env (Settings →
  Environment Variables). Until then it returns 502 and the page falls back
  to local Ollama, then to canned replies labelled "OFFLINE BRAIN — canned reply".
- No "1247 chunks" anywhere in this build. The number was never real: it
  started as a supplier note ("Archive fabrics 1247 chunks") and grew into
  badges, bot replies and a "fine-tuned 7B model" fiction. The true count is
  80 Truper chunks.

## Pricing

Free 14 days, then $20/mo. e-Transfer: forcebuildyou@gmail.com. Stars: 700.

## Files

- `index.html` — the whole app (single file, React via CDN-free inline build).
- `api/ask-stitch.js` — Vercel serverless function (Node, no dependencies).
- `api/truper-chunks.json` — 80 chunks from the 4 Truper source files.

## Deploy

Vercel auto-deploys from push to main. The same `index.html` also works on
Netlify: the chat tries `/api/ask-stitch` first, then
`/.netlify/functions/ask-stitch`, so one file serves both hosts.
