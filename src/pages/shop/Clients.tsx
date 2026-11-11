import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { store } from '../../data';
import type { Client, Job } from '../../data/models';
import { ErrorNote, Field, Loading } from '../../components/Layout';
import { PageHeading } from '../../lib/a11y';
import { STAGE_LABEL } from '../../../shared/types';

export default function Clients() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([store.listClients(), store.listJobs()]).then(
      ([c, j]) => {
        setClients(c);
        setJobs(j);
      },
      (e) => setError(e.message),
    );
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!clients) return <Loading />;
  const shown = clients.filter((c) => `${c.name} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeading>Client files</PageHeading>
      <p className="muted">New clients appear here when they book through Stitch.</p>
      <Field id="cl-search" label="Search clients">
        <input id="cl-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <p role="status" className="hint">
        {shown.length} client{shown.length === 1 ? '' : 's'}
      </p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {shown.map((c) => {
          const cj = jobs.filter((j) => j.clientId === c.id);
          return (
            <li key={c.id} className="card tight">
              <h2 style={{ fontSize: '1rem', marginBottom: 2 }}>
                <Link to={`/shop/clients/${c.id}`}>{c.name}</Link>
              </h2>
              <div className="hint">
                {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact details'}
                {cj.length ? ` · ${cj.map((j) => STAGE_LABEL[j.stage]).join(', ')}` : ''}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
