# iFixz Workspace Prototype — V1 Complete

**Snapshot date:** 2026-10-04
**Canonical entry:** `index.html` (project root — double-click or drag into a browser; no build step, no server, works over `file://`)
**Status:** V1 frozen as accepted by the user ("this is good for now, save this as whole V1 Complete").

---

## What V1 contains

### Screens (all wired to the sidebar, all clickable)

| Screen | Route | Contents |
| --- | --- | --- |
| Overview | `#/overview` | Shared metrics layer, per-module cards, attention list, activity feed |
| Data pipeline | `#/pipeline` | Per-module rule toggles, rule builder, staged run with pass/reject stats, rejected-records store with named failing rule + retry/discard |
| Module registry | `#/registry` | Filter rail, adapter/schema detail, 3-step manifest wizard (File/Database/API/Webhook), activate/deactivate without redeploy, org-admin gated |
| Module dashboard | `#/module/:id` | One shared renderer: KPI row, domain panel, trend + group charts, latest records, integration + rules cards |
| Module records | `#/module/:id/records` | Paginated table, search, CSV export, add-record with validation |
| Backups | `#/backups` | Schedule, retention, snapshot history, confirmation-gated restore (simulated) |

### IMS inventory module (fully operational)

- Stock health per line (Out of stock / Low vs reorder point / In stock) with summary chips.
- Four validated operations: **Receive, Issue, Adjust, Transfer** — never drives on-hand below zero; field-level errors with cause-and-remedy messages.
- Movement ledger: newest-first, searchable, CSV-exported, every change logged with reference and actor.
- Reorder-point schema field + `ims-r8` validation rule; additive migration (`migrateIms`) backfills older `localStorage` states without discarding data.
- Records view carries a Stock status column.

### Roles and gating

- Account menu switches **Organization Admin** / **Department Employee** / **Client Super Admin**.
- Registry, rule editing, backups = org-admin only; record input = roles with `inputRecords` on native modules only; external modules read-only.
- CRM Mirror seeds unreachable → serves last-synced snapshot behind a stale-source banner.

### Navigation hardening

- Every in-app link routes deterministically (explicit handler, `js/app.js`).
- A failed view render shows a visible "This screen could not be drawn" diagnostic card instead of a blank view.

---

## Files

```
index.html              canonical entry (Ant tokens in :root, app shell)
document.md             PRD — feature/scope authority
wireframe-userflow.html standalone wireframes + user flows doc page (design docs, not app)
V1-COMPLETE.md          this snapshot
css/app.css             shell, components, states, responsive, reduced-motion
css/views.css           screen compositions, charts
js/data.js              seed data, ETL validation, Store APIs, migrations, persistence
js/ui.js                helpers, icons, charts, dialogs, toasts, forms, CSV
js/views-overview.js    shared-metrics overview
js/views-pipeline.js    ETL pipeline
js/views-registry.js    module registry + wizard
js/views-module.js      shared module template + IMS inventory layer
js/views-backups.js     backup & restore
js/app.js               router, nav, role menu, boot
```

---

## Success metrics status at V1 freeze (per `document.md`)

| # | Metric | V1 status |
| --- | --- | --- |
| 1 | MVP features successfully implemented and working | Met — ETL, registry, analytics, backups all function |
| 2 | Working functioning prototype made to test MVP | Met — runs over `file://`, zero dependencies |
| 3 | Clear user flow and navigation | Largely met — deterministic routing + visible error diagnostics (unverified by design: no post-write render pass) |
| 4 | Cleaned and validated data onboarded | Met — pipeline validation, rejected store with named rule, retry |
| 5 | Successfully integrated a new/existing software application | Met in simulation — manifest wizard activates modules without redeploy |
| 6 | Fully cloud-native running server and hosting | Not met — explicitly replaced by static HTML/CSS/JS for phase one |
| 7 | Authentication and authorization implied | Partial — three-role switcher with permission gating stands in for auth |
| 8 | Interactive dashboard and user experience in prototype phase | Met — dashboards, charts, domain panels, dialogs, IMS operations |

**Tally: 6 of 8 met, 1 partial, 1 out of scope by phase-one design (cloud hosting).**

---

## Deferred to V2 (agreed open items)

1. **Sales Operation domain layer** — same treatment as IMS (order lifecycle actions, order activity ledger, status column) was requested but not started.
2. **Hide the other four modules "for now"** — billing-api, support-desk, payroll-export, crm-mirror are still seeded `status: 'active'`; the reversible plan was seed `status: 'inactive'` + a one-time migration flag (records kept, re-enable from the registry).
3. Real authentication (currently a role switcher).
4. Cloud-native server/hosting (out of phase-one scope by explicit instruction).

---

## Carried assumptions

- The PRD's Tanstack Start / Laravel / AWS stack is replaced by no-build HTML/CSS/JS for phase one, per explicit user instruction.
- ETL runs, syncs, backups, and restores are simulated local computations; the PRD's 2000ms / 300ms / 95% figures remain design targets, not measured results.
- State persists in `localStorage` under key `ifixz.workspace.prototype.v1` (in-memory fallback); reset to the seeded state from the account menu.
- Ant design system governs visuals: white work surfaces, single red `#d32029` accent, 4px rhythm; raw hex only in `index.html :root`.
- Per the ship-on-write boundary, no render/preview/validation pass followed any write — runtime behavior is unverified by design.
