/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { store, isDemo } from '../../data';
import type { Shop, StaffSession } from '../../data/models';
import { ErrorNote, Field, Layout, Loading } from '../../components/Layout';
import { PageHeading } from '../../lib/a11y';
import { slugify, trialDaysLeft } from '../../lib/format';
import Dashboard from './Dashboard';
import JobsBoard from './JobsBoard';
import Clients from './Clients';
import ClientFile from './ClientFile';
import QuoteBuilder from './QuoteBuilder';
import Suppliers from './Suppliers';
import Swatches from './Swatches';
import TeachStitch from './TeachStitch';
import Settings from './Settings';
import Billing from './Billing';

interface ShopCtx {
  shop: Shop;
  setShop: (s: Shop) => void;
  session: StaffSession;
}
const Ctx = createContext<ShopCtx | null>(null);
export const useShop = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useShop outside shop');
  return c;
};

export default function ShopApp() {
  const [session, setSession] = useState<StaffSession | null | undefined>(undefined);
  const [shop, setShop] = useState<Shop | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await store.getSession();
      setSession(s);
      setShop(s ? await store.myShop() : null);
    } catch (e) {
      setError((e as Error).message);
      setShop(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return store.onAuthChange(() => void refresh());
  }, [refresh]);

  if (session === undefined || (session && shop === undefined))
    return (
      <Layout>
        <Loading what="Opening the shop desk" />
      </Layout>
    );
  if (!session) return <Login />;
  if (!shop) return <CreateShop onDone={setShop} error={error} />;

  const links: [string, string][] = [
    ['', 'Dashboard'],
    ['jobs', 'Jobs'],
    ['clients', 'Clients'],
    ['suppliers', 'Suppliers'],
    ['swatches', 'Swatches'],
    ['teach', 'Teach Stitch'],
    ['settings', 'Settings'],
    ['billing', 'Billing'],
  ];
  const days = trialDaysLeft(shop.trialStartedAt);

  return (
    <Ctx.Provider value={{ shop, setShop, session }}>
      <Layout
        title={`${shop.name.toUpperCase()} · DESK`}
        home="/shop"
        nav={
          <nav aria-label="Shop desk" className="wrap no-print" style={{ paddingBottom: 0 }}>
            <ul className="tabs">
              {links.map(([path, label]) => (
                <li key={path}>
                  <NavLink end={!path} to={path ? `/shop/${path}` : '/shop'}>
                    {label}
                  </NavLink>
                </li>
              ))}
              <li>
                <button onClick={() => store.signOut()}>Sign out</button>
              </li>
            </ul>
          </nav>
        }
      >
        {shop.plan === 'trial' && (
          <p className="hint no-print">
            Free trial: {days} day{days === 1 ? '' : 's'} left. Then $29 CAD a month. Signed in as {session.email}
            {isDemo ? ' (demo)' : ''}.
          </p>
        )}
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<JobsBoard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientFile />} />
          <Route path="quote/:jobId" element={<QuoteBuilder />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="swatches" element={<Swatches />} />
          <Route path="teach" element={<TeachStitch />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
        </Routes>
      </Layout>
    </Ctx.Provider>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await store.signIn(email.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <PageHeading>Staff sign in</PageHeading>
      {isDemo ? (
        <section className="card">
          <p>Demo mode has one pretend staff account. No email needed.</p>
          <button className="primary" onClick={() => store.signIn('')}>
            Enter the demo desk
          </button>
        </section>
      ) : sent ? (
        <p role="status" className="card">
          Check your email for a sign-in link from Supabase. Open it on this device. You can close this page.
        </p>
      ) : (
        <form className="card" onSubmit={submit}>
          <p>We email you a one-time sign-in link. No password.</p>
          <Field id="login-email" label="Work email">
            <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <button className="primary" type="submit" disabled={busy || !email.includes('@')}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </Layout>
  );
}

function CreateShop({ onDone, error: initialError }: { onDone: (s: Shop) => void; error: string | null }) {
  // "Set Up + Activate" on the client chat page passes the shop name it was given.
  const preset = sessionStorage.getItem('stitch_new_shop_name') ?? '';
  const [name, setName] = useState(preset);
  const [slug, setSlug] = useState(slugify(preset));
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await store.createShop(name.trim(), slug || slugify(name)));
    } catch (err) {
      setError((err as Error).message.includes('duplicate') ? 'That web address is taken. Try another.' : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <PageHeading>Set up your shop</PageHeading>
      <form className="card" onSubmit={submit}>
        <p>This starts your 14-day free trial. If a colleague already set up your shop, ask them to add your email in Settings instead.</p>
        <Field id="cs-name" label="Shop name">
          <input id="cs-name" required value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} />
        </Field>
        <Field id="cs-slug" label="Web address for clients" hint={`Clients will use ${window.location.origin}/s/${slug || 'your-shop'}`}>
          <input id="cs-slug" required pattern="[a-z0-9][a-z0-9-]{1,40}" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
        </Field>
        <ErrorNote error={error} />
        <button className="primary" type="submit" disabled={busy || !name.trim() || slug.length < 2}>
          Create my shop
        </button>
      </form>
    </Layout>
  );
}
