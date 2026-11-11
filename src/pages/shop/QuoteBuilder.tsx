/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { estimateYards, pieceById, quoteTotals } from '../../../shared/estimator';
import { isDemo, store } from '../../data';
import type { Client, Job, Quote, Swatch } from '../../data/models';
import type { QuoteDraft } from '../../data/store';
import { ErrorNote, Field, Loading } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { money } from '../../lib/format';
import { clientLink } from './ClientFile';
import { QuotePrint } from './QuotePrint';
import { useShop } from './ShopApp';

export default function QuoteBuilder() {
  const { jobId = '' } = useParams();
  const { shop } = useShop();
  const announce = useAnnounce();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [history, setHistory] = useState<Quote[]>([]);
  const [d, setD] = useState<QuoteDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Quote | null>(null);

  useEffect(() => {
    Promise.all([store.listJobs(), store.listClients(), store.listSwatches(), store.listQuotes(jobId)]).then(
      ([js, cs, sw, qs]) => {
        const j = js.find((x) => x.id === jobId) ?? null;
        setJob(j);
        setSwatches(sw);
        setHistory(qs);
        if (!j) return;
        setClient(cs.find((c) => c.id === j.clientId) ?? null);
        const last = qs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
        const piece = pieceById(j.piece);
        const match = sw.find((s) => j.fabric && s.name.toLowerCase() === j.fabric.toLowerCase());
        setD(
          last
            ? { yards: last.yards, fabricName: last.fabricName, fabricPerYd: last.fabricPerYd, labour: last.labour, foam: last.foam, supplies: last.supplies, discount: last.discount, notes: last.notes }
            : {
                yards: j.width && j.depth ? estimateYards(piece.id, j.width, j.depth, j.units) : 0,
                fabricName: match?.name ?? j.fabric ?? '',
                fabricPerYd: match?.pricePerYd ?? shop.rates.fabricLowPerYd,
                labour: shop.rates.labour[piece.id] ?? 0,
                foam: Math.round(shop.rates.foamHr * piece.foamShare),
                supplies: Math.round(shop.rates.supplies * Math.max(0.25, piece.foamShare)),
                discount: 0,
                notes: 'Valid 30 days. Fabric subject to supplier stock.',
              },
        );
      },
      (e) => setError(e.message),
    );
  }, [jobId, shop]);

  const totals = useMemo(() => (d ? quoteTotals(d) : null), [d]);

  if (error) return <ErrorNote error={error} />;
  if (job === undefined) return <Loading />;
  if (!job || !d || !totals) return <p>Job not found. <Link to="/shop/jobs">Back to jobs</Link></p>;

  const numField = (k: keyof QuoteDraft, label: string, hint?: string, step = '0.01') => (
    <Field id={`qb-${k}`} label={label} hint={hint}>
      <input
        id={`qb-${k}`}
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={String(d[k])}
        onChange={(e) => setD({ ...d, [k]: e.target.value === '' ? 0 : Number(e.target.value) })}
      />
    </Field>
  );

  async function save(send: boolean) {
    try {
      const q = await store.saveQuote(job!.id, d!, send);
      setSaved(q);
      setHistory((h) => [q, ...h]);
      announce(send ? 'Quote saved and sent. The client sees it on their job link.' : 'Quote draft saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const previewQuote: Quote = saved ?? {
    id: 'preview', jobId: job.id, ...d, ...totals, sentAt: null, createdAt: new Date().toISOString(),
  };
  const link = clientLink(job.token);

  return (
    <>
      <div className="no-print">
        <PageHeading>Quote: {job.title}</PageHeading>
        <p className="muted">
          {client ? <Link to={`/shop/clients/${client.id}`}>{client.name}</Link> : 'No client'}
          {job.width && job.depth ? `. ${job.width} by ${job.depth} ${job.units ?? 'in'}` : ''}
        </p>
        <form className="card" onSubmit={(e) => e.preventDefault()} aria-label="Quote lines">
          <div className="grid two">
            {numField('yards', 'Yardage', 'Pre-filled from the estimator. Adjust after measuring.', '0.25')}
            <Field id="qb-fabricName" label="Fabric">
              <input
                id="qb-fabricName"
                list="qb-swatches"
                value={d.fabricName}
                onChange={(e) => {
                  const sw = swatches.find((s) => s.name === e.target.value);
                  setD({ ...d, fabricName: e.target.value, fabricPerYd: sw?.pricePerYd ?? d.fabricPerYd });
                }}
              />
              <datalist id="qb-swatches">
                {swatches.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </Field>
            {numField('fabricPerYd', 'Fabric price per yard ($)')}
            {numField('labour', 'Labour ($)')}
            {numField('foam', 'Foam ($)')}
            {numField('supplies', 'Supplies ($)', 'Thread, batting, webbing, staples, welt cord.')}
            {numField('discount', 'Discount ($)')}
          </div>
          <Field id="qb-notes" label="Notes on the quote">
            <textarea id="qb-notes" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          </Field>
        </form>
      </div>

      <section className="card" aria-labelledby="qb-total-h">
        <h2 id="qb-total-h" className="no-print">
          Totals: {money(totals.total, true)} with HST
        </h2>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Total {money(totals.total, true)} with HST.
        </p>
        <QuotePrint quote={previewQuote} shopName={shop.name} clientName={client?.name ?? null} jobTitle={job.title} />
      </section>

      <div className="row no-print">
        <button onClick={() => save(false)}>Save draft</button>
        <button className="primary" onClick={() => save(true)}>
          Save and send to client
        </button>
        <button onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      {saved?.sentAt && (
        <section className="card no-print" role="status">
          <p>Sent. The client sees the quote on their job link. Send them this link by text or email:</p>
          {isDemo && <p className="notice">Demo mode: the job link only opens in this browser, so a real client could not open it yet.</p>}
          <p style={{ wordBreak: 'break-all' }}>{link}</p>
          <div className="row">
            <button onClick={() => navigator.clipboard?.writeText(link).then(() => announce('Link copied.'))}>Copy link</button>
            {client?.email && (
              <a className="btn" href={`mailto:${client.email}?subject=${encodeURIComponent(`Your quote from ${shop.name}`)}&body=${encodeURIComponent(`Hi ${client.name},\n\nYour quote is ready: ${link}\n\n${shop.name}`)}`}>
                Email it
              </a>
            )}
            {client?.phone && (
              <a className="btn" href={`sms:${client.phone}?body=${encodeURIComponent(`Your quote from ${shop.name}: ${link}`)}`}>
                Text it
              </a>
            )}
          </div>
        </section>
      )}
      {history.length > 0 && (
        <details className="no-print">
          <summary>Earlier quotes ({history.length})</summary>
          <ul>
            {history.map((q) => (
              <li key={q.id}>
                {new Date(q.createdAt).toLocaleDateString('en-CA')}: {money(q.total, true)} {q.sentAt ? '(sent)' : '(draft)'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
