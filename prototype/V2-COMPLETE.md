# iFixz Workspace Prototype — V2 Complete

**Snapshot date:** 2026-10-05
**Canonical entry:** `index.html` (project root — double-click or drag into a browser; no build step, no server, works over `file://`)
**Status:** V2 frozen as accepted by the user ("document this as v2."). Supersedes `V1-COMPLETE.md`, which remains as the historical V1 record.

---

## What V2 changed (vs V1)

### 1. Module visibility — only IMS and Sales Operation active

- Billing API, Support Desk, Payroll Export, and CRM Mirror now seed as `status: 'inactive'` (`js/data.js:430/489/553/613`).
- One-time `hideExtras` migration in `applySeedConfig` deactivates those four in existing `localStorage` states without losing runs, rules, registrations, or rejected records; `initialState` seeds the flag for fresh states.
- **Reversible by design:** every hidden module appears in the registry's Disabled filter and re-enables with one **Activate** click (status persists across reloads). Rejected records for deactivated modules stay in the triage store per the PRD.
- Sidebar, pipeline picker, overview cards, charts, stale-source detection, and the shared revenue metric all read `activeModules()`, so they reflect only IMS + Sales.

### 2. Design system — Cisco revamp (supersedes Ant)

- `index.html` carries `color-scheme: dark` and a verbatim Cisco token block: navy-charcoal ground (`--bg #0f1720`, `--surface #1b2530`), Cisco Blue signal (`--accent #049fd9`), radius 12/20/28/pill, motion 160/240ms, blue focus ring, container/gutter tokens.
- Dark-re-derived prototype extensions: status text tints (`--success-text`, `--warn-text`, `--danger-text`) holding ≥4.5:1, solid soft-tints (`--accent-soft`, `--danger-soft`, `--success-soft`, `--warn-soft`), chart series/grid colors, `--scrim`, raised-elevation shadows, and `color-mix` hover/active states.
- `css/app.css` split repairs: both scrims use `--scrim`; `.btn-danger` uses `--danger-on`/`--danger-hover`; chip/badge/form-summary/banner danger surfaces use `--danger-soft`.
- Type, spacing, and layout scales kept; **zero raw color values outside the `:root` token block**. The remembered "Ant governs color" preference is superseded per explicit instruction.

### 3. Design documentation family (separate root pages)

- The combined `wireframe-userflow.html` was **split and deleted**, replaced by:
  - `userflows.html` — platform map (7 screens + 3 role cards) and 7 user-flow step chains.
  - `wireframes.html` — legend + 8 low-fi wireframes of every screen.
- `css/docs.css` (new) — shared stylesheet for all docs pages: Cisco token block + page/layout CSS.
- `onboarding.html` (new) — first-session journey for a brand-new Organization Admin: scenario cards, 3 flow chains (sign-in/registry branch, first-run reject branch, analytics→backup), 4 onboarding UI wireframes. Design documentation only — **onboarding is not a PRD feature**; the prototype app is unchanged.
- All docs pages cross-link each other, `index.html`, and `document.md`; each uses `color-scheme: dark`.

### 4. Admin-level scope confirmed (recorded decision)

- The design is shared across all three roles; the default view is the **Organization Admin lens** (company-wide metrics).
- No multi-company/tenant layer exists, and no org-settings/user-management surface — neither is in the PRD.

---

## Files at V2 freeze

```
index.html              canonical entry (Cisco tokens in :root, app shell)
document.md             PRD — feature/scope authority
V1-COMPLETE.md          historical V1 snapshot
V2-COMPLETE.md          this snapshot
userflows.html          docs: platform map + user flows
wireframes.html         docs: low-fi wireframes
onboarding.html         docs: new-admin onboarding flow + UI screens
css/docs.css            shared docs stylesheet (Cisco tokens + page CSS)
css/app.css             shell, components, states, responsive, reduced-motion
css/views.css           screen compositions, charts
js/data.js              seed data, ETL validation, Store APIs, migrations (hideExtras, migrateIms), persistence
js/ui.js                helpers, icons, charts, dialogs, toasts, forms, CSV
js/views-overview.js    shared-metrics overview
js/views-pipeline.js    ETL pipeline
js/views-registry.js    module registry + wizard
js/views-module.js      shared module template + IMS inventory layer
js/views-backups.js     backup & restore
js/app.js               router, nav hardening, role menu, boot
```

Removed since V1: `wireframe-userflow.html` (split) and `js/views-flows.js` / the in-app `#/flows` route (not a PRD feature).

---

## V1 deferred items — status at V2 freeze

| # | V1 deferred item | V2 status |
| --- | --- | --- |
| 1 | Sales Operation domain layer (order lifecycle actions, activity ledger, status column) | **Still open** — not started |
| 2 | Hide the other four modules "for now" | **Done** — reversible deactivation + `hideExtras` migration |
| 3 | Real authentication (currently a role switcher) | **Still open** — out of prototype scope |
| 4 | Cloud-native server/hosting | **Still out of scope** by phase-one instruction |

---

## Success metrics status at V2 freeze (per `document.md`)

| # | Metric | V2 status |
| --- | --- | --- |
| 1 | MVP features successfully implemented and working | Met — ETL, registry, analytics, backups all function |
| 2 | Working functioning prototype made to test MVP | Met — runs over `file://`, zero dependencies |
| 3 | Clear user flow and navigation | Largely met — deterministic routing + visible error diagnostics (unverified by design: no post-write render pass) |
| 4 | Cleaned and validated data onboarded | Met — pipeline validation, rejected store with named rule, retry |
| 5 | Successfully integrated a new/existing software application | Met in simulation — registry re-activates hidden modules and runs the manifest wizard without redeploy |
| 6 | Fully cloud-native running server and hosting | Not met — explicitly replaced by static HTML/CSS/JS for phase one |
| 7 | Authentication and authorization implied | Partial — three-role switcher with permission gating stands in for auth |
| 8 | Interactive dashboard and user experience in prototype phase | Met — Cisco-revamped dashboards, charts, domain panels, dialogs, IMS operations |

**Tally: 6 of 8 met, 1 partial, 1 out of scope by phase-one design (cloud hosting).**

---

## Carried assumptions

- The PRD's Tanstack Start / Laravel / AWS stack is replaced by no-build HTML/CSS/JS for phase one, per explicit user instruction.
- ETL runs, syncs, backups, and restores are simulated local computations; the PRD's 2000ms / 300ms / 95% figures remain design targets, not measured results.
- State persists in `localStorage` under key `ifixz.workspace.prototype.v1` (in-memory fallback); reset to the seeded state from the account menu. The `v1` storage key name is kept for compatibility even though the design iteration is V2.
- Cisco design system governs app and docs-page visuals (superseding Ant for this project); CiscoSansTT/IBM Plex Mono are not bundled, so fonts fall back to Inter/Arial offline.
- Onboarding, user-flow, and wireframe pages are **design documentation** living as separate root HTML files — the PRD remains the feature-scope authority for anything inside the app.
- Per the ship-on-write boundary, no render/preview/validation pass followed any write — runtime behavior is unverified by design.
