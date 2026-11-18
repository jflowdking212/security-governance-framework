# Severity and release gates

## P0 - Critical - BLOCK
Examples: authentication/authorisation bypass, cross-tenant access, material RCE/injection, exposed production credentials, destructive unrestricted operations, payment manipulation, unauthenticated forged financial webhook, broken tenant boundary, transaction corruption, externally exploitable admin escalation.

## P1 - High - BLOCK
Examples: missing authorisation on sensitive endpoints, exploitable replay/idempotency failure, major race/concurrency defects, material data corruption, unsafe non-payment webhook trust, serious session/token exposure, critical reachable dependency vulnerability, serious backup/recovery/deployment defect.

## P2 - Medium - WARN / REMEDIATE
Examples: weak validation, material monitoring gaps, scalability issues, missing rate limits, incomplete headers, resilience weaknesses without immediate compromise.

## P3 - Low - INFORMATIONAL
Examples: minor hardening, documentation, low-impact maintainability.

## Mandatory policy
P0 and P1 block production release. No agent may waive, downgrade, or silently accept either. A human risk note does not convert a blocker into PASS. Emergency containment may proceed before the full audit, but production release remains blocked until the blocker is resolved and verified. P2/P3 dispositions require documented rationale, owner, compensating controls where applicable, review date, and residual risk.
