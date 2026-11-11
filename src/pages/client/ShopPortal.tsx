import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useParams } from 'react-router-dom';
import { estimate, type Estimate, type FoamChoice } from '../../../shared/estimator';
import { EMPTY_SHEET, type ChatTurn, type JobSheet } from '../../../shared/types';
import { store } from '../../data';
import type { PublicShopData, RenderRef } from '../../data/models';
import { ErrorNote, Layout, Loading } from '../../components/Layout';
import { PageHeading } from '../../lib/a11y';
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
}

const START: PortalState = { history: [], sheet: EMPTY_SHEET, renders: [], beforePhoto: null, swatchId: null, foam: 'hr', patterned: false };

interface Ctx extends PortalState {
  slug: string;
  data: PublicShopData;
  set: (patch: Partial<PortalState> | ((s: PortalState) => Partial<PortalState>)) => void;
  reset: () => void;
  est: Estimate | null;
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
    reset: () => setState(START),
  };

  const base = `/s/${slug}`;
  const tabs = [
    ['', 'Chat'],
    ['estimate', 'Estimate'],
    ['photo', 'Photo preview'],
    ['dream', 'Dream build'],
    ['swatches', 'Swatches'],
    ['book', 'Book this'],
  ];

  return (
    <PortalCtx.Provider value={ctx}>
      <Layout
        title={data.shop.name.toUpperCase()}
        home={base}
        nav={
          <nav aria-label="Shop sections" className="wrap no-print" style={{ paddingBottom: 0 }}>
            <ul className="tabs">
              {tabs.map(([path, label]) => (
                <li key={path}>
                  <NavLink end to={path ? `${base}/${path}` : base}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        <Routes>
          <Route index element={<ChatPanel />} />
          <Route path="estimate" element={<EstimatePanel />} />
          <Route path="photo" element={<PhotoPanel />} />
          <Route path="dream" element={<DreamPanel />} />
          <Route path="swatches" element={<SwatchPanel />} />
          <Route path="book" element={<BookPanel />} />
        </Routes>
      </Layout>
    </PortalCtx.Provider>
  );
}
