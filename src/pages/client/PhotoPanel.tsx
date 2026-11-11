import { useState } from 'react';
import { PIECES, pieceById } from '../../../shared/estimator';
import { Field, ErrorNote } from '../../components/Layout';
import { RenderImage } from '../../components/RenderImage';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { renderFromPhoto, type RenderResult } from '../../lib/api';
import { fileToDataUrl } from '../../lib/image';
import { usePortal } from './ShopPortal';

const STYLES = ['Keep it the same', 'Modern clean', 'Mid-century', 'Traditional', 'Glam', 'Farmhouse'];

export default function PhotoPanel() {
  const p = usePortal();
  const announce = useAnnounce();
  const [piece, setPiece] = useState(p.sheet.piece ?? 'sofa');
  const [fabric, setFabric] = useState(p.sheet.fabric ?? 'velvet');
  const [colour, setColour] = useState('');
  const [style, setStyle] = useState(STYLES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenderResult | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(f);
      p.set({ beforePhoto: dataUrl });
      announce('Photo added.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function go() {
    if (!p.beforePhoto) return setError('Add a photo of your piece first.');
    setBusy(true);
    setError(null);
    const r = await renderFromPhoto({
      image: p.beforePhoto,
      piece: pieceById(piece).label,
      fabric,
      colour,
      style: style === STYLES[0] ? '' : style,
    });
    setBusy(false);
    setResult(r);
    p.set((s) => ({
      renders: [...s.renders, { url: r.imageUrl, label: r.label, method: r.method, usedPhoto: r.usedPhoto, caption: `${colour} ${fabric}`.trim() }],
    }));
    announce('Preview requested. It may take a few seconds to appear.');
  }

  return (
    <>
      <PageHeading>Before and after preview</PageHeading>
      <p className="muted">Add a photo of your piece, pick a fabric and colour, and see a preview. AI preview, final may vary.</p>
      <section className="card">
        <Field id="photo-file" label="Photo of your piece" hint="Take it from the front, in good light. It stays private to the shop.">
          <input id="photo-file" type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} />
        </Field>
        <div className="grid two">
          <Field id="ph-piece" label="Piece">
            <select id="ph-piece" value={piece} onChange={(e) => setPiece(e.target.value)}>
              {PIECES.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ph-fabric" label="Fabric">
            <input id="ph-fabric" list="ph-fabric-list" value={fabric} onChange={(e) => setFabric(e.target.value)} />
            <datalist id="ph-fabric-list">
              {Array.from(new Set(p.data.swatches.map((s) => s.material))).map((m) => (
                <option key={m} value={m} />
              ))}
              <option value="velvet" />
              <option value="linen" />
              <option value="leather" />
              <option value="boucle" />
            </datalist>
          </Field>
          <Field id="ph-colour" label="Colour">
            <input id="ph-colour" value={colour} onChange={(e) => setColour(e.target.value)} placeholder="for example, moss green" />
          </Field>
          <Field id="ph-style" label="Style">
            <select id="ph-style" value={style} onChange={(e) => setStyle(e.target.value)}>
              {STYLES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className="primary" onClick={go} disabled={busy}>
          {busy ? 'Making the preview…' : 'Make my preview'}
        </button>
        <ErrorNote error={error} />
      </section>
      <div className="grid two">
        {p.beforePhoto && (
          <figure className="render card tight">
            <img src={p.beforePhoto} alt="Before: your uploaded photo" />
            <figcaption style={{ color: 'var(--muted)' }}>Before</figcaption>
          </figure>
        )}
        {result && (
          <div className="card tight">
            <RenderImage url={result.imageUrl} alt={`After: ${pieceById(piece).label} in ${colour} ${fabric}`} note={result.note} />
          </div>
        )}
      </div>
    </>
  );
}
