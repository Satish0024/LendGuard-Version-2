import { Fragment, useState } from 'react'
import { Icon } from '../../lib/icons'
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons'
import { competingFundsFor, formatMoney } from '../../data/transactions.js'
import FundDetailDialog from '../common/FundDetailDialog.jsx'

// Current-holding vs after-transfer/after-rebalance grid used by both the
// Transfer and Rebalance wizards. `editable` drives whether the target
// percentage is an input (Source Selection) or plain text (Summary).
export default function InvestmentAllocationTable({ rows, sourceTotal, afterLabel, editable, onChangePct }) {
  const [openFund, setOpenFund] = useState(null)
  const currentPctTotal = rows.reduce((sum, r) => sum + (r.pct || 0), 0)
  const currentAmountTotal = rows.reduce((sum, r) => sum + (r.amount || 0), 0)
  const afterPctTotal = rows.reduce((sum, r) => sum + (+r.afterPct || 0), 0)
  const afterAmountTotal = rows.reduce((sum, r) => sum + afterAmountOf(r, sourceTotal), 0)
  const totalsMatch = Math.round(afterPctTotal) === 100

  return (
    <div className="table-scroll">
      <table className="alloc-table">
        <thead>
          <tr className="alloc-group-row">
            <th scope="col" rowSpan={2} className="alloc-name-col">
              Investments
            </th>
            <th scope="col" colSpan={3} className="alloc-group">
              Current holding
            </th>
            <th scope="col" colSpan={3} className="alloc-group alloc-after">
              {afterLabel}
            </th>
          </tr>
          <tr>
            <th scope="col" className="num">Units</th>
            <th scope="col" className="num">Percentage</th>
            <th scope="col" className="num">Amount</th>
            <th scope="col" className="num alloc-after">Units</th>
            <th scope="col" className="num alloc-after">Percentage</th>
            <th scope="col" className="num alloc-after">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const afterAmount = afterAmountOf(r, sourceTotal)
            const afterUnits = r.nav ? afterAmount / r.nav : 0
            // A transfer-in is restricted when it would raise a fund's
            // allocation while the participant also holds a fund from the
            // same competing group — the prospectus treats them as
            // duplicative, so money can't move into one at the expense of
            // reducing exposure that's meant to stay diversified.
            const heldCompetitors =
              editable && +r.afterPct > +r.pct
                ? competingFundsFor(r.name).filter((name) => rows.some((other) => other.name === name && other.pct > 0))
                : []
            return (
              <Fragment key={r.id}>
                <tr>
                  <td className="alloc-name-col">
                    <button type="button" className="text-link fund-link alloc-name" onClick={() => setOpenFund(r)}>
                      {r.name}
                    </button>
                    <span className="alloc-nav">
                      Nav <b>{formatMoney(r.nav)}</b>
                    </span>
                  </td>
                  <td className="num">{r.units.toFixed(2)}</td>
                  <td className="num">{r.pct} %</td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td className="num alloc-after">{afterUnits.toFixed(2)}</td>
                  <td className="num alloc-after">
                    {editable ? (
                      <span className="alloc-pct-input">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`${afterLabel} percentage for ${r.name}`}
                          aria-invalid={heldCompetitors.length > 0 || undefined}
                          value={r.afterPct}
                          onChange={(e) => onChangePct(r.id, e.target.value)}
                        />
                        <i>%</i>
                      </span>
                    ) : (
                      `${r.afterPct} %`
                    )}
                  </td>
                  <td className="num alloc-after">{formatMoney(afterAmount)}</td>
                </tr>
                {heldCompetitors.length > 0 && (
                  <tr className="alloc-restricted-row">
                    <td colSpan={7}>
                      <Icon icon={faExclamationCircle} size={13} aria-hidden="true" />
                      Transfer in is restricted as it is a competing fund of Investment(s) - {heldCompetitors.join(', ')}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          <tr className="alloc-total">
            <td className="alloc-name-col">Total</td>
            <td className="num" />
            <td className="num">{Math.round(currentPctTotal)} %</td>
            <td className="num">{formatMoney(currentAmountTotal)}</td>
            <td className="num alloc-after" />
            <td className={`num alloc-after${totalsMatch ? '' : ' alloc-off'}`}>{Math.round(afterPctTotal)} %</td>
            <td className="num alloc-after">{formatMoney(afterAmountTotal)}</td>
          </tr>
        </tbody>
      </table>
      {editable && !totalsMatch && (
        <p className="alloc-warn" role="alert">Target percentages must add up to 100%. Currently {Math.round(afterPctTotal)}%.</p>
      )}
      {openFund && (
        <FundDetailDialog
          name={openFund.name}
          onClose={() => setOpenFund(null)}
          fields={[
            { label: 'Nav', value: formatMoney(openFund.nav) },
            { label: 'Current units', value: openFund.units?.toFixed(2) },
            { label: 'Current percentage', value: `${openFund.pct} %` },
            { label: 'Current amount', value: formatMoney(openFund.amount) }
          ]}
        />
      )}
    </div>
  )
}

function afterAmountOf(row, sourceTotal) {
  return ((+row.afterPct || 0) / 100) * sourceTotal
}
