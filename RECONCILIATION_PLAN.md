# Reconciliation Plan — Portal → Design System

Companion to `DESIGN_SYSTEM_RECONCILIATION.md`. This is a **plan only** — no code changes are authorized by this document. It describes phased migration work, in dependency order, plus the research still needed before each phase can safely start. This is a reconciliation plan, not a UX/flow redesign — every phase below preserves existing portal behavior and copy, changing only implementation (tokens, component source, markup/class names).

---

## Phase 0 — Close the open questions (prerequisite, not implementation)

Before any component work starts:
1. Get a decision from the user on the 7 DS ambiguities listed in `DESIGN_SYSTEM_RECONCILIATION.md` §6 (semantic-token naming convention, Table/Badge component existence, radius.sm/md duplication, typography h-vs-text rule, fate of `src/pages/DesignSystem.jsx`, which DS theme to instantiate).
2. Fully read the DS files this pass left unread or partially read: `DataDisplay.tsx`, `Combobox.tsx`, `FormControls.tsx`, `Navigation.tsx`, `Calendar.tsx`, `Chart.tsx`, `Questionnaire.tsx`, `Attachment.tsx`, `Disclosure.tsx`, `HoverCard.tsx`, `Layout.tsx`, `Misc.tsx`, `ToastManager.tsx`, `Field.tsx` in full, plus `packages/core/src/styles/components.css` (never opened in this pass), plus `packages/themes/src/{core,clientb,meridian}.json` value-by-value.
3. Read the DS's own planning docs already sitting at its root — `PROJECT-LOG.md`, `MANAGER-FEEDBACK-ACTION-PLAN.md`, `METRONIC-GAP-CHECKLIST.md`, `PORTAL-GAP-CHECKLIST.md`, `COMPONENT-LIBRARY.md` — these may already describe a portal gap analysis the DS team performed; reconcile against (not duplicate) that.
4. Re-run and complete the token greps flagged "Unverified" in the reconciliation doc's §3 table: spacing, breakpoints, font-family, elevation/box-shadow, typography scale usage — across all 11 portal CSS files (`index.css` 2,779 lines, `enrollment.css` 822 lines, `portfolio.css`, `transactions.css`, etc.).
5. Locate and read `src/components/common/DatePicker.jsx` and `src/components/common/SortTh.jsx` (both named in the task brief's file list but not located/read in this pass) and diff against DS `Calendar.tsx` / any DS table-sort pattern.
6. Confirm or refute the DS Table/Badge absence noted in the reconciliation doc — this single finding gates all table and badge migration scoping.

**Exit criteria:** every "Unverified — Phase 2" and "not fully read" item in the reconciliation doc has a concrete answer, and the user has ruled on the 7 open ambiguities.

---

## Phase 1 — Foundation: tokens

Highest leverage, lowest risk (no component behavior changes) — do this first.

1. **Consolidate the portal's triplicated `:root` block.** `PROJECT_NOTES.md` §6 already flags that `index.css`, `enrich.css`, and `enrollment.css` each declare their own `:root { --brand: ... }` independently. Merge into one canonical location before layering DS tokens on top — mapping DS tokens onto three divergent copies would triple the work and the risk of missed spots.
2. **Re-point the portal's existing alias-named custom properties at real DS values.** Since `src/styles/index.css:76-122` already uses DS-shaped names (`--brand-border-primary-default`, `--neutral-text-subtle`, `--semantics-critical-text`, etc.), the lowest-risk first step is swapping their *right-hand values* to derive from DS `semantic.json`/`component.json` resolved values, not renaming anything yet. This alone fixes the 4 status-hue mismatches found (success/warning/danger/info, §3 of the reconciliation doc) without touching a single component file.
3. **Introduce the DS typography scale** as CSS custom properties (`--ds-text-*`) alongside the existing ad hoc per-selector font sizes, then migrate page CSS files one at a time (start with the smallest: `toast.css` 24 lines, `riskQuestionnaire.css` 42 lines, `documents.css` 43 lines) before tackling `index.css` (2,779 lines).
4. **Introduce the DS spacing/radius/elevation scales** the same incremental way.
5. **Re-skin verification**: because the repo runs a trunk + client-branch model (`main` / `saturna` / `journey-retirement` per `PROJECT_NOTES.md` §3), token work should land on `main` first per that repo's own workflow rule, then merge outward — do not build token changes directly on `journey-retirement`.

**Exit criteria:** portal's computed CSS custom property values match DS resolved values for color/typography/spacing/radius/elevation on at least one theme; no visual regression on the 5 standard demo participants (`PROJECT_NOTES.md` §4).

---

## Phase 2 — Core components (buttons, inputs, selects, badges, toggles)

Do only after Phase 0/1 close the Table/Badge-existence question.

1. **Button**: build a portal `<Button>` (or adopt DS's `Button.tsx` directly if the DS package becomes an installable dependency — confirm with the user which integration model is intended, since this reconciliation doesn't assume one). Map existing `btn-primary/btn-secondary/btn-ghost` call sites (86 occurrences, 20 files, per the inventory C-01) onto DS `primary/secondary/tertiary`, and introduce `destructive` for the currently hand-styled danger actions. Migrate file-by-file, verifying against the 5 demo participants after each file.
2. **IconButton**: audit every icon-only `<button>` in the portal (not enumerated in this pass) for a missing accessible name, since DS enforces `aria-label` at the type level and the portal currently has no such guarantee.
3. **Select**: wrap DS `FormControls`/`Combobox` (once fully read in Phase 0) as a portal `<Select>`, migrate the 10 bare-`<select>` call sites found in C-08.
4. **Badge**: contingent entirely on the Phase 0 finding of whether DS has a Badge component. If yes, consolidate the 7 duplicate badge classes (C-07) onto it. If genuinely absent from DS, this becomes a portal-authored component instead — flag back to the DS team rather than inventing DS values.
5. **Toggle**: diff portal `Toast.jsx`-adjacent toggle/switch usage (not fully inventoried) against DS `ToggleInputs.tsx`.
6. **Field**: diff `src/components/common/Field.jsx` prop-for-prop against DS `Field.tsx` (Phase 0 item) — this portal component already implements good practice (`useId()`-linked labels, tooltip, fieldset grouping) so this may end up as "keep portal implementation, just re-point its internal styling at DS tokens" rather than a full replace.

**Exit criteria:** one canonical Button/Select/Badge/Toggle exists in `src/components/common/`, old inline variants removed, all consuming pages re-verified against the 5 demo participants.

---

## Phase 3 — Complex components (dialogs, drawers, tables)

The single largest duplication cluster (§5 of the reconciliation doc): `ConfirmDialog.jsx`, `Slideover.jsx`, `FundDetailDialog.jsx`, `AddInvestmentSlideover.jsx`, `EditAllocationSlideover.jsx`, `BuySellDetailsSlideover.jsx`, plus inline dialog markup in ≥9 more files.

1. Build a portal `<Modal>` and `<Drawer>` matching DS's `Overlays.tsx` API shape (`actions`/`aside` props unifying Drawer+Slideover, `CORE_OVERLAY_THEME` portal-pinning for theme isolation).
2. Migrate `ConfirmDialog.jsx` first (smallest, most self-contained, 42 lines) as a proof of concept, verify Escape-to-close still works via the portal's existing `useEscapeToClose.js` hook (`PROJECT_NOTES.md` §5.6) or is superseded by DS's built-in `onKeyDown` Escape handling — decide which one wins, don't keep both.
3. Migrate `Slideover.jsx` + the 3 transaction-specific slideover components onto one `<Drawer aside=... actions=...>` usage — this is the highest-value single consolidation identified in this audit (4 components → 1).
4. Migrate `FundDetailDialog.jsx` chrome onto `<Modal>`, keeping its fund-detail body content as-is (portal-specific, not a DS concern).
5. Sweep the inline `role="dialog"` markup in `AddBeneficiary.jsx`, `AccessibilityMenu.jsx`, `ChartLegend.jsx`, `ReadinessVisuals.jsx`, and page-level modals in `Profile.jsx`, `PlanDetails.jsx`, `Investments.jsx`, `Reports.jsx`, `TransactionRequest.jsx`, `RetirementGoal.jsx`, `EnrollmentSummary.jsx`, `Enrollment.jsx` onto the new primitives one file at a time.
6. **Tables** — blocked on Phase 0's DS Table/DataDisplay finding. If a DS table pattern exists, plan migration of Investments/PlanDetails/AccountSummary/Portfolio/Transactions tables (5 custom implementations) onto it, preserving the existing accordion-row and `Units` column behavior (`PROJECT_NOTES.md` §5.5) and the already-fixed keyboard-operable accordion buttons (§5.6). If no DS table pattern exists, this becomes a "flag to DS team" item, not portal work.

**Exit criteria:** every dismissible overlay in the portal renders through one of two shared components; reconfirm the "7 dismissible modals" count from `PROJECT_NOTES.md` §5.6 against the actual count found in this audit (looked larger — worth reconciling the discrepancy itself).

---

## Phase 4 — Product patterns

Portal-specific composite patterns that use Phase 2/3 primitives but aren't themselves DS components — not deeply inventoried in this pass, listed here as known areas requiring their own audit pass before implementation:
- Loan/Withdrawal/Transfer wizards (`TransactionRequest.jsx`, `src/components/transactions/*`) — multi-step flows built on Field/Select/Button/Slideover.
- Retirement Goal Simulator (`RetirementGoal.jsx`) — per-plan deferral accordion, sliders with green/amber direction coding (`PROJECT_NOTES.md` §5.1).
- Risk Questionnaire (`RiskQuestionnaire.jsx`, `src/components/questionnaire/*`) vs. DS `Questionnaire.tsx` — direct-name match, should be prioritized for a prop diff early in Phase 0/2 since the naming overlap suggests intentional design-time correspondence.
- Enrollment wizard (`Enrollment.jsx`, `EnrollmentSummary.jsx`) — step navigator likely maps to DS `component.json`'s `stepper.*` tokens (§1.3 of reconciliation doc flags no `Stepper.tsx` file was found — same "flag to DS team" caveat as Table/Badge).
- Dashboard widgets (`PlanCard`, `OverallBalance`, `RetirementGoalSimulator`, `LearningPortal`, `QuickLinks`, readiness visuals) — not inventoried.
- Chart usage (Chart.js + react-chartjs-2 per `PROJECT_NOTES.md`) vs. DS `Chart.tsx` — chart color arrays are called out in `PROJECT_NOTES.md` §5.10 as already having hardcoded hex literals swapped once for the Journey Retirement re-skin; these should become DS `color.categorical.*` token references instead of another hand-swap.

---

## Phase 5 — Page-by-page rollout

Once Phases 1–4 land in shared components, sweep remaining page-local markup/CSS page by page, smallest/lowest-risk first:
1. `documents.css` (43 lines), `riskQuestionnaire.css` (42 lines), `toast.css` (24 lines) — trivial, do first as validation.
2. `enrich.css` (113 lines), `account-summary.css` (157 lines), `portfolio.css` (213 lines).
3. `transactions.css` (311 lines).
4. `login.css` (107 lines) — note `PROJECT_NOTES.md` §3 flags login-specific gradient hex literals as a known re-skin straggler risk.
5. `enrollment.css` (822 lines) — large, do after the wizard components in Phase 4 are settled.
6. `index.css` (151KB / 2,779 lines) — last, since it's the global/shared file every other page's components ultimately depend on; splitting or de-duplicating it may itself be worth a dedicated sub-plan rather than folding into this rollout.
7. Retire or repoint `src/pages/DesignSystem.jsx` per the Phase 0 decision (reconciliation doc §6, item 6).

Each page's rollout should be checked against all 5 standard demo participants (Jordan Hale, Kayla Brooks, Michael Harris, Ava Sullivan, Noah Parker — `PROJECT_NOTES.md` §4) since several pages branch UI meaningfully by participant state (multi-plan, $0 balances, not-enrolled, enrolled, opted-out).

---

## Sequencing rationale (why this order)

Tokens (Phase 1) before components (Phase 2) because component visuals depend on token values — doing it in the other order would mean re-touching every migrated component a second time. Core components (Phase 2) before complex ones (Phase 3) because Modal/Drawer/ConfirmDialog compose `Button` internally (confirmed in DS `Overlays.tsx:32-46`, which imports and uses `Button`) — building the portal's own Modal before its own Button would mean rebuilding Modal's action buttons twice. Product patterns (Phase 4) depend on Phase 2/3 primitives being stable. Page-by-page rollout (Phase 5) is last because it's the mechanical sweep that has the least room for judgment calls once everything above it is decided.
