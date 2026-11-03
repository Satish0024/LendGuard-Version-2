import { Link } from 'react-router-dom'
import { Icon } from '../../lib/icons'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'

export default function OverallBalance({ total, vested, loan, cashBalance, showSummary = true }) {
  return (
    <section className="overall-balance" aria-label="Overall account balance">
      <div className={`ob-top${showSummary ? '' : ' ob-top-single'}`}>
        <div className="ob-metrics">
          <div className="ob-block">
            <div className="ob-k">Account Balance</div>
            <div className="ob-v">{total}</div>
          </div>
          <div className="ob-block vested">
            <div className="ob-k">Vested Balance</div>
            <div className="ob-v">{vested}</div>
          </div>
        </div>
        {showSummary ? (
          <Link to="/account-summary" className="btn btn-secondary ob-summary">
            View summary
          </Link>
        ) : null}
      </div>
      {loan ? (
        <div className="ob-loan">
          <div className="ob-loan-row">
            <span className="loan-k">Outstanding loan balance</span>
            <span className="loan-v">{loan}</span>
          </div>
          <p className="loan-note">
            <Icon icon={faInfoCircle} size={13} aria-hidden="true" />
            <span>This loan balance is tracked separately and is not reflected in the account balances shown above.</span>
          </p>
        </div>
      ) : null}
      {cashBalance ? (
        <div className="ob-loan">
          <div className="ob-loan-row">
            <span className="loan-k">Cash balance benefit</span>
            <span className="loan-v">{cashBalance}</span>
          </div>
          <p className="loan-note">
            <Icon icon={faInfoCircle} size={13} aria-hidden="true" />
            <span>This is a notional value, tracked separately, and is removed from the account balances shown above.</span>
          </p>
        </div>
      ) : null}
    </section>
  )
}
