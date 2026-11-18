# M04 Injection, input validation and client security

**Source sections:** GLOBAL:1.A, GLOBAL:1.C, GLOBAL:3:Layer3
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### A. Injection & Data Layer (SQLi, NoSQLi, Command Injection)**



\- **\*\*Zero Unsafe Raw Queries:\*\*** Strictly require parameterized queries, prepared statements, or ORM/ODM-safe query builders across all data layers. Never concatenate untrusted variables directly into SQL, shell commands, database filters, or dynamic query strings.

\- **\*\*System Command Execution:\*\*** Avoid invoking shell commands (\`exec\`, \`spawn\`, \`system\`). If mandatory, use strict allow-list validation, separate arguments, least privilege, bounded execution time, and no direct interpolation of untrusted input.

\- **\*\*ORM Mass Assignment:\*\*** Block auto-binding of raw request bodies to database models. Enforce explicit attribute allow-listing/DTO mapping to prevent mass-updating security-sensitive fields such as \`role\`, \`is_admin\`, \`balance\`, \`tenantId\`, \`companyId\`, \`status\`, permissions, billing state, or ownership.

\- **\*\*Transaction Safety:\*\*** Financial, inventory, quota, entitlement, idempotency, reconciliation, and other state-sensitive updates MUST use appropriate transactions, locking, uniqueness constraints, or compare-and-set semantics.

\- **\*\*Precision:\*\*** Financial values MUST use decimal/fixed-precision types or integer minor units, never floating-point arithmetic where rounding can alter money or balances.

**### C. Input Validation, Output Encoding & Client Security**



\- **\*\*Strict Server-Side Validation:\*\*** Validate types, lengths, ranges, schemas, enum values, nested objects, file metadata, and allowed character sets before processing. Never rely solely on front-end validation.

\- **\*\*Reject Ambiguous Input:\*\*** Reject unexpected fields where practical, especially on privileged operations. Avoid silently coercing arrays/objects into strings or accepting duplicate/conflicting identifiers.

\- **\*\*Cross-Site Scripting (XSS):\*\***

  - Contextually encode dynamic content before rendering it to the DOM.

  - Forbid \`dangerouslySetInnerHTML\`, raw HTML injection, or unescaped template interpolation unless passed through a dedicated, well-maintained sanitizer with a documented reason.

\- **\*\*CSRF:\*\*** Where cookie-authenticated state-changing browser requests are possible, assess and implement CSRF protection appropriate to the framework and request model.

\- **\*\*File Upload Security:\*\***

  - Validate uploads using signature/magic-byte checks where feasible, not only MIME type or extension.

  - Enforce strict file size, row count, decompression, parser, and processing limits.

  - Generate randomized server-side filenames.

  - Store uploads outside directly executable/public paths or in isolated private object storage.

  - Deny script execution in upload directories.

  - Scan or safely parse risky formats and protect against ZIP bombs, path traversal, formula injection, and parser abuse.

\- **\*\*Downloads/Exports:\*\*** Apply authorization checks to generated reports, temporary URLs, object storage links, exports, and archived files.

**### Layer 3 — Application, API & Client Security**



Review schema validation, SQL/NoSQL/command injection, XSS, CSRF where applicable, SSRF, path traversal, unsafe deserialization, open redirects, mass assignment, insecure direct file/object access, request bounds, rate limits, and websocket authentication/message authorization.
