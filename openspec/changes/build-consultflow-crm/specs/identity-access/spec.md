# Identity and Access

## Purpose

Define secure authentication, session, password recovery, self-service credential, and authorization behavior for every ConsultFlow user.

## ADDED Requirements

### Requirement: [IA-001] Password authentication

The API SHALL authenticate an active user by normalized email and Argon2id password hash, issue a 15-minute access JWT, set a hashed and revocable refresh session through an HttpOnly cookie, and return the user's effective role. It MUST return the same safe error shape for unknown emails, invalid passwords, and inactive accounts, and MUST rate-limit attempts by IP and normalized email.

#### Scenario: Active user signs in

- **WHEN** an active user submits valid credentials to `POST /api/v1/auth/login`
- **THEN** the API returns `200`, an access token and user summary, sets the refresh cookie, updates last login, and records a successful authentication audit event

#### Scenario: Invalid or inactive credentials

- **WHEN** a caller submits an unknown email, wrong password, or inactive account
- **THEN** the API returns the same `401 AUTHENTICATION_FAILED` response without disclosing account state and records a redacted failure event

#### Scenario: Login rate exceeded

- **WHEN** the configured login attempt threshold is exceeded
- **THEN** the API returns `429 RATE_LIMITED` with retry guidance and performs no password/session mutation

### Requirement: [IA-002] Refresh rotation and sign-out

The API SHALL rotate refresh tokens atomically, store only token hashes, revoke a token family when reuse is detected, and revoke the current session on sign-out. Browser clients MUST keep access tokens in memory and MUST NOT persist refresh tokens in JavaScript-readable storage.

#### Scenario: Valid refresh

- **WHEN** a valid unexpired refresh cookie is submitted to `POST /api/v1/auth/refresh`
- **THEN** the API revokes the prior token, creates its successor, returns a new access token, and replaces the cookie

#### Scenario: Replayed refresh token

- **WHEN** a previously rotated refresh token is submitted
- **THEN** the API returns `401 SESSION_REVOKED` and revokes all active successors in that token family

#### Scenario: User signs out

- **WHEN** an authenticated user calls `POST /api/v1/auth/logout`
- **THEN** the current refresh session is revoked, the cookie is cleared, and subsequent refresh attempts fail

### Requirement: [IA-003] Secure password recovery

The system SHALL accept password reset requests without account enumeration, generate a cryptographically random single-use token for active matching users, store only its SHA-256 hash, expire it after 30 minutes, and revoke all sessions after a successful reset. Tokens and reset URLs MUST NOT appear in production API responses or ordinary logs.

#### Scenario: Reset request accepted

- **WHEN** any syntactically valid email is posted to `POST /api/v1/auth/password-reset/request`
- **THEN** the API returns the same `202` response and creates/delivers a token only if an eligible account exists

#### Scenario: Reset token used once

- **WHEN** a valid unused token and compliant new password are posted to `POST /api/v1/auth/password-reset/confirm`
- **THEN** the password hash changes, the token is consumed, all sessions are revoked, and an audit event is recorded

#### Scenario: Invalid reset token

- **WHEN** an expired, used, or malformed reset token is submitted
- **THEN** the API returns `400 RESET_TOKEN_INVALID` without changing credentials

### Requirement: [IA-004] Profile and password self-service

Authenticated users SHALL view and update their own name and SHALL change their own password after supplying the current password. Email and role changes MUST remain administrator-controlled, and a password change MUST revoke other sessions.

#### Scenario: User updates profile

- **WHEN** a user submits a valid name to `PATCH /api/v1/me`
- **THEN** only that user's name and update timestamp change and the API returns the updated profile

#### Scenario: User changes password

- **WHEN** a user submits the correct current password and a compliant different password to `POST /api/v1/me/password`
- **THEN** the password hash changes, other sessions are revoked, and the current client must reauthenticate as documented

### Requirement: [IA-005] Layered authorization

Every protected API operation SHALL require a valid access token, enforce role permissions, enforce record ownership or assignment scope where specified, and apply the scope within database reads and aggregates. Direct object identifiers MUST NOT bypass scoping; UI visibility is not an authorization control.

#### Scenario: Forbidden direct record access

- **WHEN** an authenticated user requests a protected record outside their role/ownership scope
- **THEN** the API returns `404 RESOURCE_NOT_FOUND` where existence is sensitive or `403 FORBIDDEN` for explicit capability denial and exposes no record data

#### Scenario: Expired access token

- **WHEN** a protected endpoint receives an expired access JWT
- **THEN** the API returns `401 ACCESS_TOKEN_EXPIRED` and permits the client to attempt refresh

## Acceptance Criteria

- IA-001 through IA-005 pass unit, API integration, and Playwright sign-in/sign-out coverage.
- No raw password, access token, refresh token, or reset token is persisted or logged.
- ADMIN, MANAGER, SALES, and CONSULTANT denials are verified against direct-record and list/report access.

## Edge Cases

- Email comparison is trimmed and case-insensitive; Unicode names remain preserved.
- Concurrent refreshes permit only one successor and treat later use as replay.
- Deactivation and password reset invalidate existing refresh sessions; expired access tokens remain bounded by their short lifetime.
- Password reuse of the current value, weak/common passwords, and mismatched confirmation are rejected with field-safe errors.

## Authorization Rules

- Login/reset-request routes are anonymous and throttled; refresh/reset-confirm rely on their dedicated secrets.
- Profile/password routes require the same authenticated user.
- Role and ownership enforcement applies uniformly to REST controllers, services, reports, exports, and background reminders.

## API Behavior

- Auth endpoints use `/api/v1/auth/*`; self-service endpoints use `/api/v1/me`.
- Cookies are `HttpOnly`, `SameSite=Strict`, path-scoped, and `Secure` outside local development.
- Validation failures return `400 VALIDATION_ERROR`; authentication failures return stable safe codes with a request ID.

## Test Scenarios

- Unit: Argon2 verification, password policy, JWT claims, role guard, scope predicates, token hashing/rotation/replay.
- Integration: successful/failed/rate-limited login, refresh race, logout, reset expiry/single-use, deactivation invalidation.
- E2E: sign in, reload via refresh, role-aware landing page, password change, sign out, and protected-route redirect.
