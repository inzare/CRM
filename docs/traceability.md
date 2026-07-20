# Requirement traceability

OpenSpec capability requirements are the source of truth. Implementation evidence maps as follows.

| Requirement family | Implementation                                   | Automated evidence                                                                                        |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| IA-001..005        | `apps/api/src/auth`, protected routes/context    | password/role/architecture unit tests; auth integration; Playwright auth/role journeys                    |
| UAA-001..005       | `users`, `audit`, admin/profile UI               | user/audit integration; Playwright permission journey                                                     |
| CR-001..005        | `customers`, company/contact UI                  | customer integration; Playwright company/contact journey                                                  |
| SP-001..006        | `sales`, lead/Kanban UI                          | conversion/transition integration; Playwright lead/pipeline; k6 pipeline/create                           |
| CL-001..006        | `commercial`, catalog/quote/contract UI          | quote calculator unit tests; commercial integration; Playwright quote journey                             |
| AT-001..005        | `activities`, task UI                            | task/activity integration; Playwright task journey                                                        |
| AR-001..006        | `reporting`, live dashboard                      | CSV unit tests; reporting/role integration; Playwright dashboard journey                                  |
| PO-001..010        | bootstrap/config/Docker/Terraform/workflows/docs | config/health/error units, builds, CI, Terraform CI validation, k6 thresholds, OpenSpec strict validation |

Detailed task-level links and named test gates remain in `openspec/changes/build-consultflow-crm/tasks.md`. Permanent capability specs are synchronized during change archival only after every final gate passes.
