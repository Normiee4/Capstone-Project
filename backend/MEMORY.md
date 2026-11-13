# MEMORY — Backend Progress (Kanban)

Last updated: 2026-11-13
Branch: `IAM/user-invitation` (1 commit ahead of `main`; PR #7 open, mergeable clean)
Board covers: auth flow, token lifecycle, invite/verification, role→action authorization, user CRUD guardrails, audit.

**Where we left off (2026-11-13):** IAM-06 (invite flow + email verification) is complete, and the RBAC refactor to verb-based actions is fully wired. Suite green: **59 passed / 168 assertions** (`php artisan test`).

**Today's focus:** Authentication, Authorization, User Management, password reset, invitation onboarding and email verification are done. Next P0 is IAM-07 (disable/archive endpoints), then IAM-08 (roles & permissions read API) and AUDIT-01 (audit persistence).

Legend: `[DONE]` `[DOING]` `[TODO]` `[BACKLOG]` `[BLOCKED]`

---

## Review map — where the auth/IAM layer lives

Use this to review the layer end to end. Everything below is on `IAM/user-invitation` (PR #7).

### Authorization (RBAC)

| File | What to check |
|---|---|
| `app/Support/Action.php:14-26` | The action catalog. **Verb names now** (`read`, `create`, `update`, `archive`, `delete`, `register`, `invite`, `manage_users`, `reset_password`, `activate`, `deactivate`, `run_pipeline`, `configure_adapter`). The old dotted names (`users.view`, …) are gone. |
| `app/Providers/AppServiceProvider.php:41-49` | One Gate per action, `Gate::define($action, fn (User $user, ?Model $target = null) => $user->hasAction($action, $target))`. Gates are therefore **verbs**, so `can:users.view` no longer resolves — routes must use `can:manage_users` etc. |
| `app/Models/User.php:73-92` | `hasAction()` — the single primitive: role must exist → grant lookup on `action` → `scope === 'all'` or no target ⇒ allowed → otherwise `department_id` comparison. **The `own` scope branch was removed**; only `all` and `department` are enforced. |
| `database/seeders/PermissionSeeder.php` | The role→(action, scope) matrix. Super Admin gets everything `all`; Dept Head gets `manage_users`/`invite` at `department`; Employee gets read/create/update/archive at `department` and **no** `manage_users`/`invite` (so employees 403 on the whole `/users` surface). |
| `database/migrations/2026_11_02_071508_create_permissions_table.php` | `permissions.action` enum — now includes `invite`, `manage_users`, `reset_password`. |
| `database/migrations/2026_11_13_000000_add_user_management_actions_to_permissions_enum.php` | MySQL-only `ALTER` widening that enum for databases that already ran the earlier migration. No-op on SQLite. |

### Users

| File | What to check |
|---|---|
| `app/Http/Controllers/UserController.php:27-91` | `index` / `store` / `show` / `update` / `destroy` / `sendPasswordReset`. `index` filters non-super-admins to their own department. |
| `app/Http/Controllers/UserController.php:94-173` | The three guards. `guardProvisioning` / `guardUpdate` treat `manage_users` scope `all` as super-admin rights and `department` as dept-head rights; `guardDelete` is super-admin-only (plus no self-delete, no last-super-admin). `grant()` (`:170`) is the scope lookup helper. |
| `app/Http/Requests/StoreUserRequest.php`, `UpdateUserRequest.php` | Validation for the direct-create and update paths. |
| `app/Http/Resources/UserResource.php` | API shape; `actions` now lists verb names. |
| `app/Modules/IAM/Services/UserService.php:30-51` | `create` / `update` / `delete` + audit. |
| `app/Modules/IAM/Services/AuditService.php` | Log-only audit writer; `log(string $event, ?Model $subject = null, array $metadata = [])`. Subject was widened to `?Model` so invitations can be audited. |

### Invitation + email verification

| File | What to check |
|---|---|
| `app/Modules/IAM/Services/UserService.php:55-92` | `createInvite()` — authorizes, refuses an email that already has a user, reserves the `users` row (`status = invited`, unusable random password), stores a SHA-256 token hash, mails the plain token. |
| `app/Modules/IAM/Services/UserService.php:94-152` | `resendInvite()` — refused while a live invitation is pending; after expiry it revives the reserved row and issues a new token. |
| `app/Modules/IAM/Services/UserService.php:154-197` | `acceptInvite()` — looks the invitation up by `hash('sha256', $token)`, takes **email and role from the invitation row (never the request)**, burns `accepted_at` inside a `lockForUpdate` transaction so a replay loses, then sets name/password/`active`/`email_verified_at`. |
| `app/Modules/IAM/Services/UserService.php:199-223` | `authorizeInvite()` — Super Admin may invite anyone; Dept Head may only invite employees into their own department; a department is required for every role except `super_admin`. |
| `app/Modules/IAM/Services/UserService.php:225-262` | `reserveInvitedUser()` + `issueInvitation()` helpers. |
| `app/Models/Invitation.php` | `isExpired()` / `isAccepted()` / `isValid()`; `token_hash` is hidden; `accepted_at` must stay in `$fillable` or the burn is silently dropped. |
| `app/Http/Controllers/InvitationController.php` | `store` / `resend` / `show` (token lookup for the accept form) / `accept`. |
| `app/Http/Requests/InvitationRequest.php`, `AcceptInvitationRequest.php` | `email`, `role_id`, `department_id` / `token`, `name`, `password` (+`confirmed`). |
| `app/Mail/InvitationMail.php` | Styled HTML invite; the link points at the **frontend** `/accept-invitation?token=…`. |
| `app/Modules/IAM/Services/EmailVerificationService.php:23-45` | `send()` — `URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), ['id', 'hash' => sha1(email)])`. |
| `app/Modules/IAM/Services/EmailVerificationService.php:48-64` | `verify()` — signature proves authenticity, the `sha1(email)` hash proves the link belongs to that address, `hash_equals` for comparison. Idempotent. |
| `app/Mail/EmailVerificationMail.php` | Styled HTML verification mail. |
| `routes/api.php` | Full route map (see below). |

### Route map (`routes/api.php`)

```
public   POST   /v1/auth/login                      throttle:login
public   POST   /v1/auth/refresh                    throttle:login
public   POST   /v1/auth/password-reset-request     throttle:login
public   POST   /v1/auth/reset-password             throttle:login
public   GET    /v1/invitations/{token}             throttle:invitation
public   POST   /v1/invitations/accept              throttle:invitation
public   GET    /v1/auth/email-verification/verify  signed + throttle:invitation
auth     POST   /v1/auth/logout
auth     GET    /v1/auth/me
auth     POST   /v1/auth/email-verification/send    throttle:login
auth     GET    /v1/users                           can:manage_users
auth     POST   /v1/users                           can:manage_users
auth     GET    /v1/users/{user}                    can:manage_users,user
auth     PUT    /v1/users/{user}                    can:manage_users,user
auth     DELETE /v1/users/{user}                    can:manage_users,user
auth     POST   /v1/users/{user}/password-reset     can:reset_password,user
auth     POST   /v1/users/invite                    can:invite
auth     POST   /v1/users/invite/resend             can:invite
```

`auth` = `auth:sanctum` + `user.active`.

---

## [DONE]

- **AUTH-01 — Auth API works.** Login / logout / me; JSON 401 for guests.
- **AUTH-02 — Password chain.** `password` column + `'password' => 'hashed'` cast + `Hash::check`; unhashed legacy passwords are rejected as validation errors.
- **AUTH-03 — Active-user gate.** `user.active` alias; non-active token → 403 `Account is not active.`
- **AUTH-04 — Suspended login.** Returns 403, matching the flowchart.
- **AUTH-05 — Password reset (super-admin mediated).**
  - `POST /auth/password-reset-request` (public): generic 200; notifies all Super Admins; unknown email does nothing.
  - `POST /users/{user}/password-reset` (`can:reset_password,user`): Super Admin sends the user a Laravel broker reset link.
  - `POST /auth/reset-password` (public): consumes the broker token, sets the password, revokes all user tokens.
  - No OTP and no new table: uses `password_reset_tokens` + `Password` broker.
- **AUTH-06 — Access + refresh tokens.**
  - Login/refresh issue a 15-min `access-token` (`['*']`) + 30-day `refresh-token` (`['issue-access-token']`); tokens rotate on every refresh.
  - `POST /v1/auth/refresh` lives outside `auth:sanctum` (an expired access token must still refresh) and uses `RefreshTokenRequest`.
  - No expiry middleware: Sanctum's guard rejects an expired `expires_at`. `config/sanctum.php` `expiration` stays `null` so it does not cap refresh tokens at 15 min.
  - Refresh rejects access tokens reused as refresh tokens (`*` ability would otherwise match), expired/unknown tokens, and suspended users — all 401.
  - Logout deletes the current access token and the supplied `refresh_token`; without it, all of the user's refresh tokens are revoked (all sessions).
- **IAM-01 — User CRUD scaffolding.** Controller, requests, resource, service, audit.
- **IAM-02 — Actions model (verb-based).**
  - `app/Support/Action.php` — fixed catalog of **verb** actions; `Action::all()` drives the Gate definitions.
  - `permissions` table is `(role_id, module_id, action, scope)` with unique `(role_id, module_id, action)`; `roles.role_name` unique.
  - `User::hasAction($action, ?Model $target = null)` reads the role's mounted grants; scope `all` or no target ⇒ allowed, otherwise `department_id` comparison.
  - `AppServiceProvider` defines one Gate per action.
- **IAM-03 — Routes.** `/users` inside `auth:sanctum` + `user.active`, protected by `can:<verb>[,<target>]`.
- **IAM-04 — Guardrails.** Department Head is department-scoped; cannot escalate role/department; cannot delete accounts; Super Admin cannot delete self or the last Super Admin; employees have no `manage_users` grant so the whole `/users` surface is closed to them.
- **IAM-05 — Test suite.** **59 passed / 168 assertions** (`php artisan test`).
- **IAM-06 — Invite flow + email verification.** ✅ closed 2026-11-13
  - `invitations` table: `email`, `role_id`, `department_id`, `invited_by`, `token_hash` (unique, SHA-256), `expires_at` (72 h), `accepted_at`, `last_sent_at`.
  - Token = `Str::random(64)`, stored hashed; the plain token only ever lives in the mail link. 384 bits of entropy — brute force is infeasible; the real threats are replay and enumeration, both handled (one-time use, generic error).
  - `createInvite()` reserves the `users` row so the email is claimed up front (`users.email` is unique); the row cannot log in (`status = invited`, unusable password) until accepted.
  - `resendInvite()` refuses while a live invitation is pending, revives the row after expiry, and issues a new token.
  - `acceptInvite()` is replay-proof: the token is burned (`accepted_at`) inside a `lockForUpdate` transaction before the account is touched, and email/role always come from the invitation row, never the request.
  - Accepting sets `name`, `password`, `status = active`, `email_verified_at`.
  - Email verification for directly-provisioned users: signed 60-minute URL (`URL::temporarySignedRoute`) + `sha1(email)` hash, no new table, no new token column; `POST /auth/email-verification/send` (auth) and `GET /auth/email-verification/verify` (signed, public).
  - Rate limits: `invitation` limiter, 10/min per IP, on the three public invitation/verification endpoints.
  - **23 new tests**: `tests/Feature/IAM/InvitationServiceTest.php` (10), `tests/Feature/IAM/InvitationApiTest.php` (8), `tests/Feature/Auth/EmailVerificationTest.php` (5).
- **DOC-01 — SCHEMA §3 updated.** Users are bigint + `password` + status/timestamps; permissions are action/scope.

---

## [DOING]

- Nothing in progress. Next up: IAM-07 (disable/archive endpoints).

---

## [TODO] — P0

- **VERIFY-01 — Run migrations + seed on MySQL.** ⚠️ the test suite runs on SQLite, which ignores enums, so the `permissions.action` enum change is **not covered by tests**.
  - `php artisan migrate` (picks up `2026_11_13_000000_add_user_management_actions_to_permissions_enum.php`), then `php artisan db:seed --class=PermissionSeeder`, or `php artisan migrate:fresh --seed`.
  - Then `php artisan test` (currently 59/59).
- **IAM-07 — Disable/archive endpoints.** Actions exist (`activate`, `deactivate`, `archive`); no routes/controller actions yet. Note `guardUpdate` currently only allows `active`/`suspended` in `status`.
- **IAM-08 — Roles & permissions API.** No `RoleController`/`PermissionController` exist. Roles are immutable, so **do not add role CRUD**: only list roles and read/update a role's action→scope grants (`GET /roles`, `GET /roles/{role}/permissions`, `PUT /roles/{role}/permissions`), behind `auth:sanctum` + `user.active` + `can:manage_users` (there is no `permissions.manage` verb any more).
- **AUDIT-01 — Audit persistence + endpoints.** Audit currently goes only to the log file (`AuditService`). Add `audit_logs` table + model, keep the log write, and add `GET /audit-logs` / `GET /audit-logs/{id}` behind a new `audit.view` verb.

---

## [BACKLOG]

- **FE-01 — Frontend pages for the invite/verify flows.** The invite mail links to the frontend `/accept-invitation?token=…`, which must POST `token`, `name`, `password`, `password_confirmation` to `POST /v1/invitations/accept`. The verification mail links straight at the API's signed `GET` endpoint, which answers with JSON — a browser click shows raw JSON unless the mail links at a frontend page that calls the API instead.
- **CI-01 — No CI.** `.github/workflows/` is empty, so PR #7 is green only in the sense that GitHub found no conflicts. Add a workflow running `php artisan test` on SQLite.
- **DOC-02 — Remaining docs drift.** Module tables still reference `module_id` FKs that don't exist yet.
- **PERM-01 — Per-module data permissions.** Deferred; the `permissions` table has a `module_id` column (default `*`) but no FK, and the action names carry no resource dimension — verbs are global, so `manage_users` / `invite` are what keep user management separate from record CRUD.
- **MOD-01 — Module Registry v1.** No `Module`/`Adapter` models, migrations, or routes.
- **PERM-03 — `own` scope is dead.** The `scope` enum still allows `own` and `2026_11_06_000001_...` added it, but `User::hasAction()` no longer handles it — an `own` grant silently behaves like `department`. Either drop `own` from the enum/migration or restore the branch in `hasAction()`.

---

## Verified facts

- `hasAction()` is the single authorization primitive: role must exist → grant lookup on `action` → `all` or no target ⇒ allowed → otherwise `department_id` comparison. **`own` is no longer handled.**
- Gates receive an optional target: `can:manage_users,user` passes the bound model; `can:manage_users` checks the action only.
- Gate names are verbs (`Action::all()`), so a route must never use the old dotted strings — they resolve to no gate and 403.
- `manage_users` scope `all` = Super Admin; scope `department` = Dept Head; no grant = Employee (closed out of `/users` entirely).
- Seeded roles: `super_admin`, `dept_head`, `employee`.
- No Policies: authorization is uniform role→action→scope, so policies would be boilerplate for now.
- Token scheme: 15-min access token, 30-day refresh token with ability `issue-access-token`, rotating on use; Sanctum's guard enforces `expires_at` on every request.
- Sanctum's `can()` matches `*`, so an access token would satisfy `can('issue-access-token')`; the refresh path also checks the token name.
- Audit logs never contain token values (only user/subject ids, metadata, IP, UA).
- Invitation tokens are stored hashed, are single use, and expire after 72 h; verification links are signed and expire after 60 min.
- `AuditService::log()` takes `?Model $subject`, so invitations are auditable alongside users.

## Decisions

- Keep three immutable roles; Super Admin assigns roles and edits role-action mappings.
- Actions are **verbs**; the scope column stays capability-based (`all` | `department`), not role-named — role identity lives in `users.role_id`.
- `own` scope was dropped from enforcement; employee rights are department-wide.
- Super Admin has no business-record access.
- Bigint `id` and Laravel's `password` column are the standard.
- Suspended/invited login returns 403, not 422.
- Access/refresh tokens are returned in the response body (bearer auth). They must never be written to app logs or the browser console.
- Logout is per-device when the client sends its `refresh_token`; otherwise it revokes all sessions.
- Password reset is mediated by Super Admin (request → notify → admin sends link); no OTP. Uses the built-in broker token.
- An invitation **reserves** the `users` row at invite time (status `invited`, unusable password) so the email is claimed by the unique index before anyone clicks the link; the account is inert until accepted.
- Accepting an invitation marks the email verified — clicking the mailed link is proof of email ownership. Admin-provisioned users verify through the signed link instead.
- The acceptance endpoint does **not** log the user in; they sign in with the password they just set.

## Hygiene

- Branch `IAM/user-invitation` is pushed, commit `2776612`, PR #7 open and mergeable clean. Working tree clean.
- Three junk files (`backend/hasAction('create'))`, `backend/hasAction('read'))`, `backend/toArray())` — PHP error dumps from a stray tinker command — were staged on this branch; removed from the index and disk.
- `git config core.hooksPath .githooks` is not set in this clone and no `.githooks/` directory exists, so the commit-message hook described in `CONTRIBUTING.md` is not enforced locally.
