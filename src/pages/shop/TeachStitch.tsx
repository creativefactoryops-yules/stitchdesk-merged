/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { useEffect, useState, type FormEvent } from 'react';
import type { FaqEntry } from '../../../shared/types';
import { store } from '../../data';
import { ErrorNote, Field, Loading } from '../../components/Layout';
import { PageHeading, useAnnounce } from '../../lib/a11y';

export default function TeachStitch() {
  const [list, setList] = useState<FaqEntry[] | null>(null);
  const [edit, setEdit] = useState<FaqEntry>({ id: '', question: '', answer: '' });
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();
  const load = () => store.listFaq().then(setList, (e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (edit.question.trim().length < 3 || !edit.answer.trim()) return setError('Add a question and an answer.');
    try {
      await store.saveFaq({ ...edit, question: edit.question.trim(), answer: edit.answer.trim() });
      setEdit({ id: '', question: '', answer: '' });
      setError(null);
      await load();
      announce('Stitch learned it.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!list) return error ? <ErrorNote error={error} /> : <Loading />;
  return (
    <>
      <PageHeading>Teach Stitch</PageHeading>
      <p className="muted">
        Add your shop's own answers: turnaround times, pickup and delivery, warranty, parking. Stitch uses them for your
        clients only, and they win over general trade knowledge.
      </p>
      <form className="card" onSubmit={submit}>
        <h2>{edit.id ? 'Edit answer' : 'New answer'}</h2>
        <Field id="ts-q" label="Question a client might ask">
          <input id="ts-q" value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} maxLength={300} />
        </Field>
        <Field id="ts-a" label="Your answer">
          <textarea id="ts-a" value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} maxLength={1500} />
        </Field>
        <ErrorNote error={error} />
        <div className="row">
          <button type="submit" className="primary">
            Save
          </button>
          {edit.id && (
            <button type="button" onClick={() => setEdit({ id: '', question: '', answer: '' })}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <h2>What Stitch knows about your shop ({list.length})</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {list.map((f) => (
          <li key={f.id} className="card tight">
            <h3>{f.question}</h3>
            <p>{f.answer}</p>
            <div className="row">
              <button onClick={() => setEdit(f)} aria-label={`Edit: ${f.question}`}>
                Edit
              </button>
              <button
                className="danger"
                aria-label={`Delete: ${f.question}`}
                onClick={async () => {
                  if (!confirm('Delete this answer?')) return;
                  await store.deleteFaq(f.id);
                  await load();
                  announce('Deleted.');
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
