# M09 Data protection, privacy and database integrity

## Controls
- Minimise personal, financial, sensitive, and tenant data. Define purpose, access, retention, deletion, export, and residency requirements.
- Use encryption in transit and at rest where required; verify actual provider/configuration evidence rather than assuming.
- Protect database credentials, storage ACLs, object keys, backups, exports, and replicas with least privilege and environment isolation.
- Use parameterised database operations, explicit model field allow-lists, foreign keys/constraints, uniqueness, transactions, and appropriate locking.
- Use fixed-precision decimal or integer minor units for financial values. Never use floating-point arithmetic where rounding can change money or balances.
- Make destructive operations recoverable and auditable. Consider referential integrity, orphan records, soft-delete semantics, retention, and rollback.
- Ensure exports, search, caches, logs, analytics, backups, and AI retrieval do not expose data across tenants or beyond recipient need.
- Verify backup encryption, schedule, access, retention, restore testing, RPO/RTO, and point-in-time recovery where applicable.
- Mark hosting region, encryption-at-rest, retention, and residency UNKNOWN unless authoritative configuration proves them.
- Reconcile source-of-truth records after partial failures and cross-system workflows.

## Source basis
Global directive Sections 1.A, 1.G, APES Layers 4, 5, 12; Self-audit vectors 4, 5, 8, 12, 15, 16.
