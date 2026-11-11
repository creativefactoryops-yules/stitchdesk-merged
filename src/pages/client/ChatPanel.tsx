/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// Reception: the OLD Stitch chat screen (live build of 2026-05), restored markup and classes, with the v2 brain
// underneath: full history to /api/chat, the self-filling job sheet, and the intro only once (the greeting bubble).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractJobSheet, lastAskedDimension } from '../../../shared/jobsheet';
import { askStitch } from '../../lib/api';
import { isDemo } from '../../data';
import { listenLive, recognitionSupported, speakAsStitch, stopSpeaking } from '../../lib/speech';
import { Oc } from '../../old/OldShell';
import hero from '../../old/stitch-hero.webp';
import hud from '../../old/stitch-hud.webp';
import { usePortal, type Turn } from './ShopPortal';

/** The old app's opening line, word for word. It is turn one, so Stitch never introduces itself again. */
export const GREETING =
  "Hey, it's Stitch. What type of furniture are we looking at — sofa, chair, commercial, headboard, auto, or marine? I'm here at the shop, spool's running.";

const CHIPS: [string, string][] = [
  ['Sofa', 'I have a sofa'],
  ['Chair', 'I have a chair'],
  ['Ottoman', 'I have an ottoman'],
  ['Headboard', 'I have a headboard'],
  ['Commercial', "It's a commercial job: seating for a business"],
  ['Marine', "It's marine: boat cushions"],
];

const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now');

export default function ChatPanel() {
  const p = usePortal();
  const nav = useNavigate();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState('');
  const [shopName, setShopName] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const greeted = useRef(false);

  // What the screen shows: the greeting, then the stored conversation.
  const shown: Turn[] = p.history.length ? p.history : [{ role: 'stitch', text: GREETING, at: '' }];

  useEffect(() => {
    endRef.current?.parentElement?.scrollTo({ top: endRef.current.parentElement.scrollHeight, behavior: 'smooth' });
  }, [p.history.length, busy]);

  // Old behaviour: Stitch says hello out loud on a fresh visit when Voice is on.
  useEffect(() => {
    if (greeted.current || p.history.length || !p.voiceOn) return;
    greeted.current = true;
    const t = setTimeout(() => say(GREETING, false), 900);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopSpeaking(), []);

  /** Speak a reply when Voice is on. Screen-reader users hear the reply once: from the voice when it is on,
   *  from the live region when it is off or when the phone cannot speak. */
  function say(text: string, announceIfSilent = true) {
    if (p.voiceOn) {
      p.setSpeaking(true);
      const started = speakAsStitch(text, (ok) => {
        p.setSpeaking(false);
        if (!ok && announceIfSilent) setLive(`Stitch says: ${text}`);
      });
      if (started) {
        setLive('');
        return;
      }
      p.setSpeaking(false);
    }
    if (announceIfSilent) setLive(`Stitch says: ${text}`);
  }

  async function send(text?: string) {
    const clean = (text ?? input).trim();
    if (!clean || busy) return;
    stopSpeaking();
    const now = new Date().toISOString();
    // The greeting becomes turn one, so the server knows Stitch already introduced itself.
    const before: Turn[] = p.history.length ? p.history : [{ role: 'stitch', text: GREETING, at: now }];
    const lastStitch = [...before].reverse().find((t) => t.role === 'stitch' && !t.offline);
    const sheet = extractJobSheet(clean, p.sheet, lastAskedDimension(lastStitch?.text));
    const history: Turn[] = [...before, { role: 'user', text: clean, at: now }];
    p.set({ history, sheet });
    setInput('');
    setBusy(true);
    setLive('Stitch is thinking.');
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
    say(res.reply);
  }

  function listen() {
    if (!recognitionSupported()) return p.toast("• Voice input isn't supported in this browser — type instead");
    if (listening) return;
    stopSpeaking();
    p.setSpeaking(false);
    listenLive({
      onStart: () => {
        setListening(true);
        p.toast('🎙️ Listening… speak now');
      },
      onInterim: (t) => setInput(t),
      onFinal: (t) => setTimeout(() => void send(t), 300),
      onEnd: (err) => {
        setListening(false);
        if (err) p.toast(`• ${err}`);
      },
    });
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      p.toast(`✓ Copied! ${what}`);
    } catch {
      p.toast(`✓ ${what}: ${text.slice(0, 40)}`);
    }
  }

  const shop = p.data.shop;
  const chatLink = `${window.location.origin}${import.meta.env.VITE_HASH_ROUTER === '1' ? window.location.pathname + '#' : ''}/s/${p.slug}`;

  return (
    <Oc>
      <div className="max-w-[1280px] mx-auto px-3 md:px-6 py-4 md:py-6 grid grid-cols-12 gap-4">
        <main id="main" tabIndex={-1} className="col-span-12 md:col-span-9 space-y-4" style={{ position: 'relative', zIndex: 1 }}>
          <div className="card p-4 md:p-5">
            <div className="flex gap-4 items-start">
              <img
                src={hero}
                alt="Stitch, a copper robot, model CR-7"
                className="w-[96px] md:w-[200px] h-auto object-contain rounded-[18px] border border-[#1e1e1e] bg-[#0a0a0a]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-[20px] md:text-[28px] font-black leading-none tracking-tight">Hey, it's Stitch.</h1>
                  <span className={`md:hidden inline-flex px-2 py-0.5 rounded-full text-[10px] border ${p.speaking ? 'border-[#00FF41] text-[#00FF41]' : 'border-[#222] text-[#8a847d]'}`} aria-hidden="true">
                    {p.speaking ? 'SPEAKING •' : 'STANDBY'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] md:text-[13px] text-[#b8b3ad] max-w-[56ch]">
                  Rugged copper robot CR-7 • upholstery front desk at <b className="text-[#f5f5f0]">{shop.name}</b>
                  {shop.city ? `, ${shop.city}` : ''}. Tell me about your piece and I keep notes as we go: size, fabric, what it needs. Talk or type. I
                  give a rough estimate; the shop confirms the price after seeing it. Heirlooms welcome — grandma's old loveseat gets real TLC
                  here. Ask me anything.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick picks">
                  {CHIPS.map(([label, msg]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void send(msg)}
                      className="cursor-pointer px-3 py-1.5 rounded-full bg-[#1d1d1d] border border-[#2a2a2a] text-[11px] font-bold hover:bg-[#242424]"
                      title={`Ask about ${label}`}
                      aria-label={`Quick pick: ${label}`}
                    >
                      {label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="mt-4 card bg-[#0a0a0a] !rounded-[18px] p-3 h-[360px] md:h-[420px] overflow-auto"
              role="log"
              aria-live="off"
              aria-label="Conversation with Stitch"
              tabIndex={0}
            >
              {shown.map((t, i) => (
                <div key={i} className={`mb-3 flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    data-msg={t.offline ? 'notice' : t.role}
                    className={`max-w-[88%] rounded-[16px] px-3 py-2 text-[12px] md:text-[13px] leading-[1.4] whitespace-pre-wrap ${t.role === 'user' ? 'bg-[#f5f5f0] text-black' : 'bg-[#151515] border border-[#232323] text-[#e8e5e0]'}`}
                  >
                    <div className="opacity-60 text-[10px] mb-1">
                      {t.role === 'user' ? 'You' : t.offline ? 'Shop notice' : 'Stitch • CR-7'} • {i === 0 && t.role === 'stitch' && t.text === GREETING ? 'Now' : hhmm(t.at)}{' '}
                      {t.role === 'stitch' && p.speaking && i === shown.length - 1 ? '• SPEAKING •' : ''}
                    </div>
                    {t.text}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="mb-3 flex justify-start" aria-hidden="true">
                  <div className="max-w-[88%] rounded-[16px] px-3 py-2 text-[12px] md:text-[13px] leading-[1.4] bg-[#151515] border border-[#232323] text-[#e8e5e0]">
                    <div className="opacity-60 text-[10px] mb-1">Stitch • CR-7 • …</div>
                    <span className="speaking-dot inline-block">…</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {/* Only the newest reply is announced, and only when the voice is not already reading it. */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {live}
            </div>

            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label htmlFor="chat-input" className="sr-only">
                Your message
              </label>
              <input
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask: sofa fabric for a home with cats? how many yards? book a drop-off?"
                autoComplete="off"
                className="flex-1 min-w-[180px] bg-[#0a0a0a] border border-[#222] rounded-full px-4 py-3 text-[13px] outline-none focus:border-[#c6ff00]"
                title="Chat input"
              />
              <button type="submit" disabled={busy} className="cursor-pointer px-5 py-3 rounded-full bg-[#c6ff00] text-black font-black text-[13px] shrink-0" title="Send message" aria-label="Send">
                SEND
              </button>
              <button
                type="button"
                onClick={listen}
                aria-pressed={listening}
                className={`cursor-pointer px-4 py-3 rounded-full border font-black text-[13px] shrink-0 ${listening ? 'bg-[#00FF41] text-black border-[#00FF41] shadow-[0_0_12px_rgba(0,255,65,0.6)]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#f5f5f0]'}`}
                title="Listen — speech to text"
                aria-label="Listen: talk instead of typing"
              >
                <span aria-hidden="true">🎙️ </span>
                {listening ? 'Listening…' : 'LISTEN'}
              </button>
            </form>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              <button type="button" onClick={() => nav(`/s/${p.slug}/estimate`)} className="cursor-pointer py-2.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[11px] font-bold" title="Open estimator">
                <span aria-hidden="true">📐 </span>Open Estimator
              </button>
              <button type="button" onClick={() => nav(`/s/${p.slug}/swatches`)} className="cursor-pointer py-2.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[11px] font-bold" title="Browse this shop's fabrics and prices">
                <span aria-hidden="true">🧵 </span>Browse Fabrics $
              </button>
              <button type="button" onClick={() => void copy(chatLink, 'link to this chat')} className="cursor-pointer py-2.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[11px] font-bold" title="Copy the link to this chat page" aria-label="Copy link to this chat">
                <span aria-hidden="true">🔗 </span>COPY LINK
              </button>
              <button
                type="button"
                onClick={() => void copy(shop.etransferEmail ?? '', isDemo ? 'deposit e-Transfer email (demo address)' : `${shop.name} deposit e-Transfer email`)}
                className="cursor-pointer py-2.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[11px] font-bold"
                title="Copy the shop's e-Transfer email for deposits"
                aria-label="Copy the shop's e-Transfer email for deposits"
              >
                <span aria-hidden="true">💸 </span>COPY e-Transfer
              </button>
            </div>
            <div className="mt-3 flex gap-2 items-center">
              <label htmlFor="shop-name" className="sr-only">
                Own a shop? Your shop name
              </label>
              <input
                id="shop-name"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="My Shop name to set up"
                className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-full px-3 py-2 text-[11px]"
                title="Shop name"
                autoComplete="organization"
              />
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('stitch_new_shop_name', shopName.trim());
                  if (isDemo) p.toast('• Demo mode — no database, so this opens the demo shop desk');
                  nav('/shop');
                }}
                className="cursor-pointer px-4 py-2 rounded-full bg-[#f5f5f0] text-black text-[11px] font-black"
                title="Set up Stitch for your shop"
              >
                Set Up + Activate
              </button>
              <button type="button" onClick={() => nav('/shop')} className="cursor-pointer px-4 py-2 rounded-full bg-[#c6ff00] text-black text-[11px] font-black" title="Open your shop desk">
                Open Your Shop Desk
              </button>
            </div>
          </div>

          <div className="md:hidden card p-3 !rounded-[18px]">
            <div className="flex gap-2">
              <img src={hud} alt="" className="w-[72px] h-[54px] object-cover rounded-[10px] border border-[#222]" />
              <div className="text-[10px] text-[#8a847d] leading-tight">
                Stitch's notes • Measure width, depth and height with a tape • <span className="lime">$</span> prices are a range the shop confirms •
                Voice On/Off up top • LISTEN uses your browser's mic{isDemo ? ' • Demo: chat is saved on this phone only' : ''}.
              </div>
            </div>
          </div>
        </main>
      </div>
    </Oc>
  );
}
