import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { store } from '../../data';
import { ErrorNote, Field } from '../../components/Layout';
import { JobSheetView } from '../../components/JobSheetView';
import { PageHeading } from '../../lib/a11y';
import { money, todayIso } from '../../lib/format';
import { usePortal } from './ShopPortal';

export default function BookPanel() {
  const p = usePortal();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('email');
  const [dates, setDates] = useState(['', '', '']);
  const [message, setMessage] = useState('');
  const [shareChat, setShareChat] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const shop = p.data.shop;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Please add your name.');
    if (!email.trim() && !phone.trim()) return setError('Please add an email or a phone number so the shop can reach you.');
    if (!dates[0]) return setError('Please pick at least one drop-off date.');
    setBusy(true);
    try {
      const res = await store.createBooking(p.slug, {
        name, email, phone, contactMethod: contact, preferredDates: dates.filter(Boolean), message,
        sheet: p.sheet,
        estimateLow: p.est?.totalLow ?? null,
        estimateHigh: p.est?.totalHigh ?? null,
        transcript: shareChat ? p.history.filter((t) => !t.offline).map(({ role, text, at }) => ({ role, text, at })) : [],
        renders: p.renders,
        beforePhoto: p.beforePhoto,
      });
      setToken(res.token);
    } catch (err) {
      setError((err as Error).message || 'Booking failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    const link = `${window.location.origin}${import.meta.env.VITE_HASH_ROUTER === '1' ? window.location.pathname + '#' : ''}/j/${token}`;
    return (
      <>
        <PageHeading>Request sent</PageHeading>
        <section className="card">
          <p>
            Thanks, {name.split(' ')[0]}. {shop.name} has your request and will confirm your drop-off date.
          </p>
          <h2>Your private job link</h2>
          <p>Keep this link. It shows your job's progress, photos and quote, and lets you message the shop.</p>
          <p style={{ wordBreak: 'break-all' }}>
            <Link to={`/j/${token}`}>{link}</Link>
          </p>
          <button onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
        </section>
        <DepositNote />
      </>
    );
  }

  return (
    <>
      <PageHeading>Book this</PageHeading>
      <p className="muted">Send a drop-off request. Nothing is charged here.</p>
      <JobSheetView sheet={p.sheet} />
      {p.est && p.est.yards > 0 && (
        <p>
          Your estimate: about {money(p.est.totalLow)} to {money(p.est.totalHigh)} including HST. Approximate, confirmed after inspection.
        </p>
      )}
      <form className="card" onSubmit={submit} noValidate>
        <Field id="bk-name" label="Your name">
          <input id="bk-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid two">
          <Field id="bk-email" label="Email">
            <input id="bk-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="bk-phone" label="Phone">
            <input id="bk-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <fieldset>
          <legend>Best way to reach you</legend>
          <div className="row">
            {[['email', 'Email'], ['phone', 'Phone call'], ['text', 'Text message']].map(([v, l]) => (
              <label className="check" key={v}>
                <input type="radio" name="contact" value={v} checked={contact === v} onChange={() => setContact(v)} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Preferred drop-off dates</legend>
          <div className="grid three">
            {dates.map((d, i) => (
              <Field key={i} id={`bk-date-${i}`} label={i === 0 ? 'First choice' : i === 1 ? 'Second choice' : 'Third choice'}>
                <input
                  id={`bk-date-${i}`}
                  type="date"
                  min={todayIso()}
                  value={d}
                  onChange={(e) => setDates(dates.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </Field>
            ))}
          </div>
          {shop.hours && <p className="hint">Shop hours: {shop.hours}</p>}
        </fieldset>
        <Field id="bk-msg" label="Anything else the shop should know?">
          <textarea id="bk-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={shareChat} onChange={(e) => setShareChat(e.target.checked)} />
          Share my chat with Stitch so the shop has the details
        </label>
        {(p.beforePhoto || p.renders.length > 0) && (
          <p className="hint">Your photo and {p.renders.length} preview(s) will be attached.</p>
        )}
        <ErrorNote error={error} />
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send booking request'}
        </button>
      </form>
      <DepositNote />
    </>
  );
}

function DepositNote() {
  const { data } = usePortal();
  const s = data.shop;
  return (
    <section className="card" aria-labelledby="dep-h">
      <h2 id="dep-h">Deposits</h2>
      <p>
        Once the shop confirms your quote, a {s.depositPercent}% deposit holds your spot. Pay it by Interac e-Transfer to{' '}
        <strong>{s.etransferEmail || 'the email the shop gives you'}</strong>. Put your name and the piece in the message.
      </p>
      <p className="muted">The shop never asks for card numbers in this app.</p>
    </section>
  );
}
