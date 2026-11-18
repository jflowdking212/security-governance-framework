# M03 Authorisation, roles and tenant isolation

**Source sections:** GLOBAL:1.B authorisation  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### B. Authentication, Authorization & Session Management**

\- **\*\*Broken Object Level Authorization (BOLA/IDOR):\*\***

  - Never trust IDs supplied in request routes, query parameters, headers, or request bodies without verifying the authenticated principal has permission to access that exact resource.

  - Implement tenant/user ownership checks as close to the database query as practical, e.g. \`WHERE id = :id AND tenant_id = :tenant_id\`.

  - Child resources MUST resolve through and be verified against their parent tenant boundary.


\- **\*\*Role-Based Access Control:\*\*** Centralize authorization policy. Do not scatter inconsistent role checks throughout route handlers when a common authorization middleware/service can enforce them.


\- **\*\*Tenant Isolation:\*\*** Every tenant-scoped read, write, update, delete, export, webhook, background job, cache entry, search, and AI retrieval path must preserve the canonical tenant ownership chain.

