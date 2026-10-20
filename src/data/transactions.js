import { formatMoney, isSummaryPlan, parseMoney, planBalance, planVested } from '../lib/accountSummary'

export const TRANSACTION_TYPES = [
  {
    id: 'loan',
    label: 'Loan',
    hint: 'Borrow money from your account. Interest applies.',
    to: (planId) => `/transactions/request/loan?plan=${planId}`
  },
  {
    id: 'withdrawal',
    label: 'Withdrawal',
    hint: 'Taxes and penalties may apply.',
    to: (planId) => `/transactions/request/withdrawal?plan=${planId}`
  },
  {
    id: 'transfer',
    label: 'Transfer',
    hint: 'Manage money across your investments.',
    to: (planId) => `/transactions/request/transfer?plan=${planId}`
  },
  {
    id: 'rebalance',
    label: 'Rebalance',
    hint: 'Reset your investments back to target percentages.',
    to: (planId) => `/transactions/request/rebalance?plan=${planId}`
  },
  {
    id: 'rollover',
    label: 'Rollover',
    hint: 'Move money from a former employer plan or IRA into this plan.',
    to: (planId) => `/transactions/request/rollover?plan=${planId}`
  }
]

// A plan is transaction-eligible only once it holds a balance participants can
// actually act on — mirrors how Account Summary decides which plans to show.
export function isTransactablePlan(plan) {
  return isSummaryPlan(plan) && planBalance(plan) > 0
}

export function transactablePlans(participant) {
  return (participant.plans || []).filter(isTransactablePlan)
}

// Loans and withdrawals need real cash to draw from; a transfer only needs an
// existing balance to reallocate, which is already covered by isTransactablePlan.
export function canRequest(plan, typeId) {
  if (!isTransactablePlan(plan)) return false
  if (typeId === 'loan' || typeId === 'withdrawal') return planVested(plan) > 0
  // Transfer and rebalance both reallocate existing holdings, so they need a
  // real investment lineup to act on rather than just a balance.
  if (typeId === 'transfer' || typeId === 'rebalance') return (plan.investments || []).length > 0
  return true
}

// A participant's personal eligible maximum is the lesser of 50% of vested
// balance and the plan-wide cap, with a $300 floor — a simplified stand-in for
// the real regulatory calculation, kept in one place so it's never hardcoded
// per screen.
const PLAN_WIDE_LOAN_CAP = 50000
const LOAN_FLOOR = 300

// `outstandingBalance` is any existing active loan balance on this plan —
// per plan policy, the cap is reduced dollar-for-dollar by what's already
// borrowed (mirrors the Figma policy copy: "50% of vested balance or
// $50,000, minus the outstanding loan balance").
export function loanLimits(plan, outstandingBalance = 0) {
  const vested = planVested(plan)
  const capBeforeOutstanding = Math.min(PLAN_WIDE_LOAN_CAP, Math.round(vested * 0.5))
  const max = Math.max(0, capBeforeOutstanding - Math.round(outstandingBalance || 0))
  return { min: max > 0 ? Math.min(LOAN_FLOOR, max) : 0, max }
}

// Simple daily-accrual estimate used by the loan calculator slideover — not
// a real amortization schedule, just enough to show a plausible principal +
// interest breakdown for a target catch-up or payoff date.
export function computeLoanPayoff({ balance, targetDate, mode, aprPct = 8.5, missedPayments = 2, monthlyPayment = 0 }) {
  const today = new Date()
  const target = targetDate ? new Date(targetDate) : today
  const days = Math.max(0, Math.round((target - today) / (1000 * 60 * 60 * 24)))
  const dailyRate = aprPct / 100 / 365

  if (mode === 'catchup') {
    const principal = Math.round(monthlyPayment * missedPayments * 100) / 100
    const interest = Math.round(principal * dailyRate * days * 100) / 100
    return { principal, interest, total: Math.round((principal + interest) * 100) / 100, days }
  }

  const principal = Math.round((balance || 0) * 100) / 100
  const interest = Math.round(principal * dailyRate * days * 100) / 100
  return { principal, interest, total: Math.round((principal + interest) * 100) / 100, days }
}

export function estimatePeriodicPayment(amount, years, months, aprPct = 8.5) {
  const totalMonths = Math.max(1, (years || 0) * 12 + (months || 0))
  const monthlyRate = aprPct / 100 / 12
  if (!amount || amount <= 0) return 0
  if (monthlyRate === 0) return amount / totalMonths
  const payment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalMonths))
  return Math.round(payment * 100) / 100
}

export const LOAN_TYPES = [
  { id: 'personal', label: 'Personal Loan', hint: 'For any reason — max term 5 years.', maxYears: 5 },
  { id: 'home', label: 'Home Loan', hint: 'To buy a primary residence — max term 15 years.', maxYears: 15 },
  { id: 'educational', label: 'Educational Loan', hint: 'For education expenses — max term 10 years.', maxYears: 10 }
]

export const LOAN_INTEREST_RATE = 8

// "Loan repayment method" on the Loan Details step — how repayments get
// collected, not how the loan is disbursed (that's LOAN_PAYMENT_METHODS).
export const LOAN_REPAYMENT_METHODS = [
  { id: 'payroll', label: 'Payroll deduction', hint: 'Repayments are deducted automatically from your paycheck.' },
  { id: 'direct', label: 'Direct payment', hint: 'You submit repayments directly, outside of payroll.' },
  { id: 'both', label: 'Both', hint: 'A mix of payroll deduction and direct payment.' }
]

export const LOAN_REPAYMENT_FREQUENCIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'weekly', label: 'Weekly' }
]

// "Payment method" on the Payment & Fee Details step — how the loan proceeds
// are disbursed to the participant. Same option set/ids as withdrawal's
// PAYMENT_METHODS (defined further below) so both flows share one shape.
export const LOAN_PAYMENT_METHODS = [
  { id: 'eft', label: 'Electronic Funds Transfer (EFT)' },
  { id: 'check', label: 'Mail check to address' }
]

// Mock bank-on-file details shown under "Select Bank details" when EFT is
// chosen — stands in for a real linked-bank-accounts service. Shape matches
// the Figma on-file card (Account holder / Bank name / Routing / Account #).
export const BANK_ON_FILE = {
  accountHolder: 'Margot Robbie',
  bankName: 'Bank of america',
  routingNo: 'XXXXXXXXXXX',
  accountNumber: 'XXX-XXX-876',
  last4: '876',
  accountType: 'checking'
}

const LOAN_TPA_FEE = 2
const LOAN_EFT_FEE = 2
const LOAN_REDEMPTION_FEE = 2

// Loan requests are grossed up by an itemized set of fees — TPA + EFT
// (rolled up as "Transaction Fee") plus a redemption fee — so the
// participant still nets the amount they asked for.
export function computeGrossLoanAmount(amount) {
  const requested = +amount || 0
  const tpaFee = requested > 0 ? LOAN_TPA_FEE : 0
  const eftFee = requested > 0 ? LOAN_EFT_FEE : 0
  const transactionFee = round2(tpaFee + eftFee)
  const redemptionFee = requested > 0 ? LOAN_REDEMPTION_FEE : 0
  const grossAmount = round2(requested + transactionFee + redemptionFee)
  return { requested, tpaFee, eftFee, transactionFee, redemptionFee, grossAmount }
}

// Simple straight-line amortization estimate for the "View Amortization
// Schedule" panel — not a real payoff schedule, just a plausible per-period
// principal/interest/balance breakdown.
export function computeAmortizationSchedule(principal, aprPct, termMonths) {
  const p = Math.max(0, +principal || 0)
  const months = Math.max(1, Math.round(+termMonths) || 1)
  const monthlyRate = (aprPct || 0) / 100 / 12
  const payment = monthlyRate === 0 ? p / months : (p * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
  let balance = p
  const rows = []
  for (let period = 1; period <= months; period++) {
    const interest = round2(balance * monthlyRate)
    const principalPortion = round2(Math.min(balance, payment - interest))
    balance = round2(Math.max(0, balance - principalPortion))
    rows.push({ period, payment: round2(principalPortion + interest), principal: principalPortion, interest, balance })
  }
  return rows
}

// Loan Details step — "Policy and procedures" slideover copy, verbatim from
// the plan's loan policy disclosures.
export const LOAN_POLICY_COPY = [
  'You may complete the request on paper or allow for an electronic request through a website or automated phone system.',
  'You require spousal consent to be obtained at the time a participant is obtaining a loan. The consent must be in writing and obtained not more than 90 days prior to the loan.',
  'Your eligibility is determined based on- Is the state of employment active? Do you have any outstanding loans? What is the amount of your vested account balance?',
  "You may borrow an amount that is the lesser of: 50% of the participant's vested account balance or $50,000 (minus the difference between the highest outstanding loan balance of the previous 12 months and the current outstanding loan balance).",
  'You must be aware that to prevent the use of refinancing as a means to circumvent the five-year repayment requirement, if additional funds are being borrowed as part of the refinancing transaction, the replaced loan may need to be taken into account to determine whether the five year limit is exceeded or not.',
  'You are expected to review paystubs and bank accounts to confirm payments are being deducted to satisfy their loan obligation.',
  'Loan payments can be suspended by the Admin at his/her sole discretion for the below reasons: when you go on an unpaid leave of absence (LOA); when you go on a paid leave of absence, but the pay is less than the expected loan amount; or when you go on a military leave of absence (MLOA), regardless of pay status.',
  'You may be allowed a cure period by the sponsor if a payment is missed. The regulatory maximum cure period is the last business day of the calendar quarter following the calendar quarter in which the first missed payment occurred.',
  'Loans are supposed to be paid off by the original maturity date. If the loan is not paid in full by the original maturity date, it will be considered in default unless a cure period applies, in which case the loan can be repaid through the end of the cure period to avoid the default.',
  'If a participant passes away and has an outstanding loan balance, the loan will generally become immediately due.',
  'If a participant retires or terminates employment with an outstanding loan, the action taken depends on the plan guidelines.'
]

// Loan Request Summary step — "Terms and conditions" acknowledgment copy.
export const LOAN_TERMS_COPY = [
  'I have read and understood all the rules governing loan requests from my 401k plan.',
  "I understand that redemption fees may be imposed on certain funds if assets are held less than the period stated in the fund's prospectus or other disclosure documents.",
  'I understand that it is entirely my responsibility to ensure that this election conforms with all applicable provisions of the Internal Revenue Code.',
  'I understand that I may be liable for any income tax and/or penalties assessed by the IRS for any elections I have chosen.',
  'I understand that once my payment has been processed, it cannot be changed.'
]

export const DISTRIBUTION_MODES = [
  { id: 'direct', label: 'Direct Distribution', hint: 'A check is mailed or funds are sent to your bank account.' },
  { id: 'rollover', label: 'Rollover', hint: 'Move funds directly into another employer plan.' },
  { id: 'ira', label: 'IRA Account', hint: 'Move funds directly into an IRA account.' }
]

// ---------------- Withdrawal wizard ----------------

export const WITHDRAWAL_TYPES = [
  { id: 'hardship', label: 'Hardship Withdrawal', penaltyPct: 10 },
  { id: 'separation', label: 'Separation from Service', penaltyPct: 0 },
  { id: 'in-service', label: 'In-Service Withdrawal', penaltyPct: 10 },
  { id: 'rmd', label: 'Required Minimum Distribution', penaltyPct: 0 }
]

export const PAYMENT_METHODS = [
  { id: 'check', label: 'Mail check to address' },
  { id: 'eft', label: 'Electronic Fund Transfer (EFT)' }
]

export const ADDRESS_OPTIONS = [
  { id: 'onfile', label: 'As in employee records' },
  { id: 'custom', label: 'Custom' }
]

// Bank-on-file vs custom — same labels as Address details in Figma's EFT branch.
export const BANK_OPTIONS = [
  { id: 'onfile', label: 'As in employee records' },
  { id: 'custom', label: 'Custom' }
]

export const ACCOUNT_TYPES = [
  { id: 'savings', label: 'Savings account' },
  { id: 'checking', label: 'Checking account' }
]

// ---------------- Rollover wizard ----------------

// "Distributing plan details" step — the plan type of the outside account
// the money is coming from (Figma's Dropdown instance).
export const ROLLOVER_PLAN_TYPES = [
  { id: '401k', label: '401(k)' },
  { id: '403b', label: '403(b)' },
  { id: '457b', label: '457(b)' },
  { id: 'ira-traditional', label: 'Traditional IRA' },
  { id: 'ira-roth', label: 'Roth IRA' },
  { id: 'other', label: 'Other qualified plan' }
]

// "Allocation details" step's Sources Mapping table (Figma: Pre tax rollover
// / After tax rollover / Roth rollover, each with Contribution(s) and
// Earning(s) inputs that sum to that source's Amount).
export const ROLLOVER_SOURCES = [
  { id: 'pretax', label: 'Pre tax rollover' },
  { id: 'aftertax', label: 'After tax rollover' },
  { id: 'roth', label: 'Roth rollover' }
]

// "Transaction details" step's Payment mode — how the distributing
// custodian sends the money (same shape as loan/withdrawal payment methods).
export const ROLLOVER_PAYMENT_MODES = [
  { id: 'check', label: 'Check' },
  { id: 'bank', label: 'Bank transfer' }
]

export const SOURCE_OPTIONS = [
  { id: 'prorata', label: 'Prorata' },
  { id: 'choose', label: 'Allow me to choose' },
  { id: 'optimized', label: 'Optimized for redemption fee' }
]

// Shown under "Allow me to choose from" when source === 'choose' (Figma).
export const CHOOSE_FROM_OPTIONS = [
  { id: 'source', label: 'Source' },
  { id: 'investments', label: 'Investments' }
]

// Default allocation draft fields shared by blankForm + "Add allocation".
export function blankWithdrawalAllocation(overrides = {}) {
  return {
    id: 'self',
    recipientType: 'self',
    name: 'Self',
    mode: '',
    amount: '',
    paymentMethod: 'check',
    addressOption: 'onfile',
    customAddress: '',
    bankOption: 'onfile',
    bankName: '',
    accountHolder: '',
    accountType: 'checking',
    accountNumber: '',
    routingNo: '',
    source: 'prorata',
    chooseFrom: 'source',
    sourceAmounts: {},
    ...overrides
  }
}

const WITHDRAWAL_FEE_FLAT = 1
const CHECK_FEE_FLAT = 1
const FEDERAL_TAX_PCT = 20
const REDEMPTION_FEE_FLAT = 2.6

// Grosses a requested (net) withdrawal amount up to what must be pulled from
// the plan to cover fees, withholding, and any early-withdrawal penalty tied
// to the selected withdrawal type — so the participant still nets the amount
// they asked for. Matches the Figma Fee Details breakdown: Withdrawal fee +
// Check fee + Federal tax roll up into "Fee & Tax details"; Redemption fee
// and Penalty are each broken out on their own line.
export function computeWithdrawalFees(amount, withdrawalTypeId, paymentMethodId) {
  const requested = +amount || 0
  const type = WITHDRAWAL_TYPES.find((t) => t.id === withdrawalTypeId)
  const penaltyPct = type?.penaltyPct || 0
  const withdrawalFee = requested > 0 ? WITHDRAWAL_FEE_FLAT : 0
  const checkFee = requested > 0 && paymentMethodId === 'check' ? CHECK_FEE_FLAT : 0
  const federalTax = round2(requested * (FEDERAL_TAX_PCT / 100))
  const feeAndTax = round2(withdrawalFee + checkFee + federalTax)
  const redemptionFee = requested > 0 ? REDEMPTION_FEE_FLAT : 0
  const penalty = round2(requested * (penaltyPct / 100))
  const grossAmount = round2(requested + feeAndTax + redemptionFee + penalty)
  // netDistribution is what the participant receives (the requested amount).
  // taxDeduction rolls withdrawal + check + federal tax — Figma's "Tax Deduction"
  // tree. Early-withdrawal penalty sits in its own "Penalty" tree.
  const netDistribution = requested
  const taxDeduction = feeAndTax
  return {
    requested,
    netDistribution,
    withdrawalFee,
    checkFee,
    federalTaxPct: FEDERAL_TAX_PCT,
    federalTax,
    feeAndTax,
    taxDeduction,
    redemptionFee,
    penaltyPct,
    penalty,
    earlyWithdrawalPenalty: penalty,
    grossAmount
  }
}

function round2(n) {
  return Math.round((n || 0) * 100) / 100
}

// Totals computeWithdrawalFees across every recipient allocation — the wizard's
// Fee Details step and Summary show the request-wide total, not just one
// recipient's row.
export function sumWithdrawalFees(allocations, withdrawalTypeId) {
  const rows = allocations.map((a) => computeWithdrawalFees(a.amount, withdrawalTypeId, a.paymentMethod))
  const sum = (key) => round2(rows.reduce((s, r) => s + r[key], 0))
  const type = WITHDRAWAL_TYPES.find((t) => t.id === withdrawalTypeId)
  const penaltyPct = type?.penaltyPct || 0
  const feeAndTax = sum('feeAndTax')
  const penalty = sum('penalty')
  return {
    requested: sum('requested'),
    netDistribution: sum('netDistribution'),
    withdrawalFee: sum('withdrawalFee'),
    checkFee: sum('checkFee'),
    federalTaxPct: FEDERAL_TAX_PCT,
    federalTax: sum('federalTax'),
    feeAndTax,
    taxDeduction: feeAndTax,
    redemptionFee: sum('redemptionFee'),
    penaltyPct,
    penalty,
    earlyWithdrawalPenalty: penalty,
    grossAmount: sum('grossAmount')
  }
}

// Whether the participant has an active (approved, not fully paid) loan on
// this plan — drives the "Outstanding loan detected" confirmation when
// requesting a full-balance withdrawal.
export function activeLoanFor(participant, plan) {
  const requests = TRANSACTION_REQUESTS[participant.id] || []
  return requests.find((r) => r.type === 'loan' && r.status === 'Approved' && r.plan === plan.name && r.balance > 0)
}

export const REQUEST_DOC_REQUIREMENTS = {
  loan: [{ id: 'promissory', label: 'Promissory Note', required: true }],
  withdrawal: [{ id: 'distribution-form', label: 'Distribution Request Form', required: true }],
  transfer: [],
  // Figma's Rollover Summary shows "Documents uploaded · 02 File(s)".
  rollover: [
    { id: 'distributing-statement', label: 'Distributing Plan Statement', required: true },
    { id: 'rollover-certification', label: 'Rollover Certification Form', required: true }
  ]
}

// A married participant must supply a Spousal Consent Form in addition to
// the Promissory Note (Loan Policy §2). Appended conditionally, not baked
// into REQUEST_DOC_REQUIREMENTS.loan, since it only applies when
// form.maritalStatus === 'married'.
export const SPOUSAL_CONSENT_DOC = { id: 'spousal-consent', label: 'Spousal Consent Form', required: true }

export function requestStatusTone(status) {
  if (status === 'Approved' || status === 'Completed') return 'good'
  if (status === 'Pending' || status === 'In Review' || status === 'Submitted') return 'ok'
  return 'warn'
}

// Mock in-flight/completed requests, keyed by participant id — stands in for a
// real transaction-request service.
export const TRANSACTION_REQUESTS = {
  'auto-enrolled': [
    {
      id: 'req-1001',
      type: 'loan',
      typeLabel: 'Loan',
      plan: 'LendGuard Employees Savings and Retirement 401(k) Plan',
      amount: '$2,500.00',
      date: 'Jan 10, 2026',
      status: 'Approved',
      // Outstanding-loan fields used by the loan calculator slideover.
      balance: 1840,
      monthlyPayment: 214.6
    }
  ]
}

// Requests submitted in this session, newest first, shown above the demo data
// in Transactions > Recent requests.
const SUBMITTED_KEY = 'lg-submitted-requests'
function readSubmitted() {
  try {
    return JSON.parse(sessionStorage.getItem(SUBMITTED_KEY) || '{}')
  } catch {
    return {}
  }
}

export function recordRequest(participantId, request) {
  const all = readSubmitted()
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  all[participantId] = [{ status: 'Submitted', date: today, ...request }, ...(all[participantId] || [])]
  try {
    sessionStorage.setItem(SUBMITTED_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable: list just won't include it */
  }
}

export function requestsFor(participant) {
  return [...(readSubmitted()[participant.id] || []), ...(TRANSACTION_REQUESTS[participant.id] || [])]
}

// Mock transaction id shown on the wizard's success screen and used to track
// the request from the Requests tab.
export function generateTransactionId() {
  return String(Math.floor(10000 + Math.random() * 90000))
}

// ---------------- Transfer / Rebalance ----------------

// Selectable money sources for a plan (Pre-Tax, Roth, Match, …), shaped for
// the Source Selection step's checkbox cards.
export function sourcesFor(plan) {
  return (plan.sources || []).map((s) => ({
    id: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: s.name,
    amount: s.amount || 0
  }))
}

// The plan's investment lineup scaled into a single source. Real balances are
// tracked per source; this mock splits the plan-level holdings proportionally
// so each source shows a plausible, internally consistent set of rows.
export function investmentsForSource(plan, source) {
  const investments = plan.investments || []
  const planTotal = investments.reduce((sum, i) => sum + (i.amount || 0), 0)
  if (!planTotal) return []
  const share = (source.amount || 0) / planTotal
  return investments.map((i) => {
    const amount = round2((i.amount || 0) * share)
    return {
      id: i.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: i.name,
      nav: i.price || 0,
      units: i.price ? round2(amount / i.price) : 0,
      amount,
      pct: round2(((i.amount || 0) / planTotal) * 100)
    }
  })
}

// Lineup a participant can add to a transfer that they don't already hold.
// `restricted` funds are listed but not selectable.
export const AVAILABLE_INVESTMENTS = [
  { id: 'pioneer-core-equity-a', name: 'Pioneer Core Equity A', nav: 104 },
  { id: 'pioneer-core-equity-b', name: 'Pioneer Core Equity B', nav: 98.4 },
  { id: 'pioneer-core', name: 'Pioneer Core', nav: 76.2, restricted: true },
  { id: 'zetex-equity', name: 'Zetex Equity', nav: 51.9 }
]

// Funds a fund's prospectus treats as duplicative — increasing an allocation
// into one while the participant also holds another in the same group is
// blocked, mirroring the "Transfer in is restricted as it is a competing
// fund of..." banner in the Figma Source Selection step.
const COMPETING_FUND_GROUPS = [
  ['Vanguard Institutional Index Fund Admiral Shares', 'Fidelity 500 Index Fund Institutional Class'],
  ['Vanguard Total Bond Market Index Fund Admiral Shares', 'Fidelity U.S. Bond Index Fund Institutional Premium']
]

export function competingFundsFor(name) {
  const group = COMPETING_FUND_GROUPS.find((g) => g.includes(name))
  return group ? group.filter((n) => n !== name) : []
}

// Whether any row in this source is trying to increase into a fund that
// competes with another fund the participant already holds — used to keep
// Continue disabled while the restriction banner is showing.
export function hasRestrictedTransfer(rows) {
  return rows.some(
    (r) =>
      +r.afterPct > +r.pct &&
      competingFundsFor(r.name).some((name) => rows.some((other) => other.name === name && other.pct > 0))
  )
}

// Target percentages are whole-ish numbers, so a row the participant never
// touched can still differ from its current value by a few cents. Anything
// under this threshold is rounding noise, not a trade worth placing.
const DE_MINIMIS_TRADE = 1

// Turns current-vs-target rows into the Buy/Sell ledger shown for a rebalance:
// anything gaining value is a Buy, anything losing value is a Sell.
export function computeBuySell(rows) {
  const trades = rows
    .map((r) => {
      const delta = round2((r.afterAmount || 0) - (r.amount || 0))
      if (Math.abs(delta) < DE_MINIMIS_TRADE) return null
      return {
        id: r.id,
        name: r.name,
        action: delta > 0 ? 'Buy' : 'Sell',
        amount: Math.abs(delta),
        nav: r.nav,
        units: r.nav ? round2(Math.abs(delta) / r.nav) : 0
      }
    })
    .filter(Boolean)

  return {
    trades,
    buyCount: trades.filter((t) => t.action === 'Buy').length,
    sellCount: trades.filter((t) => t.action === 'Sell').length,
    totalAmount: round2(trades.reduce((sum, t) => sum + t.amount, 0))
  }
}

// NAV-as-of disclaimer shown above rebalance allocation tables.
export const NAV_DISCLAIMER =
  'All amounts are calculated based on NAV as of MM/DD/YYYY and may fluctuate due to market conditions.'

export { formatMoney, parseMoney, planBalance, planVested }
