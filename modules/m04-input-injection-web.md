# M04 Input validation, injection and browser security

## Controls
- Validate all untrusted input server-side using explicit schemas, types, lengths, ranges, enums, nested constraints, file limits, and allow-lists. Reject ambiguous, conflicting, unexpected, and duplicate fields where practical.
- Use parameterised queries, prepared statements, or safe ORM query builders. Never concatenate untrusted values into SQL, NoSQL filters, shell commands, or dynamic query strings.
- Avoid shell execution. If essential, use fixed executable paths, argument arrays, strict allow-lists, least privilege, bounded time/output, and no untrusted interpolation.
- Map request DTOs explicitly to writable model fields. Never mass-assign privileged fields.
- Contextually encode output. Avoid raw HTML and unsafe DOM/template injection; use a maintained sanitizer only where explicitly needed.
- Assess CSRF for cookie-authenticated state-changing requests. CORS is not CSRF protection.
- Assess SSRF, path traversal, unsafe deserialisation, open redirects, insecure file/object access, prototype pollution, and request smuggling where relevant.
- Bound request body, upload, query complexity, pagination, recursion, CPU, memory, and processing time.
- CORS is not authentication or authorisation. Private/credentialed APIs require explicit trusted origins; never use wildcard origins for private credentialed responses. Do not trust Origin as identity.
- Verify middleware ordering and actual browser behaviour. SameSite, credentials mode, cookie scope, preflight, cache variation, and CSRF controls interact.
- Do not mechanically restrict intentionally public, non-credentialed resources without understanding their contract.

## Negative tests
SQL/NoSQL/command injection, XSS contexts, CSRF, SSRF, path traversal, oversized/deep payloads, type confusion, duplicate fields, mass assignment, hostile Origin, wildcard credentialed CORS, and cache poisoning.

## Source basis
Global directive Sections 1.A, 1.C and 20; APES Layer 3; Self-audit vectors 2, 3, 8, 9, 14.
