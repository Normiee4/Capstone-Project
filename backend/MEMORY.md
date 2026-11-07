# MEMORY — Backend Progress (Kanban)

Last updated: 2026-11-07
Branch: `fix/auth-login-hashing-500` (IAM action/permission work ported here from `iam/roles-and-permissions`)
Board covers: auth flow, token lifecycle, invite/verification, role→action authorization, user CRUD guardrails, audit.

**Where we left off (2026-11-07):** AUTH-06 is complete. Expiry middleware removed (Sanctum enforces per-token `expires_at`); `POST /auth/refresh` rotates the pair; logout revokes the refresh token. Suite green: **30 passed / 75 assertions**.

**Today's focus:** Authentication, Authorization, and User Management are done. Next P0 is IAM-06 (invite flow), then AUTH-05 (password reset).

Legend: `[DONE]` `[DOING]` `[TODO]` `[BACKLOG]` `[BLOCKED]`

---

## [DONE]

- **AUTH-01 — Auth API works.** Login / logout / me; JSON 401 for guests.
- **AUTH-02 — Password chain.** `password` column + `'password' => 'hashed'` cast + `Hash::check`; unhashed legacy passwords are rejected as validation errors.
- **AUTH-03 — Active-user gate.** `user.active` alias; non-active token → 403 `Account is not active.`
- **AUTH-04 — Suspended login.** Returns 403, matching the flowchart.
- **IAM-01 — User CRUD scaffolding.** Controller, requests, resource, service, audit.
- **IAM-02 — Actions model.**
  - `app/Support/Action.php` — fixed catalog of action strings (`users.view`, `records.approve`, …).
  - `permissions` table is `(role_id, action, scope)` with unique `(role_id, action)`; `roles.role_name` unique.
  - `User::hasAction($action, ?Model $target = null)` reads the role's mounted grants.
  - `AppServiceProvider` defines one Gate per action.
- **IAM-03 — Routes.** `/users` inside `auth:sanctum` + `user.active`, protected by `can:<action>[,<target>]`.
- **IAM-04 — Guardrails.** Department Head is department-scoped; cannot escalate role/department; Super Admin cannot delete self or the last Super Admin.
- **DOC-01 — SCHEMA §3 updated.** Users are bigint + `password` + status/timestamps; permissions are action/scope.
- **PERM-02 — `own` scope.** `scope` is now `all | department | own` (`2026_11_06_000001_...`); `User::hasAction()` compares keys for `own`; employees' record grants seed as `own`; covered by `test_employee_own_scope_only_matches_the_actor`.
- **AUTH-06 — Access + refresh tokens.**
  - Login/refresh issue a 15-min `access-token` (`['*']`) + 30-day `refresh-token` (`['issue-access-token']`); tokens rotate on every refresh.
  - `POST /v1/auth/refresh` lives outside `auth:sanctum` (an expired access token must still refresh) and uses `RefreshTokenRequest`.
  - No expiry middleware: Sanctum's guard rejects an expired `expires_at` (`Guard.php:126-130`). `config/sanctum.php` `expiration` stays `null` so it does not cap refresh tokens at 15 min.
  - Refresh rejects access tokens reused as refresh tokens (`*` ability would otherwise match), expired/unknown tokens, and suspended users — all 401.
  - Logout deletes the current access token and the supplied `refresh_token`; without it, all of the user's refresh tokens are revoked (all sessions).
- **IAM-05 — Test suite.** **30 passed / 75 assertions** (`php artisan test`).

---

## [DOING]

- Nothing in progress. Next up: IAM-06 (invite flow).

---

## [TODO] — P0

- **VERIFY-01 — Run migrations + seed + tests.**
  - `php artisan migrate` then `php artisan db:seed --class=PermissionSeeder`, or `php artisan migrate:fresh --seed`.
  - Then `php artisan test` (currently 30/30).
- **AUTH-05 — Password reset.** `POST /auth/forgot-password` + `POST /auth/reset-password`. Use Laravel's password broker (table and `config/auth.php` broker already exist: 60 min expiry, 60s throttle). Always return the same generic response; revoke all tokens after a successful reset.
- **IAM-06 — Invite flow + email verification.** Implement signed, single-use 72h email link; user stays `invited`; accept endpoint sets password, `email_verified_at`, and `active`. `POST /users` is currently Super Admin direct-create only (`users.create`).
  - `UserService::invite()` now throws `LogicException`; compiles, ready to implement.
- **IAM-07 — Disable/archive endpoints.** Actions exist; no routes/controller actions yet.
- **IAM-08 — Roles & permissions API.** No `RoleController`/`PermissionController` exist. Roles are immutable, so **do not add role CRUD**: only list roles and read/update a role's action→scope grants (`GET /roles`, `GET /roles/{role}/permissions`, `PUT /roles/{role}/permissions`), behind `auth:sanctum` + `user.active` + `can:permissions.manage`.
- **AUDIT-01 — Audit persistence + endpoints.** Audit currently goes only to the log file (`AuditService`). Add `audit_logs` table + model, keep the log write, and add `GET /audit-logs` / `GET /audit-logs/{id}` behind `can:audit.view`.

---

## [BACKLOG]

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

## Decisions

- Keep three immutable roles; Super Admin assigns roles and edits role-action mappings.
- Scope tiers are `all` (Super Admin), `department` (Dept Head), `own` (Dept Employee). Scopes stay capability-based, not role-named — role identity lives in `users.role_id`.
- Super Admin has no business-record access.
- Bigint `id` and Laravel's `password` column are the standard.
- Suspended/invited login returns 403, not 422.
- Access/refresh tokens are returned in the response body (bearer auth). They must never be written to app logs or the browser console.
- Logout is per-device when the client sends its `refresh_token`; otherwise it revokes all sessions.

## Hygiene

- AUTH-06 is complete and the suite is green. Working tree also holds PERM-02 (`own` scope) and the `UserService::invite()` placeholder; commit when ready.
