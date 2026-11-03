# MEMORY — Backend Progress

Last updated: 2026-11-03
Branch: `fix/auth-login-hashing-500`
Covers: last two sessions (IAM user CRUD audit, re-review, deferral decisions).

## Current state

Auth (login / logout / me) works and is covered by `tests/Feature/Auth/`.
IAM user CRUD was added but is **not functional**: routes lack model binding and
auth, `index` is unreachable, and create/update gates cannot pass for any role.
Nothing is committed; the new IAM files are untracked.

## Files in play

Modified:
- `app/Modules/IAM/Services/AuditService.php` — `Auth::id()` → `auth('sanctum')->id()`
- `app/Providers/AppServiceProvider.php` — four `iam.users.*` gates
- `bootstrap/app.php` — comments only (routing/middleware unchanged)
- `routes/api.php` — user routes added (still broken, see below)

New (untracked):
- `app/Http/Controllers/UserController.php`
- `app/Http/Requests/StoreUserRequest.php`
- `app/Http/Requests/UpdateUserRequest.php`
- `app/Modules/IAM/Services/UserService.php`

Deleted (correctly): `backend/toArray())` — shell parse-error garbage.

## Verified facts

- Password chain is consistent: Request plain password → `User` `'password' => 'hashed'`
  cast → `Hash::check` in `AuthService`; `getAuthPassword()` returns `password`.
- Sanctum registers `auth.guards.sanctum` at runtime
  (`vendor/laravel/sanctum/src/SanctumServiceProvider.php:24-27`), so
  `auth('sanctum')->id()` in `AuditService` resolves. Login-failure audits log `null` (intended).
- `user.active` alias is registered (`bootstrap/app.php:21`); suspended token → 403 JSON.
- Guest hitting a `can:` route → 403 (Gate returns false for a required-arg closure, no 500).
- `UserController` injects `UserService`, so create/update/delete now emit audit events.
- Eloquent `update()` on a non-existing model returns `false` (no insert); `delete()` on a
  non-existing model is a no-op — so unresolved route models fail silently, they do not corrupt data.
- Seeded roles: `super_admin`, `dept_head`, `employee`. Docs (`SCHEMA.md`) say `dept_employee` — drift.

## Blockers / bugs (priority order)

1. **`routes/api.php` user routes are broken (P0).**
   - Outside the `auth:sanctum` + `user.active` group → `can:` evaluates as guest → 403 for everyone.
   - No `{user}` route parameter on show/update/destroy → no route-model binding; a fresh
     empty `User` is injected. `show` returns an empty resource, `update` returns false then
     logs `user.updated` with a null subject, `destroy` no-ops and still returns
     "User deleted successfully".
   - `GET /users` points at `show`, not `index`; `index` is unreachable. No list endpoint.
   - Stale `use App\Http\Controllers\AuditLogController;` (class does not exist until deferred work resumes).
2. **Gate ↔ seeder mismatch (P0).** Gates demand `hasPermission(..., 'iam', 'all')`, but no seeded
   grant satisfies create/update:
   - super_admin: `read * all` only → no create/update
   - dept_head: `create/update * department` → scope `all` fails
   - employee: create/update only on `ims`/`sales`, `read * department`
   Result: view passes for admin/head; delete only for head; create/update for nobody.
3. **`UpdateUserRequest` blocks legitimate updates (P0).** `password` is `required`
   (forces a reset on every edit) and `unique:users,email` lacks
   `Rule::unique('users','email')->ignore($this->route('user'))` → saving an unchanged email returns 422.
4. **`UserService::invite()` is empty but typed `: User`** (`UserService.php:39`) → TypeError if called.
5. **Missing authorization/scoping on records.** No gate in the controller/requests; no
   department scoping on `show/update/destroy` → IDOR for any authenticated user. `index`
   returns all users to every role (employee `read * department` never enforced), has no
   pagination, and N+1s `role`/`department` in `UserResource`.
6. Minor: `AuditService.php:13` trailing whitespace; hard-coded `sanctum` guard.
7. Docs drift: `permissions.module_id` uses `'*'` wildcard in code but `SCHEMA.md:79` says
   FK → `modules.id` (table not migrated); `'iam'` is not a registered module.

## Decisions

- **Defer audit-log scaffolding** (model, controller, factory, migration, resource, request).
  Keep `AuditService` as log-only; remove the unused `AuditLogController` import when routes are touched.
- **Next area: Module Registry** (SCHEMA §4), not more IAM polish.

## Next: Module Registry

Docs reference it but nothing exists: no `Module`/`Adapter` models, migrations, or controller;
`app/Modules/Integration` and `app/Modules/Lifecycle` are empty. Registry actions already exist in
the `permissions.action` enum (`register`, `activate`, `deactivate`, `delete`, `run_pipeline`,
`configure_adapter`).

Candidate v1 scope:
- `modules`: name, slug (unique), `module_type` (native|integrated), `status_flag`
  (registered|active|inactive), `department_id`, `pipeline_rules` json, `registered_date`,
  `registered_by` → users, `last_synced`.
- `adapters`: module FK, name, type (file|db|api|webhook), `config` json, `credential_ref`
  (single-table inheritance).
- `module_tables` + `module_columns`: only if the schema feature is in v1 (droppable later).
- Registry service + gates (`modules.view/create/register/activate/deactivate/delete`) wired to
  `hasPermission`, with seeds that actually satisfy the gates this time.
- Routes under `/api/v1/modules` with `auth:sanctum` + `user.active` + `can:`.
- Defer: provisioning DDL / dynamic tables, pipelines, event log.

## Test tooling

Tinker + cURL suites were produced; PHP is not on the agent PATH (`php` not found in this bash),
so run them from a normal terminal.
- Tinker: per-role `Gate::forUser(...)->allows(...)`; `UserService` create/update/delete with
  `Hash::check` + `storage/logs/laravel.log` audit grep; `invite()` TypeError check;
  `UpdateUserRequest` email-uniqueness check; `config('auth.guards.sanctum')`.
- cURL: login → `TOKEN`, `/auth/me` 200/401, suspended 403, user CRUD (currently 403 / empty / no-op).
