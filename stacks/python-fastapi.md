# Python and FastAPI reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Python services using FastAPI and ASGI  
**Related modules:** M01, M02, M03, M04, M05, M08, M09, M10, M12  
**Companion supplements:** Authentication and federation; SSRF and outbound requests; API protocol security; cryptography and key management

This profile is a practical review checklist, not a tested framework preset or a claim that FastAPI is secure by default. Confirm the supported Python version, exact FastAPI/Starlette/Pydantic versions, ASGI server, reverse-proxy topology and runtime configuration before applying it.

## Application boundary

- Use supported Python and framework versions. Pin dependencies and use reproducible lockfile-based installs in CI.
- Configure trusted hosts and proxy headers deliberately. Do not trust arbitrary forwarded headers from clients that can bypass the trusted proxy.
- Configure CORS with explicit origins, methods and headers. Do not use wildcard origins with credentials.
- Set request, upload, header, timeout and concurrency limits at the application server and reverse proxy.
- Use strict request models for security-sensitive endpoints. Reject unexpected fields where practical, especially role, tenant, owner, balance, status and permission fields.
- Keep development reloaders, interactive debuggers and detailed exception pages out of production.

## Identity and authorization

- Use FastAPI dependencies or a shared policy layer for consistent authentication and authorization, but ensure the checks are applied to every protected operation.
- Authorize the requested object, action, tenant and field. A valid bearer token does not imply permission to access every object.
- Validate JWT signature, algorithm, issuer, audience, expiry and token profile using a maintained library and an explicit trust configuration.
- If cookies are used for authentication, apply Secure, HttpOnly and appropriate SameSite attributes and add CSRF protection for state-changing requests.
- Treat OAuth callback state, OIDC nonce, refresh-token rotation and account recovery as security-critical flows.
- Follow the authentication supplement for detailed federation and authenticator controls.

## Input, database and outbound requests

- Use Pydantic validation for input shape and type, but do not mistake schema validation for authorization or business-invariant validation.
- Use parameterized SQL through a maintained database library or ORM. Avoid string-built queries and untrusted dynamic identifiers.
- Bound list sizes, pagination, nested structures, regular-expression work, file sizes and decompression.
- Treat remote URL imports, image fetches, webhook diagnostics and document previews as SSRF-sensitive. Follow the SSRF supplement and bind the outbound connection to a validated destination.
- Configure request timeouts and cancellation for asynchronous outbound calls. Do not let unbounded tasks or retries exhaust the event loop or connection pool.
- Store uploads privately, validate file signatures and apply parser limits before processing.

## Errors, logs and operations

- Use central exception handling and return client-safe error structures. Do not expose tracebacks, environment variables, SQL text, local paths or internal hostnames.
- Redact Authorization headers, cookies, API keys, passwords, sensitive personal data and payment details from logs and traces.
- Use request IDs and structured security events without recording complete sensitive payloads.
- Separate liveness and readiness checks. Do not expose configuration, dependency versions or secrets through health endpoints.
- Apply rate limits to authentication, expensive endpoints, uploads and other abuse-sensitive flows.

## Runtime and delivery

- Run the service as a non-root user with a minimal runtime image.
- Keep secrets outside source, wheels, images and build logs. Use platform secret injection or workload identity.
- Use bounded worker concurrency, memory and CPU resources. Configure graceful shutdown and bounded connection pools.
- Apply container and cloud controls from the companion supplement.
- Scan and pin dependencies, produce an SBOM where required, and retain build provenance for production artefacts.

## Required application tests

- Cross-tenant and unauthorized object/property access is rejected.
- Strict request models reject unexpected privileged fields.
- CORS, CSRF and trusted-host behaviour match the deployment topology.
- JWTs with wrong issuer, audience, signature, algorithm or token class are rejected.
- Oversized requests, uploads, decompression and expensive inputs are bounded.
- SSRF tests cover redirects, DNS rebinding, IPv4/IPv6 private ranges and metadata destinations.
- Production error responses and logs do not disclose sensitive data.
- Cancellation, timeout and retry paths do not create duplicate business effects or resource exhaustion.

## Verification record required before marking this profile validated

Record the consuming repository and commit, Python version, FastAPI/Starlette/Pydantic versions, ASGI server, reverse-proxy configuration, dependency lockfile, commands and test results, deployment configuration reviewed, known exceptions and reviewer. Until this evidence exists, keep the profile status as NOT VERIFIED.

## Primary references

- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [FastAPI Behind a Proxy](https://fastapi.tiangolo.com/advanced/behind-a-proxy/)
- [FastAPI Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [Starlette Middleware](https://www.starlette.io/middleware/)

Use the documentation matching the exact FastAPI, Starlette and Pydantic versions in the consuming application. In particular, configure trusted forwarded headers only for the actual proxy addresses; do not copy wildcard trust settings from illustrative deployment examples without verifying network isolation.
