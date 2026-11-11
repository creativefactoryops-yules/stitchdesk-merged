import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeading } from '../lib/a11y';
import { DEMO_SLUG } from '../data/seed';
import { isDemo } from '../data';

export default function Home() {
  return (
    <Layout>
      <PageHeading>Stitch: the front desk that never puts the needle down</PageHeading>
      <p>
        Stitch is a copper shop robot (model CR-7) for upholstery shops. Clients chat with Stitch, get an instant
        estimate, see an AI preview of their piece in a new fabric, and book a drop-off. Your staff run every job from one
        board.
      </p>
      <div className="grid two">
        <section className="card" aria-labelledby="h-clients">
          <h2 id="h-clients">For your clients</h2>
          <ul>
            <li>Chat by text or voice, with a job sheet that fills itself</li>
            <li>Instant yardage and price range with 13% HST shown</li>
            <li>Before and after previews from a photo</li>
            <li>Dream-project builder, swatch library, booking</li>
            <li>A private link to follow their job</li>
          </ul>
          {isDemo && (
            <Link className="btn primary" to={`/s/${DEMO_SLUG}`}>
              Try the demo shop as a client
            </Link>
          )}
        </section>
        <section className="card" aria-labelledby="h-shop">
          <h2 id="h-shop">For your shop</h2>
          <ul>
            <li>Dashboard: today's drop-offs, pickups, new leads, revenue</li>
            <li>Jobs board from lead to picked up</li>
            <li>Client files, quote builder with printable quotes</li>
            <li>Suppliers, swatches, and Teach Stitch your own answers</li>
          </ul>
          <Link className="btn primary" to="/shop">
            {isDemo ? 'Open the demo shop desk' : 'Staff sign in'}
          </Link>
        </section>
      </div>
      <section className="card" aria-labelledby="h-price">
        <h2 id="h-price">Price</h2>
        <p>Free for 14 days, then $29 CAD a month per shop. No card needed to start.</p>
      </section>
    </Layout>
  );
}
