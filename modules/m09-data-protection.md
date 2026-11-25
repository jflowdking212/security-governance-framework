# M09 Data protection, privacy and residency

**Source sections:** GLOBAL:3:Layer4, GLOBAL:3:Layer5  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### Layer 4 — Data Protection, Privacy & Residency**



Verify encryption in transit, encryption at rest where required, secret/key storage, environment separation, least-privilege credential scope, rotation/revocation readiness, secret exposure history, personal/financial data minimization, retention/deletion behavior, backup encryption, export controls, log redaction, hosting/storage provider and region, data residency, subprocessors, and external AI-provider data transmission.



If hosting region, encryption-at-rest configuration, or retention policy cannot be verified from authoritative configuration, mark it `UNKNOWN` rather than assuming.

**### Layer 5 — Database, Financial & Transaction Integrity**



Review schema constraints, decimal/fixed financial precision, atomic transactions, event and business-level idempotency, reconciliation, race conditions, migration safety, rollback, destructive operations, foreign-key behavior, orphan prevention, duplicate detection, ledger/source-of-truth consistency, payment/refund/subscription state transitions, entitlement uniqueness, financial auditability, and concurrency controls.
