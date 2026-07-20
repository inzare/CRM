# Architectural decisions

## Modular monorepo with npm workspaces

One repository keeps contracts, migrations, API, web, tests, infrastructure, and specifications in a single review boundary. npm workspaces minimize tooling overhead. The trade-off is a shared release cadence; package boundaries and strict TypeScript prevent accidental coupling.

## NestJS REST and OpenAPI

REST matches the CRM's resource and command model, is easy to operate through an ALB, and produces Swagger documentation from validated DTOs. Stage/quote/task transitions are explicit command endpoints rather than ambiguous partial updates. GraphQL was not selected because field-level authorization and cache complexity add little value to this MVP.

## PostgreSQL and Prisma

PostgreSQL provides transactions, constraints, GIN indexes, Decimal support, and mature RDS operations. Prisma provides type-safe data access and migrations. Business invariants that span rows use serializable transactions; durable invariants also live in SQL constraints/triggers. Raw full-text ranking can be introduced later without replacing the ORM.

## Short-lived JWT plus opaque rotating refresh sessions

Access JWTs reduce per-request session lookup and expire after 15 minutes. Refresh tokens are random opaque values stored only as hashes, rotated on every use, and family-revoked on replay. HttpOnly cookies reduce script access; SameSite=Strict and an origin allowlist reduce cross-site risk. The trade-off is that an already issued access token remains valid until its short expiry after a password/role change.

## Owner-based authorization

ADMIN and MANAGER can operate across records; SALES and CONSULTANT are scoped to ownership/assignment. Controller architecture tests ensure authentication, while services enforce direct-ID and nested parent scope to avoid insecure object references. This simple model can evolve into teams/territories without changing resource APIs.

## Server-authoritative quote snapshots

The server calculates each line with Decimal math, rounds line amounts, and stores SKU/description/rates/totals as immutable commercial evidence once sent. Sequential versions are allocated in a serializable transaction. Snapshotting duplicates catalog text intentionally so historic quotes do not change with the catalog.

## Soft deletion plus immutable audit

Customer/business records are soft deleted where history matters. Audit rows are written within the same transaction as important changes and protected by a PostgreSQL trigger from update/delete. This increases storage use but preserves accountability and reporting lineage.

## SPA on S3/CloudFront; API on ECS Fargate

Static hosting minimizes frontend cost and operational surface. Fargate supports private networking, controlled deployments, health checks, migrations, and autoscaling without managing EC2 hosts. RDS provides managed backups/encryption. The default production shape favors availability (two tasks, Multi-AZ RDS) and can be reduced for non-production cost.

## Terraform and GitHub OIDC

Infrastructure is declarative and validated in CI. GitHub assumes narrowly scoped AWS roles through OIDC, avoiding long-lived AWS keys. Image tags are immutable commit SHAs. State storage and lock tables are prerequisites so bootstrapping and application lifecycle permissions remain separate.
