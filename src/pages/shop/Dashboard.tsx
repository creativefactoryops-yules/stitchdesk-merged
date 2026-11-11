import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { store } from '../../data';
import type { Booking, Client, Job, Quote } from '../../data/models';
import { ErrorNote, Loading } from '../../components/Layout';
import { PageHeading } from '../../lib/a11y';
import { fmtDate, money, todayIso } from '../../lib/format';
import { useShop } from './ShopApp';

export function latestQuote(quotes: Quote[], jobId: string): Quote | undefined {
  return quotes.filter((q) => q.jobId === jobId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

/** Revenue this month = quote totals (HST included) of jobs picked up this calendar month. */
export function revenueThisMonth(jobs: Job[], quotes: Quote[], now = new Date()): number {
  const ym = now.toLocaleDateString('en-CA').slice(0, 7);
  return jobs
    .filter((j) => j.stage === 'picked_up' && (j.pickupDate ?? j.updatedAt.slice(0, 10)).slice(0, 7) === ym)
    .reduce((sum, j) => sum + (latestQuote(quotes, j.id)?.total ?? 0), 0);
}

export default function Dashboard() {
  const { shop } = useShop();
  const [d, setD] = useState<{ jobs: Job[]; clients: Client[]; quotes: Quote[]; bookings: Booking[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([store.listJobs(), store.listClients(), store.listQuotes(), store.listBookings()]).then(
      ([jobs, clients, quotes, bookings]) => setD({ jobs, clients, quotes, bookings }),
      (e) => setError(e.message),
    );
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!d) return <Loading />;
  const today = todayIso();
  const clientName = (id: string | null) => d.clients.find((c) => c.id === id)?.name ?? 'Unknown client';
  const dropoffs = d.jobs.filter((j) => j.dropoffDate === today);
  const pickups = d.jobs.filter((j) => j.pickupDate === today);
  const leads = d.jobs.filter((j) => j.stage === 'lead');
  const revenue = revenueThisMonth(d.jobs, d.quotes);

  const JobList = ({ jobs, empty }: { jobs: Job[]; empty: string }) =>
    jobs.length ? (
      <ul>
        {jobs.map((j) => (
          <li key={j.id}>
            <Link to={`/shop/clients/${j.clientId}`}>{j.title || clientName(j.clientId)}</Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="muted">{empty}</p>
    );

  return (
    <>
      <PageHeading>Dashboard</PageHeading>
      <p className="muted">
        {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}. Clients book at{' '}
        <Link to={`/s/${shop.slug}`}>/s/{shop.slug}</Link>.
      </p>
      <div className="grid two">
        <section className="card" aria-labelledby="d-drop">
          <h2 id="d-drop">Today's drop-offs ({dropoffs.length})</h2>
          <JobList jobs={dropoffs} empty="No drop-offs today." />
        </section>
        <section className="card" aria-labelledby="d-pick">
          <h2 id="d-pick">Today's pickups ({pickups.length})</h2>
          <JobList jobs={pickups} empty="No pickups today." />
        </section>
        <section className="card" aria-labelledby="d-leads">
          <h2 id="d-leads">New leads ({leads.length})</h2>
          {leads.length ? (
            <ul>
              {leads.map((j) => {
                const b = d.bookings.find((x) => x.jobId === j.id);
                return (
                  <li key={j.id}>
                    <Link to={`/shop/clients/${j.clientId}`}>{j.title}</Link>
                    {b?.preferredDates.length ? `, wants ${b.preferredDates.map(fmtDate).join(' or ')}` : ''}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No new leads.</p>
          )}
        </section>
        <section className="card" aria-labelledby="d-rev">
          <h2 id="d-rev">Revenue this month</h2>
          <p className="stat">{money(revenue, true)}</p>
          <p className="hint">Quote totals with HST for jobs picked up this month.</p>
        </section>
      </div>
      <p>
        <Link className="btn primary" to="/shop/jobs">
          Open the jobs board
        </Link>
      </p>
    </>
  );
}
