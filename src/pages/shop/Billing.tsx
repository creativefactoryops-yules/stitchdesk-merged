import { PageHeading } from '../../lib/a11y';
import { trialDaysLeft } from '../../lib/format';
import { useShop } from './ShopApp';

// Billing is a placeholder: no payment provider is connected and nothing is charged.
export default function Billing() {
  const { shop } = useShop();
  const days = trialDaysLeft(shop.trialStartedAt);
  const ends = new Date(new Date(shop.trialStartedAt).getTime() + 14 * 86400000);
  return (
    <>
      <PageHeading>Billing</PageHeading>
      <section className="card">
        <h2>Your plan</h2>
        <p>
          {shop.plan === 'trial'
            ? `Free trial: ${days} day${days === 1 ? '' : 's'} left (ends ${ends.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' })}).`
            : `Plan: ${shop.plan}.`}
        </p>
        <p>After the trial, Stitch is $29 CAD a month per shop, plus tax.</p>
        <button className="primary" disabled aria-describedby="bill-note">
          Subscribe for $29 CAD a month
        </button>
        <p id="bill-note" className="notice">
          Online payments are not switched on yet, so nothing is charged and the app keeps working after the trial. To
          subscribe now, contact CreativeFactory.studio.
        </p>
      </section>
    </>
  );
}
