import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { extractJobSheet, lastAskedDimension, missingFields } from '../../../shared/jobsheet';
import { askStitch } from '../../lib/api';
import { PageHeading } from '../../lib/a11y';
import { listenOnce, recognitionSupported, speak, speechSupported, stopSpeaking } from '../../lib/speech';
import { JobSheetView } from '../../components/JobSheetView';
import { usePortal, type Turn } from './ShopPortal';

const SPEAK_KEY = 'stitch_speak_replies';

export default function ChatPanel() {
  const p = usePortal();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [speakReplies, setSpeakReplies] = useState(() => localStorage.getItem(SPEAK_KEY) === '1');
  const [latest, setLatest] = useState('');
  const logRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [p.history.length, busy]);

  useEffect(() => () => stopSpeaking(), []);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const lastStitch = [...p.history].reverse().find((t) => t.role === 'stitch' && !t.offline);
    const sheet = extractJobSheet(clean, p.sheet, lastAskedDimension(lastStitch?.text));
    const history: Turn[] = [...p.history, { role: 'user', text: clean, at: new Date().toISOString() }];
    p.set({ history, sheet });
    setInput('');
    setBusy(true);
    const res = await askStitch({
      history,
      sheet,
      shopSlug: p.slug,
      shop: {
        name: p.data.shop.name,
        city: p.data.shop.city,
        hours: p.data.shop.hours,
        etransferEmail: p.data.shop.etransferEmail,
        faq: p.data.faq,
      },
    });
    setBusy(false);
    p.set((s) => ({
      history: [...s.history, { role: 'stitch', text: res.reply, at: new Date().toISOString(), offline: res.offline }],
      sheet: res.sheet ? { ...res.sheet, notes: Array.from(new Set([...s.sheet.notes, ...res.sheet.notes])).slice(-8) } : s.sheet,
    }));
    setLatest(res.reply);
    if (speakReplies) speak(res.reply);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function mic() {
    if (listening) return;
    stopSpeaking();
    setVoiceNote('Listening. Speak now.');
    setListening(true);
    const rec = listenOnce(
      (t) => {
        setVoiceNote(`Heard: ${t}`);
        void send(t);
      },
      (err) => {
        setListening(false);
        if (err) setVoiceNote(err);
      },
    );
    if (!rec) {
      setListening(false);
      setVoiceNote('Voice input is not supported in this browser. Typing works everywhere.');
    }
  }

  const missing = missingFields(p.sheet);
  const empty = p.history.length === 0;

  return (
    <>
      <PageHeading>Chat with Stitch</PageHeading>
      <p className="muted">
        Stitch is the shop's copper robot, model CR-7. Tell Stitch about your piece by typing or with the microphone. It
        remembers the whole conversation.
      </p>

      <section className="card" aria-labelledby="conv-h">
        <h2 id="conv-h" className="sr-only">
          Conversation
        </h2>
        {empty && <p className="muted">Try: "I have a sofa, 84 inches wide and 36 deep. Can you redo it in green velvet?"</p>}
        <ol className="chat-log" ref={logRef} role="log" aria-label="Conversation with Stitch" aria-live="off">
          {p.history.map((t, i) => (
            <li key={i} className={`msg ${t.role}${t.offline ? ' offline' : ''}`}>
              <span className="who">{t.role === 'user' ? 'You' : t.offline ? 'Shop notice' : 'Stitch'}</span>
              {t.text}
            </li>
          ))}
          {busy && (
            <li className="msg stitch" aria-hidden="true">
              <span className="who">Stitch</span>…
            </li>
          )}
        </ol>
        {/* Only the newest reply is announced, so the screen reader does not reread the log. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {busy ? 'Stitch is thinking.' : latest ? `Stitch says: ${latest}` : ''}
        </div>

        <form className="composer" onSubmit={onSubmit} aria-label="Send a message to Stitch">
          <div style={{ flex: 1 }}>
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Type your message"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="primary" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
        <div className="row" style={{ marginTop: 8 }}>
          {recognitionSupported() && (
            <button type="button" onClick={mic} aria-pressed={listening} disabled={busy}>
              {listening ? 'Listening…' : 'Speak instead'}
            </button>
          )}
          {speechSupported() && (
            <label className="check">
              <input
                type="checkbox"
                checked={speakReplies}
                onChange={(e) => {
                  setSpeakReplies(e.target.checked);
                  localStorage.setItem(SPEAK_KEY, e.target.checked ? '1' : '0');
                  if (!e.target.checked) stopSpeaking();
                }}
              />
              Read Stitch's replies aloud
            </label>
          )}
          {!empty && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Start a new conversation? This clears the chat and job sheet on this device.')) {
                  p.reset();
                  setLatest('');
                }
              }}
            >
              Start over
            </button>
          )}
        </div>
        {voiceNote && (
          <p className="hint" role="status">
            {voiceNote}
          </p>
        )}
      </section>

      <JobSheetView sheet={p.sheet} />
      {missing.length === 0 || (p.sheet.width && p.sheet.depth) ? (
        <p className="row">
          <Link className="btn" to={`/s/${p.slug}/estimate`}>
            See my estimate
          </Link>
          <Link className="btn primary" to={`/s/${p.slug}/book`}>
            Book this
          </Link>
        </p>
      ) : null}
    </>
  );
}
