/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { Link } from 'react-router-dom';
import { isDemo } from '../../data';
import { PageHeading } from '../../lib/a11y';
import { usePortal } from './ShopPortal';

/** "My job" pill: opens this device's job link, or explains how to get one. */
export default function StatusPanel() {
  const p = usePortal();
  return (
    <>
      <PageHeading>My job</PageHeading>
      {p.jobToken ? (
        <section className="card">
          <p>Your private job link shows your job's progress, the quote and photos, and lets you message the shop.</p>
          <p>
            <Link className="btn primary" to={`/j/${p.jobToken}`}>
              Open my job
            </Link>
          </p>
        </section>
      ) : (
        <section className="card">
          <p>You have not booked from this phone yet. When you send a drop-off request, your private job link appears here.</p>
          <p>
            <Link className="btn primary" to={`/s/${p.slug}/book`}>
              Book a drop-off
            </Link>
          </p>
        </section>
      )}
      {isDemo && (
        <p className="notice">
          Demo mode: the job link only opens on this phone, in this browser. With the shop's database connected, it opens
          anywhere.
        </p>
      )}
    </>
  );
}
