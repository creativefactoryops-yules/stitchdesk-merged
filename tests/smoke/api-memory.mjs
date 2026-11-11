// 3-turn chat against the local API. Checks memory, single intro, and job-sheet filling.
const BASE = process.env.API ?? 'http://localhost:8787';
const shop = { name: 'Maple Upholstery (demo)', city: 'Toronto', faq: [] };
let history = [];
let sheet = undefined;
const turns = ['Hi, I have an old sofa that needs redoing', 'width is 75 and depth is 45', 'inches. I want green velvet'];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
for (const [i, t] of turns.entries()) {
  history.push({ role: 'user', text: t });
  const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history, sheet, shopSlug: 'maple-demo', shop }) });
  const d = await r.json();
  console.log(`turn ${i + 1} -> ${d.reply}`);
  history.push({ role: 'stitch', text: d.reply });
  sheet = d.sheet;
  ok(!d.offline, `turn ${i + 1} answered by the model`);
  ok(d.reply.includes('first client message="Hi, I have an old sofa'), `turn ${i + 1} model saw the first message`);
  ok(d.reply.includes(`turns=${i * 2 + 1}`), `turn ${i + 1} model got all ${i * 2 + 1} turns`);
  ok(i === 0 ? d.reply.startsWith("Hi, I'm Stitch") : !d.reply.startsWith("Hi, I'm Stitch"), `turn ${i + 1} intro only on first turn`);
}
ok(sheet.piece === 'sofa' && sheet.width === 75 && sheet.depth === 45 && sheet.units === 'in' && sheet.fabric === 'green velvet', `job sheet filled: ${JSON.stringify(sheet)}`);
process.exit(fails ? 1 : 0);
