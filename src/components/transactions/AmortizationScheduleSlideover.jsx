import Slideover from '../common/Slideover.jsx'
import { computeAmortizationSchedule, formatMoney, LOAN_INTEREST_RATE } from '../../data/transactions.js'

// Wide slideover showing a per-period principal/interest/balance breakdown
// for the loan amount + term currently entered in the wizard.
export default function AmortizationScheduleSlideover({ principal, termMonths, onClose }) {
  const rows = computeAmortizationSchedule(principal, LOAN_INTEREST_RATE, termMonths)

  return (
    <Slideover title="Amortization Schedule" width="wide" onClose={onClose}>
      <p className="hint" style={{ marginTop: 'var(--core-space-0)' }}>
        Estimated repayment schedule for {formatMoney(principal)} at {LOAN_INTEREST_RATE}% over {termMonths} month(s).
      </p>
      <div className="table-scroll">
        <table className="wd-alloc-table">
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="num">Payment</th>
              <th scope="col" className="num">Principal</th>
              <th scope="col" className="num">Interest</th>
              <th scope="col" className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period}>
                <td>{r.period}</td>
                <td className="num">{formatMoney(r.payment)}</td>
                <td className="num">{formatMoney(r.principal)}</td>
                <td className="num">{formatMoney(r.interest)}</td>
                <td className="num">{formatMoney(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Slideover>
  )
}
