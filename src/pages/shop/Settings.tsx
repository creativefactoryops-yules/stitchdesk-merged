import { useState, type FormEvent } from 'react';
import { PIECES } from '../../../shared/estimator';
import { store, isDemo } from '../../data';
import { resetDemo } from '../../data/localStore';
import { ErrorNote, Field } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { slugify } from '../../lib/format';
import { fileToDataUrl } from '../../lib/image';
import { useShop } from './ShopApp';

export default function Settings() {
  const { shop, setShop } = useShop();
  const [v, setV] = useState(shop);
  const [invite, setInvite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setShop(await store.updateShop(v));
      setError(null);
      announce('Settings saved.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const rate = (k: 'fabricLowPerYd' | 'fabricHighPerYd' | 'foamHr' | 'foamStandard' | 'supplies', label: string, hint?: string) => (
    <Field id={`set-${k}`} label={label} hint={hint}>
      <input id={`set-${k}`} type="number" inputMode="decimal" min={0} value={v.rates[k]} onChange={(e) => setV({ ...v, rates: { ...v.rates, [k]: Number(e.target.value) } })} />
    </Field>
  );

  return (
    <>
      <PageHeading>Shop settings</PageHeading>
      <form onSubmit={submit}>
        <section className="card">
          <h2>Shop</h2>
          <div className="grid two">
            <Field id="set-name" label="Shop name">
              <input id="set-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <Field id="set-slug" label="Client web address" hint={`${window.location.origin}/s/${v.slug}`}>
              <input id="set-slug" value={v.slug} onChange={(e) => setV({ ...v, slug: slugify(e.target.value) })} disabled={isDemo} />
            </Field>
            <Field id="set-city" label="City">
              <input id="set-city" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} />
            </Field>
            <Field id="set-hours" label="Hours">
              <input id="set-hours" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} />
            </Field>
            <Field id="set-et" label="Interac e-Transfer email for deposits">
              <input id="set-et" type="email" value={v.etransferEmail} onChange={(e) => setV({ ...v, etransferEmail: e.target.value })} />
            </Field>
            <Field id="set-dep" label="Deposit (%)">
              <input id="set-dep" type="number" min={0} max={100} value={v.depositPercent} onChange={(e) => setV({ ...v, depositPercent: Number(e.target.value) })} />
            </Field>
            <Field id="set-logo" label="Logo (optional)">
              <input id="set-logo" type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setV({ ...v, logoUrl: await fileToDataUrl(f, 256) }); }} />
            </Field>
            {v.logoUrl && <img src={v.logoUrl} alt="Current logo" style={{ maxWidth: 96, borderRadius: 8 }} />}
          </div>
        </section>
        <section className="card">
          <h2>Rates for the instant estimate</h2>
          <p className="hint">Clients see a range built from these. Prices in CAD before HST.</p>
          <div className="grid two">
            {rate('fabricLowPerYd', 'Fabric, low end per yard')}
            {rate('fabricHighPerYd', 'Fabric, high end per yard')}
            {rate('foamHr', 'HR foam for a full sofa', 'Smaller pieces use a share of this.')}
            {rate('foamStandard', 'Standard foam for a full sofa')}
            {rate('supplies', 'Supplies for a full sofa')}
          </div>
          <fieldset>
            <legend>Labour by piece</legend>
            <div className="grid three">
              {PIECES.map((p) => (
                <Field key={p.id} id={`set-lab-${p.id}`} label={p.label}>
                  <input
                    id={`set-lab-${p.id}`}
                    type="number"
                    min={0}
                    value={v.rates.labour[p.id] ?? 0}
                    onChange={(e) => setV({ ...v, rates: { ...v.rates, labour: { ...v.rates.labour, [p.id]: Number(e.target.value) } } })}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
        </section>
        <ErrorNote error={error} />
        <button type="submit" className="primary">
          Save settings
        </button>
      </form>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Staff</h2>
        {isDemo ? (
          <p className="muted">Adding staff needs the real database. It is off in demo mode.</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await store.inviteStaff(invite);
                announce(`${invite} can now sign in with a magic link.`);
                setInvite('');
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <Field id="set-invite" label="Add a staff member by email" hint="They sign in at /shop with that email. No email is sent by Stitch; tell them yourself.">
              <input id="set-invite" type="email" value={invite} onChange={(e) => setInvite(e.target.value)} />
            </Field>
            <button type="submit" disabled={!invite.includes('@')}>
              Add staff
            </button>
          </form>
        )}
      </section>

      {isDemo && (
        <section className="card">
          <h2>Demo data</h2>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Reset all demo data in this browser?')) {
                resetDemo();
                window.location.reload();
              }
            }}
          >
            Reset demo data
          </button>
        </section>
      )}
    </>
  );
}
