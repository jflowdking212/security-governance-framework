# M17 Security finding severity and release gates

**Source sections:** GLOBAL:7, OWNER:RELEASE-POLICY  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 7. Security Finding Severity & Release Gating**



**### P0 — Critical — BLOCK**



Examples: authentication/authorization bypass, cross-tenant data access, RCE/injection with material impact, exposed production credentials, destructive unrestricted operations, payment/financial manipulation, a payment/entitlement webhook that accepts unauthenticated forged events, broken tenant boundary, transaction integrity corruption, or externally exploitable admin privilege escalation.



**### P1 — High — BLOCK**



Examples: missing authorization on sensitive endpoints, exploitable replay/idempotency failure, major concurrency/race defects, major data corruption risk, unsafe non-payment webhook trust boundaries, incomplete webhook freshness/order/duplicate handling with material impact, insecure session/token storage, critical reachable dependency vulnerability, or serious backup/recovery/deployment defects for high-value systems.



**### P2 — Medium — WARN / REMEDIATE**



Examples: weak input validation, material monitoring gaps, performance/scalability issues, missing rate limits, incomplete security headers, or resilience issues without immediate compromise.



**### P3 — Low — INFORMATIONAL**



Examples: minor hardening opportunities, security documentation gaps, or low-impact maintainability issues.



Do not downgrade a finding because remediation is inconvenient.



\---

## Owner-approved policy clarification

P0 (Critical) and P1 (High) findings are absolute production-release blockers. No AI agent, developer, reviewer, or project operator may waive, downgrade, relabel, or silently accept a P0/P1 finding. A risk-acceptance note does not convert either severity into PASS. The blocker is cleared only after remediation and evidence-based verification, or after the owner changes this global policy through a separately reviewed, versioned amendment.
