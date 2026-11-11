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
