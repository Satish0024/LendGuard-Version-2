export const PLAN_401K = 'LendGuard Employees Savings and Retirement 401(k) Plan'
export const PLAN_PSP = 'LendGuard Profit Sharing and Employee Ownership Plan'
export const PLAN_ROTH = 'LendGuard Roth 401(k) Plan'
export const PLAN_DC = 'LendGuard Deferred Comp Plan'
export const PLAN_CB = 'LendGuard Cash Balance Plan'

export const STORAGE_KEY = 'lendguardParticipant'
export const AUTH_KEY = 'lendguardAuth'
export const DEMO_PASSWORD = 'LendGuard2026'
export const DEFERRAL_KEY = 'lendguardDeferral'
export const AUTO_INCREASE_KEY = 'lendguardAutoIncrease'
export const INVESTMENT_KEY = 'lendguardInvestment'
export const BENEFICIARY_KEY = 'lendguardBeneficiary'
export const PLAN_STATUS_KEY = 'lendguardPlanStatus'
export const ADVANCE_ELECTIONS_KEY = 'lendguardAdvanceElections'

export function readSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

export function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function planEnrollmentStatus(plan) {
  const overrides = readSession(PLAN_STATUS_KEY) || {}
  if (overrides[plan?.id]) return overrides[plan.id]
  return plan?.details?.status || plan?.badge || ''
}

export function isAutoEnrolledPlan(plan) {
  if (!plan) return false
  const overrides = readSession(PLAN_STATUS_KEY) || {}
  if (overrides[plan.id]) return false
  return /auto enrolled/i.test(plan.details?.status || '')
}

export function markPlanManuallyEnrolled(planId) {
  const overrides = readSession(PLAN_STATUS_KEY) || {}
  writeSession(PLAN_STATUS_KEY, { ...overrides, [planId]: 'Enrolled' })
}

// A not-yet-eligible participant can still "provide elections in advance"
// via the same enrollment flow. Once they've confirmed that summary, the
// dashboard plan card should offer to view what was saved instead of
// prompting them to provide elections again.
export function markAdvanceElections(participantId) {
  const overrides = readSession(ADVANCE_ELECTIONS_KEY) || {}
  writeSession(ADVANCE_ELECTIONS_KEY, { ...overrides, [participantId]: true })
}

export function hasAdvanceElections(participantId) {
  const overrides = readSession(ADVANCE_ELECTIONS_KEY) || {}
  return !!overrides[participantId]
}

export const PARTICIPANTS = [
  {
    id: 'auto-enrolled',
    name: 'Jordan Hale',
    scenario: 'Auto Enrolled',
    avatar: 'https://i.pravatar.cc/72?img=12',
    profile: {
      dob: 'Apr 8, 1994',
      ssn: '•••-••-4182',
      email: 'jordan.hale@email.com',
      phone: '(512) 555-0148',
      address: '1842 Barton Springs Rd',
      city: 'Austin, TX 78704',
      employer: 'LendGuard',
      employeeId: 'EMP-10482',
      hireDate: 'Jan 12, 2025',
      workStatus: 'Full-Time',
      beneficiaries: [
        { name: 'Taylor Hale', relationship: 'Spouse', share: '70%' },
        { name: 'Riley Hale', relationship: 'Child', share: '30%' }
      ]
    },
    overall: { total: '$14,590.00', vested: '$13,870.00', loan: '$2,500.00' },
    // false (not true, unlike the other demo participants below): the
    // Auto Enrolled scenario is meant to show the Retirement Readiness
    // widget's "Get started" intro copy first — the widget isn't
    // "not enrolled" for this scenario (isEnrolledUser() already
    // includes 'Auto Enrolled'), so the CTA is a real, active link to
    // /retirement-goal, not the disabled one shown for Eligible — Not
    // Enrolled. Only after the participant completes that questionnaire
    // should the score/ring view replace the intro. showSimulator:true
    // was skipping straight to the pre-filled score, so this intro
    // state — and its real CTA — never actually appeared for this scenario.
    showSimulator: false,
    plans: [
      {
        id: '401k',
        name: PLAN_401K,
        type: '401(k)',
        meta: 'Plan ID 124542',
        badge: 'Participating',
        notice:
          "Congratulations! You have been enrolled in this plan based on plan's auto enrollment provisions.",
        noticeLink: { label: 'View details', details: true },
        stats: { balance: '$12,840.00', vested: '$9,620.00', returnPct: 101.2 },
        details: { status: 'Auto Enrolled', balance: '$12,840.00', vested: '$9,620.00' },
        sources: [
          { name: 'Pre-Tax', amount: 4200, vested: 4200 },
          { name: 'Roth', amount: 1600, vested: 1600 },
          { name: 'Match', amount: 2200, vested: 820 },
          { name: 'After-Tax', amount: 800, vested: 800 },
          { name: 'Profit Sharing', amount: 900, vested: 900 },
          { name: 'Rollover', amount: 1100, vested: 1100 },
          { name: 'QNEC', amount: 400, vested: 400 },
          { name: 'Safe Harbor', amount: 550, vested: 550 },
          { name: 'Employer Discretionary', amount: 450, vested: 150 },
          { name: 'Catch-Up', amount: 380, vested: 380 },
          { name: 'Rollover Roth', amount: 260, vested: 260 }
        ],
        investments: [
          { name: 'Vanguard Institutional Index Fund Admiral Shares', asset: 'U.S. Equity', amount: 2100, price: 96.3, units: 21.807 },
          { name: 'Vanguard Total International Stock Index', asset: 'International Equity', amount: 1450, price: 32.4, units: 44.753 },
          { name: 'iShares Emerging Markets ETF', asset: 'International Equity', amount: 720, price: 41.2, units: 17.476 },
          { name: 'Vanguard Small-Cap Index Fund', asset: 'U.S. Equity', amount: 840, price: 98.1, units: 8.563 },
          { name: 'Vanguard Mid-Cap Index Fund', asset: 'U.S. Equity', amount: 980, price: 64.5, units: 15.194 },
          { name: 'Vanguard Total Bond Market Index Fund Admiral Shares', asset: 'Taxable Bond', amount: 1680, price: 10.12, units: 166.008 },
          { name: 'Vanguard Total International Bond Index', asset: 'Taxable Bond', amount: 760, price: 20.4, units: 37.255 },
          { name: 'Fidelity High Income Fund', asset: 'Taxable Bond', amount: 540, price: 8.15, units: 66.258 },
          { name: 'Vanguard Target Retirement 2050 Trust Select', asset: 'Allocation', amount: 1980, price: 45.18, units: 43.825 },
          { name: 'Vanguard Real Estate Index Fund', asset: 'Sector Equity', amount: 820, price: 18.6, units: 44.086 },
          { name: 'Vanguard Federal Money Market', asset: 'Money Market', amount: 970, price: 1.0, units: 970 }
        ]
      },
      {
        id: 'psp',
        name: PLAN_PSP,
        type: 'Profit Sharing',
        meta: 'Enrolled Jan 12, 2025 · Plan ID 124890',
        badge: 'Participating',
        notice: 'Congratulations! You are enrolled in this plan.',
        noticeLink: { label: 'View details', details: true },
        stats: { balance: '$4,250.00', vested: '$4,250.00', returnPct: 10.42 },
        details: { status: 'Enrolled', balance: '$4,250.00', vested: '$4,250.00' },
        sources: [{ name: 'Profit Sharing', amount: 4250, vested: 4250 }],
        investments: [
          { name: 'Vanguard Target Retirement 2050 Trust Select', asset: 'Allocation', amount: 4250, price: 45.18, units: 94.068 }
        ]
      },
      {
        id: 'roth',
        name: PLAN_ROTH,
        type: '401(k) — Roth',
        meta: 'Plan ID 124675',
        badge: 'Eligible',
        badgeClass: 'eligible',
        cardClass: 'eligible-not',
        notice: 'Congratulations! You are eligible to participate in this plan.',
        noticeClass: 'eligible-notice',
        noticeLink: { label: 'Enroll here', to: '/enrollment' },
        details: { status: 'Eligible — Not Enrolled', balance: '—', vested: '—' }
      },
      {
        id: 'dc',
        name: PLAN_DC,
        type: 'Nonqualified Deferred Compensation',
        meta: 'Plan ID 125100',
        badge: 'Not Eligible',
        badgeClass: 'muted',
        cardClass: 'ineligible',
        notice: 'You are currently not eligible for this plan since you have not met the age/service requirement.',
        noticeClass: 'ineligible-notice',
        noticeLink: { label: 'Provide elections in advance', to: '/enrollment' },
        details: { status: 'Not Eligible', balance: '—', vested: '—' }
      },
      {
        id: 'cb',
        name: PLAN_CB,
        type: 'Cash Balance',
        meta: 'Plan ID 125210',
        badge: 'Participating',
        cashBenefit: '$18,400.00'
      }
    ],
    transactions: [
      { kind: 'deferral', date: 'Feb 28, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$312.00' },
      { kind: 'employer', date: 'Feb 28, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$208.00' },
      { kind: 'deferral', date: 'Feb 14, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$312.00' },
      { kind: 'employer', date: 'Feb 14, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$208.00' },
      { kind: 'employer', date: 'Jan 31, 2026', type: 'Employer Contribution', plan: 'LendGuard Profit Sharing', amt: '$450.00' },
      { kind: 'deferral', date: 'Jan 31, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$312.00' },
      { kind: 'employer', date: 'Jan 31, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$208.00' },
      { kind: 'loan', date: 'Jan 15, 2026', type: 'Loan Repayment', plan: PLAN_401K, amt: '$125.00' },
      { kind: 'deferral', date: 'Jan 17, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$312.00' },
      { kind: 'employer', date: 'Jan 17, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$208.00' }
    ]
  },
  {
    id: 'not-eligible',
    name: 'Kayla Brooks',
    scenario: 'Not Eligible',
    avatar: 'https://i.pravatar.cc/72?img=32',
    profile: {
      dob: 'Mar 9, 2006',
      ssn: '•••-••-7721',
      email: 'kayla.brooks@email.com',
      phone: '(303) 555-0194',
      address: '920 Pearl St Apt 4B',
      city: 'Denver, CO 80203',
      employer: 'LendGuard',
      employeeId: 'EMP-11026',
      hireDate: 'Mar 3, 2026',
      workStatus: 'Full-Time',
      beneficiaries: []
    },
    overall: { total: '$0.00', vested: '$0.00' },
    showSimulator: false,
    plans: [
      {
        id: '401k',
        name: PLAN_401K,
        type: '401(k)',
        meta: 'Plan ID 124542',
        badge: 'Not Eligible',
        badgeClass: 'muted',
        cardClass: 'ineligible',
        notice: 'You are currently not eligible for this plan since you have not met the age/service requirement.',
        noticeClass: 'ineligible-notice',
        noticeLink: { label: 'Provide elections in advance', to: '/enrollment' },
        details: { status: 'Not Eligible', balance: '$0.00', vested: '$0.00' }
      },
      {
        id: 'psp',
        name: PLAN_PSP,
        type: 'Profit Sharing',
        meta: 'Plan ID 124890',
        badge: 'Not Eligible',
        badgeClass: 'muted',
        cardClass: 'ineligible',
        notice: 'You are currently not eligible for this plan since you have not met the age/service requirement.',
        noticeClass: 'ineligible-notice',
        noticeLink: { label: 'View details', details: true },
        details: { status: 'Not Eligible', balance: '$0.00', vested: '$0.00' }
      }
    ],
    transactions: []
  },
  {
    id: 'eligible-not-enrolled',
    name: 'Michael Harris',
    scenario: 'Eligible — Not Enrolled',
    avatar: 'https://i.pravatar.cc/72?img=15',
    profile: {
      dob: 'Nov 2, 1991',
      ssn: '•••-••-3350',
      email: 'michael.harris@email.com',
      phone: '(312) 555-0167',
      address: '441 N Wabash Ave',
      city: 'Chicago, IL 60611',
      employer: 'LendGuard',
      employeeId: 'EMP-10891',
      hireDate: 'Nov 18, 2025',
      workStatus: 'Full-Time',
      beneficiaries: []
    },
    overall: { total: '$0.00', vested: '$0.00' },
    showSimulator: false,
    plans: [
      {
        id: '401k',
        name: PLAN_401K,
        type: '401(k)',
        meta: 'Plan ID 124542',
        badge: 'Eligible',
        badgeClass: 'eligible',
        cardClass: 'eligible-not',
        notice: 'Congratulations! You are eligible to participate in this plan.',
        noticeClass: 'eligible-notice',
        noticeLink: { label: 'Enroll here', to: '/enrollment' },
        details: { status: 'Eligible — Not Enrolled', balance: '$0.00', vested: '$0.00' }
      },
      {
        id: 'psp',
        name: PLAN_PSP,
        type: 'Profit Sharing',
        meta: 'Plan ID 124890',
        badge: 'Eligible',
        badgeClass: 'eligible',
        cardClass: 'eligible-not',
        notice: 'Congratulations! You are eligible to participate in this plan.',
        noticeClass: 'eligible-notice',
        noticeLink: { label: 'View details', details: true },
        details: { status: 'Eligible — Not Enrolled', balance: '$0.00', vested: '$0.00' }
      }
    ],
    transactions: []
  },
  {
    id: 'eligible-enrolled',
    name: 'Ava Sullivan',
    scenario: 'Eligible Enrolled',
    avatar: 'https://i.pravatar.cc/72?img=47',
    profile: {
      dob: 'Sep 21, 1988',
      ssn: '•••-••-9044',
      email: 'ava.sullivan@email.com',
      phone: '(206) 555-0132',
      address: '718 Pine St Unit 12',
      city: 'Seattle, WA 98101',
      employer: 'LendGuard',
      employeeId: 'EMP-09217',
      hireDate: 'Jun 4, 2018',
      workStatus: 'Full-Time',
      beneficiaries: [
        { name: 'Chris Sullivan', relationship: 'Spouse', share: '100%' }
      ]
    },
    overall: { total: '$100,416.00', vested: '$92,400.00', loan: '$8,500.00' },
    showSimulator: true,
    plans: [
      {
        id: '401k',
        name: PLAN_401K,
        type: '401(k)',
        meta: 'Plan ID 124542',
        badge: 'Participating',
        notice: 'Congratulations! You are enrolled in this plan.',
        noticeLink: { label: 'View details', details: true },
        stats: { balance: '$87,166.00', vested: '$79,150.00', returnPct: 11.22 },
        details: { status: 'Enrolled', balance: '$87,166.00', vested: '$79,150.00' },
        sources: [
          { name: 'Pre-Tax', amount: 32000, vested: 32000 },
          { name: 'Roth', amount: 11000, vested: 11000 },
          { name: 'Match', amount: 18000, vested: 10032 },
          { name: 'After-Tax', amount: 4500, vested: 4500 },
          { name: 'Profit Sharing', amount: 5000, vested: 5000 },
          { name: 'Rollover', amount: 7000, vested: 7000 },
          { name: 'QNEC', amount: 1800, vested: 1800 },
          { name: 'Safe Harbor', amount: 3200, vested: 3200 },
          { name: 'Employer Discretionary', amount: 2100, vested: 1050 },
          { name: 'Catch-Up', amount: 1800, vested: 1800 },
          { name: 'Rollover Roth', amount: 766, vested: 766 }
        ],
        investments: [
          { name: 'Vanguard Institutional Index Fund Admiral Shares', asset: 'U.S. Equity', amount: 18500, price: 96.3, units: 192.108 },
          { name: 'Vanguard Total International Stock Index', asset: 'International Equity', amount: 9800, price: 32.4, units: 302.469 },
          { name: 'iShares Emerging Markets ETF', asset: 'International Equity', amount: 4200, price: 41.2, units: 101.942 },
          { name: 'Vanguard Small-Cap Index Fund', asset: 'U.S. Equity', amount: 5100, price: 98.1, units: 51.988 },
          { name: 'Vanguard Mid-Cap Index Fund', asset: 'U.S. Equity', amount: 6400, price: 64.5, units: 99.225 },
          { name: 'Vanguard Total Bond Market Index Fund Admiral Shares', asset: 'Taxable Bond', amount: 12200, price: 10.12, units: 1205.534 },
          { name: 'Vanguard Total International Bond Index', asset: 'Taxable Bond', amount: 4800, price: 20.4, units: 235.294 },
          { name: 'Fidelity High Income Fund', asset: 'Taxable Bond', amount: 3100, price: 8.15, units: 380.368 },
          { name: 'Vanguard Target Retirement 2050 Trust Select', asset: 'Allocation', amount: 14200, price: 45.18, units: 314.298 },
          { name: 'Vanguard Real Estate Index Fund', asset: 'Sector Equity', amount: 3800, price: 18.6, units: 204.301 },
          { name: 'Vanguard Federal Money Market', asset: 'Money Market', amount: 5066, price: 1.0, units: 5066 }
        ]
      },
      {
        id: 'psp',
        name: PLAN_PSP,
        type: 'Profit Sharing',
        meta: 'Plan ID 124890',
        badge: 'Participating',
        notice: 'Congratulations! You are enrolled in this plan.',
        noticeLink: { label: 'View details', details: true },
        stats: { balance: '$13,250.00', vested: '$13,250.00', returnPct: 10.42 },
        details: { status: 'Enrolled', balance: '$13,250.00', vested: '$13,250.00' },
        sources: [{ name: 'Profit Sharing', amount: 13250, vested: 13250 }],
        investments: [
          { name: 'Vanguard Target Retirement 2050 Trust Select', asset: 'Allocation', amount: 13250, price: 45.18, units: 293.271 }
        ]
      }
    ],
    transactions: [
      { kind: 'loan', date: 'Feb 28, 2026', type: 'Loan Repayment', plan: PLAN_401K, amt: '$212.50' },
      { kind: 'deferral', date: 'Feb 28, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$820.00' },
      { kind: 'employer', date: 'Feb 28, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$410.00' },
      { kind: 'deferral', date: 'Feb 14, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$820.00' },
      { kind: 'employer', date: 'Feb 14, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$410.00' },
      { kind: 'employer', date: 'Jan 31, 2026', type: 'Employer Contribution', plan: 'LendGuard Profit Sharing', amt: '$1,200.00' },
      { kind: 'deferral', date: 'Jan 31, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$820.00' },
      { kind: 'employer', date: 'Jan 31, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$410.00' },
      { kind: 'deferral', date: 'Jan 17, 2026', type: 'My Deferral', plan: PLAN_401K, amt: '$820.00' },
      { kind: 'employer', date: 'Jan 17, 2026', type: 'Employer Contribution', plan: PLAN_401K, amt: '$410.00' },
      { kind: 'dividend', date: 'Dec 31, 2025', type: 'Dividend Reinvestment', plan: PLAN_401K, amt: '$186.40' }
    ]
  },
  {
    id: 'opted-out',
    name: 'Noah Parker',
    scenario: 'Opted Out',
    avatar: 'https://i.pravatar.cc/72?img=33',
    profile: {
      dob: 'Jan 30, 1990',
      ssn: '•••-••-6618',
      email: 'noah.parker@email.com',
      phone: '(404) 555-0188',
      address: '155 Piedmont Ave NE',
      city: 'Atlanta, GA 30308',
      employer: 'LendGuard',
      employeeId: 'EMP-10144',
      hireDate: 'Aug 22, 2024',
      workStatus: 'Full-Time',
      beneficiaries: [
        { name: 'Hannah Parker', relationship: 'Sister', share: '100%' }
      ]
    },
    overall: { total: '$0.00', vested: '$0.00' },
    showSimulator: false,
    plans: [
      {
        id: '401k',
        name: PLAN_401K,
        type: '401(k)',
        meta: 'Plan ID 124542',
        badge: 'Opted Out',
        badgeClass: 'opted',
        notice: 'You have chosen to opt out from payroll deductions.',
        noticeClass: 'opted-notice',
        noticeLink: { label: 'Re-enroll', to: '/enrollment' },
        details: { status: 'Opted Out', balance: '$0.00', vested: '$0.00' }
      },
      {
        id: 'psp',
        name: PLAN_PSP,
        type: 'Profit Sharing',
        meta: 'Plan ID 124890',
        badge: 'Opted Out',
        badgeClass: 'opted',
        notice: 'You have chosen to opt out from payroll deductions.',
        noticeClass: 'opted-notice',
        noticeLink: { label: 'View details', details: true },
        details: { status: 'Opted Out', balance: '$0.00', vested: '$0.00' }
      }
    ],
    transactions: []
  }
]

export function getParticipant(id) {
  return PARTICIPANTS.find((p) => p.id === id) || PARTICIPANTS[0]
}

export function isNotEligibleUser(participant) {
  if (!participant) return true
  if (participant.scenario === 'Not Eligible') return true
  const plans = participant.plans || []
  return (
    plans.length > 0 &&
    plans.every(
      (plan) =>
        plan.badge === 'Not Eligible' ||
        plan.badgeClass === 'muted' ||
        plan.cardClass === 'ineligible'
    )
  )
}

export function isOptedOutUser(participant) {
  return participant?.scenario === 'Opted Out'
}

export function isEligibleNotEnrolledUser(participant) {
  return participant?.scenario === 'Eligible — Not Enrolled'
}

export function isEnrolledUser(participant) {
  return participant?.scenario === 'Eligible Enrolled' || participant?.scenario === 'Auto Enrolled'
}
