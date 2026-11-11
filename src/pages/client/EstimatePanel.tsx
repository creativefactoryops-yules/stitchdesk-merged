import { Link } from 'react-router-dom';
import { PIECES, type FoamChoice } from '../../../shared/estimator';
import type { Units } from '../../../shared/types';
import { Field } from '../../components/Layout';
import { PageHeading } from '../../lib/a11y';
import { money } from '../../lib/format';
import { usePortal } from './ShopPortal';

export function EstimateTable({ est }: { est: NonNullable<ReturnType<typeof usePortal>['est']> }) {
  const range = (a: number, b: number) => (a === b ? money(a) : `${money(a)} to ${money(b)}`);
  return (
    <table className="totals">
      <caption className="sr-only">Estimate breakdown in Canadian dollars</caption>
      <tbody>
        <tr>
          <th scope="row">Fabric, {est.yards} yards</th>
          <td className="num">{range(est.fabricLow, est.fabricHigh)}</td>
        </tr>
        <tr>
          <th scope="row">Labour</th>
          <td className="num">{money(est.labour)}</td>
        </tr>
        <tr>
          <th scope="row">Foam</th>
          <td className="num">{money(est.foam)}</td>
        </tr>
        <tr>
          <th scope="row">Supplies</th>
          <td className="num">{money(est.supplies)}</td>
        </tr>
        <tr>
          <th scope="row">Subtotal</th>
          <td className="num">{range(est.subtotalLow, est.subtotalHigh)}</td>
        </tr>
        <tr>
          <th scope="row">HST 13%</th>
          <td className="num">{range(est.hstLow, est.hstHigh)}</td>
        </tr>
        <tr className="total">
          <th scope="row">Approximate total</th>
          <td className="num">{range(est.totalLow, est.totalHigh)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function EstimatePanel() {
  const p = usePortal();
  const s = p.sheet;
  const setSheet = (patch: Partial<typeof s>) => p.set({ sheet: { ...s, ...patch } });
  const numOrNull = (v: string) => (v === '' ? null : Math.max(0, Number(v)));

  return (
    <>
      <PageHeading>Instant estimate</PageHeading>
      <p className="muted">
        Uses {p.data.shop.name}'s own rates. Approximate, confirmed after the shop inspects your piece.
      </p>
      <form className="card" onSubmit={(e) => e.preventDefault()} aria-label="Estimate details">
        <Field id="est-piece" label="Piece">
          <select id="est-piece" value={s.piece ?? ''} onChange={(e) => setSheet({ piece: e.target.value || null })}>
            <option value="">Choose a piece</option>
            {PIECES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend>Units</legend>
          <div className="row">
            {(['in', 'cm'] as Units[]).map((u) => (
              <label className="check" key={u}>
                <input type="radio" name="units" checked={(s.units ?? 'in') === u} onChange={() => setSheet({ units: u })} />
                {u === 'in' ? 'Inches' : 'Centimetres'}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid three">
          <Field id="est-w" label="Width (side to side)">
            <input id="est-w" type="number" inputMode="decimal" min={0} value={s.width ?? ''} onChange={(e) => setSheet({ width: numOrNull(e.target.value) })} />
          </Field>
          <Field id="est-d" label="Depth (front to back)">
            <input id="est-d" type="number" inputMode="decimal" min={0} value={s.depth ?? ''} onChange={(e) => setSheet({ depth: numOrNull(e.target.value) })} />
          </Field>
          <Field id="est-h" label="Height (floor to top)" hint="Not used in the yardage math, but helps the shop.">
            <input id="est-h" type="number" inputMode="decimal" min={0} value={s.height ?? ''} onChange={(e) => setSheet({ height: numOrNull(e.target.value) })} />
          </Field>
        </div>
        <Field id="est-fabric" label="Fabric" hint="Pick a swatch for its price, or use the shop's usual range.">
          <select
            id="est-fabric"
            value={p.swatchId ?? ''}
            onChange={(e) => {
              const sw = p.data.swatches.find((x) => x.id === e.target.value);
              p.set({ swatchId: sw?.id ?? null, sheet: { ...s, fabric: sw ? sw.name : s.fabric } });
            }}
          >
            <option value="">
              Shop's usual range ({money(p.data.shop.rates.fabricLowPerYd)} to {money(p.data.shop.rates.fabricHighPerYd)} a yard)
            </option>
            {p.data.swatches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}, {x.material}
                {x.pricePerYd != null ? `, ${money(x.pricePerYd)} a yard` : ', price on request'}
              </option>
            ))}
          </select>
        </Field>
        <Field id="est-foam" label="Foam">
          <select id="est-foam" value={p.foam} onChange={(e) => p.set({ foam: e.target.value as FoamChoice })}>
            <option value="hr">New high-resilience (HR) foam</option>
            <option value="standard">New standard foam</option>
            <option value="none">Keep my current foam</option>
          </select>
        </Field>
        <label className="check">
          <input type="checkbox" checked={p.patterned} onChange={(e) => p.set({ patterned: e.target.checked })} />
          Patterned fabric that needs matching (adds about 15%)
        </label>
      </form>

      <section className="card" aria-labelledby="est-result">
        <h2 id="est-result">Your estimate</h2>
        {/* Short live summary only, so a screen reader is not read the whole table on every change. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {p.est && p.est.yards > 0 ? `About ${p.est.yards} yards, ${money(p.est.totalLow)} to ${money(p.est.totalHigh)} with HST.` : ''}
        </p>
        {p.est && p.est.yards > 0 ? (
          <>
            <p>
              About <strong>{p.est.yards} yards</strong> of 54-inch fabric.
            </p>
            <EstimateTable est={p.est} />
            <p className="notice">Approximate, confirmed after inspection. Prices include 13% Ontario HST.</p>
            <Link className="btn primary" to={`/s/${p.slug}/book`}>
              Book this
            </Link>
          </>
        ) : (
          <p>Enter the width and depth to see yardage and a price range.</p>
        )}
      </section>
    </>
  );
}
