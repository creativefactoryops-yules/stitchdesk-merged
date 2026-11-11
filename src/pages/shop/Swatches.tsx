import { useEffect, useState } from 'react';
import { store } from '../../data';
import type { Swatch } from '../../data/models';
import { ErrorNote, Field, Loading } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { money } from '../../lib/format';
import { fileToDataUrl } from '../../lib/image';

const BLANK: Swatch = { id: '', name: '', material: '', colour: '', hex: '#888888', pricePerYd: null, cleaningCode: '', doubleRubs: null, imageUrl: null, inStock: true };

export default function Swatches() {
  const [list, setList] = useState<Swatch[] | null>(null);
  const [editing, setEditing] = useState<Swatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();
  const load = () => store.listSwatches().then(setList, (e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function save(s: Swatch) {
    try {
      await store.saveSwatch(s);
      setEditing(null);
      await load();
      announce(`${s.name} saved.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!list) return error ? <ErrorNote error={error} /> : <Loading />;
  return (
    <>
      <PageHeading>Swatches</PageHeading>
      <p className="muted">Clients see these in the swatch library, and the estimate uses each swatch's price per yard.</p>
      <button className="primary" onClick={() => setEditing({ ...BLANK })}>
        Add swatch
      </button>
      {editing && <SwatchForm s={editing} onSave={save} onCancel={() => setEditing(null)} />}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
        {list.map((s) => (
          <li key={s.id} className="card tight row">
            {s.imageUrl ? <img src={s.imageUrl} alt="" className="swatch-chip" /> : <span className="swatch-chip" style={{ background: s.hex }} aria-hidden="true" />}
            <div style={{ flex: 1, minWidth: 160 }}>
              <strong>{s.name}</strong>, {s.material}, {s.colour}
              <div className="hint">
                {s.pricePerYd != null ? `${money(s.pricePerYd)}/yd` : 'price on request'}
                {s.cleaningCode ? ` · code ${s.cleaningCode}` : ''}
                {s.doubleRubs ? ` · ${s.doubleRubs.toLocaleString('en-CA')} rubs` : ''}
                {s.inStock ? '' : ' · out of stock'}
              </div>
            </div>
            <button onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
              Edit
            </button>
            <button
              className="danger"
              aria-label={`Delete ${s.name}`}
              onClick={async () => {
                if (!confirm(`Delete ${s.name}?`)) return;
                await store.deleteSwatch(s.id);
                await load();
                announce(`${s.name} deleted.`);
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <ErrorNote error={error} />
    </>
  );
}

function SwatchForm({ s, onSave, onCancel }: { s: Swatch; onSave: (s: Swatch) => void; onCancel: () => void }) {
  const [v, setV] = useState(s);
  const txt = (k: 'name' | 'material' | 'colour' | 'cleaningCode', label: string, hint?: string) => (
    <Field id={`swf-${k}`} label={label} hint={hint}>
      <input id={`swf-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  );
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) onSave(v); }} aria-label="Swatch">
      <h2>{s.id ? `Edit ${s.name}` : 'New swatch'}</h2>
      <div className="grid two">
        {txt('name', 'Name')}
        {txt('material', 'Material', 'For example velvet, linen, leather')}
        {txt('colour', 'Colour name')}
        <Field id="swf-hex" label="Colour chip">
          <input id="swf-hex" type="color" value={v.hex} onChange={(e) => setV({ ...v, hex: e.target.value })} />
        </Field>
        <Field id="swf-price" label="Price per yard ($)" hint="Leave empty for price on request">
          <input id="swf-price" type="number" inputMode="decimal" min={0} step="0.01" value={v.pricePerYd ?? ''} onChange={(e) => setV({ ...v, pricePerYd: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
        {txt('cleaningCode', 'Cleaning code', 'W, S, W/S or X')}
        <Field id="swf-rubs" label="Double rubs">
          <input id="swf-rubs" type="number" inputMode="numeric" min={0} value={v.doubleRubs ?? ''} onChange={(e) => setV({ ...v, doubleRubs: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
        <Field id="swf-img" label="Photo of the swatch (optional)">
          <input id="swf-img" type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setV({ ...v, imageUrl: await fileToDataUrl(f, 300) }); }} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={v.inStock} onChange={(e) => setV({ ...v, inStock: e.target.checked })} />
        In stock
      </label>
      <div className="row">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
