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
