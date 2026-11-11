/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
// The old Stitch chat frame (live build of 2026-05), restored in v2.1: sticky header with the CR-7 avatar and the
// Voice On/Off toggle, lime tab pills, the trial bar with the Subscribe button, the footer and the watermark.
// Markup and class names are lifted from the old bundle; styles live in ./old-chat.css, scoped under .oc.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import './old-chat.css';
import avatar from './stitch-avatar.png';
import { OldFooter } from '../components/Footer';
import { trialDaysLeft } from '../lib/format';

export const SUBSCRIBE_EMAIL = 'forcebuildyou@gmail.com';

export interface Pill {
  to: string;
  label: string;
  end?: boolean;
}

/** `display: contents` keeps the .oc scope without adding a box, so the sticky header still sticks to the page. */
export function Oc({ children }: { children: ReactNode }) {
  return (
    <div className="oc" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

export function OldHeader(props: { voiceOn: boolean; voiceSupported: boolean; onToggleVoice: () => void; speaking: boolean; pills: Pill[] }) {
  const { voiceOn, speaking } = props;
  return (
    <Oc>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="sticky top-0 z-50 bg-[#0a0603]/90 backdrop-blur border-b border-[#1f1a14] safe-top">
        <div className="max-w-[1280px] mx-auto px-4 h-[56px] md:h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={avatar} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border border-[#2a2a2a]" />
            <div className="leading-none">
              <div className="font-black tracking-tight text-[14px] md:text-[16px]">
                Stitch Voice Chat <span style={{ color: '#7b7b7b' }}>by</span> CreativeFactory.studio
              </div>
              <div className="text-[10px] text-[#8a847d] -mt-[2px]">BuildYou • Model CR-7 • Toronto 2026</div>
            </div>
            <div className="hidden md:flex items-center gap-2 ml-6" aria-hidden="true">
              <div className={`px-2 py-1 rounded-full text-[10px] border ${speaking ? 'border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10' : 'border-[#222] text-[#666]'}`}>
                {speaking ? 'SPEAKING •' : 'STANDBY'}{' '}
                <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${speaking ? 'bg-[#00FF41] speaking-dot' : 'bg-[#444]'}`} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {props.voiceSupported && (
              <button
                type="button"
                onClick={props.onToggleVoice}
                aria-pressed={voiceOn}
                aria-label="Read Stitch's replies aloud"
                title={voiceOn ? 'Voice On - click to mute' : 'Voice Off - click to enable'}
                className={`cursor-pointer px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all ${voiceOn ? 'bg-[#00FF41] text-black border-[#00FF41] shadow-[0_0_12px_rgba(0,255,65,0.5)]' : 'bg-[#1a1a1a] text-[#888] border-[#2a2a2a]'}`}
              >
                <span aria-hidden="true">{voiceOn ? '🔊' : '🔇'}</span> {voiceOn ? 'Voice On' : 'Voice Off'}
              </button>
            )}
          </div>
        </div>
        <nav aria-label="Shop sections" className="flex overflow-x-auto gap-1.5 px-3 pb-2.5 no-scrollbar">
          {props.pills.map((p) => (
            <NavLink
              key={p.to}
              to={p.to}
              end={p.end}
              className={({ isActive }) =>
                `cursor-pointer whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border ${isActive ? 'bg-[#c6ff00] text-black border-[#c6ff00]' : 'bg-[#151515] text-[#aaa] border-[#222]'}`
              }
            >
              {p.label}
            </NavLink>
          ))}
        </nav>
      </header>
    </Oc>
  );
}

/** Toasts: visual only (aria-hidden); the same text goes to the screen-reader announcer by the caller. */
export function Toasts({ items }: { items: string[] }) {
  return (
    <Oc>
      <div className="fixed bottom-[20px] left-1/2 -translate-x-1/2 z-[90] flex flex-col gap-2 items-center pointer-events-none" aria-hidden="true">
        {items.map((t, i) => (
          <div key={i} className="px-4 py-2 rounded-full bg-[#f5f5f0] text-black text-[12px] font-bold shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-[#00FF41]/30">
            {t}
          </div>
        ))}
      </div>
    </Oc>
  );
}

export function Watermark() {
  return (
    <Oc>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-30deg] opacity-[0.04] text-[42px] md:text-[72px] font-black tracking-widest text-[#f5f5f0] whitespace-nowrap">
          {'>y| BuildYou TORONTO 2026'}
        </div>
      </div>
    </Oc>
  );
}

/**
 * Trial bar + Subscribe button, same look as the old overlay (#sd-sub-banner / #sd-sub-fab).
 * Honest version: no payment is taken in the app and nothing unlocks itself. The panel says how to pay
 * and that Yules switches the plan on by hand. It never blocks the client's chat (the old one did on first visit).
 */
export function TrialBar({ trialStartedAt, plan, onCopied }: { trialStartedAt: string; plan: string; onCopied: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const left = trialDaysLeft(trialStartedAt);
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else opener.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const text =
    plan === 'active' ? 'Subscribed — thank you.' : left > 0 ? `Free trial: ${left} day${left === 1 ? '' : 's'} left — Subscribe $29/mo` : 'Free trial ended — Subscribe $29/mo';
  const show = (e: React.MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    setOpen(true);
  };
  return (
    <Oc>
      <button type="button" id="sd-sub-banner" style={{ textAlign: 'left' }} onClick={show} aria-label={`${text}. Shop owners: how to subscribe`}>
        {text}
      </button>
      <button type="button" id="sd-sub-fab" onClick={show}>
        Subscribe — $29/mo
      </button>
      {open && (
        <div id="sd-sub-gate" style={{ display: 'flex' }} onClick={() => setOpen(false)}>
          <div className="sd-card" style={{ position: 'relative' }} role="dialog" aria-modal="true" aria-labelledby="sd-gate-h" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="sd-close" aria-label="Close" onClick={() => setOpen(false)}>
              &times;
            </button>
            <h2 id="sd-gate-h">Stitch Voice Chat is $29/month</h2>
            <p>
              For shop owners. Free for 14 days, then <b style={{ color: '#fff' }}>$29 CAD a month</b> per shop, plus tax. No card needed for the trial.
            </p>
            <p>
              Online payment is not switched on yet, so nothing is charged in this app and this button does not unlock anything by itself.
            </p>
            <div className="sd-row">
              <span>
                e-Transfer $29 CAD
                <br />
                <span style={{ color: '#a8a39c' }}>
                  to {SUBSCRIBE_EMAIL}
                  <br />
                  message: your shop name
                </span>
              </span>
              <button
                type="button"
                className="sd-btn2"
                style={{ width: 'auto', margin: 0, padding: '8px 12px' }}
                onClick={() => {
                  void navigator.clipboard?.writeText(SUBSCRIBE_EMAIL).then(
                    () => onCopied('✓ Copied! e-Transfer email'),
                    () => onCopied(`Email: ${SUBSCRIBE_EMAIL}`),
                  );
                }}
              >
                Copy email
              </button>
            </div>
            <p className="sd-fine">
              After your e-Transfer arrives, Yules confirms it and switches your shop's plan on by hand. Questions:{' '}
              {SUBSCRIBE_EMAIL}.
            </p>
            <button type="button" className="sd-btn2" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </Oc>
  );
}

export function OldFooterBlock() {
  return (
    <Oc>
      <OldFooter />
    </Oc>
  );
}
