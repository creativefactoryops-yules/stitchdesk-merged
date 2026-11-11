// Prompt building for AI previews. Used by the browser and by /api/render.

export const RENDER_LABEL = 'AI preview, final may vary.';

export interface DreamAnswers {
  piece: string;
  style: string;
  fabric: string;
  colour: string;
  tufting: string;
  legs: string;
  mood: string;
}

const clean = (s: string) => String(s ?? '').replace(/[^\p{L}\p{N}\s,.'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function dreamPrompt(a: DreamAnswers): string {
  const parts = [
    `professional product photo of a custom reupholstered ${clean(a.style)} ${clean(a.piece)}`,
    `upholstered in ${clean(a.colour)} ${clean(a.fabric)}`,
    a.tufting && a.tufting !== 'none' ? `${clean(a.tufting)} tufting` : 'smooth tight upholstery, no tufting',
    a.legs ? `${clean(a.legs)} legs` : '',
    a.mood ? `${clean(a.mood)} interior mood` : '',
    'soft natural light, realistic fabric texture, high detail, full piece in frame',
  ];
  return parts.filter(Boolean).join(', ');
}

export function photoPrompt(opts: { piece: string; fabric: string; colour: string; style: string; description?: string }): string {
  return [
    `the same ${clean(opts.piece) || 'piece of furniture'} reupholstered in ${clean(opts.colour)} ${clean(opts.fabric)}`,
    opts.style ? `${clean(opts.style)} style` : '',
    opts.description ? clean(opts.description) : '',
    'same shape and frame, realistic fabric texture, professional upholstery, natural light',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Pollinations: free text-to-image, no key. The browser loads the image straight from this URL. */
export function pollinationsUrl(prompt: string, seed = Math.floor(Math.random() * 1e6), size = 768): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${size}&height=${size}&nologo=true&seed=${seed}`;
}
