# Activities and Tasks

## Purpose

Define customer/sales activities, assigned work, completion and overdue behavior, entity timelines, and follow-up indicators.

## ADDED Requirements

### Requirement: [AT-001] Linked activities
Authorized users SHALL create, view, update, paginate, filter, and soft-delete `CALL`, `MEETING`, `EMAIL`, `NOTE`, and `TASK` activities. Each activity SHALL have subject, body/notes, occurred or due timestamps as applicable, creator, and exactly one primary parent of company, contact, lead, or opportunity; optional related links MUST remain scope-valid.

#### Scenario: Record call
- **WHEN** an authorized user creates a CALL for an accessible contact with subject, outcome, and occurred time
- **THEN** the activity is persisted, appears in the contact/company timeline as applicable, and updates last-activity reporting

#### Scenario: Invalid parent relationship
- **WHEN** an activity has no primary parent, multiple primary parents, or an inaccessible/deleted parent
- **THEN** the API returns `422 ACTIVITY_PARENT_INVALID` and persists nothing

### Requirement: [AT-002] Task assignment and lifecycle
Authorized users SHALL create and assign tasks to active users with subject, description, priority, due date/time, parent record, and status. Assignees SHALL mark their tasks complete or reopen them; completion SHALL record completing actor and UTC timestamp and SHALL be idempotent.

#### Scenario: Assign task
- **WHEN** an authorized user creates a task for an active eligible assignee who can access its parent
- **THEN** the task appears in the assignee's work queue and linked timeline

#### Scenario: Complete task
- **WHEN** the assignee calls `POST /api/v1/tasks/{id}/complete`
- **THEN** status becomes COMPLETED exactly once with completion metadata and dashboards update

#### Scenario: Invalid assignee
- **WHEN** a task is assigned to an inactive user or a user without parent-record access
- **THEN** the API returns `422 TASK_ASSIGNEE_INVALID`

### Requirement: [AT-003] Due and overdue task views
The system SHALL classify incomplete tasks due in the user's configured local calendar day as `today` and tasks whose due instant has passed as `overdue`. APIs and dashboard widgets SHALL return deterministic scoped counts and ordered task summaries without duplicating overdue tasks in today unless explicitly requested.

#### Scenario: My tasks today
- **WHEN** an authenticated user requests the today widget
- **THEN** incomplete assigned tasks due in their local day are returned ordered by priority then due time

#### Scenario: Overdue task
- **WHEN** an incomplete task passes its due instant
- **THEN** it appears in overdue results with accessible visual/text status until completed or rescheduled

### Requirement: [AT-004] No recent activity indicator
The system SHALL identify accessible active companies, contacts, leads, and open opportunities whose latest qualifying activity is older than a configurable 30-day default, excluding records created inside the window and records with a future scheduled qualifying activity when configured.

#### Scenario: Stale opportunity
- **WHEN** an open in-scope opportunity has no qualifying activity within the threshold
- **THEN** it appears once in `No activity recently` with owner, last activity date, age, and link to follow up

### Requirement: [AT-005] Activity authorization and deletion history
Users SHALL access activities only when they can access the parent record. Creators/assignees may edit their permitted open activities; ADMIN/MANAGER may edit/reassign/delete in-scope activities; deletion SHALL be soft and audited while timeline history shows a safe deletion marker where required.

#### Scenario: Consultant updates assigned task
- **WHEN** a CONSULTANT edits or completes their assigned task on an accessible opportunity
- **THEN** the permitted fields change and unrelated commercial fields remain inaccessible

#### Scenario: Unauthorized linked activity
- **WHEN** a user requests an activity whose parent is outside scope
- **THEN** the API returns safe not-found and leaks no subject/body metadata

## Acceptance Criteria

- All activity types and task state changes persist, validate exactly-one-parent linkage, and update unified timelines/reporting.
- Today/overdue/stale calculations are timezone-aware and covered at day/DST boundaries.
- Task completion, assignment permissions, and activity deletion are available through accessible UI and direct API tests.

## Edge Cases

- Missing due time uses documented end-of-day semantics; DST gaps/overlaps convert predictably to UTC.
- Completing an already completed task returns current state without duplicating events.
- Reassignment to a deactivated/ineligible user and linking to soft-deleted parents are rejected.
- Notes are sanitized on render; CSV/report fields prevent formula injection.

## Authorization Rules

- ADMIN/MANAGER access all activities/tasks and reassign/delete them.
- SALES manages activities/tasks on owned records and can assign within permitted team policy.
- CONSULTANT manages self-created activities and assigned tasks on accessible parent records; other users' tasks are read-only or hidden.

## API Behavior

- `/api/v1/activities` supports typed creation/list/detail/update/delete; task-specific commands use `/api/v1/tasks/{id}/complete|reopen`.
- Widget endpoints may be exposed through `/api/v1/dashboard/tasks` but use the same underlying scope/date rules.
- Lists cap page size at 100, expose stable status/type filters, and return safe parent summaries.

## Test Scenarios

- Unit: exactly-one-parent validator, due/overdue/DST calculations, idempotent completion, assignment policy, stale-activity calculation.
- Integration: each activity type, scoped timeline visibility, task create/reassign/complete/reopen, soft deletion/audit, widget queries.
- E2E: create an opportunity task, view it in today/overdue state, complete it, and confirm dashboard/timeline updates.

