/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import type { Quote } from '../../data/models';
import { money } from '../../lib/format';

/** The quote as the client sees it and as it prints (window.print -> Save as PDF). */
export function QuotePrint({ quote, shopName, clientName, jobTitle }: { quote: Quote; shopName: string; clientName: string | null; jobTitle: string }) {
  const m = (n: number) => money(n, true);
  return (
    <div className="quote-print">
      <div className="print-only">
        <h1>{shopName}</h1>
        <p>Quote{quote.sentAt ? `, ${new Date(quote.sentAt).toLocaleDateString('en-CA')}` : ''}</p>
      </div>
      <p>
        {clientName ? <>For {clientName}. </> : null}
        {jobTitle}
      </p>
      <table className="totals">
        <caption className="sr-only">Quote lines in Canadian dollars</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              Fabric{quote.fabricName ? `: ${quote.fabricName}` : ''}, {quote.yards} yd at {m(quote.fabricPerYd)}
            </th>
            <td className="num">{m(Math.round(quote.yards * quote.fabricPerYd * 100) / 100)}</td>
          </tr>
          <tr>
            <th scope="row">Labour</th>
            <td className="num">{m(quote.labour)}</td>
          </tr>
          <tr>
            <th scope="row">Foam</th>
            <td className="num">{m(quote.foam)}</td>
          </tr>
          <tr>
            <th scope="row">Supplies</th>
            <td className="num">{m(quote.supplies)}</td>
          </tr>
          {quote.discount > 0 && (
            <tr>
              <th scope="row">Discount</th>
              <td className="num">−{m(quote.discount)}</td>
            </tr>
          )}
          <tr>
            <th scope="row">Subtotal</th>
            <td className="num">{m(quote.subtotal)}</td>
          </tr>
          <tr>
            <th scope="row">HST 13%</th>
            <td className="num">{m(quote.hst)}</td>
          </tr>
          <tr className="total">
            <th scope="row">Total</th>
            <td className="num">{m(quote.total)}</td>
          </tr>
        </tbody>
      </table>
      {quote.notes && <p style={{ marginTop: 10 }}>{quote.notes}</p>}
    </div>
  );
}
