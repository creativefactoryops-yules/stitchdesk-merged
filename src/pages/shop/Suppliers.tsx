import { useEffect, useState } from 'react';
import { store } from '../../data';
import type { Supplier } from '../../data/models';
import { ErrorNote, Field, Loading } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';

const BLANK: Supplier = { id: '', name: '', category: '', phone: '', email: '', website: '', address: '', notes: '', verified: false };

export default function Suppliers() {
  const [list, setList] = useState<Supplier[] | null>(null);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();

  const load = () => store.listSuppliers().then(setList, (e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function save(s: Supplier) {
    try {
      await store.saveSupplier(s);
      setEditing(null);
      await load();
      announce(`${s.name} saved.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(s: Supplier) {
    if (!confirm(`Delete ${s.name}?`)) return;
    await store.deleteSupplier(s.id);
    await load();
    announce(`${s.name} deleted.`);
  }

  if (!list) return error ? <ErrorNote error={error} /> : <Loading />;
  const shown = list.filter((s) => `${s.name} ${s.category} ${s.notes} ${s.address}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeading>Suppliers vault</PageHeading>
      <p className="muted">Your suppliers, private to your shop. Entries marked "verify" are placeholders: check them before you rely on them.</p>
      <div className="row">
        <button className="primary" onClick={() => setEditing({ ...BLANK })}>
          Add supplier
        </button>
      </div>
      {editing && <SupplierForm s={editing} onSave={save} onCancel={() => setEditing(null)} />}
      <Field id="sup-q" label="Search suppliers">
        <input id="sup-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {shown.map((s) => (
          <li key={s.id} className="card tight">
            <h2 style={{ fontSize: '1rem', marginBottom: 2 }}>
              {s.name} {!s.verified && <span className="badge warn">verify</span>}
            </h2>
            <div className="hint">{[s.category, s.address].filter(Boolean).join(' · ')}</div>
            {s.notes && <p style={{ margin: '4px 0' }}>{s.notes}</p>}
            <div className="row">
              {s.phone && (
                <a className="btn" href={`tel:${s.phone}`}>
                  Call {s.phone}
                </a>
              )}
              {s.email && (
                <a className="btn" href={`mailto:${s.email}`}>
                  Email
                </a>
              )}
              {s.website && (
                <a className="btn" href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
              <button onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                Edit
              </button>
              <button className="danger" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ErrorNote error={error} />
    </>
  );
}

function SupplierForm({ s, onSave, onCancel }: { s: Supplier; onSave: (s: Supplier) => void; onCancel: () => void }) {
  const [v, setV] = useState(s);
  const f = (k: keyof Supplier, label: string, type = 'text') => (
    <Field id={`sf-${k}`} label={label}>
      <input id={`sf-${k}`} type={type} value={String(v[k])} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <form
      className="card"
      aria-label={s.id ? `Edit ${s.name}` : 'New supplier'}
      onSubmit={(e) => {
        e.preventDefault();
        if (v.name.trim()) onSave(v);
      }}
    >
      <h2>{s.id ? `Edit ${s.name}` : 'New supplier'}</h2>
      <div className="grid two">
        {f('name', 'Name')}
        {f('category', 'What they supply')}
        {f('phone', 'Phone', 'tel')}
        {f('email', 'Email', 'email')}
        {f('website', 'Website')}
        {f('address', 'Address')}
      </div>
      <Field id="sf-notes" label="Notes">
        <textarea id="sf-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>
      <label className="check">
        <input type="checkbox" checked={v.verified} onChange={(e) => setV({ ...v, verified: e.target.checked })} />I checked these details
      </label>
      <div className="row">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
