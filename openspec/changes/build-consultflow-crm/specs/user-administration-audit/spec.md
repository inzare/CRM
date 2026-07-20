# User Administration and Audit

## Purpose

Define administrator-controlled user lifecycle, role-aware presentation, and immutable audit history for security-sensitive and business-critical actions.

## ADDED Requirements

### Requirement: [UAA-001] User creation and invitation
ADMIN users SHALL create users with name, unique normalized email, one of `ADMIN`, `MANAGER`, `SALES`, or `CONSULTANT`, and active status. The system SHALL support either an administrator-supplied compliant initial password or a single-use invitation token delivered through the configured notification provider.

#### Scenario: Administrator creates a user
- **WHEN** an ADMIN posts valid user data to `POST /api/v1/users`
- **THEN** the API returns `201`, stores an Argon2id password hash or pending invitation, records timestamps, and writes an audit event

#### Scenario: Duplicate user email
- **WHEN** an ADMIN attempts to create a user whose normalized email already exists, including a deactivated account
- **THEN** the API returns `409 USER_EMAIL_EXISTS` and creates no user or invitation

### Requirement: [UAA-002] User listing and updates
ADMIN users SHALL list, paginate, search, filter, sort, view, and update users. Name, email, role, and active status changes SHALL be audited; role/email changes SHALL revoke all existing sessions.

#### Scenario: Filter users
- **WHEN** an ADMIN requests `GET /api/v1/users` with search, role, active, pagination, and allowlisted sort parameters
- **THEN** the API returns matching non-deleted users and accurate page metadata

#### Scenario: Change role
- **WHEN** an ADMIN changes another user's role through `PATCH /api/v1/users/{id}`
- **THEN** the role changes, all sessions for that user are revoked, and before/after role values are audited

### Requirement: [UAA-003] Safe activation lifecycle
ADMIN users SHALL activate and deactivate users, but the system MUST prevent deactivation or demotion of the last active ADMIN and MUST prevent an administrator from accidentally deactivating their own current account. Deactivation SHALL revoke all sessions while retaining owned business records and audit history.

#### Scenario: Deactivate user
- **WHEN** an ADMIN deactivates an eligible user
- **THEN** the user becomes inactive, their sessions are revoked, ownership remains intact, and assignment screens exclude them from new assignments

#### Scenario: Protect last administrator
- **WHEN** a mutation would leave zero active ADMIN users
- **THEN** the API returns `409 LAST_ADMIN_REQUIRED` and performs no change

### Requirement: [UAA-004] Role-aware navigation and controls
The web application SHALL display navigation, dashboards, actions, and assignment options appropriate to the signed-in user's effective permissions, while protected routes SHALL handle direct navigation with an accessible forbidden state.

#### Scenario: Consultant navigation
- **WHEN** a CONSULTANT signs in
- **THEN** user administration, catalog editing, pipeline configuration, and unrestricted reports are absent while assigned work and permitted customer context remain available

#### Scenario: Direct forbidden route
- **WHEN** a user navigates directly to a route they cannot use
- **THEN** the page renders an accessible access-denied state and no protected API data is fetched or displayed

### Requirement: [UAA-005] Immutable audit log
The system SHALL append audit events for authentication, user creation/update/status/role changes, opportunity stage changes, quote status changes, and record deletion. Each event SHALL include action, actor when known, entity reference, UTC timestamp, request ID, source metadata, and redacted before/after details; application roles MUST NOT update or delete audit events.

#### Scenario: Audited business mutation
- **WHEN** a tracked mutation succeeds
- **THEN** its audit event is committed with the mutation and is queryable by ADMIN with filters and pagination

#### Scenario: Sensitive values are redacted
- **WHEN** authentication or credential-related actions are audited
- **THEN** password hashes, tokens, cookies, and reset links are absent from metadata and change summaries

## Acceptance Criteria

- User CRUD is real persistence with session invalidation and last-admin invariants.
- ADMIN-only API and UI controls are unavailable to all other roles and tested both through UI and direct requests.
- Required audit events are immutable, correlated, retained across soft deletion, and redact secrets.

## Edge Cases

- Case-only email changes do not create duplicates; pending invitations expire and replacement invalidates the previous token.
- Deactivated owners remain visible historically and records can be reassigned by ADMIN/MANAGER.
- Concurrent last-admin changes serialize so at least one active ADMIN remains.
- Audit failure causes the protected business transaction to fail when transactional audit is required.

## Authorization Rules

- Only ADMIN manages users and views the audit log.
- MANAGER may list minimal active-user assignee summaries but not credential, status, email, or audit detail.
- Users view their own full profile through `/me`; shared record responses expose only safe owner summaries.

## API Behavior

- `/api/v1/users` implements list/create/detail/update and explicit invitation replacement where applicable.
- `/api/v1/audit-logs` is read-only, paginated, filterable by action/entity/actor/date, and not exportable by non-ADMIN roles.
- Conflicting invariants return `409`; forbidden operations return the standard safe error envelope.

## Test Scenarios

- Unit: last-admin invariant, email normalization, assignee projection, redaction serializer, audit interceptor/service.
- Integration: create/invite, duplicate email, role change revocation, deactivate/reactivate, concurrent last-admin protection, audit filtering/immutability.
- E2E: ADMIN user management succeeds; MANAGER, SALES, and CONSULTANT controls and direct calls are denied.

