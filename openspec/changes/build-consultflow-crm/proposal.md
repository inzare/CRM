## Why

ConsultFlow needs a single, secure system of record for the complete consulting and software-sales lifecycle, replacing fragmented customer, pipeline, quoting, delivery follow-up, and renewal tracking. This MVP establishes an operable production baseline that sales, consulting, and management teams can use locally and deploy to AWS with repeatable quality and security controls.

## What Changes

- Introduce a responsive CRM web application with role-aware navigation, accessible interaction patterns, and task-focused dashboards.
- Add secure account lifecycle management, JWT sessions, password recovery, profile management, role-based authorization, and immutable audit events.
- Add companies, contacts, search, filtering, ownership, tags, notes, soft deletion, and unified activity timelines.
- Add lead qualification and lossless conversion into opportunities, a configurable sales pipeline, guarded stage transitions, loss attribution, history, and Kanban interaction.
- Add a product/service catalog, opportunity line items, versioned quotes with calculated totals and printable output, contracts, renewals, and expansion signals.
- Add calls, meetings, emails, notes, and assigned tasks with due/overdue state across CRM records.
- Add role-filtered dashboards, sales metrics, renewals, follow-up indicators, date/owner filters, and CSV exports.
- Add a versioned REST API, OpenAPI documentation, validation, pagination/filtering/sorting, rate limiting, safe errors, health endpoints, and observability.
- Add a normalized PostgreSQL/Prisma data model, migrations, realistic seed data, and isolated test database support.
- Add Docker-based local operation, AWS infrastructure as code, CI/CD templates, security guidance, architecture decisions, deployment/rollback documentation, and measurable automated test gates.

## Capabilities

### New Capabilities

- `identity-access`: Authentication, session rotation, password recovery, self-service credentials, RBAC enforcement, and security controls.
- `user-administration-audit`: Admin-managed users, invitations, activation state, role-aware UI, and retained audit history.
- `customer-records`: Companies, contacts, ownership, search/filtering, notes, tags, soft deletion, and entity timelines.
- `sales-pipeline`: Lead qualification/conversion, opportunities, configurable stages, valid transitions, loss attribution, history, and Kanban behavior.
- `commercial-lifecycle`: Catalog items, opportunity offerings, versioned quotes, quote state, totals, printable documents, contracts, renewals, and expansion signals.
- `activities-tasks`: Polymorphic CRM activities, assignment, due dates, completion, overdue detection, and inactivity follow-up.
- `analytics-reporting`: Pipeline and revenue metrics, forecasts, conversion and win/loss analysis, product sales, renewals, role-aware dashboards, filters, and CSV export.
- `platform-operations`: API conventions, persistence, configuration, observability, local containers, AWS deployment, CI/CD, quality gates, performance thresholds, and operational documentation.

### Modified Capabilities

None. This is a greenfield repository with no permanent capability specifications.

## Impact

- Creates an npm-workspace monorepo containing a React frontend, NestJS API, shared contracts/configuration, Prisma database assets, automated tests, Terraform, and operational documentation.
- Introduces PostgreSQL, container images, AWS-managed services, and GitHub Actions workflows.
- Establishes `/api/v1` as the public API compatibility boundary and Swagger/OpenAPI as its machine-readable contract.
- Requires environment-specific secrets, an AWS account and deployment identity, DNS/TLS inputs for production HTTPS, and an isolated PostgreSQL database for integration testing.
- Adds new operational responsibilities for database migrations, backups, monitoring, incident response, token-secret rotation, deployment rollback, and cost management.
