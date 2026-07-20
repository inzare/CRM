# Platform Operations

## Purpose

Define cross-cutting API, persistence, security, local environment, AWS infrastructure, observability, CI/CD, documentation, and measurable quality behavior.

## ADDED Requirements

### Requirement: [PO-001] Versioned validated REST API
The NestJS API SHALL expose business endpoints under `/api/v1`, publish OpenAPI/Swagger documentation, validate and strip/reject unknown input, use standard pagination/filter/sort rules, and return safe structured errors containing request ID, stable code, message, and optional field details without stack/database/secret leakage.

#### Scenario: Invalid API input
- **WHEN** a request contains invalid types, unknown fields, unsupported sort/filter, or a page size above 100
- **THEN** the API returns `400 VALIDATION_ERROR` with safe field details and performs no mutation

#### Scenario: OpenAPI contract
- **WHEN** the documented JSON endpoint is generated in CI
- **THEN** it contains authenticated schemas, enums, response/error types, pagination, and all public v1 routes without duplicate operation IDs

### Requirement: [PO-002] Normalized persistence and migrations
The system SHALL use PostgreSQL through Prisma with committed forward migrations, foreign keys, unique/check constraints, Decimal money, UTC timestamps, indexes for frequent scopes/sorts/search, soft deletion where required, and realistic deterministic seed data. Integration tests SHALL use an isolated PostgreSQL database and clean state per suite.

#### Scenario: Fresh database bootstrap
- **WHEN** migrations run against an empty supported PostgreSQL instance and the seed command is explicitly invoked
- **THEN** the complete schema, default pipeline, roles/users, and realistic linked CRM data are created without manual SQL

#### Scenario: Constraint violation race
- **WHEN** concurrent requests violate a unique or state invariant
- **THEN** the transaction rolls back and the API maps the database error to a stable safe conflict response

### Requirement: [PO-003] Application security baseline
The platform SHALL use Argon2id password hashing, JWT validation, refresh/reset token hashing, CORS allowlists, Helmet security headers, login/reset throttling, request size limits, parameterized ORM/raw queries, output-safe rendering, authorization on every protected resource, dependency scanning, and environment-only secrets. Production configuration SHALL fail closed when secrets or secure origins are missing.

#### Scenario: Production starts with missing secret
- **WHEN** the API starts in production without a required database/JWT/CORS configuration
- **THEN** startup fails with a redacted actionable configuration error before accepting traffic

#### Scenario: Disallowed CORS origin
- **WHEN** a browser preflight arrives from an origin outside the allowlist
- **THEN** credentialed CORS headers are omitted/denied and no protected operation executes

### Requirement: [PO-004] Deterministic local environment
The repository SHALL provide Docker Compose services for PostgreSQL and the API/web development or production-like stack, health checks, named persistent data, isolated test configuration, `.env.example`, and root commands for install, migrate, seed, start, stop, logs, lint, format, typecheck, unit, integration, E2E, performance, and build.

#### Scenario: Local bootstrap
- **WHEN** a developer copies `.env.example` to `.env` and follows README setup on a machine with Docker and Node
- **THEN** dependencies, healthy database, migrations, seed, API docs, and web sign-in become available using documented commands

### Requirement: [PO-005] AWS production infrastructure
Terraform SHALL define ECR, ECS Fargate API service/task/migration task, ALB/listeners/target health, encrypted RDS PostgreSQL in private subnets, private versioned S3 frontend bucket, CloudFront with origin access control and SPA behavior, Secrets Manager, CloudWatch log groups/alarms, IAM least privilege, networking/security groups, autoscaling, backups, and HTTPS-ready ACM/Route53 inputs. State backend configuration and external prerequisites SHALL be documented, not hard-coded.

#### Scenario: Terraform validation
- **WHEN** CI runs formatting and `terraform init -backend=false` plus `terraform validate`
- **THEN** the configuration validates without provider credentials and exposes required environment-specific variables safely

#### Scenario: HTTPS production plan
- **WHEN** valid certificate/domain/hosted-zone inputs are supplied for production
- **THEN** the plan uses HTTPS redirects/listeners/distribution aliases and never exposes RDS or ECS tasks directly to the internet

### Requirement: [PO-006] Observability and recoverability
The API SHALL emit structured redacted logs with request correlation, health liveness/readiness endpoints, and useful latency/error metadata. Infrastructure SHALL retain CloudWatch logs and alarms for API/ALB/ECS/RDS failure signals. Deployment documentation SHALL define migration safety, backups, frontend/API rollback, database recovery, and ownership of each AWS service.

#### Scenario: Dependency readiness fails
- **WHEN** the API process is alive but PostgreSQL is unavailable
- **THEN** liveness remains appropriate, readiness returns non-success, structured logs include request correlation without credentials, and the ALB removes the task

### Requirement: [PO-007] CI/CD quality and deployment gates
GitHub Actions SHALL run lockfile install, formatting, linting, type checking, unit tests, PostgreSQL integration tests, Playwright E2E tests, builds, Prisma validation, Docker builds, Terraform format/validate, and security checks. Publication SHALL tag Docker images immutably in ECR using OIDC; deployment templates SHALL require protected-environment approval, migrate before rollout, wait for health, deploy frontend safely, and support rollback.

#### Scenario: Pull request verification
- **WHEN** a pull request changes application, database, tests, or Terraform code
- **THEN** relevant verification jobs run with cached dependencies and block merge on failure

#### Scenario: Approved deployment
- **WHEN** an authorized workflow deploys a verified commit to an approved environment
- **THEN** it uses AWS OIDC and immutable artifacts, runs migrations, verifies ECS health, publishes frontend assets, and records outputs needed for rollback without storing long-lived AWS keys

### Requirement: [PO-008] Automated test and performance gates
The repository SHALL contain backend service/business/validation/guard unit tests, React component tests, isolated PostgreSQL API integration tests, the specified Playwright user journeys, and k6 tests for login, company search/list, pipeline retrieval, and opportunity creation. The documented normal load SHALL require CRUD/API p95 below 500 ms, HTTP failure rate below 1%, and zero critical/check failures.

#### Scenario: Performance threshold failure
- **WHEN** k6 records p95 at or above 500 ms, failure rate at or above 1%, or any critical workflow check failure under documented load
- **THEN** the performance command exits non-zero and CI reports the failing endpoint/threshold

### Requirement: [PO-009] Accessible responsive web shell
The React application SHALL provide semantic landmarks/headings/tables/forms, labeled controls, keyboard navigation, visible focus, accessible validation/status announcements, adequate contrast, responsive layouts, loading/empty/error states, and role-aware routes for all MVP modules.

#### Scenario: Keyboard-only workflow
- **WHEN** a user signs in and performs core company, pipeline, quote, and task actions using a keyboard
- **THEN** focus order remains logical and visible, dialogs trap/restore focus, actions have names, and status changes are announced

### Requirement: [PO-010] Operational documentation
The repository SHALL provide a root README plus `docs/architecture.md`, `docs/decisions.md`, and `docs/deployment.md` covering setup, commands, architecture with Mermaid, security, APIs, testing, AWS prerequisites/Terraform/deploy/rollback, estimated service responsibilities, assumptions, limitations, and traceability.

#### Scenario: Documentation review
- **WHEN** a new operator follows the documented local or AWS path
- **THEN** prerequisites, configuration ownership, commands, expected outputs, destructive steps, rollback points, and limitations are explicit and match the repository automation

## Acceptance Criteria

- A clean install builds all packages; lint, format, typecheck, unit, integration, E2E, Prisma, OpenSpec, and Terraform checks pass in their documented environments.
- Docker Compose becomes healthy with no committed secrets; Swagger accurately represents the v1 API.
- Terraform validates and models every required AWS service with private data plane, encryption, logs, and HTTPS inputs.
- k6 thresholds enforce p95 below 500 ms and no critical errors under the documented load.

## Edge Cases

- Startup rejects malformed URLs, weak/default production secrets, wildcard credentialed CORS, and invalid role/currency/timezone values.
- SIGTERM drains requests and closes database connections within the ECS stop timeout.
- Migration/deployment failure prevents rollout from advancing and leaves the prior healthy task/frontend available.
- CloudFront SPA fallback does not rewrite missing static assets as HTML; cache headers distinguish hashed assets from `index.html`.

## Authorization Rules

- Health liveness may be public and minimal; readiness details, Swagger in production, logs, secrets, infrastructure, and deployment actions are restricted.
- GitHub OIDC roles are branch/environment scoped; ECS task/execution/migration roles have separate least-privilege policies.
- All protected controllers declare authentication and capability requirements; a CI architecture test fails unguarded protected routes.

## API Behavior

- Successful resources use appropriate `200/201/204`; validation `400`, authentication `401`, authorization `403` or safe `404`, conflicts `409`, semantic validation `422`, throttling `429`, and unexpected failures safe `500`.
- Every response carries/correlates `X-Request-Id`; list metadata is consistent; OpenAPI is generated from the same DTOs and decorators.
- `/api/v1/health/live` and `/api/v1/health/ready` are stable operational endpoints with minimal disclosure.

## Test Scenarios

- Unit/component: services, rules, DTO validation, guards/scopes, error filter, configuration, accessible React components/routes/forms.
- Integration: PostgreSQL constraints/transactions/search, every protected module and role, health degradation, OpenAPI snapshot.
- E2E: sign in/out, user permissions, company/contact, lead conversion, pipeline move, quote acceptance, task completion, role dashboard visibility.
- Performance: k6 login, company list/search, pipeline retrieval, opportunity creation with documented virtual users/duration/data cleanup and enforced thresholds.
- Infrastructure: Docker health, image builds, Terraform fmt/init/validate, workflow syntax/action lint where available, and secret scanning.
