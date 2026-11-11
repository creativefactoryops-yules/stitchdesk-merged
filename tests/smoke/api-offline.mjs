// With the AI unreachable, /api/chat must return the honest offline message, never a fake answer.
const BASE = process.env.API ?? 'http://localhost:8787';
const r = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: [{ role: 'user', text: 'what is welt?' }], shop: { name: 'X' } }) });
const d = await r.json();
console.log(d);
const pass = d.offline === true && /Stitch is offline/.test(d.reply);
console.log(pass ? 'PASS offline message is honest' : 'FAIL');
process.exit(pass ? 0 : 1);
