# ConsultFlow CRM

ConsultFlow CRM is a production-oriented CRM for software consulting and software-product sales. It joins customer context, qualified demand, opportunity stages, catalog offerings, versioned quotes, contracts, activities, tasks, renewals, and scoped reporting in one responsive application.

## Architecture

- `apps/web`: React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS
- `apps/api`: NestJS REST API, Swagger/OpenAPI, JWT access and rotating refresh sessions, RBAC
- `prisma`: normalized PostgreSQL schema, checked migration, deterministic seed
- `packages/contracts`: shared API contracts
- `infra/terraform`: AWS VPC, ALB, ECS Fargate, ECR, RDS, Secrets Manager, CloudWatch, S3, CloudFront
- `tests/e2e` and `tests/performance`: Playwright journeys and k6 load profiles

See [architecture](docs/architecture.md), [decisions](docs/decisions.md), and [deployment](docs/deployment.md).

## Prerequisites

- Node.js 22+ and npm 10+
- Docker Desktop / Docker Compose
- PostgreSQL 17 when not using Docker
- Optional: k6, Terraform 1.7+, AWS CLI 2

## Local setup

```bash
npm ci
copy .env.example .env
docker compose up -d postgres postgres-test
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:5173`. Swagger UI is at `http://localhost:3000/api/docs`; the OpenAPI JSON is at `/api/docs-json`. The seed password is `ConsultFlow!2026` for:

| Account                        | Role       |
| ------------------------------ | ---------- |
| `admin@consultflow.local`      | ADMIN      |
| `manager@consultflow.local`    | MANAGER    |
| `sales@consultflow.local`      | SALES      |
| `consultant@consultflow.local` | CONSULTANT |

Seed credentials are development-only. Never deploy them.

For a fully containerized environment, run `npm run docker:up`. The API container applies migrations before starting. The web container serves the built SPA through nginx and proxies `/api` to the API.

## Configuration

Copy `.env.example`; do not commit `.env`. Production requires unique high-entropy `JWT_ACCESS_SECRET` and `JWT_REFRESH_PEPPER`, an allowlisted HTTPS `CORS_ORIGINS`, PostgreSQL TLS as required by the environment, `EMAIL_PROVIDER=ses`, a verified `EMAIL_FROM`, and `APP_BASE_URL`.

Access JWTs live only in browser memory. Refresh tokens are opaque, hashed server-side, rotated atomically, replay-family revoked, and placed in an HttpOnly, SameSite=Strict, Secure production cookie. Passwords use Argon2id. Login/reset routes are rate limited by IP and normalized email. Every protected controller requires authentication, role and owner scopes are applied server-side, important changes are audited transactionally, and safe errors include request IDs without leaking internals.

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run build
npm run openspec:validate
```

Integration tests refuse to reset a database unless `NODE_ENV=test` and the database name contains `test`. Start the Compose `postgres-test` profile and set the variables shown in `.env.example`. Playwright also requires `DATABASE_URL` to name a migrated test database, reseeds deterministic fixture credentials, and starts isolated API/web servers on ports 3100/5173. k6 defaults to 10 virtual users for one minute and enforces p95 below 500 ms, HTTP failures below 1%, and all critical checks passing.

## Core modules

- Admin-managed users, invitations, reset tokens, self profile/password, activation, safe assignees
- Companies, contacts, tags, ownership, duplicate hints, search, soft deletion, unified activity timelines
- Leads, qualification, idempotent conversion, configurable stages, validated transitions, Kanban pipeline
- Catalog, opportunity offerings, authoritative Decimal quote math, sequential versions, statuses, print/PDF layout
- Won/accepted-gated contracts, renewal dates and expansion context
- Calls, meetings, emails, notes, tasks, completion metadata, today/overdue/no-activity widgets
- Pipeline value, weighted forecast, won revenue, conversion and win/loss metrics, accepted offering sales, renewals, CSV exports

## AWS deployment

Terraform uses a remote S3 backend (configured during `init`) and expects an existing state bucket/lock table, Route 53/DNS control, ACM certificates, SES identity, and GitHub OIDC roles. It creates application networking and runtime services. Review `infra/terraform/terraform.tfvars.example`, then follow [deployment.md](docs/deployment.md). Start with `terraform plan`; production `apply` should run only through the protected deploy environment.

## Known limitations

- The MVP uses one reporting currency per request; it does not perform FX conversion.
- Quote output is a print/PDF-ready HTML document, not a stored server-generated PDF artifact.
- Pipeline configuration edits stage attributes; graph editing remains an operator/seed concern.
- Notifications support SES and a development console adapter; delivery webhooks and bounce handling are not yet included.
- Search uses indexed PostgreSQL fields and case-insensitive matching; ranking/highlighting can be enhanced with a dedicated search query.
- Terraform validation requires Terraform to be installed; CI is the canonical validation environment.

Recommended next features are email/calendar synchronization, file attachments with malware scanning, recurring-revenue schedules, multi-currency FX snapshots, custom fields, webhooks, territory teams, and database-backed scheduled reminder delivery.
