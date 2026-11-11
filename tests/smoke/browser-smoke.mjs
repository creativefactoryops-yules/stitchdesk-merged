// Browser smoke test (Playwright + Chromium) against the built app in DEMO MODE.
// Needs: npm run build, then the local server with the mock Gemini (see README "Testing").
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const BASE = process.env.APP ?? 'http://localhost:8787';
const SHOTS = process.env.SHOTS ?? '/tmp/stitch-shots';
mkdirSync(SHOTS, { recursive: true });
const axeSrc = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => { console.log('PAGE ERROR', e.message); fails++; });

async function axe(name) {
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
  const serious = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  ok(serious.length === 0, `axe ${name}: ${serious.length} serious/critical issues ${serious.map((v) => v.id + '(' + v.nodes.length + ')').join(', ')}`);
}

// 1. Client chat, 3 turns, memory
await page.goto(`${BASE}/s/maple-demo`);
await page.getByRole('heading', { level: 1, name: 'Chat with Stitch' }).waitFor();
await axe('chat');
const say = async (t, n) => {
  await page.getByLabel('Your message').fill(t);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.msg.stitch:not([aria-hidden])').nth(n - 1).waitFor({ timeout: 15000 });
};
await say('Hi, I have an old sofa that needs redoing', 1);
await say('width is 75 and depth is 45', 2);
await say('inches. I want green velvet', 3);
const replies = await page.locator('.msg.stitch:not([aria-hidden])').allInnerTexts();
console.log(replies.join('\n---\n'));
ok(replies.length === 3, '3 Stitch replies');
ok(replies[0].includes("Hi, I'm Stitch") && !replies[1].includes("Hi, I'm Stitch") && !replies[2].includes("Hi, I'm Stitch"), 'intro only once');
ok(replies[2].includes('turns=5') && replies[2].includes('first client message="Hi, I have an old sofa'), 'turn 3 carried full history');
const sheetText = await page.locator('.sheet').innerText();
ok(/Width\s*75 in/.test(sheetText) && /Depth\s*45 in/.test(sheetText) && /green velvet/.test(sheetText), 'job sheet filled itself');
const live = await page.locator('[aria-live="polite"][aria-atomic="true"]').first().innerText();
ok(live.startsWith('Stitch says:'), 'aria-live announces the newest reply');
await page.screenshot({ path: `${SHOTS}/01-chat.png`, fullPage: true });

// memory survives reload
await page.reload();
ok((await page.locator('.msg.stitch').count()) === 3, 'conversation kept after reload');

// 2. Estimate
await page.getByRole('link', { name: 'Estimate', exact: true }).click();
await page.getByRole('heading', { level: 1, name: 'Instant estimate' }).waitFor();
const est = await page.locator('section[aria-labelledby="est-result"]').innerText();
ok(est.includes('14.5 yards'), 'estimate: 14.5 yards for a 75 x 45 in sofa');
ok(/HST 13%/.test(est) && /Approximate, confirmed after inspection/.test(est), 'estimate shows HST and the inspection note');
await page.screenshot({ path: `${SHOTS}/02-estimate.png`, fullPage: true });
await axe('estimate');

// 3. Book
await page.getByRole('link', { name: 'Book this' }).first().click();
await page.getByRole('heading', { level: 1, name: 'Book this' }).waitFor();
await page.getByLabel('Your name').fill('Test Client');
await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');
const d = new Date(); d.setDate(d.getDate() + 3);
await page.getByLabel('First choice').fill(d.toLocaleDateString('en-CA'));
await axe('book');
await page.getByRole('button', { name: 'Send booking request' }).click();
await page.getByRole('heading', { level: 1, name: 'Request sent' }).waitFor();
const jobHref = await page.locator('a[href^="/j/"]').getAttribute('href');
ok(/^\/j\/[0-9a-f]{48}$/.test(jobHref), `unguessable job link ${jobHref}`);
await page.screenshot({ path: `${SHOTS}/03-booked.png`, fullPage: true });

// 4. Shop board shows the new lead
await page.goto(`${BASE}/shop/jobs`);
await page.getByRole('heading', { level: 1, name: 'Jobs board' }).waitFor();
const leadCol = page.locator('section[aria-labelledby="col-lead"]');
ok((await leadCol.innerText()).includes('Sofa for Test Client'), 'booking shows in the Lead column');
await page.screenshot({ path: `${SHOTS}/04-board.png`, fullPage: true });
await axe('board');

// accessible move button
await page.getByRole('button', { name: 'Move Sofa for Test Client forward to Quoted' }).click();
await page.waitForTimeout(300);
ok((await page.locator('section[aria-labelledby="col-quoted"]').innerText()).includes('Sofa for Test Client'), 'move button moved the card to Quoted');
await page.getByRole('button', { name: 'Move Sofa for Test Client back to Lead' }).click();
await page.waitForTimeout(300);

// drag and drop (desktop width: phones use the move buttons, touch has no HTML drag and drop)
await page.setViewportSize({ width: 1280, height: 900 });
await page.locator('.job-card', { hasText: 'Sofa for Test Client' }).dragTo(page.locator('section[aria-labelledby="col-deposit"]'));
await page.waitForTimeout(300);
ok((await page.locator('section[aria-labelledby="col-deposit"]').innerText()).includes('Sofa for Test Client'), 'drag and drop moved the card');
await page.getByRole('button', { name: 'Move Sofa for Test Client back to Quoted' }).click();
await page.getByRole('button', { name: 'Move Sofa for Test Client back to Lead' }).click();
await page.waitForTimeout(300);
await page.setViewportSize({ width: 390, height: 844 });

// 5. Quote math: 14.5 yd x $30 + 650 + 180 + 60 = 1325.00; HST 172.25; total 1497.25
await page.getByRole('link', { name: 'Quote for Sofa for Test Client' }).click();
await page.getByRole('heading', { level: 1, name: /Quote:/ }).waitFor();
let qt = await page.locator('.quote-print').innerText();
ok(qt.includes('$1,325.00') && qt.includes('$172.25') && qt.includes('$1,497.25'), 'quote: subtotal 1,325.00, HST 172.25, total 1,497.25');
await page.getByLabel('Discount ($)').fill('25');
qt = await page.locator('.quote-print').innerText();
ok(qt.includes('$1,300.00') && qt.includes('$169.00') && qt.includes('$1,469.00'), 'quote with $25 discount: 1,300.00 + 169.00 = 1,469.00');
await axe('quote');
await page.getByRole('button', { name: 'Save and send to client' }).click();
await page.getByText('Sent. The client sees the quote').waitFor();
await page.screenshot({ path: `${SHOTS}/05-quote.png`, fullPage: true });

// 6. Client job page shows stage, quote, messages
await page.goto(`${BASE}${jobHref}`);
await page.getByRole('heading', { level: 2, name: 'Your quote' }).waitFor();
const jp = await page.locator('main').innerText();
ok(jp.includes('$1,469.00') && /Quoted, current step/.test(jp), 'client sees quote and stage Quoted');
await page.getByLabel('Message the shop').fill('Can I drop it off Saturday?');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await page.getByText('Can I drop it off Saturday?').waitFor();
ok(true, 'client message posted');
await page.screenshot({ path: `${SHOTS}/06-job.png`, fullPage: true });
await axe('job page');

// 7. Dashboard
await page.goto(`${BASE}/shop`);
await page.getByRole('heading', { level: 1, name: 'Dashboard' }).waitFor();
const dash = await page.locator('main').innerText();
ok(/Revenue this month/.test(dash) && /New leads/.test(dash), 'dashboard renders');
await page.screenshot({ path: `${SHOTS}/07-dashboard.png`, fullPage: true });
await axe('dashboard');

// 8. other pages load without errors
for (const p of ['/shop/clients', '/shop/suppliers', '/shop/swatches', '/shop/teach', '/shop/settings', '/shop/billing', '/s/maple-demo/swatches', '/s/maple-demo/dream', '/s/maple-demo/photo', '/']) {
  await page.goto(`${BASE}${p}`);
  await page.locator('h1').first().waitFor();
  ok(true, `loads ${p}: ${await page.locator('h1').first().innerText()}`);
}
await axe('settings-ish last page');

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
