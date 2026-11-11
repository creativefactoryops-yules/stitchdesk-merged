// POST /api/render
// Dream build:   { mode: "dream", answers: DreamAnswers }
// Before/after:  { mode: "photo", image: "data:image/jpeg;base64,...", piece, fabric, colour, style, description? }
// Returns: { imageUrl, label, method: "pollinations" | "cloudflare-img2img" | "pollinations-text-fallback", usedPhoto, note? }

import { dreamPrompt, photoPrompt, pollinationsUrl, RENDER_LABEL, type DreamAnswers } from '../shared/render.js';
import { env, rateLimited, readBody, sendJson, type Req, type Res } from './_lib.js';

const CF_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

interface Body {
  mode?: 'dream' | 'photo';
  answers?: DreamAnswers;
  image?: string;
  piece?: string;
  fabric?: string;
  colour?: string;
  style?: string;
  description?: string;
}

async function cloudflareImg2Img(prompt: string, dataUrl: string): Promise<string> {
  const account = env('CF_ACCOUNT_ID')!;
  const token = env('CF_API_TOKEN')!;
  const b64 = dataUrl.split(',')[1] ?? '';
  const bytes = Array.from(Buffer.from(b64, 'base64'));
  if (bytes.length < 1000) throw new Error('image too small');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CF_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negative_prompt: 'blurry, distorted, extra legs, text, watermark',
      image: bytes,
      strength: 0.55,
      num_steps: 20,
      guidance: 7.5,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:image/png;base64,${buf.toString('base64')}`;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  if (rateLimited(req, 12)) return sendJson(res, 429, { error: 'Too many previews, try again in a minute.' });
  let body: Body;
  try {
    body = await readBody<Body>(req);
  } catch {
    return sendJson(res, 400, { error: 'Bad JSON or image too large' });
  }

  if (body.mode === 'dream') {
    if (!body.answers) return sendJson(res, 400, { error: 'answers required' });
    const prompt = dreamPrompt(body.answers);
    return sendJson(res, 200, { imageUrl: pollinationsUrl(prompt), label: RENDER_LABEL, method: 'pollinations', usedPhoto: false, prompt });
  }

  if (body.mode === 'photo') {
    const prompt = photoPrompt({
      piece: body.piece ?? '',
      fabric: body.fabric ?? '',
      colour: body.colour ?? '',
      style: body.style ?? '',
      description: body.description,
    });
    const hasCf = Boolean(env('CF_ACCOUNT_ID') && env('CF_API_TOKEN'));
    if (hasCf && body.image?.startsWith('data:image/')) {
      try {
        const imageUrl = await cloudflareImg2Img(prompt, body.image);
        return sendJson(res, 200, { imageUrl, label: RENDER_LABEL, method: 'cloudflare-img2img', usedPhoto: true, prompt });
      } catch (e) {
        console.error('render: cloudflare failed', (e as Error).message);
      }
    }
    return sendJson(res, 200, {
      imageUrl: pollinationsUrl(prompt),
      label: RENDER_LABEL,
      method: 'pollinations-text-fallback',
      usedPhoto: false,
      note: 'Made from your description, not your photo. Photo-based previews switch on when the shop connects its image service.',
      prompt,
    });
  }

  return sendJson(res, 400, { error: 'mode must be "dream" or "photo"' });
}
