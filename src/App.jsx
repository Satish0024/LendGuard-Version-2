import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import EnrollmentLayout from './components/layout/EnrollmentLayout.jsx'
import { GuestOnly, RequireAuth } from './components/layout/AuthGates.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PlanDetails from './pages/PlanDetails.jsx'
import Enrollment from './pages/Enrollment.jsx'
import Investments from './pages/Investments.jsx'
import EnrollmentSummary from './pages/EnrollmentSummary.jsx'
import Portfolio from './pages/Portfolio.jsx'
import Enrich from './pages/Enrich.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Transactions from './pages/Transactions.jsx'
import TransactionRequest from './pages/TransactionRequest.jsx'
import Reports from './pages/Reports.jsx'
import Login from './pages/Login.jsx'
import RetirementGoal from './pages/RetirementGoal.jsx'
import AccountSummary from './pages/AccountSummary.jsx'
import RiskQuestionnaire from './pages/RiskQuestionnaire.jsx'
import DesignSystem from './pages/DesignSystem.jsx'
import { useOverlayScrollLock } from './hooks/useOverlayScrollLock'
import IconTooltip from './components/common/IconTooltip.jsx'

export default function App() {
  // Above <Routes> so it covers every layout — AppLayout, EnrollmentLayout and
  // the standalone shells (TransactionRequest, RiskQuestionnaire) all open
  // dialogs, and each has its own page chrome.
  useOverlayScrollLock()

  return (
    <>
    {/* Tooltips for icon-only buttons marked with data-icon-tip (see IconTooltip). */}
    <IconTooltip />
    <Routes>
      <Route path="/design-system" element={<DesignSystem />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/account-summary" element={<AccountSummary />} />
          <Route path="/retirement-goal" element={<RetirementGoal />} />
          <Route path="/plans/:planId" element={<PlanDetails />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/accounts" element={<Navigate to="/reports" replace />} />
        </Route>
        <Route path="/transactions/request/:type" element={<TransactionRequest />} />
        <Route path="/risk-check-in" element={<RiskQuestionnaire />} />
        <Route element={<EnrollmentLayout />}>
          <Route path="/enrollment" element={<Enrollment />} />
          <Route path="/enrollment/auto-increase" element={<Navigate to="/enrollment" replace />} />
          <Route path="/enrollment/investments" element={<Investments />} />
          <Route path="/enrollment/beneficiaries" element={<Navigate to="/enrollment/summary" replace />} />
          <Route path="/enrollment/summary" element={<EnrollmentSummary />} />
        </Route>
        <Route path="/enrich" element={<Enrich />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
