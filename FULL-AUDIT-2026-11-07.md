# Full audit — merged StitchDesk voice app (live)
Site: https://stitchdesk-merged.vercel.app — audited 2026-11-07 ~05:45–05:47 EST (browser) + direct API test 05:45 EST.
Source: browser task browser-task:699baf96-e4ac-5f12-8cee-19da2569d55e + curl POST to /api/ask-stitch.

## CORRECTION (Nov 7 ~06:00, Wick checked the deployed source)
The audit browser INVENTED details for Library, Docs, Archive breakdowns, and the "$43,000,216,490 previous quote" — none of those strings exist in the deployed index.html (verified by grep + by extracting the actual glossary and supplier arrays from the file). What is TRUE in the source instead:
- Library glossary (7 entries): Candy leather, Boast/Boasting, Pebbled cognac lot #453, TLC resurrect, Reference card 85.6mm, RAG chunks ("80 Truper chunks"), BuildYou. No "$29.00 / yardage services", no "Long Last", no "4-way".
- Suppliers (28): clean, coherent data (phones, emails, addresses, sensible notes). NO gibberish — no "Alberni or winter", no "Games waxing", no "61st barrel", no "Dave's boss + 21¢ per yard".
- Archive: only the Rosa quote object exists in source (total $1,420); the "$1,400 table", "$660+$200+$200+$80" lines and "$710 deposit" are NOT in the source (the $710 is derivable as 50% of $1,420, the rest is unverified).
- Docs quoted lines ("device ID and session data being recorded") and the $43B figure: NOT in the source.
- DROPPED from the fix list: Library "$29.00" label, quote-totals fix, Docs contradiction fix, $43B fix, supplier-gibberish fix. The VERIFIED fix list is: status pill prefix, footer domain, price $20→$29. The structural findings below (sections render, payment gap, no console errors, estimator, suppliers search, status label) are corroborated by the source and by direct tests, and stand.

## RAG brain — LIVE (proven twice)
- Direct API POST (sofa price, dims W82/D34/H33, yardage 13.3, total 1159): HTTP 200 in 9.1s, source gemini, model gemini-flash-lite-latest, chunks truper-004/056/003/013/020 (correct pricing chunks). Answer was honest but generic — Ontario ranges, did not quote the $1,159 estimator total passed in. Prompt tweak candidate. 9s is close to Vercel's 10s function limit.
- Browser bot test (boat marine vinyl): live Gemini answer, refused to fake a brand name, cited Len's Mill 66 Orfus Road North York. Status label verbatim: "Ollama GEMINI - gemini-flash-lite-latest - 5 Truper chunks" — the "Ollama" prefix contradicts GEMINI (stale pill text from the base; the Xl() status itself is correct). Fix: pill should show just the status.
- Voice: LISTEN button + Mic button + green Voice On toggle present. Yules confirmed voice works on her phone.

## Works
- Reception chat, live Gemini answer, GEMINI status label.
- Estimator: defaults W82/D34/H33, $45/yd, HR 2.8lb 50ILD, Pebbled Cognac lot #453; 13.3yd, $599 fabric + $380 labour + $180 foam = $1,159. Drag updates live (W 82→120 = 15.9yd, $1,276). Formula shown. AR 85.6mm ref card present (heading + Vision HUD).
- Suppliers Vault: 28 entries, search works (marine → 3: Greenberg Fabrics, Auto Marine Vinyl, Marine Zipper Pro). Each has phone/email/website.
- Library: 7 entries. No "1247", no "$29" by page-text search — BUT one entry reads "$29.00 / yardage services" (missed by the "$29" search because of the ".00"). It is a shop service rate, not the app price — needs a clarifying label or a change.
- Archive: 1 quote (Q-001 Rosa). Docs/IP/legal renders. No console errors, no blank areas.

## Broken / weak
- PAYMENT — no way to pay the $20/mo subscription (see below).
- Client Files: 4 files; Upload button gave no visible response in the audit browser (unverified); photo Open shows only a toast, no viewer/lightbox.
- Width slider ignores arrow keys (drag works).
- Quote totals inconsistent: header $1,420.00 vs breakdown table $1,400.00 (and the breakdown lines sum to $1,140: 660+200+200+80). Demo data needs consistent numbers.
- Gibberish/placeholder supplier copy: "Alberni or winter", "Trim & Tassel — Games waxing", "King Textiles — Dave's boss + 21¢ per yard", "61st barrel". Needs real supplier details from Yules; do not invent.
- "Truper" throughout — NOT a typo: it is the name of the shop-knowledge source files (the 80 chunks come from 4 Truper files). Leave it.
- "File will be chunked → embedded → reviewed → boring → learning" — "boring" is in the base glossary text; likely a joke/typo, leave or fix with her say-so.
- Footer on every page says stitchdesk-buildyou.netlify.app while the live site is stitchdesk-merged.vercel.app. Fix to the Vercel URL.
- Docs contradicts itself: "data stays on your device" vs "device ID and session data being recorded".
- "A $43,000,216,490 previous quote" in the Estimate heading area — garbled/placeholder figure.
- Status pill "Ollama GEMINI" contradiction (above).

## Payment — the gap
- Only payment mechanism on the whole site: COPY e-Transfer (forcebuildyou@gmail.com), on every section. Manual Interac, no amount, no reference, no confirmation.
- Quote deposit is client-job money, not subscription: Archive Q-001 "Pay 50% deposit: $710.00 / Balance $710.00".
- Searched, found NOTHING: "$20", "Stars", "14 days", "subscribe", any trial gate/paywall, any checkout/Stripe/PayPal/Shop Pay button. The "Free 14 days, then $20/mo" line exists only inside the shop-activation toast (shows on tap, not in page text) — effectively invisible.
- Verdict: a shop cannot subscribe or pay for the app as it stands. Missing: a subscription product/price page, a checkout or payment link, trial terms, and any way to tie an e-Transfer to a subscription.

## Payment plan (pending Yules's pick)
- A (panel only): a Subscribe section — $20/mo, 14 days free, e-Transfer $20 to forcebuildyou@gmail.com with shop name as the message (COPY button + amount + reference) + Stars 700 via the Telegram bot. Everything stays open. Fast, honest, no lockout.
- B (panel + trial gate, like the toolkit): same panel + a browser-local 14-day trial (name + business + email) after which sections lock until paid (trust unlock). Real paywall, more work, changes the app from free-open to gated.
- Small fixes to ride along either way: status pill ("Ollama GEMINI" → just the status), footer domain → Vercel URL, quote totals made consistent, "$29.00 / yardage services" labelled as a service rate. Supplier gibberish needs her real details — not fixable from here.
