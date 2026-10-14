import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../lib/icons'
import { faCheck, faRocket, faBalanceScale, faShieldAlt, faTimes } from '@fortawesome/free-solid-svg-icons'
import { useParticipant } from '../context/ParticipantContext.jsx'
import { LIKERT_OPTIONS, LIKERT_QUESTIONS, QUESTIONNAIRE_STEP_COUNT } from '../data/riskQuestionnaire'
import { getRiskAnswers, getRiskLevel, scoreQuestionnaire, setRiskAnswers, setRiskProfileId } from '../lib/riskProfile'
import RiskJourneyScene from '../components/questionnaire/RiskJourneyScene.jsx'
import '../styles/riskQuestionnaire.css'

const LEVEL_ICON = { conservative: faShieldAlt, moderate: faBalanceScale, aggressive: faRocket }

export default function RiskQuestionnaire() {
  const { participant } = useParticipant()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Lets a caller (e.g. the enrollment Investment Election step) send the
  // participant here and get them back to a specific place afterward,
  // instead of always landing on the dashboard.
  const returnTo =
    params.get('return')?.startsWith('/') && !params.get('return')?.startsWith('//') ? params.get('return') : ''
  const goReturn = (extra) => navigate(returnTo ? `${returnTo}${extra || ''}` : '/')
  // 0..4 = the 5 Likert questions, 5 = results. Per client feedback (item
  // #17), the questionnaire is exactly these 5 questions -- the financial-
  // profile step (retirement location/age/spend/salary/other savings) that
  // used to follow them has been removed; it never fed the risk score
  // (scoreQuestionnaire only reads the Likert answers below), and the
  // Retirement Goal calculator that used those values already falls back
  // to sensible per-location defaults on its own.
  const [step, setStep] = useState(0)
  // Pre-select whatever this participant answered last time (View/Edit
  // questionnaire) instead of starting blank.
  const [answers, setAnswers] = useState(() => getRiskAnswers(participant.id) || {})

  const leave = () => (returnTo ? goReturn() : navigate(-1))

  const isResultsStep = step === LIKERT_QUESTIONS.length
  const isLastQuestion = step === LIKERT_QUESTIONS.length - 1
  const question = LIKERT_QUESTIONS[step]

  const canContinue = isResultsStep ? true : Boolean(answers[question?.id])

  const finish = () => {
    const { levelId } = scoreQuestionnaire(answers)
    setRiskProfileId(participant.id, levelId)
    setRiskAnswers(participant.id, answers)
  }

  const goNext = () => {
    if (isResultsStep) {
      // ?riskDone=1 tells a caller like Investments.jsx that a level was
      // just measured, so it can read it back via getRiskProfileId and
      // apply a matching allocation instead of landing on a blank step.
      goReturn(returnTo ? (returnTo.includes('?') ? '&riskDone=1' : '?riskDone=1') : '')
      return
    }
    if (isLastQuestion) finish()
    setStep((s) => s + 1)
  }
  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const { levelId, score } = isResultsStep ? { ...scoreQuestionnaire(answers) } : {}
  const level = isResultsStep ? getRiskLevel(levelId) : null
  const resultIcon = level ? LEVEL_ICON[level.id] : null

  return (
    <div className="rqp-page">
      <aside className="rqp-side" aria-hidden="true">
        <RiskJourneyScene />
        <div className="rqp-side-copy">
          <span className="rqp-side-tag">Quick Setup · Smarter Insights</span>
          <h1>See how ready you are for retirement</h1>
          <p>A few honest answers help us shape an investment style that actually fits how you feel about risk.</p>
        </div>
      </aside>

      <main className="rqp-main">
        {/* Visually hidden: the only visible <h1> on this page lives in the
            decorative side panel above, which is aria-hidden -- so screen
            reader users had no real page-level heading at all (flagged by
            axe-core's page-has-heading-one rule). This restores one
            without duplicating the side panel's visible copy. */}
        <h2 className="sr-only">Investment style questionnaire</h2>
        <div className="rqp-main-head">
          <button type="button" className="rqp-leave" onClick={leave}>
            Back
          </button>
          {!isResultsStep && (
            <div className="rq-progress">
              <div className="rq-progress-track">
                <div
                  className="rq-progress-fill"
                  style={{ width: `${((step + 1) / QUESTIONNAIRE_STEP_COUNT) * 100}%` }}
                />
              </div>
              <span>
                {String(step + 1).padStart(2, '0')} / {String(QUESTIONNAIRE_STEP_COUNT).padStart(2, '0')}
              </span>
            </div>
          )}
          <button type="button" className="rq-close" onClick={leave} aria-label="Close">
            <Icon icon={faTimes} size={18} />
          </button>
        </div>

        <div className="rqp-body">
          {!isResultsStep && (
            <div className="rq-step" key={question.id}>
              <h2 id="rq-title">{question.text}</h2>
              <div className="rq-options">
                {LIKERT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rq-opt${answers[question.id] === opt.value ? ' on' : ''}`}
                    onClick={() => setAnswers((a) => ({ ...a, [question.id]: opt.value }))}
                  >
                    <span className="rq-opt-dot" aria-hidden="true">
                      {answers[question.id] === opt.value && <Icon icon={faCheck} size={12} />}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="rq-hint">This question helps us understand your investment style.</p>
            </div>
          )}

          {isResultsStep && (
            <div className="rq-step rq-results">
              <div className="rq-results-ring" style={{ '--level-color': level.color }}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="rq-ring-track" cx="60" cy="60" r="52" />
                  <circle
                    className="rq-ring-fill"
                    cx="60"
                    cy="60"
                    r="52"
                    style={{ strokeDasharray: `${(score / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}` }}
                  />
                </svg>
                <span className="rq-results-ico" style={{ color: level.color }}>
                  <Icon icon={resultIcon} size={30} />
                </span>
              </div>
              <span className="rq-results-tag" style={{ color: level.color }}>
                {level.badge} · {score}/100
              </span>
              <h2 id="rq-title">{level.label}</h2>
              <p>{level.copy}</p>
            </div>
          )}
        </div>

        <div className="rq-actions rqp-actions">
          {step > 0 && !isResultsStep && (
            <button type="button" className="btn btn-ghost" onClick={goBack}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-primary rq-next" disabled={!canContinue} onClick={goNext}>
            {isResultsStep ? 'Done' : isLastQuestion ? 'See my results' : 'Continue'}
          </button>
        </div>
      </main>
    </div>
  )
}
