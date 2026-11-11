/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isDemo } from '../data';
import { SiteFooter } from './Footer';

export function Layout({ title, nav, children, home = '/' }: { title?: string; nav?: ReactNode; children: ReactNode; home?: string }) {
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap">
          <Link to={home} className="brand">
            <span className="dot" aria-hidden="true" />
            {title ?? 'STITCH'}
          </Link>
        </div>
      </header>
      {nav}
      <main id="main" tabIndex={-1} className="wrap">
        {isDemo && (
          <p className="demo-banner">
            Demo mode: no database is connected, so everything is saved only on this phone (in this browser).
          </p>
        )}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

export function Field(props: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.hint && (
        <div className="hint" id={props.id + '-hint'}>
          {props.hint}
        </div>
      )}
    </div>
  );
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <p role="status">{what}…</p>;
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}
