# M05 API, network and transport security

## Controls
- Require HTTPS/TLS for sensitive traffic. Never disable certificate verification to make integrations work.
- Authenticate and authorise every private API operation server-side. CORS and hidden UI controls are not access control.
- Allow only required HTTP methods, content types, headers, origins, and routes. Apply request size/time limits and rate/abuse controls.
- Authenticate websocket connections and authorise every message/action against the current principal, tenant, and resource.
- Apply pagination, query bounds, timeouts, safe retries, backpressure, and abuse controls.
- Validate outbound destinations and redirects to mitigate SSRF. Restrict access to metadata services and internal networks where applicable.
- Protect proxy and TLS termination configuration; do not infer network controls from application code.
- Keep environment-specific origins, endpoints, certificates, credentials, and network rules separate.
- Define provider outage, timeout, retry, circuit-breaker, and partial-failure behaviour.

## Verification
Test unauthenticated access, wrong methods, oversized requests, rate limits, websocket cross-tenant messages, hostile redirects, TLS verification, SSRF destinations, and production/staging endpoint separation.

## Source basis
Global directive Section 1.D and Section 20; APES Layers 3, 8, 11.
