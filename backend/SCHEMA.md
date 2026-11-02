# SCHEMA.md — Platform Core Database Schema

Centralized Digital Workspace (EAI hub-and-spoke, modular monolith on Laravel + MySQL).
This document describes the **platform core** schema: authentication and RBAC, the module registry and adapters, the ETL pipeline, and the business lifecycle log. It matches the v1 class diagrams one to one.

## 1. Scope and conventions

- **In scope:** tables the application itself queries and stores.
- **Out of scope (handled by Laravel, not designed here):** Sanctum access tokens, queue and failed jobs tables, cache, sessions, and database notifications. These come from framework migrations.
- **Out of scope (code layer, not data):** routes, controllers, services. They have no tables.
- **Module data tables are not listed here.** Each registered module owns its own schema (`modules.slug`). Native modules (e.g. IMS, Sales Operation) define their tables in code. Integrated modules declare their tables through `module_tables` and `module_columns`, which are provisioned at registration (see section 7).
- **Keys:** every table uses `id` (string/UUID or bigint, decided at implementation) as its primary key, except `operation_tracker` which uses `context_id`.
- **Timestamps:** Laravel's `created_at` and `updated_at` are implied on every table and omitted below. Only business-meaningful timestamps are listed.
- **Class mapping:** each table maps to a class in the v1 class diagrams. The four adapter subclasses (File, API, DB, Webhook) share the single `adapters` table (single-table inheritance), with type-specific attributes in `config`.

## 2. Table overview

| Group | Table | Purpose |
|---|---|---|
| Auth | `departments` | Organizational departments used to scope access |
| Auth | `roles` | The three RBAC roles |
| Auth | `users` | Platform users |
| Auth | `permissions` | What a role may do, on which module, at what scope |
| Registry | `modules` | Registered modules (native or integrated) |
| Registry | `adapters` | How an integrated module connects to its external system |
| Registry | `module_tables` | Declared tables of an integrated module (schema feature) |
| Registry | `module_columns` | Declared columns and their mapping to external fields (schema feature) |
| ETL | `pipelines` | One ETL execution (job) |
| ETL | `rejected_records_ledger` | Rows that failed during an ETL execution |
| Lifecycle | `event_log` | Business activity log (single source of truth) |
| Lifecycle | `operation_tracker` | Current state of a tracked business process |

## 3. Auth and RBAC

### Roles

| Role | Layer it operates on |
|---|---|
| `super_admin` | Module registry and pipeline only (register, activate, deactivate, delete modules, run ETL, configure adapters). Never touches department data. |
| `dept_head` | Full CRUD on their department's module data, with department scope. |
| `dept_employee` | CRUD on their department's module data, with narrower (own) scope as configured. |

### `departments`

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| name | string | | Department name (e.g. Inventory, Sales) |

### `roles`

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| name | string | | Seeded: `super_admin`, `dept_head`, `dept_employee` 
|description | string 
|status | enum | Seeded: 'active' / 'inactive'


### `users`

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| name | string | | |
| email | string | | Login identifier; should be unique |
| password_hash | string | | Hashed password; never store plain text |
| role_id | string | FK → roles.id | |
| department_id | string | FK → departments.id | Null for `super_admin` |

Access tokens are managed by Laravel Sanctum, not stored here.

### `permissions`

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| role_id | string | FK → roles.id | |
| module_id | string | FK → modules.id | Null means all modules |
| action | enum | | Registry actions: `register`, `activate`, `deactivate`, `delete`, `run_pipeline`, `configure_adapter`. Data actions: `create`, `read`, `update`, `archive`. |
| scope | enum | | `own`, `department`, `all` |

Recommended constraint: unique on (`role_id`, `module_id`, `action`).

## 4. Module registry and adapters

### `modules`

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| name | string | | Display name |
| slug | string | | Used for the route prefix and the module's schema name; unique |
| module_type | enum | | `native` or `integrated` |
| status_flag | enum | | `registered`, `active`, `inactive` |
| department_id | string | FK → departments.id | Owning department (drives "own module" CRUD) |
| pipeline_rules | json | | Ordered list of validate/transform rules for this module |
| registered_date | timestamp | | |
| registered_by | string | FK → users.id | |
| last_synced | timestamp | | Last successful sync |

### `adapters`

Single table for all adapter types. Type-specific attributes live in `config`.

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| module_id | string | FK → modules.id | |
| name | string | | |
| type | enum | | `file`, `db`, `api`, `webhook` |
| config | json | | Type-specific settings (see below) |
| credential_ref | string | | Pointer to a secret in a secrets store. Never store the secret itself. |

`config` contents by type:

| Type | Keys |
|---|---|
| file | `file_type` |
| api | `base_url` |
| db | `hostname`, `port`, `db_name` |
| webhook | `payload_url`, `http_method` |

Priority for the MVP: file first, then database, then API. Webhook is likely out of MVP scope.

### `module_tables` (schema feature)

Declares a table that an integrated module will have in its own schema.

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| module_id | string | FK → modules.id | |
| name | string | | Logical and physical table name (validated, slug-safe) |
| source_resource | string | | Where the data comes from: API endpoint, file pattern, or external table |
| status | enum | | `draft`, `provisioned`, `failed` |

### `module_columns` (schema feature)

Declares a column and how it maps to the external data.

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| table_id | string | FK → module_tables.id | |
| name | string | | Column name (validated, slug-safe) |
| data_type | enum | | `string`, `int`, `decimal`, `boolean`, `date`, `datetime`, `json` |
| is_nullable | boolean | | |
| is_key | boolean | | Marks the external key used for upserts |
| external_path | string | | Source field path (e.g. `data.sku`) |
| transform_rule | string | | Optional transform applied during the ETL Transform step |

If the schema feature is postponed, `module_tables` and `module_columns` (and the `pipelines.table_id` column) can be dropped without affecting the rest of the schema.

## 5. ETL pipeline

Stage order: Ingest → Staging → Validate → Transform → Load.

### `pipelines`

One row per ETL execution (job).

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| module_id | string | FK → modules.id | |
| table_id | string | FK → module_tables.id | Null when the module does not use the schema feature |
| job_number | string | | Human-readable job identifier |
| status | enum | | Proposed values: `running`, `success`, `partial`, `failed` |
| started_at | timestamp | | |
| ended_at | timestamp | | Null while running |

### `rejected_records_ledger`

Rows that failed validation, transformation, or load during an execution.

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| pipeline_id | string | FK → pipelines.id | |
| failed_row_index | int | | Row position in the source batch |
| error_message | string | | Why the row was rejected |
| raw_payload | json | | The original row as received |

## 6. Business lifecycle

### `event_log`

Single source of truth for business activity and item history.

| Column | Type | Key | Description |
|---|---|---|---|
| id | string | PK | |
| module_id | string | FK → modules.id | Module that produced the event |
| user_id | string | FK → users.id | Actor |
| name | string | | Event name (e.g. `order.paid`) |
| correlation_key | string | FK → operation_tracker.context_id | Groups events of one process (e.g. a product serial number) |
| activity_description | string | | What happened |
| status | string | | State flag (e.g. ongoing, pending, completed) |
| timestamp | timestamp | | When the event occurred |

Recommended index: `correlation_key`.

### `operation_tracker`

Current state of a tracked business process, built from its events.

| Column | Type | Key | Description |
|---|---|---|---|
| context_id | string | PK | Same value as `event_log.correlation_key` |
| name | string | | |
| current_process | string | | Current stage |
| module_id | string | FK → modules.id | |
| snapshot | json | | Checkpoint of the process state |

## 7. Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| users.role_id | roles.id | many → one | |
| users.department_id | departments.id | many → one | Null for super admin |
| permissions.role_id | roles.id | many → one | |
| permissions.module_id | modules.id | many → one | Null = all modules |
| modules.department_id | departments.id | many → one | |
| modules.registered_by | users.id | many → one | |
| adapters.module_id | modules.id | many → one | A native module has none; an integrated module can have several |
| module_tables.module_id | modules.id | many → one | |
| module_columns.table_id | module_tables.id | many → one | |
| pipelines.module_id | modules.id | many → one | |
| pipelines.table_id | module_tables.id | many → one | Optional |
| rejected_records_ledger.pipeline_id | pipelines.id | many → one | |
| event_log.module_id | modules.id | many → one | |
| event_log.user_id | users.id | many → one | |
| event_log.correlation_key | operation_tracker.context_id | many → one | |
| operation_tracker.module_id | modules.id | many → one | |

## 8. Dynamic module tables (integrated modules)

When an admin registers an integrated module and declares its schema:

1. The module, its adapter, and its `module_tables` and `module_columns` rows are created (status `draft`).
2. On provisioning, a registry service creates the physical tables in the module's own schema from this metadata, and sets `status` to `provisioned` (or `failed`).
3. The ETL pipeline loads data into these tables, and department staff get CRUD on them through generic, metadata-driven code.

Rules and constraints:

- The metadata is the source of truth; physical tables are generated from it.
- Table and column names are validated against a strict pattern and a reserved-word list. Types are limited to the fixed `data_type` set. DDL is never built from raw input.
- DDL runs on a dedicated connection used only by the registry service.
- MySQL DDL is not transactional, so provisioning must be idempotent and its status tracked.
- Schema changes after activation are additive only (new columns) in v1.
- Modules reference other modules' records by foreign key and never duplicate their data.
- Planned system columns on every generated table: `id`, `external_id` (for upserts), `synced_at`, `is_deleted`.

## 9. Deferred to later versions

Not in v1, and each can be added with a migration: write-back direction and outbound queue handling, row counts and batch/rollback markers on `pipelines`, resolution tracking on rejected records, before/after state and entity links on `event_log`, `deal_id` (once the Deal/Order diagram exists), a separate notification rules table, a separate pipeline rules table, and per-column schema versioning.

## 10. Eraser diagram source

```
notation crows-foot
// ═════════ AUTH ═════════
departments [icon: users, color: teal] {
  id string pk
  name string
}

roles [icon: shield, color: red] {
  id string pk
  name string
}

users [icon: user, color: orange] {
  id string pk
  name string
  email string
  password_hash string
  role_id string
  department_id string
}

permissions [icon: lock, color: green] {
  id string pk
  role_id string
  module_id string
  action enum
  scope enum
}

// ═════════ MODULE + ADAPTERS ═════════
modules [icon: box, color: yellow] {
  id string pk
  name string
  slug string
  module_type enum
  status_flag enum
  department_id string
  pipeline_rules json
  registered_date timestamp
  registered_by string
  last_synced timestamp
}

adapters [icon: plug, color: orange] {
  id string pk
  module_id string
  name string
  type enum
  config json
  credential_ref string
}

// ═════════ SCHEMA FEATURE (delete these 2 + their relationships if postponed) ═════════
module_tables [icon: table, color: yellow] {
  id string pk
  module_id string
  name string
  source_resource string
  status enum
}

module_columns [icon: columns, color: yellow] {
  id string pk
  table_id string
  name string
  data_type enum
  is_nullable boolean
  is_key boolean
  external_path string
  transform_rule string
}

// ═════════ ETL ═════════
pipelines [icon: workflow, color: yellow] {
  id string pk
  module_id string
  table_id string
  job_number string
  status enum
  started_at timestamp
  ended_at timestamp
}

rejected_records_ledger [icon: alert-triangle, color: red] {
  id string pk
  pipeline_id string
  failed_row_index int
  error_message string
  raw_payload json
}

// ═════════ LIFECYCLE ═════════
event_log [icon: list, color: orange] {
  id string pk
  module_id string
  user_id string
  name string
  correlation_key string
  activity_description string
  status string
  timestamp timestamp
}

operation_tracker [icon: activity, color: red] {
  context_id string pk
  name string
  current_process string
  module_id string
  snapshot json
}

// ═════════ RELATIONSHIPS ═════════
users.role_id > roles.id
users.department_id > departments.id
roles.id < permissions.role_id
modules.id < permissions.module_id
departments.id < modules.department_id
users.id < modules.registered_by
modules.id < adapters.module_id
modules.id < module_tables.module_id
module_tables.id < module_columns.table_id
modules.id < pipelines.module_id
module_tables.id < pipelines.table_id
pipelines.id < rejected_records_ledger.pipeline_id
modules.id < event_log.module_id
users.id < event_log.user_id
event_log.correlation_key > operation_tracker.context_id
modules.id < operation_tracker.module_id
```