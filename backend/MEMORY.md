# MEMORY — Backend Progress (Kanban)

Last updated: 2026-11-13
Branch: `IAM/user-invitation` (PR #7 open, mergeable clean; `main` still lacks the invite/verification work).
Board covers: auth flow, token lifecycle, invite/verification, role→action authorization, user CRUD guardrails, audit.

## Pillar status

| Pillar | Status | Notes |
|---|---|---|
| **Authentication** | ✅ Done | login, logout, me, refresh rotation, super-admin password reset |
| **Authorization** | ✅ Done | verb actions (`read`/`create`/… + `manage_users`/`invite`/`reset_password`), Gates, guardrails; roles/perms API deliberately skipped |
| **User Management** | ✅ Done | CRUD + guardrails + invite flow + email verification |

Legend: `[DONE]` `[DOING]` `[TODO]` `[BACKLOG]` `[BLOCKED]`

---

## [DONE]

- **AUTH-01 — Auth API works.** Login / logout / me; JSON 401 for guests.
- **AUTH-02 — Password chain.** `password` column + `'password' => 'hashed'` cast + `Hash::check`; unhashed legacy passwords are rejected as validation errors.
- **AUTH-03 — Active-user gate.** `user.active` alias; non-active token → 403 `Account is not active.`
- **AUTH-04 — Suspended login.** Returns 403, matching the flowchart.
- **AUTH-06 — Access + refresh tokens.**
  - Login/refresh issue a 15-min `access-token` (`['*']`) + 30-day `refresh-token` (`['issue-access-token']`); tokens rotate on every refresh.
  - `POST /v1/auth/refresh` lives outside `auth:sanctum` (an expired access token must still refresh) and uses `RefreshTokenRequest`.
  - No expiry middleware: Sanctum's guard rejects an expired `expires_at` (`Guard.php:126-130`). `config/sanctum.php` `expiration` stays `null` so it does not cap refresh tokens at 15 min.
  - Refresh rejects access tokens reused as refresh tokens (`*` ability would otherwise match), expired/unknown tokens, and suspended users — all 401.
  - Logout deletes the current access token and the supplied `refresh_token`; without it, all of the user's refresh tokens are revoked (all sessions).
- **AUTH-05 — Password reset (super-admin mediated)** — merged into `main` via PR #5.
  - `POST /auth/password-reset-request` (public): generic 200; notifies all Super Admins; unknown email does nothing.
  - `POST /users/{user}/password-reset` (`can:reset_password,user`): Super Admin sends the user a Laravel broker reset link.
  - `POST /auth/reset-password` (public): consumes the broker token, sets the password, revokes all user tokens.
  - No OTP and no new table: uses `password_reset_tokens` + `Password` broker. New action `reset_password` (super_admin only).
- **IAM-01 — User CRUD scaffolding.** Controller, requests, resource, service, audit.
- **IAM-02 — Actions model (verb-based).**
  - `app/Support/Action.php` — fixed catalog of **verb** action strings (`read`, `create`, `update`, `archive`, `delete`, `register`, `invite`, `manage_users`, `reset_password`, `activate`, `deactivate`, `run_pipeline`, `configure_adapter`). The old dotted names (`users.view`, …) are gone.
  - `permissions` table is `(role_id, module_id, action, scope)` with unique `(role_id, module_id, action)`; `roles.role_name` unique.
  - `User::hasAction($action, ?Model $target = null)` reads the role's mounted grants; `scope = all` or no target ⇒ allowed, otherwise `department_id` comparison.
  - `AppServiceProvider` defines one Gate per action, so **routes must use the verb names** (`can:manage_users,user`) — a dotted name resolves to no gate and 403s.
- **IAM-03 — Routes.** `/users` inside `auth:sanctum` + `user.active`, protected by `can:<action>[,<target>]`.
- **IAM-04 — Guardrails.** Department Head is department-scoped; cannot escalate role/department; cannot delete accounts; Super Admin cannot delete self or the last Super Admin; employees hold no `manage_users` grant, so the whole `/users` surface is closed to them.
- **IAM-05 — Test suite.** **59 passed / 168 assertions** (`php artisan test`).
- **IAM-06 — Invite flow + email verification.** Closed on `IAM/user-invitation` (PR #7).
  - `invitations` table: `email`, `role_id`, `department_id`, `invited_by`, `token_hash` (unique, SHA-256), `expires_at` (72 h), `accepted_at`, `last_sent_at`.
  - Token = `Str::random(64)` stored hashed; the plain token only ever exists in the mail link. 384 bits of entropy, so brute force is infeasible — the real threats are replay and enumeration, both handled (single use, generic error).
  - `UserService::createInvite()` reserves the `users` row (`status = invited`, unusable random password) so the email is claimed up front by the unique index; the row cannot log in until accepted.
  - `UserService::resendInvite()` refuses while a live invitation is pending, revives the reserved row after expiry, and issues a new token.
  - `UserService::acceptInvite()` is replay-proof: the token is burned (`accepted_at`) inside a `lockForUpdate` transaction before the account is touched, and email/role always come from the invitation row, never the request.
  - Accepting sets `name`, `password`, `status = active`, `email_verified_at`.
  - Email verification for directly-provisioned users: signed 60-minute URL (`URL::temporarySignedRoute`) + `sha1(email)` hash — no new table, no new token column. `POST /auth/email-verification/send` (auth) and `GET /auth/email-verification/verify` (signed, public).
  - Rate limit `invitation` (10/min per IP) on the three public invitation/verification endpoints.
  - Review pointers: `app/Modules/IAM/Services/UserService.php:55` (invite) `:94` (resend) `:154` (accept) `:199` (authorize) `:225` (reserve) `:243` (issue) · `app/Http/Controllers/InvitationController.php` · `app/Http/Controllers/EmailVerificationController.php` · `app/Modules/IAM/Services/EmailVerificationService.php:23` (send) `:48` (verify) · `app/Models/Invitation.php:41-56` (`isExpired`/`isAccepted`/`isValid`) · `app/Mail/InvitationMail.php`, `app/Mail/EmailVerificationMail.php`.
  - 23 new tests: `tests/Feature/IAM/InvitationServiceTest.php` (10), `tests/Feature/IAM/InvitationApiTest.php` (8), `tests/Feature/Auth/EmailVerificationTest.php` (5).
- **PERM-02 — `own` scope removed.** The `scope` enum still allows `own` and `2026_11_06_000001_...` added it, but `User::hasAction()` no longer handles it — an `own` grant silently behaves like `department`. Employee rights are department-wide.
- **DOC-01 — SCHEMA §3 updated.** Users are bigint + `password` + status/timestamps; permissions are action/scope.

---

## [DOING]

- Nothing in progress. Next up: IAM-07 (archive endpoints).

---

## [TODO] — P0

- **VERIFY-01 — Run migrations + seed on MySQL.** ⚠️ the test suite runs on SQLite, which ignores enums, so the `permissions.action` enum change is **not covered by tests**.
  - `php artisan migrate` (picks up `2026_11_13_000000_add_user_management_actions_to_permissions_enum.php`, MySQL-only `ALTER`), then `php artisan db:seed --class=PermissionSeeder`, or `php artisan migrate:fresh --seed`.
  - Then `php artisan test` (currently 59/59).
- **PERM-03 — `own` scope cleanup.** Either drop `own` from the `scope` enum/migration, or restore the branch in `hasAction()`.
- **CI-01 — No CI.** `.github/workflows/` is empty, so PR #7 is green only in the sense that GitHub found no conflicts. Add a workflow running `php artisan test` on SQLite.

---

## [BACKLOG / deferred]

- **FE-01 — Frontend pages for the invite/verify flows.** The invite mail links to the frontend `/accept-invitation?token=…`, which must POST `token`, `name`, `password`, `password_confirmation` to `POST /v1/invitations/accept`. The verification mail links straight at the API's signed `GET` endpoint, which answers with JSON — a browser click shows raw JSON unless the mail links at a frontend page that calls the API instead.
- **AUDIT-01 — Audit persistence + endpoints.** Audit only writes to the log file (`AuditService`); no `audit_logs` table or `GET /audit-logs`.
- **IAM-07 — Archive endpoints.** Activate/deactivate already works via `PUT /users/{user}` (`status` active/suspended). True archive (soft delete or `archived` status) was deliberately skipped.
- **IAM-08 — Roles & permissions API.** Skipped by decision. If added later: only `GET /roles`, `GET /roles/{role}/permissions`, `PUT /roles/{role}/permissions` behind `can:manage_users` (there is no `permissions.manage` verb any more); no role CRUD (roles are immutable).
- **DOC-02 — Remaining docs drift.** Module tables still reference `module_id` FKs that don't exist yet.
- **PERM-01 — Per-module data permissions.** Deferred; current action names encode the module area.
- **MOD-01 — Module Registry v1.** No `Module`/`Adapter` models, migrations, or routes.

---

## Verified facts

- `hasAction()` is the single authorization primitive: role must exist → grant lookup on `action` → `all` bypass or no target → `department_id` comparison. `own` is no longer handled.
- Gates receive an optional target: `can:manage_users,user` passes the bound model; `can:manage_users` checks the action only.
- Gate names are verbs (`Action::all()`), so a route using the old dotted strings resolves to no gate and 403s.
- `manage_users` scope `all` = Super Admin, `department` = Dept Head, no grant = Employee (closed out of `/users` entirely).
- Seeded roles: `super_admin`, `dept_head`, `employee`.
- No Policies: authorization is uniform role→action→scope, so policies would be boilerplate for now.
- Token scheme: 15-min access token, 30-day refresh token with ability `issue-access-token`, rotating on use; Sanctum's guard enforces `expires_at` on every request.
- Sanctum's `can()` matches `*`, so an access token would satisfy `can('issue-access-token')`; the refresh path also checks the token name.
- Audit logs never contain token values (only user/subject ids, metadata, IP, UA). `AuditService::log()` takes `?Model $subject`, so invitations are auditable alongside users.
- Password reset uses the existing `password_reset_tokens` table; no new table or OTP.
- Invitation tokens are stored hashed, are single use, and expire after 72 h; verification links are signed and expire after 60 min.

## Decisions

- Keep three immutable roles; Super Admin assigns roles and edits role-action mappings.
- Actions are verbs; scope stays capability-based (`all` | `department`), not role-named — role identity lives in `users.role_id`.
- `own` scope was dropped from enforcement; employee rights are department-wide.
- Super Admin has no business-record access.
- Bigint `id` and Laravel's `password` column are the standard.
- Suspended/invited login returns 403, not 422.
- Access/refresh tokens are returned in the response body (bearer auth). They must never be written to app logs or the browser console.
- Logout is per-device when the client sends its `refresh_token`; otherwise it revokes all sessions.
- Password reset is mediated by Super Admin (request → notify → admin sends link); no OTP.
- Archive is out of scope; deactivation is `status = suspended` through update.
- Roles & permissions API is out of scope; mappings are seeder-managed.
- An invitation **reserves** the `users` row at invite time (status `invited`, unusable password) so the email is claimed before anyone clicks the link; the account is inert until accepted.
- Accepting an invitation marks the email verified — clicking the mailed link is proof of email ownership. Admin-provisioned users verify through the signed link instead.
- The acceptance endpoint does **not** log the user in; they sign in with the password they just set.

## Hygiene

- `IAM/user-invitation` is pushed (commit `2776612` + `262428d`), PR #7 open and mergeable clean, working tree clean.
- Three junk files (`backend/hasAction('create'))`, `backend/hasAction('read'))`, `backend/toArray())` — PHP error dumps from a stray tinker command — were staged on this branch; removed from the index and disk.
- `git config core.hooksPath .githooks` is not set in this clone and no `.githooks/` directory exists, so the commit-message hook described in `CONTRIBUTING.md` is not enforced locally.
- `gh` is not installed; PR #7 was created through the REST API using the credential already in the git credential store.
