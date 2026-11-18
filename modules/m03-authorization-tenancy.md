# M03 Authorisation, roles and tenant isolation

## Scope
RBAC/ABAC, object ownership, tenant boundaries, hierarchical organisations, administrator access, background jobs, caches, exports, search, and AI retrieval.

## Controls
- Centralise authorisation policy. Do not scatter inconsistent role checks across handlers.
- Never trust IDs in routes, query strings, headers, bodies, events, or nested resources until the authenticated principal is authorised for that exact object.
- Enforce ownership/tenant constraints as close to the data query as practical. Resolve child resources through a verified parent boundary.
- Enforce tenant isolation on every read, create, update, delete, export, search, websocket, cache, queue/job, webhook, report, file/object, and AI retrieval path.
- Never trust client-supplied role, permissions, tenant ID, owner ID, organisation membership, status, or entitlement.
- Prevent mass assignment of sensitive fields including role, admin flags, balance, tenant/company, ownership, permissions, billing state, and status.
- Verify parent-child hierarchy and delegated authority at every level. A parent administrator's powers must be explicitly scoped and must not imply unrestricted access to all child data.
- Re-check authorisation in service/data layers, not only in UI visibility or route guards.
- Prevent tenant crossover through shared caches, object-storage keys, exports, background workers, analytics, logs, search indexes, AI prompts, embeddings, and support tooling.
- Define safe behaviour for suspended, removed, transferred, or deleted memberships. Revoke stale sessions and delegated access.
- Use deny-by-default policies and explicit resource/action checks.

## Negative tests
Cross-tenant read/write/delete/export, ID substitution, nested parent mismatch, role escalation by extra fields, revoked membership, stale cache/job context, guessed file IDs, and child access through a different tenant parent.

## Source basis
Global directive Section 1.B; APES Layer 2; Self-audit vectors 1, 3, 4, 8, 11, 16.
