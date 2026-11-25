# Node.js and Express reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Node.js services using maintained LTS release lines and Express 4.x or 5.x (reviewed 2026-11-25 against nodejs.org and expressjs.com)
**Related modules:** M01, M02, M03, M04, M05, M08, M09, M10, M12  
**Companion supplements:** Authentication and federation; SSRF and outbound requests; API protocol security; cryptography and key management

This profile is a practical review checklist, not a tested framework preset or a claim that Express is secure by default. Primary sources checked on 2026-11-25 (`nodejs.org/en/about/previous-releases` and `expressjs.com/en/support/`): active supported Node.js LTS lines are **Node.js 22** (Maintenance LTS, EOL 2027-04-30), **Node.js 24** (Maintenance LTS, EOL April 2028), and **Node.js 26** (Active LTS, EOL April 2029); Node.js 20 is past EOL (2026-04-30). Express **5.x** (support started September 2024, requires Node.js `>=18`) and **4.x** are currently supported only on the **latest minor/patch release** of each major line; no upstream Express 4.x EOL date is published (`NOT VERIFIED`). Confirm the deployed Node.js LTS line, exact Express version, middleware versions, reverse-proxy topology and runtime settings before applying this profile; consuming-application compliance is NOT VERIFIED until recorded.

## Application boundary

- Keep Node.js on an actively maintained LTS release (22, 24, or 26 as of 2026-11-25) and keep Express on the latest patched minor/patch release of a supported major line (`5.x` or maintained `4.x`). Use the lockfile and deterministic installation (`npm ci --ignore-scripts`) in CI.
- Place the application behind a correctly configured TLS-terminating proxy or use TLS directly. Configure Express `trust proxy` explicitly for known proxy hops, subnets, or loopback interfaces (`expressjs.com/en/guide/behind-proxies.html`). Do not set `trust proxy` to broad `true` when untrusted clients can supply or spoof forwarded headers.
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

## Primary references

- [Node.js Release Schedule and Previous Releases](https://nodejs.org/en/about/previous-releases)
- [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices)
- [Express Version Support Policy](https://expressjs.com/en/support/)
- [Express Production Best Practices: Security](https://expressjs.com/en/advanced/best-practice-security/)
- [Express: Behind Proxies](https://expressjs.com/en/guide/behind-proxies.html)
- [Helmet documentation](https://helmetjs.github.io/)

Check the current supported Node.js release line and Express security advisories at the time of the consuming-application review. Unsupported assumptions about Express `4.x` future EOL dates or unverified middleware configurations remain **NOT VERIFIED** and do not replace version-specific verification.
