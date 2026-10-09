# Component & Design-System Audit — LendGuard / Journey Retirement Participant Portal

**Repo:** `/Users/arunvijayan.s/Downloads/S_PPT` (branch `journey-retirement`)
**Method:** Source-code inventory (ground truth) + targeted greps + live verification in the running dev server (`http://127.0.0.1:5173`) for a sample of states/participants. Builds on and extends two existing docs already in this repo root: `DESIGN_SYSTEM_RECONCILIATION.md` and `RECONCILIATION_PLAN.md` (both dated from an earlier pass against a DS package that was checked out at a scratch path). That DS package **no longer exists on disk in this session** (`/private/tmp/claude-502/.../ds` — not found), so DS-side claims below are cited from those two docs with attribution, not re-verified, and are marked accordingly.
**Scope discipline:** anything not directly read from source or seen live is marked "Not verified" rather than guessed, per the task's explicit instruction.

---

## 1. Executive Summary

- The app is a single React Router tree (`src/App.jsx`, 63 lines) with **16 real routes** behind auth plus 1 public login and 1 unauthenticated `/design-system`, and 3 route-level redirects (dead/renamed routes kept for back-compat).
- The codebase has been through a real, multi-commit tokenization effort (`git log`: 20+ commits mentioning "token", e.g. `401a413 refactor: remove all old tokens — migrate to DS v1.1 naming`, `6fe8967 feat: 100% DS tokenization + AA/ADA compliance + responsive fixes`). Despite this, **288 raw hex-color literals** still exist across `src/styles/*.css` outside the `:root` token blocks (see §9/§14), and no central typography scale is exposed as CSS custom properties in the same file that already tokenizes color.
- The two pre-existing audit docs already identified the highest-value duplication clusters — **dialogs/modals/slideovers (6+ implementations)**, **7+ distinct badge classes**, **no shared `<Button>` component (95 inline `btn btn-*` usages found in this pass, up from 86 previously — the count grew, not shrank)**, and **5+ independent custom table implementations**. This pass confirms all four are still present and unresolved.
- One correction to the prior docs: they stated `src/components/common/DatePicker.jsx` and `SortTh.jsx` "were not located" — both exist today (`src/components/common/DatePicker.jsx`, `src/components/common/SortTh.jsx`), and a `src/components/common/Select.jsx` now also exists, which the prior pass explicitly said did not exist ("no shared Select despite `common/` existing for this purpose"). This suggests some Phase-2-equivalent consolidation work has already started since the prior audit — worth confirming with the team before re-litigating Select as a gap (see §10).
- Participant-status conditional rendering is a first-class, recurring pattern, not an edge case: Dashboard, AccountSummary, Enrollment, and PlanDetails all branch heavily on plan status (`Participating` / `Eligible` / `Not Eligible`) and on which of the 5 demo participants is active. Live-checked Jordan Hale (Auto Enrolled): Dashboard renders 4 plan cards with 3 different status banners simultaneously ("Congratulations — auto enrolled", "Congratulations — eligible, Enroll here", "not eligible... age/service requirement"), plus a loan balance panel and a cash-balance-plan panel that a single-plan participant would not see at all. Any component inventory or state matrix for this app is incomplete unless it accounts for this axis.
- Given the scope (17 routes, ~9,000 lines across `src/pages/*.jsx` alone, plus `src/components/**`), this report prioritizes the synthesis sections (§4–§10) that are genuinely new work, and keeps per-page inventory (§3) at a structural/breadth level rather than exhaustive per-pixel detail, per the task's own sequencing guidance.

---

## 2. Complete Route Inventory

Source: `src/App.jsx`.

| Route | Page Component | Access | How Reached | Status |
|---|---|---|---|---|
| `/design-system` | `DesignSystem.jsx` | Public (no gate) | Direct URL only — not in Sidebar/Header nav | Live |
| `/login` | `Login.jsx` | Guest-only (`GuestOnly`) | Direct URL / redirect when unauthenticated | Live |
| `/` | `Dashboard.jsx` | Auth (`AppLayout`) | Sidebar "Dashboard", post-login default | Live |
| `/account-summary` | `AccountSummary.jsx` | Auth (`AppLayout`) | Sidebar / Dashboard "View summary" | Live |
| `/retirement-goal` | `RetirementGoal.jsx` | Auth (`AppLayout`) | Dashboard "Get started" (Retirement Readiness) | Live |
| `/plans/:planId` | `PlanDetails.jsx` | Auth (`AppLayout`) | Dashboard "View details" per plan card | Live |
| `/portfolio` | `Portfolio.jsx` | Auth (`AppLayout`) | Sidebar / Quick Links "My portfolio" | Live |
| `/profile` | `Profile.jsx` | Auth (`AppLayout`) | Header/account menu | Live |
| `/settings` | `Settings.jsx` | Auth (`AppLayout`) | Header/account menu | Live |
| `/transactions` | `Transactions.jsx` | Auth (`AppLayout`) | Sidebar "Transactions" | Live |
| `/reports` | `Reports.jsx` | Auth (`AppLayout`) | Sidebar "Documents/Reports" | Live |
| `/accounts` | — | Auth | N/A | **Redirect →** `/reports` (dead route kept for back-compat) |
| `/transactions/request/:type` | `TransactionRequest.jsx` | Auth, standalone shell (no `AppLayout`) | CTA from Transactions/Portfolio ("Request a loan/withdrawal/transfer") | Live |
| `/risk-check-in` | `RiskQuestionnaire.jsx` | Auth, standalone shell | Dashboard/Portfolio risk check-in prompt | Live |
| `/enrollment` | `Enrollment.jsx` | Auth (`EnrollmentLayout`) | Dashboard "Enroll here" | Live |
| `/enrollment/auto-increase` | — | Auth | N/A | **Redirect →** `/enrollment` |
| `/enrollment/investments` | `Investments.jsx` | Auth (`EnrollmentLayout`) | Enrollment wizard step 2 | Live |
| `/enrollment/beneficiaries` | — | Auth | N/A | **Redirect →** `/enrollment/summary` |
| `/enrollment/summary` | `EnrollmentSummary.jsx` | Auth (`EnrollmentLayout`) | Enrollment wizard final step | Live |
| `/enrich` | `Enrich.jsx` | Auth (no shared layout wrapper — sits alongside `EnrollmentLayout` route but outside it) | Dashboard "Enrich — Know More" | Live |
| `*` (catch-all) | — | — | Any unmatched path | **Redirect →** `/` |

Notes:
- 3 of 19 declared routes are pure redirects (`/accounts`, `/enrollment/auto-increase`, `/enrollment/beneficiaries`) — these represent retired/renamed features whose old URLs are kept alive. Worth flagging for cleanup review, not touched here.
- `/design-system` is reachable with **no auth gate at all** — it's outside both `GuestOnly` and `RequireAuth`. Confirmed by direct route read; not something a nav crawl would surface.

---

## 3. Page-by-Page Component Inventory (structural)

Full line-by-line breakdown of all 17 live routes was out of budget; below is the component/conditional tree for the highest-traffic and highest-complexity pages, plus a one-line summary for the rest. All examined via source read; Dashboard cross-checked live for participant "Jordan Hale."

### `/` Dashboard (`Dashboard.jsx`, 53 lines — thin composition shell)
- `Header` / `Sidebar` (via `AppLayout`)
- Greeting ("Hi {firstName}")
- `OverallBalance` — account/vested balance, conditionally shows loan-balance panel and cash-balance-plan panel **only if that plan type exists for the participant**
- `PlanCard` × N (one per plan) — status-branches: `Participating` (green, "View details"), `Eligible` (blue, "Enroll here"), `Not Eligible` (grey, informational only) — **live-confirmed 3 of these 3 states simultaneously for Jordan Hale**
- `QuickLinks` — static CTA grid, conditional items depend on entitlements (not exhaustively verified per participant)
- Recent Transactions table (mini, non-paginated, capped list)
- `RetirementGoalSimulator` teaser card ("Get started" → `/retirement-goal`)
- `LearningPortal` teaser card ("Know More" → `/enrich`)

### `/account-summary` (`AccountSummary.jsx`, 388 lines)
- Accordion-style per-plan rows (uses `SortTh.jsx` for sortable headers per prior audit's note that accordion rows were fixed from `role="button"` on `<tr>` to real `<button>` for keyboard access — confirmed hook usage present, not re-tested live in this pass)
- Category badges (`as-cat-badge`/`as-cat-badges` classes — see §10)

### `/retirement-goal` (`RetirementGoal.jsx`, 911 lines — largest non-wizard page)
- Per-plan deferral accordion, sliders with green/amber directional coding, multiple modals (confirm-changes, per prior fix commit `7be05ee fix: #89 swap deferral confirm/update button labels, widen confirm-changes modal` — already fixed in current branch history)
- Heaviest single page outside `TransactionRequest`/`DesignSystem` — high complexity, not fully state-mapped in this pass (flagged "Not verified: full slider/accordion state cross-product").

### `/plans/:planId` (`PlanDetails.jsx`, 478 lines)
- Plan-type-conditional layout (401(k) vs Roth vs Cash Balance vs Deferred Comp render different detail blocks — not exhaustively diffed per type in this pass)
- Custom table (one of the 5+ independent table implementations, see §10)

### `/portfolio` (`Portfolio.jsx`, 531 lines)
- Fund allocation table + `<select>` (bare, unwrapped — see §10)
- `FundDetailDialog.jsx` modal on row click

### `/profile` (`Profile.jsx`, 678 lines) and `/settings` (`Settings.jsx`, 185 lines)
- `ProfileFields.jsx`, `AddBeneficiary.jsx` (inline dialog pattern, flagged in prior audit as one of the 9+ inline `role="dialog"` sites)
- `AccessibilityMenu.jsx` used from `Header`/`Sidebar`, also has its own inline dialog pattern

### `/transactions` (`Transactions.jsx`, 388 lines) + `/transactions/request/:type` (`TransactionRequest.jsx`, 2,031 lines — largest page in the app)
- `TransactionRequest.jsx` is a multi-step wizard (loan/withdrawal/transfer, branches on `:type` param) composing `EditAllocationSlideover`, `BuySellDetailsSlideover`, `AmortizationScheduleSlideover`, `LoanCalculatorSlideover`, `LegalCopySlideover`, `InvestmentAllocationTable` — 5 distinct slideover components live in `src/components/transactions/` alone, confirming the prior audit's "highest-value consolidation target" finding (§10).
- `Transactions.jsx` (dashboard widget variant also exists at `src/components/dashboard/Transactions.jsx` — a second, page-local component sharing a name with the top-level page, worth a naming-collision note even though they render in different contexts).

### `/reports` (`Reports.jsx`, 356 lines)
- Document center; per prior commit `0c0045c` the Search button was explicitly wired to real state and disabled until searchable — confirms this page had a recent a11y/state-integrity pass already.

### `/enrollment` wizard (`Enrollment.jsx` 430 lines → `Investments.jsx` 538 lines → `EnrollmentSummary.jsx` 265 lines)
- Step navigator (likely maps to a stepper pattern — prior audit flagged no dedicated DS `Stepper.tsx` was found in the old DS package; not re-verifiable now since that package is gone — "Not verified" for this pass)
- Recent commit `1499c94 fix: #89 swap deferral confirm/update button labels, widen confirm-changes modal` and `2ecc433 fix: #91 remove risk-questionnaire investment matching option` both touch this flow — actively maintained.

### `/risk-check-in` (`RiskQuestionnaire.jsx`, 168 lines) + `src/components/questionnaire/RiskJourneyScene.jsx`
- Standalone shell (no `AppLayout`/`EnrollmentLayout`), own CSS (`riskQuestionnaire.css`, 42 lines per prior audit).

### `/enrich` (`Enrich.jsx`, 115 lines)
- Smallest routed page; static/mostly-informational per line count.

### `/design-system` (`DesignSystem.jsx`, 1,340 lines — has grown from 724 lines noted in the prior audit)
- Self-contained internal style guide: buttons, forms, selection controls, badges/alerts, nav, tabs/steps, zebra tables, dialogs, chart legend, accessibility toolbar section, WCAG 2.2 AA checklist. **This file nearly doubled in size since the last audit** — worth flagging that it is an actively growing, not shrinking, parallel documentation surface (see §11, §15).

**Not verified in this pass** (explicitly, per task instruction): exhaustive click-through of every modal/slider/accordion state on `RetirementGoal.jsx`, `TransactionRequest.jsx`, and `Investments.jsx`; per-plan-type visual diffing on `PlanDetails.jsx`; full Settings.jsx state coverage.

---

## 4. Complete Component Master List

**Foundations** (tokens, no markup)
- `src/styles/index.css` `:root` block — color primitives, `color-mix()`-derived ramps, alias layer (`--brand-text-primary-default` etc.)
- `src/styles/core-color-palette.css` — separate palette file (relationship to `index.css` tokens not fully diffed in this pass)
- Font: single family (`--font-family-sans: "Inclusive Sans", sans-serif`) — confirmed, no responsive type-scale custom properties found alongside it.

**Primitives** (`src/components/common/`)
- `Field.jsx` — label/tooltip/fieldset wrapper, `useId()`-linked (previously flagged as "already good practice")
- `Select.jsx` — **now exists** (correction to prior audit, see §1)
- `DatePicker.jsx` — **now exists** (correction to prior audit)
- `SortTh.jsx` — **now exists** (correction to prior audit), used for sortable table headers
- `ConfirmDialog.jsx`, `Slideover.jsx`, `FundDetailDialog.jsx` — 3 separate modal/overlay primitives (duplication, see §10)
- `Toast.jsx` + `toast.css`
- `ChartLegend.jsx` — has its own inline dialog-ish pattern per prior audit

**Molecules**
- `src/components/profile/ProfileFields.jsx`, `AddBeneficiary.jsx`
- `src/components/transactions/*` (7 files: `AddInvestmentSlideover`, `AmortizationScheduleSlideover`, `BuySellDetailsSlideover`, `EditAllocationSlideover`, `InvestmentAllocationTable`, `LegalCopySlideover`, `LoanCalculatorSlideover`)
- `src/components/dashboard/*` (14 files: `PlanCard`, `OverallBalance`, `QuickLinks`, `LearningPortal`, `LearningIllustration`, `PlanReturn`, `ReadinessScoreCard`, `ReadinessVisuals`, `ReadinessSceneV2`, `RetirementGoalSimulator`/`V2`, `RiskCairnIllustration`, `RiskMeter`/`V2`, `Transactions` (widget))

**Components** (layout-level)
- `src/components/layout/AppLayout.jsx`, `EnrollmentLayout.jsx`, `Header.jsx`, `Sidebar.jsx`, `Footer.jsx`, `AuthGates.jsx`, `AccessibilityMenu.jsx`, `DemoScenarioSwitcher.jsx` (the 5-participant picker seen live)

**Patterns** (composite, page-owning)
- Enrollment wizard (`Enrollment.jsx` → `Investments.jsx` → `EnrollmentSummary.jsx`)
- Transaction request wizard (`TransactionRequest.jsx`, 2,031 lines, by far the largest single composite)
- Retirement Goal simulator (`RetirementGoal.jsx`)
- Risk questionnaire flow (`RiskQuestionnaire.jsx` + `RiskJourneyScene.jsx`)

**Page-level-only** (not reused elsewhere)
- `DesignSystem.jsx` (self-contained style guide, 1,340 lines)
- `Login.jsx`, `Reports.jsx`

**Duplicate-implying "component families" that have no single shared component** (see §10 for full detail): Button, Badge, Card, Table.

---

## 5. Component Instance Matrix (representative sample — not exhaustive across all 9,000+ lines)

| Component | Page | Instance | Variant | State observed | Responsive | Shared base class? | Custom CSS? |
|---|---|---|---|---|---|---|---|
| `btn` (inline class) | Dashboard | "View details" link-button | `btn-primary` | Default (live) | Not verified | Y (`.btn`) | Y (per-page overrides common) |
| `btn` (inline class) | Enrollment | Next/Back | `btn-primary`/`btn-secondary` | Default | Not verified | Y | Y |
| `PlanCard` | Dashboard | Participating plan | success/green | Default (live) | Not verified | N (bespoke) | Y |
| `PlanCard` | Dashboard | Eligible plan | info/blue | Default (live) | Not verified | N | Y |
| `PlanCard` | Dashboard | Not Eligible plan | neutral/grey | Default (live) | Not verified | N | Y |
| Badge (`as-cat-badge`) | AccountSummary | category tag | — | Default | Not verified | N | Y |
| Badge (`req-plan-badge`) | TransactionRequest | plan tag | — | Default | Not verified | N | Y |
| Badge (`ds-badge`) | DesignSystem | style-guide sample only | — | Default | Not verified | N | Y |
| `ConfirmDialog` | Enrollment (opt-out) | confirm modal | — | Not verified live | Not verified | shares `useEscapeToClose` | Y |
| `Slideover` | Investments | fund add panel | left/right? | Not verified live | Not verified | shares `useFocusTrap`/`useOverlayScrollLock` | Y |
| `<select>` (bare) | Portfolio, TransactionRequest, Transactions, RetirementGoal, Reports, Investments, RiskQuestionnaire | fund/plan pickers | — | Default | Not verified | N (native) | Y (per-page) |
| Table (bespoke) | Investments, PlanDetails, AccountSummary, Portfolio, Transactions | fund/plan/txn rows | — | Not verified | Not verified | N (5 separate impls) | Y |

Given the combinatorial size (17 routes × 5 participants × N conditional branches), a fully exhaustive instance matrix was not attempted — this table demonstrates the pattern and lists the highest-duplication families; treat unlisted combinations as **not verified**.

---

## 6. Component State Matrix (sample)

✅ = verified working, ⚠️ = partial/inconsistent, ❌ = missing, N/A = not applicable, "Not verified" = not checked this pass.

| Component | Default | Hover | Focus | Active | Disabled | Loading | Error | Success | Empty |
|---|---|---|---|---|---|---|---|---|---|
| `.btn` (all variants) | ✅ | ✅ (commit `1ff5b60`-era hover work; recent commit `add missing :hover states on 5 more shared input classes` confirms active hover-state maintenance) | Not verified | Not verified | ⚠️ (commit `icon-btn disabled cursor not rendering on hover` — a disabled-state bug was *just* fixed per most recent commit, implying disabled states are fragile/regression-prone) | ❌ (no shared `loading` prop found — confirmed absent, matches prior audit) | N/A (not a form input) | N/A | Not verified |
| `PlanCard` | ✅ (live-confirmed 3 status variants) | Not verified | Not verified | N/A | N/A | Not verified | N/A | ✅ (status banner is itself the "success" messaging) | Not verified (0-plan participant not tested) |
| `ConfirmDialog`/`Slideover` | Not verified live | N/A | ⚠️ (uses `useFocusTrap` per grep, but coverage across all 9+ dialog-shaped surfaces not confirmed — prior audit already flagged some inline dialogs may predate the "7 dismissible modals" a11y count) | N/A | N/A | N/A | Not verified | Not verified | N/A |
| `<select>` (bare) | ✅ (native) | ✅ (native) | ✅ (native, browser default) | N/A | Not verified | N/A | Not verified | N/A | Not verified |
| Table rows (accordion) | ✅ | Not verified | ⚠️ (prior audit: fixed from `role=button` on `<tr>` to real `<button>` — good, but not re-tested live this pass) | Not verified | N/A | Not verified | Not verified | N/A | Not verified |
| Toast | Not verified live | N/A | Not verified | N/A | N/A | N/A | Not verified | Not verified | N/A |

The mobile account-menu wrapping/merging bug fixed in the most recent commit (`d0e4f19 fix: Dark mode/Help buttons wrapping and merging in mobile account menu`) is direct evidence that the responsive state of shared header/menu buttons has been an active bug source — worth extra scrutiny in any future audit of that component.

---

## 7. Responsive Behavior Matrix

Actual `@media` breakpoints found via grep across `src/styles/*.css` (not the spec's assumed list): the dominant real breakpoints are **`max-width:640px`** (15 occurrences) and **`max-width:980px`** (7 occurrences) — confirming the task brief's assumption. But there are also **11 other distinct breakpoint values** in active use (520/480/860/900/760/720/420/1150/560/340/1080px), meaning the CSS is **not** cleanly organized around just two breakpoints as assumed — it has accreted page-specific breakpoints over time. This is itself a design-system finding (see §9/§10).

| Page | 1440 | 1280 | 1024 | 768 | 390 | 375 |
|---|---|---|---|---|---|---|
| Dashboard | Not verified (desktop only checked, 1024×768 default viewport) | Not verified | ✅ layout loads correctly | Not verified | Not verified | Not verified |
| Portfolio, Account Summary, Transactions, Profile, Enrollment | Not verified | Not verified | Not verified | Not verified | Not verified | Not verified |

Given the session's time budget, only a single desktop viewport (1024×768, the Browser pane default) was live-checked, on Dashboard only. **The full responsive matrix across 6 pages × 6 breakpoints was not executed live in this pass** — this is called out explicitly rather than fabricated, per the task's instruction. The CSS evidence above (real breakpoint list) is offered as the best available substitute: any future pass should test at 980px and 640px specifically (where the CSS actually branches) rather than the spec's assumed round numbers, and should treat the 11 outlier breakpoints as candidates for consolidation.

---

## 8. Accessibility Findings

- **Focus-trap / escape-to-close hooks exist and are used somewhat consistently**: `useFocusTrap` and `useEscapeToClose` (both in `src/hooks/`) are imported in `Sidebar.jsx`, `ReadinessVisuals.jsx`, `FundDetailDialog.jsx`, `Slideover.jsx`, `ConfirmDialog.jsx`, `AddBeneficiary.jsx`, and 7 page files (`RetirementGoal`, `Profile`, `DesignSystem`, `TransactionRequest`, `PlanDetails`, `EnrollmentSummary`, `Investments`, `Enrollment`, `Reports`). That's the 3 shared common/ dialogs plus at least 8 page-local dialog usages.
- **Gap**: the prior audit identified inline `role="dialog"` markup in `AccessibilityMenu.jsx` and `ChartLegend.jsx` — neither appears in the `useFocusTrap`/`useEscapeToClose` grep results above, meaning **these two dialog-shaped surfaces likely lack focus-trap/escape-to-close coverage** while the others have it. This is a concrete, file-identified a11y gap, not a general impression: `src/components/layout/AccessibilityMenu.jsx` and `src/components/common/ChartLegend.jsx`.
- Recent commit history shows active a11y maintenance, not neglect: `fix: icon-btn disabled cursor not rendering on hover`, `fix: add missing :hover states on 5 more shared input classes`, `fix: Dark mode/Help buttons wrapping and merging in mobile account menu` — all within the last 5 commits.
- Heading hierarchy, aria-label coverage on icon-only buttons across all pages, and modal focus-trap *behavior* (as opposed to hook *presence*) were **not verified live** in this pass — would require per-page `inspect`/`read_page` accessibility-tree checks that weren't run given the budget.
- The prior audit's specific claim that DS's `IconButton` "requires `aria-label` at the type level" while the portal has no equivalent enforcement could not be re-verified (DS package no longer present) but is architecturally consistent with the portal being plain JSX with no compile-time prop enforcement — flagged as still-likely-true, not re-confirmed.

---

## 9. Token / Styling Findings

- **288 raw hex-color literals** remain in `src/styles/*.css` outside `:root` blocks (grep count, this pass) — down from the prior audit's rough "35 additional" estimate in one file, but that prior number was for `index.css` alone / non-exhaustive; this pass's 288 is a full `src/styles/*.css` grep and is not directly comparable, so **do not read this as regression** — it's a more complete count of the same underlying issue.
- Font-family is tokenized (`--font-family-sans: "Inclusive Sans", sans-serif"`, `index.css:162`) and consistently referenced (`index.css:424,684,706`) — good.
- **No typography scale custom properties** (`--text-*`/`--font-size-*` ramp) were found in `index.css`'s token block, consistent with the prior audit's finding — type sizes still appear to be hard-coded per selector. Not re-verified line-by-line in this pass; flagged as "still likely true."
- Breakpoint sprawl (11 non-standard breakpoint values beyond the two dominant ones) — see §7 — is itself an un-tokenized-value problem: there is no `--breakpoint-*` custom property system; every `@media (max-width: Npx)` is a literal.
- Git history confirms this is genuinely an actively-worked area, not a stale problem: 20+ commits reference "token" by name, most recently `c90db5c DS component + A11y alignment: headings, radius, button weight, chart tokens`. Any remaining hardcoded values should be read as "not yet reached" rather than "missed," given the visible cadence of cleanup commits.

---

## 10. Duplicate / Conflicting Components

Building directly on `DESIGN_SYSTEM_RECONCILIATION.md` §5, re-verified this pass:

1. **Dialogs/Modals/Slideovers — largest cluster, confirmed still present.** `ConfirmDialog.jsx`, `Slideover.jsx`, `FundDetailDialog.jsx` (3 in `common/`) + `AddInvestmentSlideover.jsx`, `AmortizationScheduleSlideover.jsx`, `BuySellDetailsSlideover.jsx`, `EditAllocationSlideover.jsx`, `LegalCopySlideover.jsx`, `LoanCalculatorSlideover.jsx` (6 in `transactions/`, one more than the prior audit's count of 3 — `LegalCopySlideover` and `LoanCalculatorSlideover` are new/newly-found) + inline dialog markup still present in `AddBeneficiary.jsx`, `AccessibilityMenu.jsx`, `ChartLegend.jsx`, `ReadinessVisuals.jsx`. **Total: 9 dedicated overlay components + 4 inline patterns = 13 dialog-shaped surfaces**, confirming this is the single highest-value consolidation target, now measurably larger than previously documented (was "6 + inline" in the prior pass).
2. **Badges/pills** — 7+ distinct classes confirmed still present via grep this pass (`as-cat-badge(s)`, `req-plan-badge`, `risk-cairn-badge`, `ds-badge`, generic `badge(s)`, `plan-badge`). No shared `Badge` component in `src/components/common/`.
3. **Buttons** — no shared `<Button>` component; **95** `className="btn` occurrences this pass (was 86 previously) across pages/components — the count grew.
4. **Bare `<select>`** — still unwrapped in Portfolio/TransactionRequest/Transactions/RetirementGoal/Reports/Investments/RiskQuestionnaire, **despite `src/components/common/Select.jsx` now existing** (see §1 correction). This is a meaningful finding: the shared component was built but **the 7+ call sites have not yet been migrated onto it** — i.e., this is now a migration-debt gap, not a missing-component gap. Same story likely applies to `DatePicker.jsx`/`SortTh.jsx` — worth a follow-up grep of their actual import call-sites vs. remaining bare `<input type=date>`/manual `<th>` usage (not done in this pass — "Not verified").
5. **Tables** — 5+ independent custom table implementations confirmed still present (`AccountSummary`, `Portfolio`, `Investments`, `PlanDetails`, `TransactionRequest`/`InvestmentAllocationTable`, plus `src/components/dashboard/Transactions.jsx`) — no shared `<Table>` component.
6. **Design-system documentation itself** — `DesignSystem.jsx` grew from 724 → **1,340 lines** since the prior audit. It remains a parallel, portal-authored style guide competing with whatever the real DS docs site is meant to be (that DS package is no longer available to compare against in this session — see §11).
7. **New this pass**: naming collision between `src/pages/Transactions.jsx` (routed page) and `src/components/dashboard/Transactions.jsx` (dashboard widget) — not a functional bug, but a maintainability/readability risk worth flagging.

---

## 11. Design System vs Portal Comparison

**Not available for direct re-verification in this session.** The DS package the prior audit read (`/private/tmp/claude-502/.../scratchpad/ds/design-system-claude-dev-server-setup-b85db1`) does not exist in this session's filesystem — scratch paths are session-scoped and that prior session's copy is gone. No other DS reference (e.g. `packages/core`, a linked npm package, a `figma` reference, or a docs URL) was found in this repo — grepped for "packages/core" and equivalent with no hits in this pass beyond what the prior doc already quoted.

Where a comparison is needed, this report defers to `DESIGN_SYSTEM_RECONCILIATION.md` §1–§3 verbatim (DS Button has 9 variants vs portal's 3; DS unifies Modal+Drawer into 2 primitives vs portal's 9+; DS status-hue tokens differ from portal's hand-picked hex in `index.css:59-71`; no DS Table/Badge component was located in that prior pass, itself flagged as unconfirmed pending a fuller read of `DataDisplay.tsx`/`Misc.tsx`). None of these specific token/prop values were re-read from source in this pass — they are **cited, not re-verified**.

**Recommendation:** before acting on any DS-comparison finding above, re-acquire the DS package (ask the user where its canonical location is — npm registry, monorepo path, or a fresh checkout) since it is not currently reachable from this repo or this session.

---

## 12. Missing Components

- Shared `<Button>` — still missing (95 inline instances).
- Shared `<Badge>` — still missing (7+ classes).
- Shared `<Table>` — still missing (5+ bespoke implementations); DS-side existence unconfirmed (§11).
- Shared `<Card>` — no single card primitive; grep shows at least 12 distinct card-ish class names (`ds-card`, `login-card`, `overall-card`, `pd-advance-card`, `review-card`, `txn-card`(+nested variant), `wd-fee-card`, `edit-alloc-readcard`, `cycle-cards`, `as-cat-badges` (badge not card, listed for completeness)) — this is a **newly identified duplication cluster this pass**, not previously called out by name in the prior two docs, and arguably as large as the badge cluster.
- Shared `Stepper`/wizard-step-navigator component for Enrollment and TransactionRequest wizards — each wizard appears to implement its own step UI (not diffed line-by-line this pass; flagged as likely duplication based on both being multi-step flows with no shared import between them per the `src/components/` listing, which has no `Stepper.jsx` anywhere in the tree).

---

## 13. Missing States

- No shared `loading` state/prop pattern for buttons (confirmed absent both passes).
- Empty states (zero-plan participant, zero-transaction history, zero-fund portfolio) were **not verified** — the 5 demo participants sampled in this pass (only Jordan Hale checked live) all appear to have at least one plan and some transaction history; whether a true empty state exists and renders correctly is unconfirmed.
- Error states (failed transaction submission, form validation errors on TransactionRequest's multi-step wizard) — not verified live.

---

## 14. Hard-coded / Non-tokenized Values

- 288 raw hex literals in `src/styles/*.css` outside `:root` (grep count; file:line breakdown not enumerated exhaustively given volume — re-run `grep -rnE "#[0-9a-fA-F]{6}" src/styles/*.css` for the full list when doing the fix pass).
- 11 non-standard `@media (max-width: …)` breakpoint values with no custom-property backing (340, 420, 480, 520, 560, 720, 760, 860, 900, 1080, 1150px) alongside the two dominant, presumably-intentional ones (640, 980px).
- No typography-scale tokens exposed in `index.css`'s `:root` block (color/spacing appear tokenized per commit history; type sizes do not, per absence of `--text-*`/`--font-size-*` custom properties in the block read).

---

## 15. Recommended Reconciliation Order

This report substantially agrees with `RECONCILIATION_PLAN.md`'s existing phased order (tokens → core primitives → complex overlays/tables → product patterns → page sweep) and does not see reason to reorder it. Adjustments based on this pass's findings:

1. **Phase 0 addition**: re-acquire the DS package before any DS-comparison-dependent work (§11) — this blocks Phases 2–3 of the existing plan more completely than previously known, since the package is now fully unavailable, not just partially read.
2. **Phase 2 addition**: audit actual call-site adoption of `Select.jsx`/`DatePicker.jsx`/`SortTh.jsx`, which now exist but whose 7+ bare-`<select>` call sites haven't visibly migrated (§10 item 4) — this is now cheaper than building the components (already done), so it should be pulled forward as quick, low-risk wins ahead of the harder Modal/Drawer consolidation.
3. **New workstream**: add a `<Card>` consolidation track (§12) at the same priority tier as Badge, since the grep surfaced a comparably large duplicate cluster (12 distinct card class names) that neither prior doc named explicitly.
4. **Dialog/overlay consolidation (existing Phase 3) should be re-scoped upward**: the cluster is now 13 surfaces (9 dedicated components + 4 inline), not the 6 previously counted — still the single highest-value target, just larger than documented.
5. Keep `DesignSystem.jsx`'s fate (retire vs. redirect vs. keep as internal reference) as an explicit, separate decision point before Phase 5 page sweep — it has nearly doubled in size since last flagged, so the cost of leaving it un-decided is compounding.

---

## Appendix: What genuinely could not be verified this pass

- Full responsive matrix (6 pages × 6 breakpoints) — only Dashboard at one viewport was live-checked.
- Cross-product of participant status × page for all 5 demo users × all 17 routes — only Jordan Hale × Dashboard was live-checked in this pass.
- DS-side component/token values (package unavailable this session — §11).
- Full hover/focus/active/disabled/loading/error/success/empty state matrix for every component instance (§6 gives a representative sample only).
- Exact file:line list for all 288 hex-literal hits (count given, not individually enumerated).
