import { BILLING_ENABLED, PLAN_TABLE, PRICING } from '../lib/plans';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { Link } from '../router';

export function Premium() {
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
        <p className="muted">More insight, faster logging, and planning tools — for people who want to go further.</p>
      </header>

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
        <p className="muted small">*Fair-use limits apply to the AI coach.</p>
      </Card>

      <Card className="status-card">
        <p className="small muted">Your plan</p>
        <p className="big-num">Free</p>
        {BILLING_ENABLED && PRICING.monthly ? (
          <button className="btn btn-primary block">Upgrade — {PRICING.monthly}/month</button>
        ) : (
          <>
            <button className="btn btn-primary block" disabled>
              Premium is coming soon
            </button>
            <p className="muted small">Payments aren’t set up yet, so nothing can be charged. Until then, every feature listed above is available to you for free.</p>
          </>
        )}
      </Card>
    </div>
  );
}
