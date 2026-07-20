# Analytics and Reporting

## Purpose

Define role-scoped, filterable sales and follow-up metrics, renewal visibility, and safe CSV exports with consistent business definitions.

## ADDED Requirements

### Requirement: [AR-001] Pipeline and weighted forecast

The dashboard SHALL report open pipeline expected value grouped by stage and weighted forecast calculated as each open opportunity expected value multiplied by its effective probability. Results SHALL support inclusive date range, owner, and currency filters and SHALL apply the caller's record scope before aggregation.

#### Scenario: Filtered pipeline dashboard

- **WHEN** an authorized user requests dashboard metrics for a date range and owner
- **THEN** the API returns stage totals/counts and weighted forecast derived only from matching in-scope non-deleted open opportunities

### Requirement: [AR-002] Revenue and conversion metrics

The dashboard SHALL report won revenue, lead-to-opportunity conversion rate, opportunity win/loss rate, and average sales cycle using immutable conversion/stage history and documented zero-denominator behavior. Won revenue SHALL be counted once using actual close/won transition dates.

#### Scenario: Metrics with data

- **WHEN** the selected range contains converted leads and closed opportunities
- **THEN** the API returns numerator, denominator, rate, value, currency, and comparison metadata with consistent definitions

#### Scenario: Empty denominator

- **WHEN** a rate denominator is zero
- **THEN** the API returns `null` rate plus zero counts rather than NaN, infinity, or a misleading percentage

### Requirement: [AR-003] Sales by offering

The system SHALL report accepted/won sales grouped by product/service using immutable accepted quote line snapshots, including quantity, net revenue, category/type, and currency. It MUST avoid double counting superseded quote versions.

#### Scenario: Product sales report

- **WHEN** an authorized user requests sales by offering for a date range
- **THEN** only accepted quote lines tied to in-scope won business are aggregated once and sorted by net revenue by default

### Requirement: [AR-004] Renewals and follow-ups

The dashboard SHALL include upcoming/overdue contract renewals, overdue tasks, and no-recent-activity records using the commercial and activity capability definitions. Each item SHALL be deduplicated, scope-filtered, actionable, and include the date/owner context explaining why it appears.

#### Scenario: Manager follow-up dashboard

- **WHEN** a MANAGER opens the dashboard with an owner filter
- **THEN** renewal and follow-up widgets show only that owner's qualifying records with accurate counts and accessible links

### Requirement: [AR-005] Role-aware dashboard presentation

ADMIN and MANAGER SHALL view organization/team metrics; SALES SHALL view owned metrics; CONSULTANT SHALL view assigned-task/activity and permitted delivery context without revenue or sales-performance figures not granted by policy. The web dashboard SHALL hide unauthorized widgets and the API SHALL independently deny their endpoints.

#### Scenario: Consultant dashboard

- **WHEN** a CONSULTANT requests the dashboard
- **THEN** assigned tasks and permitted renewal/delivery reminders are visible while pipeline value, revenue, forecast, win/loss, and product sales are absent and direct calls are forbidden

### Requirement: [AR-006] CSV report export

Authorized users SHALL export key tabular opportunity, sales-by-offering, renewal, and overdue-follow-up reports as UTF-8 CSV using the same filters, definitions, columns, sort, and authorization scope as their JSON views. Cells beginning with spreadsheet formula prefixes SHALL be escaped.

#### Scenario: Export filtered report

- **WHEN** an authorized user requests `/api/v1/reports/{report}/csv` with valid filters
- **THEN** the API streams a named CSV with headers, invariant date/decimal formats, scoped rows, and formula-safe cells

#### Scenario: Unauthorized export

- **WHEN** a role requests a report it cannot view
- **THEN** the API returns `403 FORBIDDEN` and emits no file bytes or partial data

## Acceptance Criteria

- Every metric has a documented formula, history/date basis, zero-state, currency behavior, and authorization scope.
- JSON widgets and CSV exports return reconciled totals for identical filters.
- Normal dashboard/report queries meet p95 below 500 ms under documented seed/load conditions or have an explicit indexed optimization.

## Edge Cases

- Mixed currencies are returned as separate series/totals; the MVP does not invent exchange rates.
- Soft-deleted records remain counted only when their qualifying historical event was valid and the report definition requires history.
- Date range boundaries use business timezone dates converted to UTC; future close dates do not count as won revenue.
- Large CSV exports stream with row caps/timeout protection and formula injection escaping for `=`, `+`, `-`, `@`, tab, and carriage return prefixes.

## Authorization Rules

- ADMIN/MANAGER access organization/team commercial reports and exports.
- SALES access only owned commercial metrics/exports.
- CONSULTANT accesses assigned work widgets only and cannot export commercial performance reports.
- Owner filters cannot broaden the caller's underlying scope.

## API Behavior

- `/api/v1/dashboard/summary` returns role-appropriate widget DTOs; focused `/api/v1/reports/*` endpoints return tabular JSON/CSV.
- Filters are validated and default to the current quarter plus caller scope; page/report limits are explicit.
- Response metadata includes effective filters, generated timestamp, definitions version, and currencies.

## Test Scenarios

- Unit: forecast/revenue/rate formulas, zero denominators, date windows, currency partitioning, CSV escaping.
- Integration: seeded aggregate reconciliation, owner/role scoping, history-based counts, renewal/follow-up deduplication, JSON/CSV equality.
- E2E: dashboard role visibility, date/owner filtering, empty states, renewal/follow-up navigation, and CSV download.
