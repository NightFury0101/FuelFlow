import { useEffect, useState } from 'react';
import { PLAN_TABLE, PREMIUM_PITCH } from '../lib/plans';
import { introText, periodLabel, planName, savingVsMonthly, type PurchasesPackage } from '../lib/billing';
import { usePremium } from '../lib/premium';
import { useStore } from '../lib/store';
import { isNativeApp } from '../lib/platform';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { Link, navigate } from '../router';

const APPLE_SUBSCRIPTIONS = 'https://apps.apple.com/account/subscriptions';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function PlanTable() {
  return (
    <Card>
      <table className="plan-table">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Free</th>
            <th scope="col" className="accent">
              Premium
            </th>
          </tr>
        </thead>
        <tbody>
          {PLAN_TABLE.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {[r.free, r.premium].map((v, i) => (
                <td key={i}>{v === true ? <Icon name="check" size={18} className="accent" aria-label="Included" /> : v === false ? <span className="muted">—</span> : <span className="small">{v}</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Everything in the Free column stays free.</p>
    </Card>
  );
}

function FinePrint() {
  return (
    <p className="muted small fine-print">
      Payment is charged to your Apple ID when you confirm. The subscription renews automatically at the same price unless you cancel at least 24 hours before the end of the current period. Manage or cancel any time in your Apple ID settings. See our{' '}
      <Link to="/terms" className="accent">
        terms of use
      </Link>{' '}
      and{' '}
      <Link to="/privacy" className="accent">
        privacy policy
      </Link>
      .
    </p>
  );
}

function PackageOption({ pkg, all, selected, onSelect }: { pkg: PurchasesPackage; all: PurchasesPackage[]; selected: boolean; onSelect: () => void }) {
  const saving = savingVsMonthly(pkg, all);
  const intro = introText(pkg);
  return (
    <button type="button" role="radio" aria-checked={selected} className={'plan-option' + (selected ? ' on' : '')} onClick={onSelect}>
      <span className="plan-radio" aria-hidden="true" />
      <span className="plan-main">
        <strong>
          {planName(pkg)} {saving ? <span className="badge">Save {saving}%</span> : null}
        </strong>
        {intro && <span className="small accent">{intro}, then</span>}
      </span>
      <span className="plan-price">
        <strong>{pkg.product.priceString}</strong>
        <span className="muted small">/ {periodLabel(pkg)}</span>
      </span>
    </button>
  );
}

function Subscribe() {
  const store = useStore();
  const premium = usePremium();
  const { packages } = premium;
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    if (!choice && packages.length) setChoice(packages[0].identifier);
  }, [packages, choice]);
  const pkg = packages.find((p) => p.identifier === choice) ?? packages[0];

  if (!packages.length) {
    return (
      <Card className="status-card">
        {premium.error ? (
          <>
            <p className="notice warn small">
              <Icon name="alert" size={16} /> {premium.error}
            </p>
            <button className="btn btn-secondary block" onClick={() => window.location.reload()}>
              Try again
            </button>
          </>
        ) : (
          <div className="page-loading" aria-label="Loading prices" />
        )}
      </Card>
    );
  }

  return (
    <Card className="status-card">
      <div className="plan-options" role="radiogroup" aria-label="Choose a plan">
        {packages.map((p) => (
          <PackageOption key={p.identifier} pkg={p} all={packages} selected={p.identifier === pkg.identifier} onSelect={() => setChoice(p.identifier)} />
        ))}
      </div>
      {premium.error && (
        <p className="notice warn small" role="alert">
          <Icon name="alert" size={16} /> {premium.error}
        </p>
      )}
      <button
        className="btn btn-primary block"
        disabled={premium.busy}
        onClick={async () => {
          const r = await premium.buy(pkg);
          if (r === 'done') store.showToast('Welcome to FuelFlow Premium');
        }}
      >
        {premium.busy ? 'Please wait…' : introText(pkg) ? `Try ${introText(pkg)}, then ${pkg.product.priceString} / ${periodLabel(pkg)}` : `Subscribe for ${pkg.product.priceString} / ${periodLabel(pkg)}`}
      </button>
      <button
        className="btn btn-ghost block"
        disabled={premium.busy}
        onClick={async () => {
          const r = await premium.restore();
          if (r === 'restored') store.showToast('Premium restored');
          else if (r === 'none') store.showToast('No active Premium subscription found for this Apple ID.');
        }}
      >
        Restore purchases
      </button>
      <FinePrint />
    </Card>
  );
}

function Subscribed() {
  const store = useStore();
  const premium = usePremium();
  const e = premium.entitlement;
  const date = formatDate(e?.expirationDate ?? null);
  return (
    <Card className="status-card premium-active">
      <p className="small muted">Your plan</p>
      <p className="big-num">
        Premium <Icon name="check" size={22} className="accent" />
      </p>
      {date && <p className="small">{e?.willRenew === false ? `Ends on ${date}. You can renew any time.` : `${e?.periodType === 'TRIAL' ? 'Free trial — first payment' : 'Renews'} on ${date}.`}</p>}
      <button className="btn btn-primary block" onClick={() => navigate('/coach')}>
        <Icon name="sparkles" size={18} /> Ask your coach
      </button>
      <a className="btn btn-secondary block" href={premium.managementURL || APPLE_SUBSCRIPTIONS} target="_blank" rel="noreferrer">
        Manage subscription
      </a>
      <button
        className="btn btn-ghost block"
        disabled={premium.busy}
        onClick={async () => {
          const r = await premium.restore();
          if (r === 'restored') store.showToast('Premium is active');
        }}
      >
        Restore purchases
      </button>
    </Card>
  );
}

export function Premium() {
  const premium = usePremium();
  const inApp = isNativeApp();
  return (
    <div className="page premium">
      <Link to="/profile" className="back-link">
        <Icon name="left" size={16} /> Profile
      </Link>
      <header className="premium-hero">
        <span className="crown">
          <Icon name="crown" size={26} />
        </span>
        <h1>FuelFlow Premium</h1>
        <p className="muted">{PREMIUM_PITCH}</p>
      </header>

      {premium.available && premium.status === 'premium' && <Subscribed />}
      {premium.available && premium.status === 'free' && <Subscribe />}
      {premium.available && premium.status === 'loading' && <div className="page-loading" aria-label="Loading" />}

      <PlanTable />

      {!inApp && (
        <Card className="status-card">
          <p className="small muted">Your plan</p>
          <p className="big-num">Free</p>
          <p className="muted small">Premium is available in the FuelFlow iPhone app, paid securely through your Apple ID. Nothing can be bought on this website.</p>
        </Card>
      )}
    </div>
  );
}
