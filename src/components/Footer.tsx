/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */

export const COPYRIGHT =
  '© 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved.';

/** Only these exact, owner-confirmed links. No Facebook, TikTok or X (no known public URL). */
export const FOOTER_LINKS: { label: string; srLabel: string; href: string }[] = [
  { label: 'Portfolio', srLabel: 'Portfolio of Yules', href: 'https://force-folio.netlify.app' },
  { label: 'Ko-fi', srLabel: 'Support Yules on Ko-fi', href: 'https://ko-fi.com/creativefactorystudio' },
  { label: 'Instagram', srLabel: 'CreativeFactory.studio on Instagram', href: 'https://www.instagram.com/creativefactory.studio/' },
  { label: 'DEV', srLabel: 'Yules on DEV', href: 'https://dev.to/yules' },
  { label: 'Medium', srLabel: 'Yules on Medium', href: 'https://medium.com/@yules_buildyou' },
  { label: 'GitHub', srLabel: 'Yules on GitHub', href: 'https://github.com/creativefactoryops-yules' },
  { label: 'Threads', srLabel: 'CreativeFactory.studio on Threads', href: 'https://www.threads.net/@creativefactory.studio' },
];

/** Third-party credits that their licences ask for. */
export const CREDITS =
  'Font: JetBrains Mono (SIL OFL 1.1). Built with React (MIT); old look styles include Tailwind CSS (MIT). AI previews: Pollinations.ai.';

function Links({ linkClass }: { linkClass?: string }) {
  return (
    <ul className="footer-links" aria-label="Links">
      {FOOTER_LINKS.map((l) => (
        <li key={l.href}>
          <a className={linkClass} href={l.href} target="_blank" rel="noopener" aria-label={`${l.srLabel} (opens in a new tab)`}>
            {l.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Footer in the old chat's style (10px, centred, terminal-green links). Lives inside the .oc look. */
export function OldFooter() {
  return (
    <footer className="text-[10px] text-[#8a847d] text-center py-6 leading-tight oc-footer">
      <p>{COPYRIGHT}</p>
      <Links linkClass="terminal-green" />
      <p className="mt-2">{CREDITS}</p>
    </footer>
  );
}

/** Same footer for the v2 pages (/j/…, /shop, home). */
export function SiteFooter() {
  return (
    <footer className="wrap muted no-print site-footer">
      <p>
        <small>{COPYRIGHT}</small>
      </p>
      <Links />
      <p>
        <small>AI previews and estimates are approximate. {CREDITS}</small>
      </p>
    </footer>
  );
}
