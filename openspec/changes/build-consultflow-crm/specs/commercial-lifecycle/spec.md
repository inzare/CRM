# Commercial Lifecycle

## Purpose

Define the sellable catalog, opportunity offerings, immutable quote versions and calculations, printable output, contracts, renewals, and expansion signals.

## ADDED Requirements

### Requirement: [CL-001] Product and service catalog
ADMIN and MANAGER users SHALL manage catalog items with unique normalized SKU, name, category, type (`CONSULTING`, `SUBSCRIPTION`, `LICENSE`, `IMPLEMENTATION`), pricing model (`ONE_TIME`, `RECURRING`, `PER_USER`, `FIXED`), Decimal price, currency, active status, description, and timestamps. Other roles SHALL view active items needed for permitted workflows.

#### Scenario: Create catalog item
- **WHEN** an ADMIN or MANAGER posts a valid item to `POST /api/v1/catalog-items`
- **THEN** the API returns `201`, persists normalized SKU and precise price, and makes the item selectable

#### Scenario: Deactivate used item
- **WHEN** an authorized user deactivates an item referenced by an opportunity or quote
- **THEN** historical snapshots remain unchanged and the item is excluded from new selections

### Requirement: [CL-002] Opportunity offerings
Authorized opportunity owners SHALL add, update, and remove catalog items on non-terminal opportunities with quantity, negotiated unit price, billing notes, and sort order. Changes SHALL update expected commercial value only according to explicit user action and SHALL retain Decimal precision.

#### Scenario: Add offering
- **WHEN** an opportunity owner adds an active catalog item with valid quantity and price
- **THEN** the opportunity returns the persisted offering and recalculated offering subtotal

#### Scenario: Edit terminal opportunity
- **WHEN** a non-manager attempts to change offerings on a Won or Lost opportunity
- **THEN** the API returns `409 OPPORTUNITY_TERMINAL` without mutation

### Requirement: [CL-003] Versioned quote creation and totals
Authorized users SHALL create a quote from an opportunity with a monotonically increasing version, unique human-readable number, validity date, notes, and one or more snapshot line items. The server SHALL calculate per-line and document subtotal, line/document discounts, taxes, and total using fixed Decimal rounding; clients MUST NOT set authoritative totals.

#### Scenario: Create quote version
- **WHEN** an authorized opportunity owner creates a quote from selected offerings
- **THEN** the API snapshots SKU/description/pricing, assigns the next version atomically, calculates totals, and returns `201`

#### Scenario: Concurrent quote versions
- **WHEN** two requests create a version for the same opportunity concurrently
- **THEN** they receive distinct sequential versions or one safely retries without duplicate version numbers

#### Scenario: Invalid discount or validity
- **WHEN** a discount exceeds allowed bounds or validity date is in the past
- **THEN** the API returns `422 QUOTE_TERMS_INVALID` and persists no quote

### Requirement: [CL-004] Quote status lifecycle
Quotes SHALL transition `DRAFT -> SENT -> ACCEPTED|REJECTED`, with `SENT -> EXPIRED` when validity passes; DRAFT may be superseded by a newer version. Only one quote per opportunity may be Accepted. Sent quotes and later statuses SHALL be immutable except for status metadata; edits require a new version. Status transitions SHALL be audited.

#### Scenario: Send quote
- **WHEN** an authorized owner sends a valid DRAFT quote
- **THEN** status becomes SENT with timestamp and the snapshot becomes immutable

#### Scenario: Accept quote
- **WHEN** an authorized SALES owner or MANAGER accepts a valid SENT quote
- **THEN** status becomes ACCEPTED exactly once, competing open versions become REJECTED/superseded as defined, and the event is audited

#### Scenario: Expired quote acceptance
- **WHEN** acceptance is attempted after the validity date without manager override
- **THEN** the quote becomes/returns EXPIRED and the API returns `409 QUOTE_EXPIRED`

### Requirement: [CL-005] Printable quote
Authorized users SHALL view a semantic printable quote page containing company/contact, issuer, version/number, validity, line details, totals, terms, status, and notes with print CSS suitable for browser PDF generation. The route SHALL not expose quotes outside record scope.

#### Scenario: Print quote
- **WHEN** an authorized user opens `/quotes/{id}/print` and prints to PDF
- **THEN** navigation/actions are removed, totals and page breaks remain legible, and the document identifies its version and status

### Requirement: [CL-006] Contracts and renewal signals
ADMIN, MANAGER, and authorized SALES users SHALL create and manage contracts linked to a Won opportunity and Accepted quote, with number, start/end date, renewal date, amount, currency, status, renewal notes, and owner. Dashboard/API responses SHALL flag upcoming renewals within a configurable 30-day default and expansion candidates based on active contracts plus unpurchased active catalog categories.

#### Scenario: Create contract
- **WHEN** an authorized user submits valid contract terms for a Won opportunity with an Accepted quote
- **THEN** the contract is persisted with linked snapshot references and appears in renewal reporting

#### Scenario: Renewal reminder
- **WHEN** an active contract renewal date enters the configured window
- **THEN** scoped dashboards list it once with owner, amount, days remaining, and expansion suggestions

## Acceptance Criteria

- Catalog, opportunity offerings, quote versions/statuses/totals, printable pages, and contracts use real persisted workflows.
- Money calculations are server-authoritative, deterministic, currency-consistent, and unit tested at rounding boundaries.
- Quote acceptance, expiry, and version races are transactional and auditable.

## Edge Cases

- Zero/negative quantities, mixed currencies, inactive items, excessive discounts, negative tax, and empty quote lines are rejected.
- Historical quote lines survive catalog edits/deactivation/deletion.
- Date-only validity/renewal semantics use the configured business timezone while timestamps remain UTC.
- A contract end date cannot precede start date; renewal date warnings handle null/overdue values.

## Authorization Rules

- ADMIN/MANAGER manage catalog and all commercial records.
- SALES manages offerings, quotes, and contracts for owned opportunities subject to terminal/status rules.
- CONSULTANT may view linked commercial summaries needed for assigned delivery but cannot see internal discounts/margins where response policy excludes them or mutate records.

## API Behavior

- Catalog and contract collections follow standard pagination/filter/sort behavior.
- Quote lines are managed only while DRAFT; transitions use `/api/v1/quotes/{id}/transitions` with expected status/version.
- Printable data is available through a scoped quote detail endpoint; the frontend route supplies print layout without inventing totals.

## Test Scenarios

- Unit: SKU normalization, Decimal calculations/rounding, discount/tax validation, quote transition graph, expiry, renewal/expansion rules.
- Integration: catalog CRUD/deactivation, offerings, sequential/concurrent quote versions, immutability, acceptance exclusivity, contract prerequisites, renewal queries.
- E2E: add a catalog item to an opportunity, create/send/accept a quote, inspect print view, and see the linked contract reminder.

