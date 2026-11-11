/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PIECES } from '../../../shared/estimator';
import { STAGES, STAGE_LABEL, type Stage } from '../../../shared/types';
import { store } from '../../data';
import type { Client, Job, Message, Photo } from '../../data/models';
import { ErrorNote, Field, Loading } from '../../components/Layout';
import { RenderImage } from '../../components/RenderImage';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { money } from '../../lib/format';
import { fileToDataUrl } from '../../lib/image';

export function clientLink(token: string) {
  const hash = import.meta.env.VITE_HASH_ROUTER === '1';
  return `${window.location.origin}${hash ? window.location.pathname + '#' : ''}/j/${token}`;
}

export default function ClientFile() {
  const { id = '' } = useParams();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();

  useEffect(() => {
    Promise.all([store.listClients(), store.listJobs()]).then(
      ([cs, js]) => {
        setClient(cs.find((c) => c.id === id) ?? null);
        setJobs(js.filter((j) => j.clientId === id));
      },
      (e) => setError(e.message),
    );
  }, [id]);

  if (error) return <ErrorNote error={error} />;
  if (client === undefined) return <Loading />;
  if (!client) return <p>Client not found. <Link to="/shop/clients">Back to clients</Link></p>;

  async function saveClient(patch: Partial<Client>) {
    try {
      setClient(await store.updateClient(client!.id, patch));
      announce('Client saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageHeading>{client.name}</PageHeading>
      <section className="card" aria-labelledby="ct-h">
        <h2 id="ct-h">Contact</h2>
        <ClientForm client={client} onSave={saveClient} />
      </section>
      {jobs.length === 0 && <p>No jobs yet.</p>}
      {jobs.map((j) => (
        <JobSection key={j.id} job={j} onChange={(nj) => setJobs((js) => js.map((x) => (x.id === nj.id ? nj : x)))} />
      ))}
    </>
  );
}

function ClientForm({ client, onSave }: { client: Client; onSave: (p: Partial<Client>) => void }) {
  const [c, setC] = useState(client);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: c.name, email: c.email || null, phone: c.phone || null, notes: c.notes });
      }}
    >
      <div className="grid three">
        <Field id="cf-name" label="Name">
          <input id="cf-name" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </Field>
        <Field id="cf-phone" label="Phone">
          <input id="cf-phone" type="tel" value={c.phone ?? ''} onChange={(e) => setC({ ...c, phone: e.target.value })} />
        </Field>
        <Field id="cf-email" label="Email">
          <input id="cf-email" type="email" value={c.email ?? ''} onChange={(e) => setC({ ...c, email: e.target.value })} />
        </Field>
      </div>
      <Field id="cf-notes" label="Notes">
        <textarea id="cf-notes" value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} />
      </Field>
      <div className="row">
        <button type="submit" className="primary">
          Save contact
        </button>
        {c.phone && (
          <a className="btn" href={`tel:${c.phone}`}>
            Call
          </a>
        )}
        {c.email && (
          <a className="btn" href={`mailto:${c.email}`}>
            Email
          </a>
        )}
      </div>
    </form>
  );
}

function JobSection({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const [j, setJ] = useState(job);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();
  const hid = `job-${job.id}`;

  useEffect(() => {
    store.listPhotos(job.id).then(setPhotos, () => {});
    store.listMessages(job.id).then(setMessages, () => {});
  }, [job.id]);

  async function save(patch: Partial<Job>) {
    try {
      const nj = await store.updateJob(job.id, patch);
      setJ(nj);
      onChange(nj);
      announce('Job saved.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addPhoto(f: File | undefined, kind: Photo['kind']) {
    if (!f) return;
    try {
      const url = await fileToDataUrl(f, 1280);
      const p = await store.addPhoto(job.id, url, kind, '');
      setPhotos((ps) => [...ps, p]);
      announce('Photo added.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    try {
      const m = await store.addShopMessage(job.id, reply);
      setMessages((ms) => [...ms, m]);
      setReply('');
      announce('Message sent.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const link = clientLink(j.token);

  return (
    <section className="card" aria-labelledby={hid}>
      <h2 id={hid}>{j.title || 'Job'}</h2>
      <p className="row">
        <Link className="btn primary" to={`/shop/quote/${j.id}`}>
          Build quote
        </Link>
        <button onClick={() => navigator.clipboard?.writeText(link).then(() => announce('Client link copied.'))}>Copy client link</button>
        <a className="btn" href={link} target="_blank" rel="noreferrer">
          Open client view
        </a>
      </p>
      {j.estimateLow != null && j.estimateHigh != null && (
        <p className="hint">
          Client saw an online estimate of {money(j.estimateLow)} to {money(j.estimateHigh)} with HST.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            title: j.title, stage: j.stage, piece: j.piece, width: j.width, depth: j.depth, height: j.height, units: j.units,
            fabric: j.fabric, notes: j.notes, dropoffDate: j.dropoffDate || null, pickupDate: j.pickupDate || null,
          });
        }}
      >
        <div className="grid three">
          <Field id={`${hid}-title`} label="Title">
            <input id={`${hid}-title`} value={j.title} onChange={(e) => setJ({ ...j, title: e.target.value })} />
          </Field>
          <Field id={`${hid}-stage`} label="Stage">
            <select id={`${hid}-stage`} value={j.stage} onChange={(e) => setJ({ ...j, stage: e.target.value as Stage })}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${hid}-piece`} label="Piece">
            <select id={`${hid}-piece`} value={j.piece ?? ''} onChange={(e) => setJ({ ...j, piece: e.target.value || null })}>
              <option value="">Not set</option>
              {PIECES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${hid}-w`} label={`Width (${j.units ?? 'in'})`}>
            <input id={`${hid}-w`} type="number" inputMode="decimal" value={j.width ?? ''} onChange={(e) => setJ({ ...j, width: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field id={`${hid}-d`} label={`Depth (${j.units ?? 'in'})`}>
            <input id={`${hid}-d`} type="number" inputMode="decimal" value={j.depth ?? ''} onChange={(e) => setJ({ ...j, depth: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field id={`${hid}-h`} label={`Height (${j.units ?? 'in'})`}>
            <input id={`${hid}-h`} type="number" inputMode="decimal" value={j.height ?? ''} onChange={(e) => setJ({ ...j, height: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field id={`${hid}-units`} label="Units">
            <select id={`${hid}-units`} value={j.units ?? 'in'} onChange={(e) => setJ({ ...j, units: e.target.value as 'in' | 'cm' })}>
              <option value="in">Inches</option>
              <option value="cm">Centimetres</option>
            </select>
          </Field>
          <Field id={`${hid}-fabric`} label="Fabric">
            <input id={`${hid}-fabric`} value={j.fabric ?? ''} onChange={(e) => setJ({ ...j, fabric: e.target.value })} />
          </Field>
          <Field id={`${hid}-drop`} label="Drop-off date">
            <input id={`${hid}-drop`} type="date" value={j.dropoffDate ?? ''} onChange={(e) => setJ({ ...j, dropoffDate: e.target.value })} />
          </Field>
          <Field id={`${hid}-pick`} label="Pickup date">
            <input id={`${hid}-pick`} type="date" value={j.pickupDate ?? ''} onChange={(e) => setJ({ ...j, pickupDate: e.target.value })} />
          </Field>
        </div>
        <Field id={`${hid}-notes`} label="Job notes">
          <textarea id={`${hid}-notes`} value={j.notes} onChange={(e) => setJ({ ...j, notes: e.target.value })} />
        </Field>
        <button type="submit" className="primary">
          Save job
        </button>
      </form>

      <h3 style={{ marginTop: 16 }}>Photos and renders</h3>
      <div className="thumbs">
        {photos.map((p) =>
          p.kind === 'render' ? (
            <RenderImage key={p.id} url={p.url} alt={p.caption || 'AI preview'} />
          ) : (
            <figure className="render" key={p.id}>
              <img src={p.url} alt={`${p.kind} photo`} />
              <figcaption style={{ color: 'var(--muted)' }}>{p.kind}</figcaption>
            </figure>
          ),
        )}
        {j.renders.map((r, i) => (
          <RenderImage key={i} url={r.url} alt={r.caption || 'AI preview'} note={r.usedPhoto === false && r.method.includes('fallback') ? '(made from text, not the photo)' : undefined} />
        ))}
      </div>
      {photos.length === 0 && j.renders.length === 0 && <p className="hint">No photos yet.</p>}
      <div className="grid two" style={{ marginTop: 8 }}>
        <Field id={`${hid}-up-progress`} label="Add a progress photo">
          <input id={`${hid}-up-progress`} type="file" accept="image/*" onChange={(e) => addPhoto(e.target.files?.[0], 'progress')} />
        </Field>
        <Field id={`${hid}-up-after`} label="Add a finished (after) photo">
          <input id={`${hid}-up-after`} type="file" accept="image/*" onChange={(e) => addPhoto(e.target.files?.[0], 'after')} />
        </Field>
      </div>

      <details>
        <summary>Chat with Stitch ({j.transcript.length} messages)</summary>
        {j.transcript.length === 0 ? (
          <p className="hint">The client did not share a chat.</p>
        ) : (
          <ol className="chat-log" aria-label="Chat transcript">
            {j.transcript.map((t, i) => (
              <li key={i} className={`msg ${t.role}`}>
                <span className="who">{t.role === 'user' ? 'Client' : 'Stitch'}</span>
                {t.text}
              </li>
            ))}
          </ol>
        )}
      </details>

      <h3 style={{ marginTop: 16 }}>Messages with the client</h3>
      {messages.length === 0 && <p className="hint">No messages yet.</p>}
      <ol className="chat-log" aria-label="Messages">
        {messages.map((m) => (
          <li key={m.id} className={`msg ${m.sender === 'shop' ? 'user' : 'stitch'}`}>
            <span className="who">
              {m.sender === 'shop' ? 'Shop' : 'Client'}, {new Date(m.createdAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            {m.body}
          </li>
        ))}
      </ol>
      <Field id={`${hid}-reply`} label="Reply to the client" hint="They see it on their job link.">
        <textarea id={`${hid}-reply`} value={reply} onChange={(e) => setReply(e.target.value)} />
      </Field>
      <button onClick={sendReply} disabled={!reply.trim()}>
        Send reply
      </button>
      <ErrorNote error={error} />
    </section>
  );
}
