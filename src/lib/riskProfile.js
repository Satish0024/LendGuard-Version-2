import { ageFromDob } from './retirementGoal'
import { LIKERT_QUESTIONS } from '../data/riskQuestionnaire'

export const RISK_PROFILE_KEY = 'lendguardRiskProfile'

// Resolve a CSS custom property at runtime so risk-level colors always
// come from the DS palette, not hardcoded hex values.
function cssVar(token, fallback) {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback
}

// Three canonical levels — these ids line up with the `risk` field already
// used on fund rows in data/portfolio.js (conservative/moderate/aggressive).
export const RISK_LEVELS = [
  {
    id: 'conservative',
    label: 'Conservative Investor',
    badge: 'CONSERVATIVE',
    subtitle: 'Conservative risk',
    score: 15,
    get color() { return cssVar('--semantics-success-text', '#116840') },
    get accent() { return cssVar('--semantics-success-background-strong', '#178451') },
    copy: "This investment style favors stability, leaning on bonds and cash to help protect what you've saved.",
    outlook: "You'd rather protect what you've saved than chase extra growth.",
    insights: [
      'Balanced approach that favors stability over growth.',
      'Typically 60-70% bonds and cash, 30-40% equities.',
      'Built to smooth out short-term market swings.',
      'Best suited for a shorter time horizon to retirement.'
    ]
  },
  {
    id: 'moderate',
    label: 'Moderate Investor',
    badge: 'MODERATE',
    subtitle: 'Moderate risk',
    score: 50,
    get color() { return cssVar('--semantics-warning-text', '#95590A') },
    get accent() { return cssVar('--brand-text-primary-default', '#1F4F8D') },
    copy: 'We picked this investment style based on how you answered the questionnaire.',
    outlook: "You're comfortable with some ups and downs for potential long-term growth.",
    insights: [
      'Balanced approach between growth and stability.',
      'Typically a 50/50 mix of stocks and bonds.',
      'Aims for steady growth with manageable ups and downs.',
      'Fits most mid-career savers with 10+ years to retirement.'
    ]
  },
  {
    id: 'aggressive',
    label: 'Aggressive Investor',
    badge: 'AGGRESSIVE',
    subtitle: 'Aggressive risk',
    score: 85,
    get color() { return cssVar('--semantics-critical-text', '#8F212A') },
    get accent() { return cssVar('--semantics-critical-background-strong', '#B72E38') },
    outlook: "You're comfortable with larger swings in pursuit of higher long-term growth.",
    insights: [
      'Growth-focused approach that leans into equities.',
      'Typically 80-90% stocks, 10-20% bonds.',
      'Expect more short-term swings for higher long-term potential.',
      'Best suited for a longer runway before retirement.'
    ],
    copy: 'This investment style leans into equities for higher long-term growth potential, with more short-term swings.'
  }
]

export function getRiskLevel(id) {
  return RISK_LEVELS.find((l) => l.id === id) || RISK_LEVELS[1]
}

function readOverrides() {
  try {
    return JSON.parse(sessionStorage.getItem(RISK_PROFILE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function getRiskProfileId(participant) {
  const overrides = readOverrides()
  if (overrides[participant.id]) return overrides[participant.id]
  const age = ageFromDob(participant.profile?.dob)
  if (age < 35) return 'aggressive'
  if (age < 55) return 'moderate'
  return 'conservative'
}

// Fired on window whenever a risk level is saved, so any already-mounted
// widget (e.g. the dashboard Risk Meter) can refresh even when the
// questionnaire was opened from somewhere else (like the sidebar CTA).
export const RISK_PROFILE_UPDATED_EVENT = 'riskProfileUpdated'

export function setRiskProfileId(participantId, levelId) {
  try {
    const overrides = readOverrides()
    overrides[participantId] = levelId
    sessionStorage.setItem(RISK_PROFILE_KEY, JSON.stringify(overrides))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(RISK_PROFILE_UPDATED_EVENT, { detail: { participantId, levelId } }))
}

const RISK_ANSWERS_KEY = 'lendguardRiskAnswers'

// Raw per-question likert answers, kept alongside the derived level so
// re-opening the questionnaire (View/Edit questionnaire) can show what the
// participant picked last time instead of starting blank.
export function getRiskAnswers(participantId) {
  try {
    const all = JSON.parse(sessionStorage.getItem(RISK_ANSWERS_KEY) || '{}')
    return all[participantId] || null
  } catch {
    return null
  }
}

export function setRiskAnswers(participantId, answers) {
  try {
    const all = JSON.parse(sessionStorage.getItem(RISK_ANSWERS_KEY) || '{}')
    all[participantId] = answers
    sessionStorage.setItem(RISK_ANSWERS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

// Turns { [questionId]: 1-5 } answers into a 0-100 risk-tolerance score and
// the nearest canonical level. Reverse-scored questions (agreeing means
// more conservative) get flipped before summing.
export function scoreQuestionnaire(answers) {
  const total = LIKERT_QUESTIONS.reduce((sum, q) => {
    const raw = answers[q.id] || 3
    return sum + (q.reverse ? 6 - raw : raw)
  }, 0)
  const max = LIKERT_QUESTIONS.length * 5
  const min = LIKERT_QUESTIONS.length * 1
  const score = Math.round(((total - min) / (max - min)) * 100)
  const levelId = score < 35 ? 'conservative' : score <= 65 ? 'moderate' : 'aggressive'
  return { score, levelId }
}
