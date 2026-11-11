import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { pieceById } from '../../../shared/estimator';
import { STAGES, STAGE_LABEL, type Stage } from '../../../shared/types';
import { store } from '../../data';
import type { Client, Job } from '../../data/models';
import { ErrorNote, Loading } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';
import { fmtDate } from '../../lib/format';

export default function JobsBoard() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const announce = useAnnounce();

  useEffect(() => {
    Promise.all([store.listJobs(), store.listClients()]).then(
      ([j, c]) => {
        setJobs(j);
        setClients(c);
      },
      (e) => setError(e.message),
    );
  }, []);

  async function move(job: Job, stage: Stage) {
    if (job.stage === stage) return;
    const prev = jobs;
    setJobs((js) => js!.map((j) => (j.id === job.id ? { ...j, stage } : j)));
    try {
      await store.updateJob(job.id, { stage });
      announce(`${job.title} moved to ${STAGE_LABEL[stage]}.`);
    } catch (e) {
      setJobs(prev);
      setError((e as Error).message);
    }
  }

  if (error) return <ErrorNote error={error} />;
  if (!jobs) return <Loading />;
  const name = (id: string | null) => clients.find((c) => c.id === id)?.name ?? '';

  return (
    <>
      <PageHeading>Jobs board</PageHeading>
      <p className="muted">Drag a card to another column, or use the move buttons on each card.</p>
      <div className="board">
        {STAGES.map((stage, si) => {
          const list = jobs.filter((j) => j.stage === stage);
          return (
            <section
              key={stage}
              className={`column${over === stage ? ' drop' : ''}`}
              aria-labelledby={`col-${stage}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const job = jobs.find((j) => j.id === (dragId ?? e.dataTransfer.getData('text/plain')));
                if (job) void move(job, stage);
              }}
            >
              <h2 id={`col-${stage}`}>
                {STAGE_LABEL[stage]} <span className="muted">({list.length})</span>
              </h2>
              <ul>
                {list.map((j) => (
                  <li
                    key={j.id}
                    className="job-card"
                    draggable
                    onDragStart={(e) => {
                      setDragId(j.id);
                      e.dataTransfer.setData('text/plain', j.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                  >
                    <h3 style={{ marginBottom: 4 }}>
                      <Link to={`/shop/clients/${j.clientId}`}>{j.title || name(j.clientId)}</Link>
                    </h3>
                    <div className="hint">
                      {j.piece ? pieceById(j.piece).label : 'Piece not set'}
                      {j.fabric ? `, ${j.fabric}` : ''}
                      {j.dropoffDate ? `. Drop-off ${fmtDate(j.dropoffDate)}` : ''}
                      {j.pickupDate ? `. Pickup ${fmtDate(j.pickupDate)}` : ''}
                    </div>
                    <div className="row" style={{ marginTop: 6 }}>
                      {si > 0 && (
                        <button onClick={() => move(j, STAGES[si - 1])} aria-label={`Move ${j.title} back to ${STAGE_LABEL[STAGES[si - 1]]}`}>
                          ◀ Back
                        </button>
                      )}
                      {si < STAGES.length - 1 && (
                        <button onClick={() => move(j, STAGES[si + 1])} aria-label={`Move ${j.title} forward to ${STAGE_LABEL[STAGES[si + 1]]}`}>
                          Next ▶
                        </button>
                      )}
                      <Link className="btn" to={`/shop/quote/${j.id}`} aria-label={`Quote for ${j.title}`}>
                        Quote
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              {list.length === 0 && <p className="hint">Empty</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
