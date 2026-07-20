# Sales Pipeline

## Purpose

Define lead capture and qualification, lossless conversion, configurable opportunity stages, guarded movement, pipeline presentation, and loss attribution.

## ADDED Requirements

### Requirement: [SP-001] Pipeline stage configuration

The system SHALL seed ordered stages `New Lead`, `Qualified`, `Discovery`, `Proposal`, `Negotiation`, `Won`, and `Lost`, each with stable key, display name, order, type, default probability, and active status. ADMIN and MANAGER SHALL configure display name, order, probability, active status, and allowed transitions while preserving Won/Lost terminal semantics and historical references.

#### Scenario: Retrieve pipeline configuration

- **WHEN** an authorized user requests `GET /api/v1/pipeline-stages`
- **THEN** active stages are returned in configured order with permissions and transition metadata needed by the board

#### Scenario: Invalid stage configuration

- **WHEN** a configuration change removes the only won/lost terminal, duplicates order/key, or strands active opportunities
- **THEN** the API returns `409 INVALID_PIPELINE_CONFIGURATION` and preserves the prior configuration

### Requirement: [SP-002] Lead capture and qualification

Authorized sales users SHALL create, view, update, search, filter, and soft-delete leads with person/company context, source, owner, interest, budget, expected timeline, status, and qualification notes. Qualification SHALL require meaningful interest plus recorded budget/timeline disposition.

#### Scenario: Qualify lead

- **WHEN** an authorized owner records required qualification data and calls `POST /api/v1/leads/{id}/qualify`
- **THEN** the lead becomes qualified with timestamp/history and is eligible for conversion

#### Scenario: Incomplete qualification

- **WHEN** qualification is requested without required evidence
- **THEN** the API returns `422 LEAD_QUALIFICATION_INCOMPLETE` with field-safe reasons and leaves status unchanged

### Requirement: [SP-003] Idempotent lead conversion

A qualified lead SHALL convert transactionally into one opportunity and linked company/contact records selected or created during conversion, while retaining the source lead and history. Repeated or concurrent conversion requests MUST return the existing result and MUST NOT create duplicates.

#### Scenario: Convert qualified lead

- **WHEN** an authorized owner posts valid mapping data to `POST /api/v1/leads/{id}/convert`
- **THEN** the API creates/reuses company and contact, creates an opportunity in the configured initial stage, marks and links the lead, records history/audit, and returns `201`

#### Scenario: Repeat conversion

- **WHEN** conversion is requested for an already converted lead
- **THEN** the API returns `200` with the existing linked opportunity and creates no new records

### Requirement: [SP-004] Opportunity management

Authorized users SHALL create, view, update, search, filter, sort, and soft-delete opportunities with company, primary contact, owner, expected value, currency, probability, close date, stage, offerings, competitor, loss reason, and notes. Primary contact MUST belong to the selected company; probability MUST be 0-100 and defaults from stage unless explicitly set.

#### Scenario: Create opportunity

- **WHEN** an authorized user posts valid opportunity data to `POST /api/v1/opportunities`
- **THEN** the API returns `201`, creates initial stage history, and makes the opportunity visible in scoped list/board views

#### Scenario: Invalid company contact

- **WHEN** the primary contact does not belong to the opportunity company
- **THEN** the API returns `422 CONTACT_COMPANY_MISMATCH` and persists nothing

### Requirement: [SP-005] Valid stage movement and history

Opportunity stage changes SHALL use configured allowed transitions, atomically update stage/probability, append immutable stage history with actor and timestamps, and append an audit event. Won requires a positive value and actual close date; Lost requires loss reason and competitor disposition. Terminal opportunities cannot move without ADMIN/MANAGER reopen authorization.

#### Scenario: Valid stage move

- **WHEN** an authorized user moves an opportunity through `POST /api/v1/opportunities/{id}/stage-transitions` to an allowed stage with required data
- **THEN** the API returns the updated opportunity and history entry and dashboard/pipeline queries reflect the change

#### Scenario: Invalid or stale stage move

- **WHEN** a transition is disallowed, required terminal data is absent, or the expected source stage is stale
- **THEN** the API returns `409 INVALID_STAGE_TRANSITION` or `422` details and leaves stage/history unchanged

### Requirement: [SP-006] Accessible Kanban pipeline

The web application SHALL render scoped opportunities grouped by ordered stage with value/count summaries, filters, detail access, and pointer plus keyboard stage movement. Optimistic moves SHALL roll back and announce server rejection; a responsive tabular alternative SHALL remain usable.

#### Scenario: Drag opportunity

- **WHEN** an authorized user drags or keyboard-moves an opportunity to an allowed stage
- **THEN** the UI submits the transition, updates summaries after confirmation, preserves focus, and exposes the history event

#### Scenario: Rejected optimistic move

- **WHEN** the server rejects a board transition
- **THEN** the card returns to its original stage and an accessible error message explains the permitted next action

## Acceptance Criteria

- Lead qualification/conversion and opportunity stage rules execute server-side in transactions with immutable history.
- Pipeline list and board honor owner/date/search filters and every role's scope.
- Won/Lost values feed reporting exactly once; lost opportunities persist required reason/competitor disposition.

## Edge Cases

- Concurrent conversions and stage moves are idempotent or conflict safely.
- Inactive stages remain visible in history but accept no new opportunities.
- Decimal values and probability boundaries are validated; close dates are timezone-safe date values.
- Soft-deleted company/contact/catalog links remain historical but cannot be newly selected.

## Authorization Rules

- ADMIN/MANAGER view all opportunities, configure stages, reassign owners, reopen terminals, and delete records.
- SALES manages owned leads/opportunities and performs allowed transitions; cross-owner access is denied.
- CONSULTANT views linked/assigned opportunities and adds permitted activities but cannot qualify/convert leads, change commercial values, or move stages.

## API Behavior

- Lead and opportunity lists use standard pagination/filter/sort/search; `/opportunities/pipeline` returns board-optimized grouped data without bypassing scope.
- Transitions use an explicit subresource and expected current stage/update version; generic PATCH cannot alter stage.
- Business-rule failures use stable `409`/`422` codes and never partially persist aggregates.

## Test Scenarios

- Unit: qualification policy, conversion mapping/idempotency, transition graph, terminal requirements, probability defaults, ownership guards.
- Integration: lead CRUD/qualification/conversion, concurrent conversion, opportunity CRUD, valid/invalid/stale transitions, stage history, lost attribution, scoped pipeline retrieval.
- E2E: qualify and convert a lead; move its opportunity across the board; reject invalid movement; complete Won/Lost requirements.
