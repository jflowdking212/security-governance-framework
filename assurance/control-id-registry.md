# Control ID registry

Stable control-family references for reports, tests, and traceability. IDs are references, not claims of implementation.

- M01: ENG-01 through ENG-10, secure workflow, scope, evidence, remediation, human approval.
- M02: AUTH-01 through AUTH-10, credentials, MFA, sessions, recovery, identity callbacks, abuse controls.
- M03: TEN-01 through TEN-12, object ownership, RBAC/ABAC, tenant isolation, hierarchy, caches, jobs, exports, AI retrieval.
- M04: INPUT-01 through INPUT-12, schema validation, injection, mass assignment, encoding, CSRF, SSRF, files, CORS, bounds.
- M05: API-01 through API-09, TLS, methods, rate controls, websocket authorisation, outbound requests, environment isolation, resilience.
- M06: PAY-01 through PAY-20, webhook inventory, signature, raw body, secrets, freshness, event/business idempotency, ordering, invariants, ledger, reconciliation, negative tests.
- M07: TAX-01 through TAX-12, jurisdiction model, source dates, exposure/registration/collection distinction, classification, server calculation, evidence, refunds, filing, responsibility, AI safety.
- M08: SECRET-01 through SECRET-09, no commits, server-side storage, least privilege, scanning, rotation, fail-closed, environment separation, safe logs.
- M09: DATA-01 through DATA-12, minimisation, encryption, access, constraints, precision, transactions, retention, export, tenant data, backup/restore, residency evidence.
- M10: OPS-01 through OPS-12, safe errors, redacted logs, audit attribution, monitoring, alerts, retries, failure modes, incident response, recovery.
- M11: AI-01 through AI-10, untrusted content, prompt injection, tool boundary, tenant isolation, output validation, authoritative facts, privacy, quota, human approval, audit.
- M12: SUPPLY-01 through SUPPLY-14, inventory, lockfiles, SCA, source integrity, install scripts, SBOM, secrets, infrastructure, environment isolation, CI gates, approvals, artifacts, migrations, rollback.
