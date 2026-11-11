/* © 2026 Yules · CreativeFactory.studio · buildyou. Stitch, CR-7 and this software are original work. All rights reserved. */
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PageHeading } from '../lib/a11y';

export default function NotFound() {
  return (
    <Layout>
      <PageHeading>Page not found</PageHeading>
      <p>
        That link does not lead anywhere. <Link to="/">Go to the start page</Link>.
      </p>
    </Layout>
  );
}
