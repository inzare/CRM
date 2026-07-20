# AWS deployment

## Prerequisites

Provision outside this stack:

- AWS account and a deployment region with sufficient ECS/RDS/ALB quotas
- S3 Terraform state bucket with versioning, encryption, public-access block, and lifecycle policy
- DynamoDB state lock table (string key `LockID`)
- Route 53 hosted zone or external DNS control
- Regional ACM certificate for the API ALB; us-east-1 ACM certificate for CloudFront aliases
- Verified SES domain/from identity, DKIM, and production sending access
- GitHub OIDC provider and separate least-privilege publish/deploy roles
- GitHub protected `production` environment with required reviewers

Repository variables used by workflows: `AWS_REGION`, `AWS_ACCOUNT_ID`, `ECR_REPOSITORY`, `TF_STATE_BUCKET`, `TF_LOCK_TABLE`, `PUBLIC_API_URL`, `PRIVATE_SUBNET_IDS`, and `API_SECURITY_GROUP_ID`. Secrets: `AWS_PUBLISH_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`. Store `production.tfvars` as a protected deployment artifact or generate it from environment values; never commit secrets.

## Terraform

```bash
cd infra/terraform
terraform init \
  -backend-config="bucket=STATE_BUCKET" \
  -backend-config="key=consultflow/production.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=STATE_LOCK_TABLE" \
  -backend-config="encrypt=true"
copy terraform.tfvars.example production.tfvars
terraform fmt -check -recursive
terraform validate
terraform plan -var-file=production.tfvars -out=production.tfplan
terraform apply production.tfplan
```

Review replacement/destruction actions, security-group changes, public exposure, RDS settings, IAM policies, task image, certificate region, and expected monthly cost before apply. Production RDS has deletion protection, a final snapshot, encryption, backups, and Multi-AZ enabled by default through the environment condition.

## Release flow

1. `Verify` runs formatting, lint, typecheck, unit/integration/E2E, builds, OpenSpec, Terraform, and Docker gates.
2. `Publish API image` assumes the publisher role, pushes an immutable commit-SHA image, emits provenance/SBOM, and verifies the digest.
3. Run `Deploy` with `action=plan`; review the plan.
4. Re-run with `action=apply` after protected-environment approval.
5. The workflow applies Terraform, starts a one-off Fargate migration task, waits for ECS stability, uploads hashed SPA assets and no-cache `index.html`, invalidates CloudFront, and checks readiness.

Database migrations must be backward compatible with the currently running API during rolling deploys. Destructive schema changes require an expand/migrate/contract sequence across releases.

## Rollback

- API: provide the prior task-definition ARN to the deploy workflow's rollback input or run `aws ecs update-service --task-definition PRIOR_ARN --force-new-deployment`; then wait for stable service and inspect CloudWatch.
- Frontend: restore the prior version of `index.html` and assets from S3 versioning, then invalidate CloudFront.
- Terraform: revert the infrastructure commit and plan/apply the reversal; never blindly apply an old plan.
- Database: prefer forward-fix migrations. Restore RDS point-in-time to a new instance only for data-loss/corruption incidents, validate it, then switch the secret/endpoint under an incident plan.

## Service responsibilities

| Service             | Responsibility                 | Key operator checks                          |
| ------------------- | ------------------------------ | -------------------------------------------- |
| CloudFront + S3     | TLS SPA delivery and caching   | OAC, aliases, `index.html` cache, versioning |
| ALB                 | Public API TLS, health routing | certificate, 5xx, target health              |
| ECS Fargate         | API runtime and migrations     | desired count, circuit breaker, task logs    |
| ECR                 | Immutable scanned API images   | scan findings, lifecycle, digest             |
| RDS PostgreSQL      | Durable relational state       | backups, storage, connections, failover      |
| Secrets Manager     | DB URL and token secrets       | rotation/change process, access policy       |
| SES                 | Invitation/reset delivery      | verified identity, bounces, complaints       |
| CloudWatch          | Logs, metrics, alarms          | retention, 5xx alarm, dashboards             |
| GitHub Actions/OIDC | Verification and deployment    | protected environment, role trust, audit     |

## Cost and availability

Primary costs are NAT Gateway, ALB, two Fargate tasks, Multi-AZ RDS, CloudWatch ingestion, and CloudFront transfer. Non-production may set one task, single-AZ through a distinct environment policy, smaller retention, and scheduled shutdown. Setting `enable_nat_gateway=false` requires supplying equivalent private endpoints/egress for ECR, logs, Secrets Manager, SES, and package/migration needs; do not disable it without those routes.
