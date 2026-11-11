import { PageHeading, useAnnounce } from '../../lib/a11y';
import { money } from '../../lib/format';
import { usePortal } from './ShopPortal';

export default function SwatchPanel() {
  const p = usePortal();
  const announce = useAnnounce();
  const groups = new Map<string, typeof p.data.swatches>();
  for (const s of p.data.swatches) groups.set(s.material, [...(groups.get(s.material) ?? []), s]);

  return (
    <>
      <PageHeading>Swatch library</PageHeading>
      <p className="muted">Fabrics {p.data.shop.name} works with. Colours on screens vary: see the real swatch in the shop.</p>
      {groups.size === 0 && <p>The shop has not added swatches yet.</p>}
      {[...groups.entries()].map(([material, list]) => (
        <section key={material} className="card" aria-labelledby={`sw-${material}`}>
          <h2 id={`sw-${material}`}>{material}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {list.map((s) => {
              const chosen = p.swatchId === s.id;
              return (
                <li key={s.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt="" className="swatch-chip" />
                  ) : (
                    <span className="swatch-chip" style={{ background: s.hex }} aria-hidden="true" />
                  )}
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <strong>{s.name}</strong>, {s.colour}
                    <div className="hint">
                      {s.pricePerYd != null ? `${money(s.pricePerYd)} a yard` : 'Price on request'}
                      {s.cleaningCode ? ` · cleaning code ${s.cleaningCode}` : ''}
                      {s.doubleRubs ? ` · ${s.doubleRubs.toLocaleString('en-CA')} double rubs` : ''}
                      {!s.inStock ? ' · out of stock' : ''}
                    </div>
                  </div>
                  <button
                    aria-pressed={chosen}
                    aria-label={chosen ? `${s.name} chosen` : `Use ${s.name}`}
                    onClick={() => {
                      p.set({ swatchId: chosen ? null : s.id, sheet: { ...p.sheet, fabric: chosen ? p.sheet.fabric : s.name } });
                      announce(chosen ? `${s.name} removed` : `${s.name} added to your job sheet`);
                    }}
                  >
                    {chosen ? 'Chosen' : 'Use this'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
