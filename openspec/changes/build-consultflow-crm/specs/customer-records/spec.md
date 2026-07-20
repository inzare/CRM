# Customer Records

## Purpose

Define company and contact records, ownership, search/filtering, relationship timelines, and recoverable deletion behavior.

## ADDED Requirements

### Requirement: [CR-001] Company management
Authorized users SHALL create, view, update, paginate, filter, sort, and soft-delete companies with name, industry, website, size, structured address, owner, tags, and notes. Company names need not be globally unique, but duplicate candidates SHALL be surfaced to the creator.

#### Scenario: Create company
- **WHEN** an authorized user submits valid company data to `POST /api/v1/companies`
- **THEN** the API returns `201`, assigns ownership, normalizes website/tags, persists timestamps, and returns the company

#### Scenario: Delete company with relationships
- **WHEN** an authorized ADMIN or MANAGER soft-deletes a company that has contacts or sales history
- **THEN** the company is excluded from normal lists, history remains retained, linked records are not hard-deleted, and an audit event is written

### Requirement: [CR-002] Contact management
Authorized users SHALL create, view, update, paginate, filter, sort, and soft-delete contacts with first/last name, job title, normalized email, phone, decision-maker flag, linked company, and notes. A contact SHALL link to one active company in the MVP.

#### Scenario: Create linked contact
- **WHEN** an authorized user posts valid contact data for an accessible active company
- **THEN** the API returns `201` with the contact and safe company/owner summaries

#### Scenario: Duplicate email within company
- **WHEN** a contact email matches another non-deleted contact at the same company
- **THEN** the API returns `409 CONTACT_EMAIL_EXISTS` without creating a duplicate

### Requirement: [CR-003] Full-text search and filters
Company and contact list APIs SHALL provide PostgreSQL full-text/prefix search over appropriate names, email, website, industry, tags, job title, and notes, combined with allowlisted filters, ownership scope, pagination, and deterministic sorting.

#### Scenario: Search customer records
- **WHEN** an authorized user searches by a partial company, contact, email, industry, or tag term
- **THEN** the API returns only in-scope active matches ordered by relevance then a deterministic tie-breaker within the p95 target

#### Scenario: Invalid sort field
- **WHEN** a list request supplies a non-allowlisted sort field or malformed filter
- **THEN** the API returns `400 VALIDATION_ERROR` and does not interpolate the value into SQL

### Requirement: [CR-004] Unified customer timeline
Each company and contact SHALL expose a reverse-chronological timeline containing permitted activities and material linked events, including lead conversion, opportunity stage changes, quote status changes, tasks, and notes, with pagination and actor/type filters.

#### Scenario: View company timeline
- **WHEN** an authorized user requests `GET /api/v1/companies/{id}/timeline`
- **THEN** the API returns scoped events for the company and its directly linked contacts/opportunities without duplicates

#### Scenario: Restricted event omitted
- **WHEN** a timeline contains a linked record outside the caller's permission scope
- **THEN** the restricted event and sensitive metadata are omitted without revealing their existence

### Requirement: [CR-005] Ownership and reassignment
Company/contact access SHALL follow role and ownership scope. ADMIN and MANAGER SHALL reassign owners; SALES SHALL manage owned customer records; CONSULTANT SHALL view only customer context linked to assigned work and SHALL not delete or reassign it.

#### Scenario: Sales ownership enforcement
- **WHEN** a SALES user lists companies or requests a direct company ID
- **THEN** only owned or explicitly linked permitted records are returned and other records remain undisclosed

#### Scenario: Manager reassigns company
- **WHEN** a MANAGER assigns a company to an active SALES user
- **THEN** dependent default ownership behavior is applied as documented, the change is audited, and stale updates return `409`

## Acceptance Criteria

- Company/contact CRUD, search, filtering, deterministic pagination, timeline, ownership, and soft deletion use PostgreSQL persistence.
- Search and timeline endpoints meet authorization scoping and normal CRUD p95 below 500 ms under the documented load.
- Form controls are labeled, errors are associated, tables/cards are keyboard navigable, and duplicate warnings are understandable.

## Edge Cases

- Blank optional strings normalize to null; website and phone validation accepts international practical formats without executing links/scripts.
- Deleting a company does not cascade-delete commercial/audit history and blocks new child records.
- Concurrent updates use `updatedAt` conflict detection for material edits.
- Search safely handles punctuation, accents, empty terms, very long terms, and soft-deleted rows.

## Authorization Rules

- ADMIN has all access; MANAGER has all customer access and reassignment/deletion.
- SALES creates and manages owned records and can view linked records permitted by sales workflows.
- CONSULTANT has read-only customer context for assigned activities/tasks/opportunities and may add permitted activities, not customer mutations.

## API Behavior

- `/api/v1/companies` and `/api/v1/contacts` use `{data, meta}` list responses, page size 25/default and 100/max.
- Timeline endpoints share cursor or page pagination and stable event DTOs; normal deletes return `204` after soft deletion.
- Unknown or out-of-scope IDs return the standard safe not-found response.

## Test Scenarios

- Unit: normalization, duplicate rules, scope predicates, search query builder, timeline merge/deduplication, soft-delete policy.
- Integration: CRUD, duplicate contact, filters/sorts, full-text search, stale update, relationship-preserving deletion, role-scoped timelines.
- E2E: create a company and contact, search for them, edit details, and observe a linked timeline event.

