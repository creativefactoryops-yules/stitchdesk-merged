import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PIECES, pieceById } from '../../../shared/estimator';
import type { DreamAnswers } from '../../../shared/render';
import { Field } from '../../components/Layout';
import { RenderImage } from '../../components/RenderImage';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { renderDream, type RenderResult } from '../../lib/api';
import { usePortal } from './ShopPortal';

const OPTIONS = {
  style: ['Mid-century modern', 'Classic Chesterfield', 'Traditional', 'Modern minimal', 'Scandinavian', 'Art deco', 'Farmhouse', 'Boho'],
  fabric: ['velvet', 'boucle', 'linen', 'leather', 'performance fabric', 'chenille', 'wool', 'outdoor fabric'],
  tufting: ['none', 'button', 'deep diamond', 'channel', 'biscuit'],
  legs: ['tapered wood', 'turned wood', 'brass', 'black metal', 'bun feet', 'hidden'],
  mood: ['cozy', 'bright and airy', 'dark and moody', 'luxe', 'playful'],
};

export default function DreamPanel() {
  const p = usePortal();
  const announce = useAnnounce();
  const [a, setA] = useState<DreamAnswers>({
    piece: pieceById(p.sheet.piece ?? 'sofa').label,
    style: OPTIONS.style[0],
    fabric: OPTIONS.fabric[0],
    colour: 'emerald green',
    tufting: 'none',
    legs: OPTIONS.legs[0],
    mood: OPTIONS.mood[0],
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const set = (k: keyof DreamAnswers) => (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await renderDream(a);
    setBusy(false);
    setResult(r);
    p.set((s) => ({
      renders: [...s.renders, { url: r.imageUrl, label: r.label, method: r.method, usedPhoto: false, caption: `Dream build: ${a.colour} ${a.fabric} ${a.style} ${a.piece}` }],
      sheet: { ...s.sheet, fabric: s.sheet.fabric ?? `${a.colour} ${a.fabric}` },
    }));
    announce('Dream build requested. It may take a few seconds to appear.');
  }

  const select = (k: keyof typeof OPTIONS, label: string) => (
    <Field id={`dr-${k}`} label={label}>
      <select id={`dr-${k}`} value={a[k]} onChange={set(k)}>
        {OPTIONS[k].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <>
      <PageHeading>Dream project builder</PageHeading>
      <p className="muted">Answer a few questions and Stitch paints your idea. AI preview, final may vary.</p>
      <form className="card" onSubmit={submit}>
        <div className="grid two">
          <Field id="dr-piece" label="Piece">
            <select id="dr-piece" value={a.piece} onChange={set('piece')}>
              {PIECES.map((x) => (
                <option key={x.id}>{x.label}</option>
              ))}
            </select>
          </Field>
          {select('style', 'Style')}
          {select('fabric', 'Fabric')}
          <Field id="dr-colour" label="Colour">
            <input id="dr-colour" value={a.colour} onChange={set('colour')} />
          </Field>
          {select('tufting', 'Tufting')}
          {select('legs', 'Legs')}
          {select('mood', 'Mood of the room')}
        </div>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Painting…' : 'Show me'}
        </button>
      </form>
      {result && (
        <section className="card" aria-labelledby="dream-h">
          <h2 id="dream-h">Your dream build</h2>
          <RenderImage url={result.imageUrl} alt={`${a.colour} ${a.fabric} ${a.style} ${a.piece}, ${a.tufting} tufting, ${a.legs} legs`} />
          <p className="row" style={{ marginTop: 10 }}>
            <Link className="btn" to={`/s/${p.slug}/estimate`}>
              Estimate it
            </Link>
            <Link className="btn primary" to={`/s/${p.slug}/book`}>
              Book this
            </Link>
          </p>
        </section>
      )}
    </>
  );
}
