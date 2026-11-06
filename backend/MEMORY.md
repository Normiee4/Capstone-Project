# MEMORY — Backend Progress (Kanban)

Last updated: 2026-11-06
Branch: `fix/auth-login-hashing-500` (IAM action/permission work ported here from `iam/roles-and-permissions`)
Board covers: auth flow, role→action authorization, user CRUD guardrails.

**Today's focus:** run migrations + seed + tests, then implement the invite flow.

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

---

## [DOING]

- **IAM-05 — Tests written, not run.** `tests/Feature/Auth/*` and `tests/Feature/IAM/UserAuthorizationTest.php` cover the flowchart branches. PHP is unavailable on the agent PATH (ENV-01).

---

## [TODO] — P0

- **VERIFY-01 — Run migrations + seed + tests.**
  - `php artisan migrate` then `php artisan db:seed --class=PermissionSeeder`, or `php artisan migrate:fresh --seed`.
  - Then `php artisan test`.
- **IAM-06 — Invite flow.** `UserService::invite()` still empty but typed `: User`. Implement single-use email link (72h). `POST /users` is currently Super Admin direct-create only (`users.create`).
- **IAM-07 — Disable/archive endpoints.** Actions exist; no routes/controller actions yet.

---

## [BACKLOG]

- **DOC-02 — Remaining docs drift.** Module tables still reference `module_id` FKs that don't exist yet.
- **PERM-01 — Per-module data permissions.** Deferred; current action names encode the module area.
- **PERM-02 — `own` scope.** Not needed yet; department is the boundary.
- **MOD-01 — Module Registry v1.** No `Module`/`Adapter` models, migrations, or routes.

---

## Verified facts

- `hasAction()` is the single authorization primitive: active role → grant lookup → `all` bypass or `department_id` comparison.
- Gates receive an optional target: `can:users.update,user` passes the bound model; `can:users.view` checks the action only.
- Seeded roles: `super_admin`, `dept_head`, `employee`.
- No Policies: authorization is uniform role→action→scope, so policies would be boilerplate for now.

## Decisions

- Keep three immutable roles; Super Admin assigns roles and edits role-action mappings.
- Scope is `all` vs `department` (`own` deferred).
- Super Admin has no business-record access.
- Bigint `id` and Laravel's `password` column are the standard.
- Suspended/invited login returns 403, not 422.
