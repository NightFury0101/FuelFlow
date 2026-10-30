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
        <p className="muted">Everything you need is free today. Premium is planned for extras like a built-in coach and sharing progress with your trainer.</p>
      </header>

      <Card>
        <table className="plan-table">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col" className="accent">
                Premium <span className="muted small">(planned)</span>
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
        <p className="muted small">Premium isn’t available yet and nothing is charged. When it launches, the free features above stay free.</p>
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
            <p className="muted small">Payments aren’t set up, so nothing can be charged. Everything in the Free column is yours now.</p>
          </>
        )}
      </Card>
    </div>
  );
}
