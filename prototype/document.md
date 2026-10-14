# Product Requirement Document

## Project Scope

A Centralized Digital Workspace Platform for Streamlining Business Processes and Integrating Systems.

## Client

iFixz Co.

## The Problem

iFixz Co. struggles on juggling and using different softwares and systems along with their scattered databases because each software they use has its own database.

## The Solution

We plan to develop a centralized workspace platform for them to enhance their employee's digital experience and also to have software with a centralized database.

## Users

Department Employees, Administrator, Client Super Admin

## MVP Features

### ETL Data Pipeline

Every new data or record that will be inputted or uploaded will go through the pipeline to get cleaned and validated before being used to the integrated apps and displayed in analytics.

Organization Admin can set and define pipeline rules of what is the criteria of cleaned data and what validated data is a pass.

### Application Module Registry

Org admin is responsible for creating and integrating new application modules or existing system applications and databases.

It is created by the given factors used for creating module applications (identity, schema, pipeline rules, etc,)

### Analytics

As per application module integrated, there will be a dedicated dashboard for them.

## Tech Stack

Frontend: Tanstack Start, Tailwind CSS, ShadCN, Watermelon UI, Zustand, and Tanstack Query

Backend: Laravel, Redis, MySQL, Eloquent ORM,

Deployment: AWS Cloudfront, S3, EC2/ECS

External Tools:

## Technical Requirements

### Functional

- The system shall route all data entering the central database — native module input, bulk uploads, and external-tool syncs — through the ETL pipeline before storage.
- Org admin shall be able to define and modify pipeline validation rules per module (required fields, formats, duplicate checks, allowed values).
- The system shall log records that fail validation to a rejected-records store, visible to org admin, rather than discarding them silently.
- Org admin shall be able to register a new module (native or external) by submitting a manifest (identity, routes, permissions, schema reference, pipeline rules, dashboard config, shared metrics, events).
- The system shall activate a registered module — sidebar entry, routing, permissions — without requiring a code deployment.
- When registering an external module, org admin shall select one adapter type: File, Database, API, or Webhook, based on what the existing system supports.
- Org admin shall be able to configure adapter-specific connection details (DB credentials, API endpoint, file location, or webhook receiver) and a field mapping from the external system's fields to the workspace's canonical schema.
- Org admin shall be able to set, per module, a sync mode — real-time (default, where the adapter supports it) or batch — with batch as the fallback when real-time isn't supported by the external system.
- Data synced from an external module shall be read-only in the workspace — the system shall not write back to an external tool's source system.
- Native-module users (user role) shall be able to input data directly into native modules (e.g. IMS, Sales Operation); this does not extend to external modules, which remain view-only.
- The system shall render a dedicated dashboard per module (native or external) from that module's schema data, using the same rendering system regardless of source.
- The system shall provide one shared/overview dashboard aggregating metrics across modules via the shared metrics layer.
- Only org admin roles shall be able to register, enable, disable, or edit modules in the registry.
- Org admin shall be able to configure the backup schedule and retention duration for the central database.
- The system shall support restoring the database from a configured backup.
- The system shall cache computed analytics per module, so dashboard queries are served from cache rather than recomputing from the central database on every request.

### Non-Functional

- Workspace pages and dashboards shall load within 2000ms under normal conditions.
- The module registry shall support registering and activating at max 6 additional modules beyond IMS and Sales Operation without requiring changes to the registry's core mechanism (manifest schema, activation flow, or database architecture).
- The shared-metrics overview dashboard shall respond within 300ms with up to 8 total registered modules, verified through load testing prior to deployment. .
- When an external module's source system becomes unreachable, the workspace shall continue serving the last successfully synced data (marked with a "last updated" timestamp) rather than blocking access — prioritizing availability over strict consistency for external-module dashboards.
- The Workspace Platform uptime should be able to secure 95% uptime on a monthly basis excluding the maintenance.

## Success Metrics

- MVP Features successfully implemented and working.
- A working functioning prototype made to test MVP.
- Clear user flow and navigation of the software.
- Cleaned and Validated data should successfully be onboarded.
- Successfully integrated a new or an existing software application.
- A fully cloud native running server and hosting.
- Authentication and Authorization should be successfully implied to users.
- An Interactive Dashboard and User experience in prototype phase.
