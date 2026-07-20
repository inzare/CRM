## Context

ConsultFlow CRM is a greenfield, multi-user business system for a consulting and software-product sales organization. It must cover identity, customer records, pipeline, commercial documents, activity management, reporting, and AWS operations without introducing microservice overhead. The repository begins empty, so this change establishes conventions, data ownership, security boundaries, delivery automation, and an initial deployable schema.

Primary stakeholders are administrators, sales managers, sales representatives, consultants, operations engineers, and auditors. The system handles commercially sensitive contact, pricing, forecast, and contract data. Production defaults therefore favor least privilege, transactional consistency, audit retention, private networking, encryption, and recoverable deployments.

Constraints include the required React/Vite and NestJS stacks, PostgreSQL with Prisma migrations, REST/OpenAPI, Docker Compose, AWS ECS/RDS/S3/CloudFront, and GitHub Actions. The MVP is a single organization deployment; multi-tenancy and customer-facing portals are deferred.

## Goals / Non-Goals

**Goals:**

- Deliver a modular npm-workspaces monorepo with independently buildable `web`, `api`, and shared packages.
- Keep business rules in backend domain services and transactions so UI behavior cannot bypass them.
- Provide secure browser sessions using short-lived JWT access tokens and rotated, revocable refresh tokens.
- Apply consistent RBAC and ownership scoping at controllers/services, with role-aware UI as a usability layer only.
- Model CRM data relationally, retain conversion/stage/version history, soft-delete mutable business records, and preserve audit events.
- Make local setup deterministic and production deployment repeatable, observable, HTTPS-ready, and rollback-capable.
- Trace every capability requirement to implementation tasks and automated tests.

**Non-Goals:**

- Multi-tenant SaaS isolation, SSO/SAML, SCIM, native mobile apps, offline mode, or a public customer portal.
- Sending production email, electronic signatures, payment collection, accounting sync, or third-party calendar/telephony integrations; reset/invite delivery is exposed through a provider interface and local log sink.
- Arbitrary workflow scripting, custom fields, per-record ACLs, or user-authored report builders.
- Server-side PDF rendering; the MVP provides a stable printable/PDF-ready quote route and CSS print layout.
- Zero-downtime support for destructive schema changes; migrations follow expand/migrate/contract discipline.

## Decisions

### 1. Modular monolith in an npm-workspaces monorepo

Use `apps/api` (NestJS), `apps/web` (React/Vite), `packages/contracts` (shared enums and transport-safe types), `packages/config` (shared lint/TypeScript presets), `prisma`, `tests/e2e`, `tests/performance`, and `infra/terraform`. Backend modules align to capabilities and communicate through explicit services inside one process.

This keeps transactions, deployment, and local development simple while preserving extraction boundaries. Independent microservices were rejected because the MVP has one team, one database, and workflows that cross several domains.

### 2. PostgreSQL is authoritative; Prisma owns schema evolution

Use normalized tables with UUID primary keys, UTC `timestamptz`, `Decimal` money values plus ISO currency codes, explicit join tables, unique constraints, and targeted indexes. Search uses PostgreSQL `tsvector`/GIN indexes added through SQL migration where Prisma schema syntax is insufficient. Prisma migrations are committed and applied by a one-off ECS migration task before service rollout.

Core aggregates are User/Session/ResetToken, Company/Contact, Lead, PipelineStage/Opportunity/StageHistory, CatalogItem/OpportunityItem, Quote/QuoteLine, Contract, Activity/Task, and AuditLog. Conversion, stage movement, quote versioning/status changes, token rotation, and soft deletion execute transactionally.

An event-sourced database was rejected: append-only history is valuable for selected transitions, but full event sourcing would add projection and operational complexity without an MVP requirement.

### 3. JWT access plus opaque refresh-cookie rotation

The API issues a 15-minute signed access JWT returned in the response body and a 7-day high-entropy refresh token in an `HttpOnly`, `Secure` in production, `SameSite=Strict`, path-scoped cookie. Only an Argon2id hash of each refresh token is stored. Rotation revokes the used session and creates a successor; reuse revokes the token family. The SPA keeps the access token in memory and silently refreshes after reload/401. Sign-out revokes the current session and clears the cookie.

Passwords use Argon2id with OWASP-aligned parameters, a 12-character minimum, breached/common-password denial through a local deny list, and constant-shape authentication errors. Password reset tokens are 32-byte random values, stored only as SHA-256 hashes, single-use, expire after 30 minutes, and revoke all sessions after use. Login and reset requests are throttled by IP plus normalized email; production uses a small Redis/ElastiCache-compatible adapter only if horizontally scaled counters are enabled, while the baseline implementation uses Nest throttling per task and ALB/WAF-ready limits.

Long-lived access JWTs and browser localStorage were rejected because theft would be harder to contain. Storing raw refresh/reset tokens was rejected.

### 4. RBAC plus ownership scoping is enforced server-side

`ADMIN` has user/configuration and all-record access; `MANAGER` has team-wide CRM/report access but cannot manage users except view active assignees; `SALES` manages owned customer/sales records and shared catalog visibility; `CONSULTANT` can view assigned/linked customer and opportunity context and manage assigned activities/tasks. Destructive actions and catalog/pipeline configuration are restricted to ADMIN/MANAGER as specified.

Nest guards establish authentication and coarse roles; services add resource-level ownership/assignment predicates on every protected read and mutation. List queries include scope predicates rather than filtering after retrieval. UI navigation and buttons use the same shared role capability map but are never the security boundary.

### 5. Versioned REST API with uniform behavior

All endpoints live under `/api/v1`; Swagger JSON is served at `/api/docs-json` and interactive docs at `/api/docs` outside hardened production unless explicitly enabled. DTOs use class-validator with a global whitelist, transformation, and unknown-property rejection. Lists accept `page`, `pageSize` (default 25, max 100), allowlisted `sort`, direction, filters, and search, returning `{data, meta}`. Errors use a request ID and stable code without stack traces or secret/database detail.

State-changing requests use JSON, validate optimistic `updatedAt` where collision risk is material, and return `409` for stale or invalid transitions. Deletion is `DELETE` plus soft-delete semantics and audit entry. Idempotency is enforced through transaction checks for lead conversion, quote acceptance, and task completion.

GraphQL was rejected because REST/OpenAPI is required and the bounded screens do not need arbitrary selection sets.

### 6. Frontend uses route modules and query-owned server state

React Router provides authenticated layouts, nested module routes, loaders only for access gating, and a print-only quote route. TanStack Query owns remote state, invalidation, optimistic task completion, and rollback. React Hook Form plus Zod provides client feedback while the API remains authoritative. Tailwind CSS defines a restrained navy/teal/amber visual system with semantic tokens, responsive navigation, dense but readable tables, keyboard-operable menus/dialogs, visible focus rings, labels, live status announcements, and contrast-compliant states.

The pipeline board uses accessible pointer and keyboard drag-and-drop; failed transitions restore the previous column and announce the server error. Tables remain the small-screen fallback where drag interactions are unsuitable.

### 7. Derived reporting is query-based for MVP

Dashboard endpoints aggregate PostgreSQL data inside the caller's authorization scope and a required/default date range. Weighted forecast is `expectedValue * probability`; won revenue uses won stage transition/close dates; conversion metrics use immutable lead conversion and opportunity histories. CSV endpoints stream UTF-8 data with formula-injection escaping and the same filters/scope as JSON reports.

Precomputed warehouses were rejected at MVP scale. Slow-query logging and k6 thresholds establish when materialized views or a reporting replica become justified.

### 8. AWS uses separate static and API delivery planes

Terraform provisions a VPC across two availability zones; public subnets contain an internet-facing ALB and NAT gateways configurable to one per environment, while private subnets contain ECS Fargate tasks and an encrypted Multi-AZ-capable RDS PostgreSQL instance. The API image is stored in ECR. Secrets Manager injects database and JWT configuration. CloudWatch receives structured container logs and alarms. The frontend builds to a private, versioned S3 bucket served by CloudFront with origin access control and SPA fallback.

ACM certificate ARNs and Route 53 zone/domain inputs are optional in development and required for production HTTPS listeners/distributions. Security groups allow database traffic only from ECS and API traffic only from the ALB. RDS deletion protection, backup retention, final snapshots, log retention, autoscaling, and desired counts vary by environment through validated variables.

A single ECS-hosted frontend was rejected because S3/CloudFront is cheaper and isolates static delivery. Kubernetes was rejected due to operational overhead.

### 9. CI separates verification, publication, and deployment authority

Pull requests run install-from-lockfile, format check, lint, typecheck, unit/integration tests, builds, Prisma validation, Terraform formatting/validation, and optional Playwright with service containers. Docker publication runs on protected main/tags with GitHub OIDC to AWS and immutable commit-SHA tags. Deployment workflows require a GitHub Environment approval, apply a reviewed Terraform plan, run migrations, update ECS, wait for health, publish versioned frontend assets, and invalidate CloudFront.

Rollback redeploys the prior image digest/task definition and prior frontend artifact. Database rollback uses forward-fix migrations or snapshot restore; automatic down migrations are not used.

### 10. Observability and audit serve different purposes

Pino JSON logs include request ID, route, status, duration, actor ID, and error code but exclude credentials, tokens, reset links, and sensitive request bodies. Health endpoints distinguish liveness from dependency readiness. CloudWatch alarms cover ALB 5xx/latency, ECS health/capacity, RDS CPU/storage/connections, and log error rates.

AuditLog is immutable application data recording actor, action, entity type/ID, timestamp, request ID, IP/user-agent metadata, and redacted before/after summaries. Audit writes occur in the same database transaction as important mutations where possible; authentication failures are recorded without exposing whether an email exists.

## Risks / Trade-offs

- [Broad MVP scope can create shallow modules] -> Implement vertical capability slices with acceptance tests and do not mark tasks complete without real persistence/business rules.
- [JWT revocation and horizontal scaling are subtle] -> Store hashed refresh sessions in PostgreSQL, rotate atomically, detect reuse, and test concurrency/replay paths.
- [Role plus ownership rules can leak data through lists or reports] -> Centralize scope predicates, test each role against direct IDs and aggregates, and never rely on client filtering.
- [Polymorphic activities can lose referential integrity] -> Use nullable typed foreign keys with an exactly-one-parent database check constraint rather than a free-form entity ID.
- [Quote totals can drift] -> Snapshot descriptions/SKU/unit prices/tax/discount on quote lines and calculate server-side with fixed decimal rounding in one currency.
- [Search and dashboard aggregation may slow with growth] -> Add GIN/composite indexes, pagination, query timing, k6 thresholds, and documented materialized-view triggers.
- [One NAT gateway reduces non-production cost but availability] -> Default production to one per AZ and document the environment trade-off.
- [Email provider is deployment-specific] -> Keep a real delivery port with SES-ready adapter; local mode records expiring links in controlled logs only, never API responses in production.
- [Terraform cannot create external DNS delegation or GitHub secrets safely] -> Document prerequisites and expose validated certificate/zone/OIDC variables.

## Migration Plan

1. Provision or start PostgreSQL, validate environment variables, and build immutable API/frontend artifacts.
2. Run Prisma migrations and seed only explicit non-production environments.
3. Deploy the API task behind the ALB with readiness checks, then run smoke tests against `/api/v1/health/ready` and authentication.
4. Upload hashed frontend assets, publish the entry document last, and invalidate CloudFront.
5. Run role-based smoke tests and monitor error/latency alarms through the bake window.
6. On application failure, restore the prior ECS task definition and frontend release. On incompatible database failure, stop writes and perform a forward fix; restore the latest RDS snapshot only under the documented recovery procedure.

## Open Questions

No implementation-blocking questions remain. Defaults are USD currency, America/Mexico_City display timezone with UTC storage, 30-day renewal warning, 30-day inactivity threshold, 15-minute access tokens, 7-day refresh sessions, and a single organization. Each is configurable where business policy is likely to change.
