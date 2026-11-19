# API protocol security supplement

**Status:** Supplemental implementation guidance  
**Applies to:** GraphQL, WebSocket and gRPC services  
**Related modules:** M03, M04, M05, M10  
**Reviewed:** 2026-11-18

This supplement adds protocol-specific controls. The universal authorization, validation, rate-limit, transport and logging requirements continue to apply.

## GraphQL

- Authenticate the caller at the transport boundary and establish a trusted server-side principal.
- Enforce authorization in resolvers or a shared policy layer close to the protected object. Check both object access and field/property access. Do not assume that authorization on a parent query protects every nested node or edge.
- Apply authorization to mutations as well as queries. Validate tenant and ownership context from trusted server-side state, not client-supplied IDs alone.
- Limit query depth, total complexity/cost, aliases, batched operations, pagination size, execution time and concurrent operations.
- Apply rate limits using more than raw HTTP request count. One HTTP request may contain many expensive operations.
- Use strict input and variable schemas. Bound string lengths, list sizes and nested input depth.
- Disable development consoles, GraphiQL and verbose error output in production. Restrict introspection where the exposure is not required by the product or client tooling. If introspection remains enabled, document the reason and protect schema details appropriately.
- Prevent resolver N+1 amplification and unbounded fan-out. DataLoader or caching does not replace authorization checks and must not share cached objects across tenants or principals.
- Use persisted/allowlisted queries where the product's client model permits it, while retaining server-side authorization and complexity controls.
- Do not return stack traces, internal resolver names, database details or secrets in GraphQL error extensions.

## WebSocket

- Use WSS in production and validate the Origin header against an explicit allowlist on every browser handshake. Do not use a wildcard or a permissive default.
- Authenticate the connection using a documented mechanism. Do not put bearer tokens in query strings. If authentication occurs in the first message, accept only the authentication message until it succeeds and enforce a short authentication timeout.
- Re-check session validity and authorization for each protected message or action. A successful handshake does not grant unlimited future permissions.
- Bind each connection to a principal and tenant on the server. Never accept client-supplied tenant or user identity as the authority for a message.
- Enforce maximum frame/message size, connection count, per-user concurrency, message rate, idle timeout, backpressure and bounded queue sizes.
- Handle logout, session revocation, account disablement and privilege changes for long-lived connections. Close or re-authenticate affected connections.
- Log connection lifecycle, authentication failures, authorization denials, rate-limit events and protocol errors. Do not log full message payloads, credentials or session tokens.

## gRPC

- Require TLS for production transport. Use mutual TLS or workload identity for service-to-service authentication where the trust model requires it.
- Authorize every RPC method and protected resource. Do not infer permission from the fact that a client can establish a channel.
- Validate metadata and message fields. Treat metadata as untrusted input, and never trust a tenant, user or role header merely because it came through a gateway.
- Set maximum inbound and outbound message sizes, deadlines, cancellation handling, concurrency limits and resource budgets.
- Configure retries only for operations that are safe to retry. Use idempotency keys or application-level deduplication for state-changing calls.
- Restrict reflection and administrative services to trusted environments or authenticated operators.
- Keep protobuf schema evolution backward-compatible and reject unknown or invalid security-sensitive enum values rather than silently mapping them to privileged defaults.
- Redact authorization metadata and sensitive payload fields from logs and traces.

## Required tests

- Cross-tenant object and field access attempts fail in GraphQL.
- Deep, wide, batched and expensive GraphQL queries are bounded.
- Unauthorized WebSocket origins, missing authentication, expired sessions and unauthorized messages are rejected.
- Oversized and flooded WebSocket messages are bounded without exhausting memory.
- gRPC methods enforce per-method authorization and tenant isolation.
- Expired deadlines, cancellation, retries and duplicate state-changing RPCs do not create duplicate business effects.
- Reflection, consoles and verbose errors are unavailable to unauthorised production callers.

## Primary references

- [OWASP GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html)
- [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [OWASP API Security Top 10 - 2023](https://owasp.org/www-project-api-security/)

Check the current server framework and protocol library documentation for exact configuration names and defaults.
