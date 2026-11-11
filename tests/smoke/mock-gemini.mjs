// Fake Gemini for local smoke tests. It answers from what it RECEIVED, so it proves the
// whole history and job sheet reach the model. It is not used in production.
import { createServer } from 'node:http';
const PORT = Number(process.env.MOCK_PORT ?? 9999);
export const received = [];
createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    received.push(body);
    const sys = body.systemInstruction?.parts?.[0]?.text ?? '';
    const turns = body.contents ?? [];
    const users = turns.filter((t) => t.role === 'user').map((t) => t.parts[0].text);
    const greetAllowed = /greet the client once/.test(sys);
    const sheet = /JOB SHEET SO FAR[^\n]*\n([\s\S]*?)\n(Still missing|The job sheet is complete)/.exec(sys)?.[1].replace(/\n/g, '; ') ?? '';
    const text = `${greetAllowed ? "Hi, I'm Stitch. " : ''}[mock] turns=${turns.length}; first client message="${users[0]}"; sheet: ${sheet}`;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  });
}).listen(PORT, () => console.log('mock gemini on', PORT));
