/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** Page heading that takes focus when the page opens, so screen readers announce where you are. */
export function PageHeading({ children, level = 1 }: { children: ReactNode; level?: 1 | 2 }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const Tag = level === 1 ? 'h1' : 'h2';
  return (
    <Tag ref={ref} tabIndex={-1}>
      {children}
    </Tag>
  );
}

const AnnounceCtx = createContext<(msg: string) => void>(() => {});

/** One polite live region for short status messages ("Moved to Ready", "Saved"). */
export function Announcer({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const announce = useCallback((m: string) => {
    setMsg('');
    setTimeout(() => setMsg(m), 50);
  }, []);
  return (
    <AnnounceCtx.Provider value={announce}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {msg}
      </div>
    </AnnounceCtx.Provider>
  );
}

export const useAnnounce = () => useContext(AnnounceCtx);
