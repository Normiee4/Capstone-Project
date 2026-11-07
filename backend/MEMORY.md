# MEMORY — Backend Progress (Kanban)

Last updated: 2026-11-07
Branch: `auth/reset-pass` (PR #5, based on `main` after the auth chain merged via PRs #2–#4).
Board covers: auth flow, token lifecycle, invite/verification, role→action authorization, user CRUD guardrails, audit.

## Pillar status

| Pillar | Status | Notes |
|---|---|---|
| **Authentication** | ✅ Done | login, logout, me, refresh rotation, super-admin password reset |
| **Authorization** | ✅ Done | role→action→scope, Gates, guardrails; roles/perms API deliberately skipped |
| **User Management** | 🟡 ~90% | CRUD + guardrails done; **IAM-06 invite/email verification pending (you are building it)** |

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
- **AUTH-05 — Password reset (super-admin mediated)** — this branch / PR #5.
  - `POST /auth/password-reset-request` (public): generic 200; notifies all Super Admins; unknown email does nothing.
  - `POST /users/{user}/password-reset` (`can:users.reset_password`): Super Admin sends the user a Laravel broker reset link.
  - `POST /auth/reset-password` (public): consumes the broker token, sets the password, revokes all user tokens.
  - No OTP and no new table: uses `password_reset_tokens` + `Password` broker. New action `users.reset_password` (super_admin only).
- **IAM-01 — User CRUD scaffolding.** Controller, requests, resource, service, audit.
- **IAM-02 — Actions model.**
  - `app/Support/Action.php` — fixed catalog of action strings (`users.view`, `records.approve`, …).
  - `permissions` table is `(role_id, action, scope)` with unique `(role_id, action)`; `roles.role_name` unique.
  - `User::hasAction($action, ?Model $target = null)` reads the role's mounted grants.
  - `AppServiceProvider` defines one Gate per action.
- **IAM-03 — Routes.** `/users` inside `auth:sanctum` + `user.active`, protected by `can:<action>[,<target>]`.
- **IAM-04 — Guardrails.** Department Head is department-scoped; cannot escalate role/department; Super Admin cannot delete self or the last Super Admin.
- **IAM-05 — Test suite.** `main`: **30 passed / 75 assertions**. This branch: **36 passed / 88 assertions**.
- **DOC-01 — SCHEMA §3 updated.** Users are bigint + `password` + status/timestamps; permissions are action/scope.
- **PERM-02 — `own` scope.** `scope` is now `all | department | own` (`2026_11_06_000001_...`); `User::hasAction()` compares keys for `own`; employees' record grants seed as `own`; covered by `test_employee_own_scope_only_matches_the_actor`.

---

## [DOING]

- Nothing (repository side). IAM-06 invite flow is being implemented by the user.

---

## [TODO] — P0

- **IAM-06 — Invite flow + email verification** (owner: user).
  - Signed, single-use 72h email link; user stays `invited`; accept sets password, `email_verified_at`, `active`.
  - No new table needed: `status`, `invited_at`, `email_verified_at`, `jobs` already exist.
  - Decision pending: `users.name`/`password` are NOT NULL. Either require a name at invite (random password hash), or add a nullable migration if the invitee sets them at accept.
  - `UserService::invite()` currently throws `LogicException`; replace it.
  - Bulk note: one array-shaped `POST /users/invitations` covers 1..N invites; the Dept Head branch of `UserController::guardProvisioning()` is unreachable because `POST /users` needs `users.create` while Dept Head only has `users.invite`.
- **VERIFY-01 — Run migrations + seed + tests.**
  - `php artisan migrate` then `php artisan db:seed --class=PermissionSeeder`, or `php artisan migrate:fresh --seed`.
  - Then `php artisan test` (main 30/30; this branch 36/36).

---

## [BACKLOG / deferred]

- **AUDIT-01 — Audit persistence + endpoints.** Audit only writes to the log file (`AuditService`); no `audit_logs` table or `GET /audit-logs`.
- **IAM-07 — Archive endpoints.** Activate/deactivate already works via `PUT /users/{user}` (`status` active/suspended). True archive (soft delete or `archived` status) was deliberately skipped.
- **IAM-08 — Roles & permissions API.** Skipped by decision. If added later: only `GET /roles`, `GET /roles/{role}/permissions`, `PUT /roles/{role}/permissions` behind `can:permissions.manage`; no role CRUD (roles are immutable).
- **DOC-02 — Remaining docs drift.** Module tables still reference `module_id` FKs that don't exist yet.
- **PERM-01 — Per-module data permissions.** Deferred; current action names encode the module area.
- **MOD-01 — Module Registry v1.** No `Module`/`Adapter` models, migrations, or routes.

---

## Verified facts

- `hasAction()` is the single authorization primitive: active role → grant lookup → `all` bypass, `own` key match, or `department_id` comparison.
- Gates receive an optional target: `can:users.update,user` passes the bound model; `can:users.view` checks the action only.
- Seeded roles: `super_admin`, `dept_head`, `employee`.
- No Policies: authorization is uniform role→action→scope, so policies would be boilerplate for now.
- Token scheme: 15-min access token, 30-day refresh token with ability `issue-access-token`, rotating on use; Sanctum's guard enforces `expires_at` on every request.
- Sanctum's `can()` matches `*`, so an access token would satisfy `can('issue-access-token')`; the refresh path also checks the token name.
- Audit logs never contain token values (only user/subject ids, metadata, IP, UA).
- Password reset uses the existing `password_reset_tokens` table; no new table or OTP.

## Decisions

- Keep three immutable roles; Super Admin assigns roles and edits role-action mappings.
- Scope tiers are `all` (Super Admin), `department` (Dept Head), `own` (Dept Employee). Scopes stay capability-based, not role-named — role identity lives in `users.role_id`.
- Super Admin has no business-record access.
- Bigint `id` and Laravel's `password` column are the standard.
- Suspended/invited login returns 403, not 422.
- Access/refresh tokens are returned in the response body (bearer auth). They must never be written to app logs or the browser console.
- Logout is per-device when the client sends its `refresh_token`; otherwise it revokes all sessions.
- Password reset is mediated by Super Admin (request → notify → admin sends link); no OTP.
- Archive is out of scope; deactivation is `status = suspended` through update.
- Roles & permissions API is out of scope; mappings are seeder-managed.

## Hygiene

- This branch holds the reset feature + the current MEMORY (36/88). `main` is clean and green (30/75).
- Never commit `session-ses_e502.md` (session export).
