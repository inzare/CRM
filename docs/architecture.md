# Architecture

## Deployment view

```mermaid
flowchart LR
  U[Browser] -->|HTTPS| CF[CloudFront]
  CF --> S3[Private S3 SPA bucket]
  U -->|HTTPS /api/v1| ALB[Application Load Balancer]
  ALB --> ECS[ECS Fargate API tasks]
  ECS --> RDS[(Private RDS PostgreSQL)]
  ECS --> SM[Secrets Manager]
  ECS --> SES[Amazon SES]
  ECS --> CW[CloudWatch logs and metrics]
  GHA[GitHub Actions via OIDC] --> ECR[ECR immutable images]
  GHA --> ECS
  GHA --> S3
  ECR --> ECS
```

The ALB and CloudFront are public. ECS and RDS run in private subnets across at least two availability zones. RDS accepts PostgreSQL only from the API security group. The frontend bucket blocks public access and is readable only through CloudFront OAC.

## Request and authorization flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as NestJS API
  participant G as Guards/scopes
  participant P as Prisma/PostgreSQL
  B->>A: Login credentials
  A->>P: Verify active user + Argon2id hash
  A-->>B: Access JWT + HttpOnly refresh cookie
  B->>A: Bearer request
  A->>G: JWT, role, owner/direct-ID checks
  G->>P: Scoped transaction
  P-->>G: Domain record + audit event
  G-->>B: Versioned safe DTO + request ID
```

Access tokens remain in memory. The refresh cookie is opaque; only a peppered SHA-256 hash is stored. Rotation and replay-family revocation use serializable transactions. Protected APIs combine authentication, role metadata, and owner predicates; nested resources are checked through their parent.

## Module boundaries

```mermaid
flowchart TD
  Auth[Identity and access] --> Users[Users and audit]
  Users --> Customers[Companies and contacts]
  Customers --> Sales[Leads and opportunities]
  Sales --> Commercial[Catalog, quotes, contracts]
  Customers --> Activities[Activities and tasks]
  Sales --> Activities
  Commercial --> Reporting[Dashboard and exports]
  Activities --> Reporting
  DB[(Prisma/PostgreSQL)] --- Auth
  DB --- Customers
  DB --- Sales
  DB --- Commercial
  DB --- Activities
  DB --- Reporting
```

Nest modules own DTO validation, business services, controllers, and audit production. React pages consume versioned REST endpoints through TanStack Query. Shared contracts contain cross-package response types; Prisma types never cross the API boundary intentionally.

## Data integrity

The schema uses UUID primary keys, explicit foreign keys, Decimal monetary values, timestamptz event fields, date-only commercial dates, soft deletion for customer/business records, immutable audit rows, stage history, quote snapshots, unique quote versions, and checked status/rate/value constraints. The initial migration adds GIN search indexes and a database trigger that rejects audit updates/deletes.
