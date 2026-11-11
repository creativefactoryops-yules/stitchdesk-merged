import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { pieceById } from '../../shared/estimator';
import { STAGES, STAGE_LABEL } from '../../shared/types';
import { store } from '../data';
import type { JobView } from '../data/models';
import { ErrorNote, Field, Layout, Loading } from '../components/Layout';
import { RenderImage } from '../components/RenderImage';
import { PageHeading, useAnnounce } from '../lib/a11y';
import { fmtDate, money } from '../lib/format';
import { QuotePrint } from './shop/QuotePrint';

export default function JobStatus() {
  const { token = '' } = useParams();
  const [view, setView] = useState<JobView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const announce = useAnnounce();

  const load = () => store.getJobByToken(token).then(setView, (e) => setError(String(e.message ?? e)));
  useEffect(() => {
    void load();
  }, [token]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    try {
      await store.addClientMessage(token, msg);
      setMsg('');
      await load();
      announce('Message sent to the shop.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (view === undefined && !error)
    return (
      <Layout>
        <Loading what="Opening your job" />
      </Layout>
    );
  if (!view)
    return (
      <Layout>
        <PageHeading>Job not found</PageHeading>
        <ErrorNote error={error ?? 'This job link is not valid. Check that you copied all of it.'} />
      </Layout>
    );

  const { job, shop, quote, photos, messages } = view;
  const idx = STAGES.indexOf(job.stage);

  return (
    <Layout title={shop.name.toUpperCase()} home={`/s/${shop.slug}`}>
      <PageHeading>{job.piece ? pieceById(job.piece).label : 'Your job'} at {shop.name}</PageHeading>
      <section className="card no-print" aria-labelledby="st-h">
        <h2 id="st-h">Where it's at</h2>
        <ol className="steps">
          {STAGES.map((s, i) => (
            <li key={s} className={i < idx ? 'done' : ''} aria-current={i === idx ? 'step' : undefined}>
              {STAGE_LABEL[s]}
              {i < idx ? ', done' : i === idx ? ', current step' : ''}
            </li>
          ))}
        </ol>
        <p>
          Drop-off: {fmtDate(job.dropoffDate)}. Pickup: {fmtDate(job.pickupDate)}.
        </p>
        {job.estimateLow != null && job.estimateHigh != null && !quote && (
          <p className="muted">
            Online estimate: {money(job.estimateLow)} to {money(job.estimateHigh)} with HST. Approximate, confirmed after inspection.
          </p>
        )}
      </section>

      {quote && (
        <section className="card" aria-labelledby="q-h">
          <h2 id="q-h" className="no-print">
            Your quote
          </h2>
          <QuotePrint quote={quote} shopName={shop.name} clientName={view.clientName} jobTitle={job.title} />
          <button className="no-print" onClick={() => window.print()}>
            Print or save as PDF
          </button>
          <p className="notice no-print">
            Deposit: {shop.depositPercent}% ({money((quote.total * shop.depositPercent) / 100, true)}) by Interac e-Transfer to{' '}
            <strong>{shop.etransferEmail || 'the shop'}</strong>. Put your name and the piece in the message.
          </p>
        </section>
      )}

      {(photos.length > 0 || job.renders.length > 0) && (
        <section className="card no-print" aria-labelledby="ph-h">
          <h2 id="ph-h">Photos and previews</h2>
          <div className="thumbs">
            {photos.map((p) =>
              p.kind === 'render' ? (
                <RenderImage key={p.id} url={p.url} alt={p.caption || 'AI preview'} />
              ) : (
                <figure key={p.id} className="render">
                  <img src={p.url} alt={`${p.kind} photo${p.caption ? ': ' + p.caption : ''}`} />
                  <figcaption style={{ color: 'var(--muted)' }}>{p.kind}</figcaption>
                </figure>
              ),
            )}
            {job.renders.map((r, i) => (
              <RenderImage key={i} url={r.url} alt={r.caption || 'AI preview'} />
            ))}
          </div>
        </section>
      )}

      <section className="card no-print" aria-labelledby="msg-h">
        <h2 id="msg-h">Messages with the shop</h2>
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        <ol className="chat-log" aria-label="Messages">
          {messages.map((m) => (
            <li key={m.id} className={`msg ${m.sender === 'client' ? 'user' : 'stitch'}`}>
              <span className="who">
                {m.sender === 'client' ? 'You' : shop.name}, {new Date(m.createdAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              {m.body}
            </li>
          ))}
        </ol>
        <form onSubmit={send}>
          <Field id="jm" label="Message the shop">
            <textarea id="jm" value={msg} onChange={(e) => setMsg(e.target.value)} />
          </Field>
          <button className="primary" type="submit" disabled={!msg.trim()}>
            Send
          </button>
        </form>
        <ErrorNote error={error} />
      </section>
    </Layout>
  );
}
