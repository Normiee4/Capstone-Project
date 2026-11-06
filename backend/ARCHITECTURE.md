# System & Software Architecture Specification

**Project:** Centralized Digital Workspace Platform / iPaaS for Integrating iFixz CRM, Inventory, Operations System
**Client:** iFixz Enterprise Co.
**Version:** 1.1
**Date:** November 2, 2026

---

## ⚠️ Strategic Roadmap Context & Architectural Disclaimer

The primary objective of this project is the development of the **Enterprise Integration Platform Core** (the Workspace Shell, the Module Registry, the ETL Pipeline Engine, and the Timeline Tracking Architecture).

The **Inventory Management System (IMS)** and **Sales Operations** modules represent the initial use cases recommended by the client. The system is designed so these modules can either be built directly inside the workspace later on, or connected to the client's existing legacy tools using integration adapters. During this MVP stage, these modules are simulated using configuration files to prove that the integration hub can successfully validate, route, and track data workflows.

---

## 1. High-Level Design (HLD) & Hybrid Infrastructure

The platform uses a **Hybrid Cloud x On-Premise Infrastructure** designed to give office workers fast performance while keeping data centralized and secure in the cloud.

- **The Central Source of Truth:** The main production database is hosted in the cloud using **AWS RDS (MySQL)** inside a private, secure AWS network (VPC).
- **On-Premise Application Server:** A local server inside the office network hosts the Laravel **API-only compute layer**. Laravel exposes versioned JSON endpoints under `/api/v1` and does not render pages or serve front-end assets. It communicates securely with the cloud database (AWS RDS) over an encrypted **Site-to-Site VPN**.
- **Presentation Layer:** The workspace front end is a **Next.js 16 (App Router)** application deployed independently of the API. Office employees load the Next.js workspace from the local network or the remote mirror for fast page loads; the front end communicates exclusively with the Laravel API over JSON using Sanctum bearer tokens. Blade, Inertia, and server-rendered Laravel views are not part of the runtime architecture.
- **Remote & Disaster Recovery Access:** Remote workers, or office workers experiencing a local hardware blackout, access an identical backup mirror of the application hosted on **AWS ECS (Fargate)**. An AWS Application Load Balancer automatically routes traffic here if the on-premise server goes offline.
- **Performance Optimization:** To keep the system fast over the VPN, the application uses database query caching and pulls related data rows together in bulk rather than making dozens of small, slow network requests.

---

### Operational Routing Scenarios

- **The Central Source of Truth:** The production database is decoupled from the compute layers and hosted entirely in the cloud using **AWS RDS (MySQL)** running within an isolated, private AWS VPC subnet.
- **On-Premise Office Boundary:** Internal warehouse and operational employees access the Next.js workspace via a local office network domain shortcut. The local on-premise Laravel API processes compute operations locally and securely queries the AWS RDS instance through an encrypted, low-latency **Site-to-Site VPN**.
- **Remote & Disaster Recovery Boundary:** Remote (WFH) employees or local workers experiencing an on-premise infrastructure blackout are seamlessly routed to an application mirror running on **AWS ECS (with Fargate Launch Type)**, managed by an Application Load Balancer (ALB) to handle dynamic container networking. Static system assets and data pipeline templates reside securely within an **AWS S3 Bucket**.
- **Data Transport Optimization:** To prevent network latency over the Site-to-Site VPN from degrading the workspace UI, the backend application layer enforces strict Eloquent **Eager Loading (`with()`)** to consolidate relational data lookups into single database requests. Row transactions sent to AWS RDS are executed using bulk inserts rather than sequential individual writes.

---

## 2. Software Architecture & Design Design

The codebase is organized as a unified, single deployable unit utilizing structural modular boundaries to prevent architectural decay.

### Architectural Frameworks

- **Modular Monolith Architecture:** The entire backend compiles and deploys as a single application unit. However, logical business components (Core IAM, IMS, Sales Operations, Integration Engine) are isolated into independent, strictly bound directory structures under `app/Modules`. Cross-module database table joins are architecturally banned; modules interact solely via contract interfaces or structural events.
- **Identity & Access Management (Core Module):** The `app/Modules/Core` module is the single bounded context for identity. It owns authentication, users, roles, permissions, departments, invitations, and audit logging. Other modules consume Core contracts or events and never query Core tables directly.
- **Layered Model-View-Controller (MVC):** Internal request-handling follows Laravel's native MVC pattern on the backend. The **Model** encapsulates the data layer and core business validation rules, the **View** is implemented as versioned JSON API resources (`/api/v1`) that serialize optimized state for the **Next.js 16 (App Router)** presentation front-end, and the **Controller** manages application request routing.

### Core Design Methodologies

- **Object-Oriented Design (OOD):** Governs micro-level code implementation. System features, integration adapters, and event payloads are treated as encapsulated **Objects**. Design principles like abstraction and polymorphism are utilized to manage connection behaviors across different external legacy applications seamlessly.

### Strategic Development Practices

- **Test-Driven Development (TDD):** High-risk application boundaries—specifically the custom ETL calculation stages and data transformation mappings—require functional unit test coverage compiled through an Agile CI/CD testing pipeline before production acceptance.
- **Spec-Driven Development (SDD):** Feature implementations mandate a frozen Markdown technical specification before coding blocks initialize, ensuring development strictly respects the established project boundaries.

---

## 3. Low-Level Design (LLD) Design Patterns

To cleanly execute complex enterprise synchronization features, five foundational behavioral and structural patterns are implemented natively within the backend framework:

- **Adapter Pattern (Integration Mapping):** Utilized to bridge structural differences between systems. The workspace implements adapters to translate incoming data from external tools into a format the central database understands, and conversely maps workspace actions back into payloads the external systems can accept.
- **Chain of Responsibility Pattern (The ETL Data Pipeline):** Applied directly to data onboarding tasks. Data moves down a sequential, step-by-step pipeline (*Ingest → Stage → Validate → Transform → Load*). Each step has a single job; if a record fails a validation step, it is cleanly routed to a rejected ledger, preventing it from moving further down the chain.
- **Observer Pattern (Cross-Module Event Messaging):** Powers your Business Activity Monitoring (BAM) timeline. When an action occurs within a module (like a status change), it broadcasts an event notification. Other modules or logging services listen for this event and update themselves automatically, keeping the systems loosely coupled.
- **Strategy Pattern (Dynamic Execution Routines):** Handles the admin's configuration choices. Depending on the sync mode (Batch vs. Real-time) or adapter type selected in a module's manifest, the workspace dynamically switches its execution routine at runtime without needing code modifications.
- **Role-Based Access Control (RBAC) with Sanctum Bearer Tokens:** System endpoints enforce route-level authorization gates against database-backed roles and permissions. Authentication uses Sanctum personal access tokens carried in the `Authorization: Bearer` header. Each user holds exactly one role, and each role maps to a set of permissions stored in the global database tables. Gates evaluate the user's current role-permission mapping on every request, so permission changes take effect immediately without waiting for tokens to expire.

### Authentication, Authorization & Account Lifecycle

- **Invite-Only Accounts:** The platform has no public registration. Accounts are provisioned by authorized administrators — a Super Admin may invite any role, while a Department Head may invite Department Employees only within their own department — who issue a single-use invitation link valid for 72 hours. The invited user confirms their name and sets their password when accepting the invitation. As an exception, a Super Admin may also directly create an active account with a password; this is still not public registration. Passwords are never transmitted by email.
- **Account Statuses:** Users exist in one of three states — `invited` (awaiting acceptance), `active` (able to authenticate), or `suspended` (blocked from authenticating). Only `active` users may sign in.
- **Platform Roles:** The system defines three immutable role names: **Super Admin**, **Department Head**, and **Department Employee**. Role names cannot be created, renamed, or deleted through the application; a Super Admin may only reassign the permissions attached to each role.
- **Super Admin:** Holds read-only oversight across every module, pipeline, and backup history. Additionally, a Super Admin provisions any account, appoints Department Heads, edits role-permission mappings, performs CRUD over user records (create, view, update, enable/disable, archive or hard-delete), and reads the audit log. Super Admin does not mutate modules, pipeline rules, or backups.
- **Department Head:** Inherits operational administration of the workspace: registering and activating modules, configuring pipeline validation rules, manually running ETL batches, configuring backups and restores, executing CRUD overrides, and reviewing rejected validation records. The Department Head also invites and views Department Employee accounts strictly within their own department.
- **Department Employee:** Reads dashboards and records within their own department. May input, update, archive, and approve business-process steps (for example purchase approvals and inventory requests) only in native modules (such as IMS and Sales Operations) and only within their designated department; external modules remain read-only.
- **Audit Trail:** Authentication events (login success/failure, logout), invitation events (sent, resent, accepted), and account/role changes (role assignment, suspension, reactivation, permission mapping changes) are recorded with the actor, subject, IP address, user agent, and metadata. Passwords and invitation tokens are never written to the audit log.
- **Token Lifecycle:** Sanctum token lifetime is configurable. Logout revokes the current token; suspending a user or changing their password revokes active tokens. Rate limiting applies to login, invitation acceptance, and invitation issuance.

### Role Use Cases (Actor Responsibilities)

These use cases define each actor's behavioral boundary. Platform roles are fixed (see above); "assign role" means assigning one of the three existing roles to a user, not creating new roles.

- **Super Admin (Platform Governance):** Audits user actions through the audit trail (authentication, invitation, role assignment, suspension/reactivation, and permission-mapping changes). Assigns existing roles to users and reassigns the permissions attached to each role. Appoints Department Heads. Performs CRUD over user records: creates accounts (by invitation or direct active creation), views all accounts, updates profile/role/department, enables or disables (suspends/reactivates) accounts, and archives or hard-deletes accounts subject to guardrails (cannot delete self or the last Super Admin; audit history is retained; disabling or deleting revokes active tokens). Retains read-only oversight of modules, pipelines, and backup history, and does not mutate operational configuration.
- **Department Head (Operational Administration):** Invites Department Employees within their own department only and views those accounts. Integrates external applications and defines their schemas and pipeline validation rules. Manually runs ETL pipeline batches. Configures and schedules backups and restores. Monitors the end-to-end business activity process (BAM timeline) across the workspace.
- **Department Employee (Department-Scoped Execution):** Performs business-process work within their own department only — for example approving purchases, requesting products in inventory, and approving each workflow step. Views, adds, updates, and archives records in their designated department. Integrated/external modules remain read-only; mutations are limited to native modules and department scope.

---

## 4. Diagrams

### 4.1 Use-case diagram

The **Workspace Use Case Diagram** defines the behavioral boundaries and access control rules of the platform, explicitly separating administrative configuration duties from day-to-day department operations.

- **Platform Governance (Super Admin):** The Super Admin actor provides read-only oversight across every module, pipeline, and backup history. The Super Admin also owns account governance: provisioning users, appointing Department Heads, reassigning role permissions, viewing all employee accounts, and auditing user actions. Super Admin access is intentionally read-only for operational configuration — module registration, pipeline rules, and backups are not mutated by this role. It also performs CRUD over user records (create, view, update, enable/disable, archive or hard-delete).
- **Administrative Isolation (Department Head):** The system assigns core infrastructure tasks to the Department Head actor as workspace-wide operational administration. This includes registering new external applications (Can Register a Module...), updating validation schemas (Configure Pipeline Validation Rules), manually orchestrating batch loading runs (Can manual run ETL Pipeline), and managing disaster recovery routines. The Department Head also retains data override rights across integrated spokes (Execute CRUD Overrides...), owns the data-cleaning oversight via the Review Rejected Validation Records use case, and may invite or view Department Employee accounts within their own department only.
- **Operational Business Activities (Department Employee):** The Department Employee actor is locked strictly to module-level execution boundaries. They can perform localized data mutations (Add, Edit, and Archive/Delete Records) within their designated native workspace modules (such as native IMS or Sales Operations) without exposing administrative endpoints. External modules remain read-only. All record visibility and workflow approvals are restricted to the employee's designated department.
- **Unified Cross-Module Capabilities:** The diagram establishes shared informational access points where all three actors intersect. Every role points directly to View Records and Monitor Order Tracking via BAM Timeline, ensuring that end-to-end lifecycle visibility and consolidated dashboards are transparent across the entire enterprise network.

---

### 4.2 Class Diagram

The **UML Class Diagram** maps out the structural design patterns and object relationships implemented within the unified Laravel framework, showcasing low-level decoupling through clean interface contracts and data models.

- **Dynamic Integration Hub (The Adapter Pattern):** The core module registry utilizes polymorphic inheritance. The abstract parent class Adapter defines a shared blueprint for system communication. It is extended by three concrete child modules—API_adapter, DB_adapter, and Webhook_adapter—which isolate connection handling and payload translation behaviors depending on the structural type declared in the Module configuration manifest.
- **Robust Data Cleaning Engine (The Chain of Responsibility):** The processing pipeline is modeled via the Pipeline class, which handles data chunk ingestion asynchronously. Data elements flow sequentially through distinct single-responsibility execution steps (Extract, Validate, Transform, Load). If a structural failure occurs during validation, processing halts for that row segment, and the transactional error log is isolated inside the RejectedRecordsLedger dependency class.
- **Business Activity Monitoring Framework (The Observer Pattern):** The data flow decouples system notifications from heavy relational cross-queries. When the ModuleController executes application state mutations, it broadcasts an event notification. This instantiates a clean, property-holding Activity/Event data transfer object. The OperationTracker service engine intercepts this object to capture runtime data snapshots and chronologically compile the visual workflow tracking log.

---

### 4.3 Sequence Diagram

---

## Architectural Decision Report

**System Focus:** Cross-Department Business Lifecycle & Product Serial ID Tracking

**Core Platforms:** Integrated Modules (CRM, Inventory, Operations, Accounting, Logistics, Finance) managed inside an Integration Hub / iPaaS Platform.

---

### 1. Selected Architecture Pattern

**Event-Driven Architecture (EDA) via the Publish-Subscribe (Pub-Sub) Pattern**

- **Why it was chosen over alternatives:** The **Observer Pattern** is a code-level pattern that only operates inside a single application process's volatile memory space (RAM). Because your CRM, Inventory, and Operations applications run on distinct systems, they have entirely separate memory profiles and databases.
- **The Pub-Sub Solution:** Your **iPaaS platform acts as the universal Event Broker**. Applications do not communicate with each other directly; they announce changes to the broker, which handles message queuing and distribution asynchronously.

---

### 2. Core Operational Dynamics (Fluid Integration Roles)

Your system features a fluid model where **integration roles are contextual rather than hard-coded**. A system's status as a Publisher or Subscriber shifts dynamically based on real-time activity. These integration roles are distinct from platform user roles (Super Admin, Department Head, Department Employee), which are fixed and govern access to the workspace itself:

- **The Publisher (The Trigger):** The exact millisecond an action completes within a module, it broadcasts an Event to the iPaaS platform.
- **The Subscriber (The Action):** Any downstream module configured to listen for that specific event catches it via the iPaaS and automatically executes a corresponding action or alerts a human user.

**The Lifecycle Relay:**

1. **CRM (Publisher)** sends `Transaction.Started` ➔ **Inventory (Subscriber)** reacts.
2. **Inventory (Publisher)** assigns the **Product Serial ID** and sends `Item.Allocated` ➔ **Operations (Subscriber)** reacts.
3. **Operations (Publisher)** completes multi-step updates (*Preparation ➔ Purchasing ➔ Receiving*) and sends `Operations.Completed` ➔ **Accounting and Logistics (Subscribers)** execute parallel billing and shipping workflows.

---

### 3. Flowchart Mapping & Verification

The logic in your provided architectural flowcharts perfectly validates this design paradigm:

- **Flow 1 (Module Registry / Integration Hub):** Establishes your **Data Contract / Schema**. By declaring app details, fields, and pipeline validation rules in the iPaaS, you ensure data integrity across all decoupled applications without hard-coding direct hooks.
- **Flow 2 (Tracking and Monitoring Flowchart):** Implements the execution layer of your **Pub-Sub Engine**. It accurately maps an app action converting into a transcribed event, automatically sorting distribution streams based on department context.

---

### 4. Checklist: What to Look Up Next

As you transition from abstract concepts to building out your iPaaS platform, research these foundational concepts:

**1. Core Integration Concepts**

- **Webhooks vs. Polling API Architecture:** Learn how your applications will pass data to the iPaaS. Target real-time *Outbound Webhooks* for publishers where possible, resorting to *Scheduled API Polling* only for legacy components.
- **Event Payload Schemas (JSON/Avro):** Study how to construct clean, lightweight, universal event payloads. Ensure you design an immutable data block format that carries the master tracking metadata (e.g., `transaction_id`, `serial_id`, `current_lifecycle_status`).

**2. Advanced Architectural Patterns for Scale**

- **The Saga Pattern (Distributed Transactions):** Look up how to coordinate business workflows across multiple microservice databases. This pattern teaches you how to manage "Compensating Transactions"—such as automatically canceling an accounting invoice if the logistics step fails down the line.
- **Idempotent Consumers:** Read about message processing safety. An "idempotent" subscriber guarantees that if a network glitch causes the same event message to be delivered three times, the system will only process it once (preventing multiple duplicate invoices or shipping labels).
- **Dead Letter Queues (DLQ):** Investigate how message brokers isolate broken workflows. If a module fails validation or hits an unexpected database error, the event message drops into a DLQ so your entire business stream doesn't bottleneck or crash.