/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// Browser voice: SpeechRecognition (Chrome/Android/Edge/Safari) and speechSynthesis.
type Rec = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};

export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function listenOnce(onText: (t: string) => void, onEnd: (error?: string) => void): Rec | null {
  const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!C) return null;
  const rec: Rec = new C();
  rec.lang = 'en-CA';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  let error: string | undefined;
  rec.onresult = (e) => {
    const t = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0]?.transcript ?? '').join(' ').trim();
    if (t) onText(t);
  };
  rec.onerror = (e) => {
    error = e?.error === 'not-allowed' ? 'Microphone permission was blocked.' : e?.error === 'no-speech' ? 'I did not hear anything.' : 'Voice input stopped.';
  };
  rec.onend = () => onEnd(error);
  rec.start();
  return rec;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string) {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, '').slice(0, 800));
  u.lang = 'en-CA';
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

// ---- Old Stitch voice (v1 live build), restored in v2.1 ----
// Same settings as the old app: a male-sounding voice when the phone has one, rate 0.95, pitch 0.85.
// Returns false when the browser cannot speak, so the caller can fall back to the screen-reader live region.
let voices: SpeechSynthesisVoice[] = [];
export function loadVoices() {
  if (!speechSupported()) return;
  const k = () => (voices = window.speechSynthesis.getVoices());
  k();
  window.speechSynthesis.onvoiceschanged = k;
  setTimeout(k, 500);
}

export function speakAsStitch(text: string, done: (ok: boolean) => void): boolean {
  if (!speechSupported()) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, '').slice(0, 600));
    const v =
      voices.find((x) => /male|david|alex/i.test(x.name) && !/female/i.test(x.name)) ||
      voices.find((x) => /^en[-_]CA/i.test(x.lang)) ||
      voices[0];
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = 0.85;
    u.volume = 1;
    u.onend = () => done(true);
    u.onerror = (e: any) => done(e?.error === 'interrupted' || e?.error === 'canceled');
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** Old LISTEN button: interim results fill the box, the final result is sent. */
export function listenLive(opts: { onInterim: (t: string) => void; onFinal: (t: string) => void; onStart: () => void; onEnd: (error?: string) => void }): boolean {
  const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!C) return false;
  const rec: Rec = new C();
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.lang = 'en-CA';
  let error: string | undefined;
  (rec as any).onstart = opts.onStart;
  rec.onresult = (e) => {
    const r = e.results[0];
    const t = String(r?.[0]?.transcript ?? '');
    opts.onInterim(t);
    if (r?.isFinal && t.trim()) opts.onFinal(t.trim());
  };
  rec.onerror = (e) => {
    error = e?.error === 'not-allowed' || e?.error === 'service-not-allowed' ? 'Mic blocked — check permissions' : e?.error === 'no-speech' ? 'I did not hear anything — try again' : 'Voice input stopped';
  };
  rec.onend = () => opts.onEnd(error);
  try {
    rec.start();
    return true;
  } catch {
    opts.onEnd('Mic blocked — check permissions');
    return true;
  }
}
