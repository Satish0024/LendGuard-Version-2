import { useState } from 'react'
import { Icon } from '../../lib/icons'
import { faExclamationTriangle, faSearch } from '@fortawesome/free-solid-svg-icons'
import Slideover from '../common/Slideover.jsx'
import { NAV_DISCLAIMER, computeBuySell, formatMoney } from '../../data/transactions.js'

// Read-only ledger of the buys and sells a rebalance would generate for one
// source, derived from the current-vs-target rows.
export default function BuySellDetailsSlideover({ sourceName, rows, sourceTotal, onClose }) {
  const [query, setQuery] = useState('')

  const priced = rows.map((r) => ({ ...r, afterAmount: ((+r.afterPct || 0) / 100) * sourceTotal }))
  const { trades, buyCount, sellCount, totalAmount } = computeBuySell(priced)
  const visible = trades.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Slideover
      title="Buy/Sell details"
      width="wide"
      onClose={onClose}
      actions={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="buysell-banner">
        <Icon icon={faExclamationTriangle} size={20} />
        <span>{NAV_DISCLAIMER}</span>
      </div>

      <div className="buysell-summary">
        <div>
          <span>Source Name</span>
          <b>{sourceName}</b>
        </div>
        <div>
          <span>Total investments</span>
          <b>{String(trades.length).padStart(2, '0')}</b>
        </div>
        <div>
          <span className="buy">Buy</span>
          <b>{String(buyCount).padStart(2, '0')}</b>
        </div>
        <div>
          <span className="sell">Sell</span>
          <b>{String(sellCount).padStart(2, '0')}</b>
        </div>
        <div>
          <span>Total amount</span>
          <b>{formatMoney(totalAmount)}</b>
        </div>
      </div>

      <div className="add-inv-search">
        <Icon icon={faSearch} size={15} />
        <input
          type="search"
          placeholder="Search Investment name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="table-scroll">
        <table className="alloc-table buysell-table">
          <thead>
            <tr>
              <th scope="col">Investment name</th>
              <th scope="col">Transactions</th>
              <th scope="col" className="num">Amount</th>
              <th scope="col" className="num">NAV</th>
              <th scope="col" className="num">Units</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className={t.action === 'Buy' ? 'buy' : 'sell'}>{t.action}</td>
                <td className="num">{formatMoney(t.amount)}</td>
                <td className="num">{formatMoney(t.nav)}</td>
                <td className="num">{t.units.toFixed(2)}</td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={5} className="buysell-empty">
                  {trades.length
                    ? 'No investments match that search.'
                    : 'No trades yet — adjust a target percentage to see buys and sells.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Slideover>
  )
}
