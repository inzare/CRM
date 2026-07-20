# Performance test

Run against disposable seeded data: `k6 run tests/performance/crm.js`. Defaults to 10 virtual users for one minute. Override `BASE_URL`, `EMAIL`, `PASSWORD`, `VUS`, and `DURATION`. Gates are p95 below 500 ms, HTTP failures below 1%, and 100% critical checks.
