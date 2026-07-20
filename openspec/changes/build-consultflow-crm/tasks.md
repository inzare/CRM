## 1. Monorepo and Developer Foundation

- [x] 1.1 Create npm workspace layout, strict shared TypeScript/ESLint/Prettier configuration, root scripts, lockfile, and package boundaries. [PO-004, PO-007; verify clean install, format, lint, typecheck]
- [x] 1.2 Scaffold NestJS API and React/Vite/Tailwind web applications with shared contracts, environment validation, and production builds. [PO-001, PO-003, PO-009; unit/build tests]
- [x] 1.3 Add `.env.example`, secret-safe configuration schema, request IDs, structured redacted logging, global validation/error handling, Helmet, CORS, shutdown hooks, and live/ready health endpoints. [PO-001, PO-003, PO-006; configuration/error/health tests]
- [x] 1.4 Add Dockerfiles and Docker Compose for PostgreSQL, API, and web with health checks, volumes, migration/seed flow, and isolated test database profile. [PO-002, PO-004; container smoke tests]

## 2. Database and Shared Domain

- [x] 2.1 Implement normalized Prisma schema for users, sessions, reset/invite tokens, audit logs, and role/status enums with constraints and indexes. [IA-001..005, UAA-001..005; Prisma validation/integration tests]
- [x] 2.2 Implement customer, sales-pipeline, stage/history, catalog/offering, quote/line, contract, activity/task, tag, and relationship models with Decimal/date/soft-delete semantics. [CR-001..005, SP-001..006, CL-001..006, AT-001..005; schema constraint tests]
- [x] 2.3 Create initial migration including PostgreSQL check constraints and full-text GIN/index SQL, plus deterministic realistic seed data for all roles and linked workflows. [PO-002, CR-003, SP-001; migration/bootstrap/search tests]
- [x] 2.4 Implement Prisma module, transaction helpers, safe database-error mapping, standard pagination/filter/sort/search utilities, and reusable authorization scope predicates. [IA-005, CR-003, PO-001..003; unit/integration tests]

## 3. Identity, Authorization, Users, and Audit

- [ ] 3.1 Implement Argon2id password policy/hashing, access JWT issuance/verification, hashed refresh sessions, atomic rotation/replay-family revocation, cookie policy, logout, and session cleanup. [IA-001, IA-002; unit and PostgreSQL integration tests]
- [ ] 3.2 Implement throttled login plus reset request/confirmation and invitation tokens through a notification provider with safe local and SES-ready adapters. [IA-001, IA-003, UAA-001; unit/integration tests for enumeration, expiry, single use]
- [ ] 3.3 Implement authentication, role, and resource-scope guards/decorators plus a protected-controller architecture test. [IA-005, PO-003; guard/scope/direct-ID authorization tests]
- [ ] 3.4 Implement `/me` profile/password flows with validation, password-change session revocation, and safe DTOs. [IA-004; unit/integration/component tests]
- [ ] 3.5 Implement ADMIN user list/create/invite/update/activate/deactivate APIs, last-active-admin concurrency invariant, assignee summaries, and role/email session revocation. [UAA-001..003; unit/integration tests]
- [ ] 3.6 Implement transactional immutable audit service and ADMIN read API with required event producers, filters, redaction, and retention across deletion. [UAA-005; audit atomicity/redaction/immutability tests]
- [ ] 3.7 Build sign-in/reset/profile and ADMIN user-management UI with in-memory access session, refresh bootstrap, route guards, role navigation, accessible forms/dialogs, and sign-out. [IA-001..005, UAA-001..004, PO-009; component/Playwright tests]

## 4. Companies, Contacts, and Timelines

- [ ] 4.1 Implement scoped company service/API for CRUD, normalization, duplicate suggestions, ownership/reassignment, search/filter/sort/pagination, optimistic conflict, and soft deletion/audit. [CR-001, CR-003, CR-005; unit/integration tests]
- [ ] 4.2 Implement scoped contact service/API for CRUD, same-company email uniqueness, company linkage, search/filter/sort/pagination, optimistic conflict, and soft deletion/audit. [CR-002, CR-003, CR-005; unit/integration tests]
- [ ] 4.3 Implement unified paginated company/contact timeline query with event normalization, deduplication, actor/type filters, and nested authorization. [CR-004; unit/integration tests]
- [ ] 4.4 Build responsive company/contact lists, filters, detail/forms, ownership controls, duplicate warning, deletion confirmation, and unified timeline. [CR-001..005, PO-009; component/Playwright creation/search/timeline tests]

## 5. Leads and Opportunity Pipeline

- [ ] 5.1 Implement pipeline-stage seed/configuration APIs with ordering, transition graph, terminal invariants, and active-opportunity safeguards. [SP-001; rule/integration tests]
- [ ] 5.2 Implement scoped lead CRUD/search/filter, qualification policy/history, and audit behavior. [SP-002; unit/integration tests]
- [ ] 5.3 Implement transactionally idempotent lead conversion that creates/reuses company/contact, creates opportunity/history, and retains source linkage. [SP-003; concurrency/integration tests]
- [ ] 5.4 Implement scoped opportunity CRUD/search/filter/sort and offering-ready detail with company/contact/value/probability/date validation and soft deletion. [SP-004; unit/integration tests]
- [ ] 5.5 Implement explicit opportunity transition command with expected-stage conflict, configured graph, terminal requirements/reopen privilege, stage history, probability update, and audit. [SP-005; transition matrix/concurrency/integration tests]
- [ ] 5.6 Implement board-optimized pipeline endpoint with scoped stage groups, counts/values, filters, and performance indexes. [SP-006, AR-001; integration/k6 tests]
- [ ] 5.7 Build lead qualification/conversion screens and responsive accessible opportunity list/detail plus pointer/keyboard Kanban with optimistic rollback/status announcements. [SP-002..006, PO-009; component/Playwright tests]

## 6. Catalog, Quotes, and Contracts

- [ ] 6.1 Implement catalog CRUD/filter APIs with SKU/type/pricing/Decimal validation, deactivate semantics, scope, and audit. [CL-001; unit/integration tests]
- [ ] 6.2 Implement opportunity offering commands with active-item, terminal, quantity/currency/value rules and precise subtotals. [CL-002; calculation/integration tests]
- [ ] 6.3 Implement atomic sequential quote versioning, snapshot line items, authoritative Decimal discount/tax/total calculation, quote numbering, and DRAFT editing. [CL-003; rounding/race/integration tests]
- [ ] 6.4 Implement quote transition graph, sent immutability, automatic expiry evaluation, exclusive idempotent acceptance, supersession, authorization, and audit. [CL-004; unit/concurrency/integration tests]
- [ ] 6.5 Build catalog management, opportunity offering editor, quote builder/detail/status controls, and semantic print/PDF-ready route with print CSS. [CL-001..005, PO-009; component/Playwright/print-layout tests]
- [ ] 6.6 Implement contract CRUD/status APIs with Won/Accepted prerequisites, date/value rules, renewal window query, and expansion suggestions. [CL-006; unit/integration tests]
- [ ] 6.7 Build contract list/detail/forms and renewal/upsell indicators linked to opportunity/quote context. [CL-006; component/Playwright tests]

## 7. Activities, Tasks, and Follow-up

- [ ] 7.1 Implement activity CRUD for call/meeting/email/note/task with exactly-one-parent constraint, safe parent scope, timeline integration, and deletion audit. [AT-001, AT-005; unit/integration tests]
- [ ] 7.2 Implement task assignment eligibility, scoped update/reassignment, idempotent complete/reopen commands, and completion metadata. [AT-002, AT-005; rule/integration tests]
- [ ] 7.3 Implement timezone-aware today/overdue queries and no-recent-activity calculation with configurable thresholds and deduplication. [AT-003, AT-004; unit tests at date/DST boundaries and integration tests]
- [ ] 7.4 Build reusable activity composer/timeline entries, task lists/forms, accessible completion controls, overdue states, and dashboard widgets. [AT-001..005, PO-009; component/Playwright tests]

## 8. Dashboard, Reports, and Exports

- [ ] 8.1 Implement scoped pipeline-by-stage and weighted forecast aggregates with date/owner/currency filters and documented definitions. [AR-001; formula/scope/integration tests]
- [ ] 8.2 Implement won revenue, lead conversion, win/loss, average cycle, and sales-by-offering aggregates using immutable history/snapshots and zero/mixed-currency behavior. [AR-002, AR-003; reconciliation/integration tests]
- [ ] 8.3 Implement renewal, overdue, and no-activity dashboard composition with role-specific DTOs and direct endpoint denial. [AR-004, AR-005; role/scope/integration tests]
- [ ] 8.4 Implement streamed formula-safe CSV exports for opportunities, offering sales, renewals, and overdue follow-ups with JSON parity and row limits. [AR-006; escaping/reconciliation/authorization tests]
- [ ] 8.5 Build responsive dashboard metric cards/charts/tables, date/owner filters, role-specific widgets, empty/loading/error states, and CSV actions. [AR-001..006, PO-009; component/Playwright role visibility tests]

## 9. Automated Quality and Performance

- [ ] 9.1 Complete backend unit suites for services, transition/calculation/date rules, DTO validation, guards/scopes, error mapping, redaction, and configuration. [all backend requirements; coverage report]
- [ ] 9.2 Complete React component/accessibility tests for session, routing, navigation, forms, tables, dialogs, Kanban keyboard behavior, quote print view, tasks, and dashboard. [UAA-004, SP-006, CL-005, PO-009; Vitest/Testing Library]
- [ ] 9.3 Complete isolated-PostgreSQL API integration suites for all modules, roles, transactions, constraints, search, aggregates, CSV, health, and OpenAPI snapshot. [all API requirements; integration command]
- [ ] 9.4 Implement Playwright fixtures and required journeys: sign in/out, user permissions, company/contact, lead conversion, pipeline movement, quote acceptance, task completion, and role dashboards. [IA/UAA/CR/SP/CL/AT/AR acceptance scenarios; E2E command]
- [ ] 9.5 Implement k6 seeded-data setup and tests for login, company list/search, pipeline retrieval, and opportunity creation at documented load with p95 <500 ms, HTTP failures <1%, and zero critical check failures. [PO-008; performance command]

## 10. AWS Infrastructure and Delivery Automation

- [ ] 10.1 Implement reusable Terraform networking, security groups, VPC endpoints/NAT options, ECR, private encrypted RDS, Secrets Manager, and validated environment variables/outputs. [PO-005; terraform fmt/init/validate]
- [ ] 10.2 Implement ECS Fargate API service/task/migration task, ALB HTTP/HTTPS health/listeners, IAM separation, autoscaling, deployment circuit breaker, and CloudWatch logs/alarms. [PO-005, PO-006; terraform validation/plan review]
- [ ] 10.3 Implement private versioned S3 frontend hosting and CloudFront OAC, SPA/error/cache behavior, logs, HTTPS aliases/certificate inputs, and safe outputs. [PO-005; terraform validation/plan review]
- [ ] 10.4 Add GitHub Actions verification workflow for formatting/lint/typecheck/unit/integration/E2E/build/Prisma/OpenSpec/Terraform/security gates with PostgreSQL service and caches. [PO-007, PO-008; workflow syntax and local command parity]
- [ ] 10.5 Add OIDC-based immutable ECR publication and protected deploy workflow templates for Terraform plan/apply, migration, ECS health, frontend publish/invalidation, smoke checks, and rollback inputs. [PO-007; action lint/template review]

## 11. Documentation, Verification, and OpenSpec Completion

- [ ] 11.1 Write README with architecture summary, prerequisites, environment, local/Docker setup, seed accounts, API docs, all quality commands, security practices, and limitations. [PO-004, PO-010; command/document review]
- [ ] 11.2 Write `docs/architecture.md` with Mermaid deployment/module/data flows and `docs/decisions.md` with decisions, alternatives, and trade-offs aligned to design. [PO-010; Mermaid/document review]
- [ ] 11.3 Write `docs/deployment.md` with AWS/GitHub/DNS/certificate/state prerequisites, Terraform/deploy/rollback/recovery commands, cost/availability choices, and service responsibility table. [PO-005..007, PO-010; operator review]
- [ ] 11.4 Add requirement-to-task-to-test traceability matrix and verify every requirement ID has implementation and automated acceptance evidence. [all requirements; traceability audit]
- [ ] 11.5 Run clean install, format, lint, typecheck, unit, integration, E2E, builds, Docker smoke, Prisma, OpenAPI, k6, Terraform, workflow, secret, and strict OpenSpec checks; capture results and fix failures. [PO-007, PO-008; full gate evidence]
- [ ] 11.6 Synchronize permanent capability specs and archive `build-consultflow-crm` only after all tasks, acceptance criteria, and quality gates pass. [OpenSpec workflow; strict archive verification]
