/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
export { money } from '../../shared/estimator';

export const todayIso = () => new Date().toLocaleDateString('en-CA');

export function fmtDate(d: string | null | undefined): string {
  if (!d) return 'not set';
  const date = d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d);
  return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function trialDaysLeft(startIso: string, now = Date.now()): number {
  const end = new Date(startIso).getTime() + 14 * 86400000;
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
