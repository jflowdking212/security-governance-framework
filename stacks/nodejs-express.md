# Node.js and Express reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Node.js services using Express  
**Related modules:** M01, M02, M03, M04, M05, M08, M09, M10, M12  
**Companion supplements:** Authentication and federation; SSRF and outbound requests; API protocol security; cryptography and key management

This profile is a practical review checklist, not a tested framework preset or a claim that Express is secure by default. Confirm the deployed Node.js LTS line, exact Express major version, middleware versions, reverse-proxy topology and runtime settings before applying it.

## Application boundary

- Keep Node.js and Express versions supported by their maintainers. Use the lockfile and deterministic installation in CI.
- Place the application behind a correctly configured TLS-terminating proxy or use TLS directly. Configure Express trust proxy only for the known proxy hops or networks. Do not set trust proxy broadly without understanding how client IP and protocol headers are supplied.
- Set security headers with a maintained middleware such as Helmet, then review the effective headers and any required exceptions. Do not assume a package's defaults fit every application.
- Configure explicit CORS origins, methods and headers. Never reflect arbitrary Origin values or combine wildcard origins with credentials.
- Set request body, URL, header, upload and timeout limits at the application and reverse-proxy layers.
- Use a maintained schema validator for route parameters, query strings, headers and bodies. Reject unexpected privileged fields rather than mass-assigning request bodies to models.

## Identity and authorization

- Use secure, HttpOnly and appropriate SameSite cookies when cookie sessions are selected. Set Secure in production and review domain/path scope.
- If cookie authentication is used, implement CSRF protection appropriate to the request model. SameSite is defence in depth, not a universal substitute.
- Authenticate before protected handlers and authorize every action against the requested object, tenant and property.
- Do not trust user, tenant, role, owner or permission values supplied in request bodies or headers.
- Revalidate privileges for sensitive operations and long-lived sessions. Do not let cached authorization decisions outlive their justified scope.
- Follow the authentication supplement for OAuth, OIDC, JWT, refresh tokens and MFA.

## Input, network and data

- Use parameterized database operations and explicit DTO-to-model mapping. Avoid raw SQL concatenation and mass assignment.
- Treat URL fetching, webhook testing, remote image processing and import-from-URL features as SSRF-sensitive. Follow the SSRF supplement and validate the actual connection destination.
- Apply per-route rate limits and stronger limits to login, password reset, OTP, search, expensive reports, uploads and other resource-intensive actions.
- Limit uploads by byte size, count, file signature, decompressed size and parser workload. Store outside executable public paths.
- Use central error handling. Return safe client errors and keep stack traces, SQL errors, secrets and internal paths out of production responses.
- Redact passwords, tokens, cookies, authorization headers, payment data and sensitive personal data from logs.

## Runtime and delivery

- Run as a non-root user with least filesystem permissions.
- Keep production secrets outside the image and repository. Use the deployment platform's protected secret injection or workload identity.
- Pin container images by digest where containers are used. Apply the container/cloud runtime supplement.
- Use graceful shutdown and bounded timeouts for outbound requests and database operations.
- Keep liveness and readiness endpoints minimal and free of sensitive deployment details.
- Ensure CI checks lockfile consistency, tests, secret scanning, dependency vulnerabilities and the project's selected static analysis.

## Required application tests

- Cross-tenant object access and privileged property mass assignment are rejected.
- CORS rejects untrusted origins and CSRF tests cover cookie-authenticated mutations.
- Body, upload, request-rate and outbound-fetch limits are enforced.
- Production error responses do not expose stack traces or internal implementation details.
- Session revocation and account disablement prevent continued protected access.
- The final runtime image and configuration match the reviewed non-root, secret and network assumptions.

## Verification record required before marking this profile validated

Record the consuming repository and commit, Node.js version, Express version, reverse-proxy configuration, relevant middleware versions, commands and test results, deployment configuration reviewed, known exceptions and reviewer. Until this evidence exists, keep the profile status as NOT VERIFIED.
