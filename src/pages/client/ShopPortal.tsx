/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import { estimate, type Estimate, type FoamChoice } from '../../../shared/estimator';
import { EMPTY_SHEET, type ChatTurn, type JobSheet } from '../../../shared/types';
import { store } from '../../data';
import type { PublicShopData, RenderRef } from '../../data/models';
import { ErrorNote, Layout, Loading } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { isDemo } from '../../data';
import { loadVoices, speechSupported, stopSpeaking } from '../../lib/speech';
import { OldFooterBlock, OldHeader, Toasts, TrialBar, Watermark, type Pill } from '../../old/OldShell';
import StatusPanel from './StatusPanel';
import ChatPanel from './ChatPanel';
import EstimatePanel from './EstimatePanel';
import PhotoPanel from './PhotoPanel';
import DreamPanel from './DreamPanel';
import SwatchPanel from './SwatchPanel';
import BookPanel from './BookPanel';

export type Turn = ChatTurn & { offline?: boolean };

interface PortalState {
  history: Turn[];
  sheet: JobSheet;
  renders: RenderRef[];
  beforePhoto: string | null;
  swatchId: string | null;
  foam: FoamChoice;
  patterned: boolean;
  /** The private job link token from this device's last booking, for the "My job" pill. */
  jobToken: string | null;
}

const START: PortalState = { history: [], sheet: EMPTY_SHEET, renders: [], beforePhoto: null, swatchId: null, foam: 'hr', patterned: false, jobToken: null };

export interface Health {
  ai: boolean;
  photoRender: boolean;
  database: boolean;
}

interface Ctx extends PortalState {
  slug: string;
  data: PublicShopData;
  set: (patch: Partial<PortalState> | ((s: PortalState) => Partial<PortalState>)) => void;
  reset: () => void;
  est: Estimate | null;
  /** Old voice setting: read Stitch's replies aloud. On by default, like the old app; stored as "stitch_voice". */
  voiceOn: boolean;
  speaking: boolean;
  setSpeaking: (b: boolean) => void;
  /** Old-style toast, also announced to screen readers. */
  toast: (msg: string) => void;
  /** What the server has switched on (/api/health). null = unknown (no server, e.g. the single-file preview). */
  health: Health | null;
}

const PortalCtx = createContext<Ctx | null>(null);
export const usePortal = () => {
  const c = useContext(PortalCtx);
  if (!c) throw new Error('usePortal outside portal');
  return c;
};

const storageKey = (slug: string) => `stitch_portal_${slug}`;

function loadState(slug: string): PortalState {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (raw) return { ...START, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return START;
}

export default function ShopPortal() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<PublicShopData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PortalState>(() => loadState(slug));
  const [voiceOn, setVoiceOn] = useState(() => speechSupported() && localStorage.getItem('stitch_voice') !== 'false');
  const [speaking, setSpeaking] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const announce = useAnnounce();
  const toast = useCallback(
    (msg: string) => {
      setToasts((t) => [...t, msg]);
      setTimeout(() => setToasts((t) => t.slice(1)), 2800);
      announce(msg.replace(/^[✓•]\s*/, ''));
    },
    [announce],
  );

  useEffect(() => {
    loadVoices();
    fetch('/api/health', { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => h && typeof h.ai === 'boolean' && setHealth({ ai: h.ai, photoRender: Boolean(h.photoRender), database: Boolean(h.database) }))
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    localStorage.setItem('stitch_voice', String(voiceOn));
    if (!voiceOn) {
      stopSpeaking();
      setSpeaking(false);
    }
  }, [voiceOn]);

  useEffect(() => {
    store.getPublicShop(slug).then(
      (d) => (d ? setData(d) : setError('We could not find that shop. Check the link.')),
      (e) => setError(String(e.message ?? e)),
    );
  }, [slug]);

  useEffect(() => {
    // Keep the conversation across reloads. Photos are left out to stay under browser storage limits.
    try {
      const { beforePhoto: _b, ...rest } = state;
      localStorage.setItem(storageKey(slug), JSON.stringify({ ...rest, renders: rest.renders.filter((r) => !r.url.startsWith('data:')) }));
    } catch {
      /* storage full: memory still works for this visit */
    }
  }, [state, slug]);

  const est = useMemo(() => {
    if (!data || !state.sheet.width || !state.sheet.depth) return null;
    const swatch = data.swatches.find((s) => s.id === state.swatchId);
    return estimate(
      {
        pieceId: state.sheet.piece ?? 'sofa',
        width: state.sheet.width,
        depth: state.sheet.depth,
        units: state.sheet.units ?? 'in',
        foam: state.foam,
        patterned: state.patterned,
        fabricPerYd: swatch?.pricePerYd ?? null,
      },
      data.shop.rates,
    );
  }, [data, state.sheet, state.foam, state.patterned, state.swatchId]);

  if (error)
    return (
      <Layout>
        <PageHeading>Shop not found</PageHeading>
        <ErrorNote error={error} />
      </Layout>
    );
  if (!data)
    return (
      <Layout>
        <Loading what="Opening the shop" />
      </Layout>
    );

  const ctx: Ctx = {
    ...state,
    slug,
    data,
    est,
    set: (patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })),
    reset: () => setState((s) => ({ ...START, jobToken: s.jobToken })),
    voiceOn,
    speaking,
    setSpeaking,
    toast,
    health,
  };

  const base = `/s/${slug}`;
  // The v2 extras as old-style pills. They never change the chat screen (Reception).
  const pills: Pill[] = [
    { to: base, label: 'Reception', end: true },
    { to: `${base}/estimate`, label: 'Estimate' },
    { to: `${base}/photo`, label: 'Photo preview' },
    { to: `${base}/dream`, label: 'Dream build' },
    { to: `${base}/swatches`, label: 'Fabrics' },
    { to: `${base}/book`, label: 'Book' },
    { to: `${base}/status`, label: 'My job' },
  ];

  return (
    <PortalCtx.Provider value={ctx}>
      <div className="portal-old min-h-screen" style={{ background: '#120c08', color: '#f5f5f0', minHeight: '100vh' }}>
        <OldHeader voiceOn={voiceOn} voiceSupported={speechSupported()} onToggleVoice={() => setVoiceOn((v) => !v)} speaking={speaking} pills={pills} />
        <Routes>
          <Route index element={<ChatPanel />} />
          <Route path="*" element={<V2Main />} />
        </Routes>
        <OldFooterBlock />
        <div style={{ height: 56 }} aria-hidden="true" />
        <TrialBar trialStartedAt={data.shop.trialStartedAt} plan={data.shop.plan} onCopied={toast} />
        <Toasts items={toasts} />
        <Watermark />
      </div>
    </PortalCtx.Provider>
  );
}

/** The v2 extras keep their v2 look, inside the old page frame. */
function V2Main() {
  return (
    <main id="main" tabIndex={-1} className="wrap v2-in-old" style={{ paddingBottom: 24, position: 'relative', zIndex: 1 }}>
      {isDemo && <p className="demo-banner">Demo mode: no database is connected, so everything is saved only on this phone (in this browser).</p>}
      <Routes>
        <Route path="estimate" element={<EstimatePanel />} />
        <Route path="photo" element={<PhotoPanel />} />
        <Route path="dream" element={<DreamPanel />} />
        <Route path="swatches" element={<SwatchPanel />} />
        <Route path="book" element={<BookPanel />} />
        <Route path="status" element={<StatusPanel />} />
      </Routes>
    </main>
  );
}
