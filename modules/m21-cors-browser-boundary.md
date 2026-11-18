# M21 CORS and browser cross-origin trust boundary

**Source sections:** GLOBAL:20  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 20. CORS & Browser Cross-Origin Trust Boundary**



CORS is a browser-enforced response-sharing policy. It is not authentication, authorization, tenant isolation, or a substitute for CSRF protection.

A private or credentialed API MUST expose cross-origin responses only to explicitly trusted origins required by the application.



### 20.1 CORS Security Model



- **Browser Boundary, Not API Authentication:** CORS controls whether compliant browsers allow JavaScript from one origin to read responses from another origin. Non-browser clients, scripts, backend services, curl, mobile apps, and malicious servers are not stopped by CORS. Every API still requires normal server-side authentication, authorization, tenant ownership, validation, and rate/abuse controls.

- **Do Not Trust the `Origin` Header as Identity:** The `Origin` header may inform CORS policy, but it MUST NOT be treated as proof of user identity, tenant ownership, application authenticity, or authorization. Non-browser clients can send arbitrary `Origin` values.

- **CORS Is Not CSRF Protection:** CORS primarily governs cross-origin response readability. Some cross-origin requests can still be sent even when the response cannot be read. Cookie-authenticated state-changing endpoints MUST separately assess CSRF defenses such as appropriate `SameSite` cookies, anti-CSRF tokens, origin/referer validation where appropriate, and framework protections.

- **SameSite and Credential Semantics Matter:** Do not assume cross-site cookies are always sent. Cookie `SameSite` policy, browser credential mode, cookie domain/path/security attributes, and request context affect whether cookies accompany a request. Verify the actual browser/authentication architecture rather than relying on simplified CORS assumptions.



### 20.2 Wildcard Policy



- **Private/Credentialed APIs:** Do NOT use `Access-Control-Allow-Origin: *` for APIs returning private, tenant-scoped, authenticated, financial, administrative, or otherwise sensitive data.

- **Credentialed Wildcard Correction:** Do not claim that a standards-compliant browser will expose a credentialed response merely because the server returns both `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true`. Browsers reject wildcard `Access-Control-Allow-Origin` for credentialed CORS responses. The configuration is invalid and must still be fixed, but the browser does not treat it as permission for every origin to read a credentialed response.

- **Public Non-Credentialed Resources:** `Access-Control-Allow-Origin: *` MAY be intentional for genuinely public, non-credentialed resources designed to be readable by any website. Do not mechanically replace a valid public-resource policy with a restrictive allowlist without understanding the product contract.

- **No Wildcard Credential Scope:** For credentialed requests, do not use wildcard response values where the CORS specification requires explicit values for origin/method/header/exposed-header behavior. Configure the narrowest values required by the application.



### 20.3 Explicit Trusted-Origin Allowlist



- **Exact Origin Matching:** For private cross-origin browser clients, compare the request origin against an explicit trusted-origin allowlist and return `Access-Control-Allow-Origin` only for an authorized exact origin.

- **Origin Includes Scheme, Host, and Port:** Treat `https://app.example.com`, `http://app.example.com`, and `https://app.example.com:8443` as different origins. Do not compare hostnames alone when making a CORS trust decision.

- **Configuration, Not Necessarily Hardcoding:** Trusted origins may be defined in reviewed environment/configuration rather than hardcoded in source. Production allowlists MUST be explicit, auditable, environment-specific, and fail safely when malformed or missing.

- **No Naive Substring/Suffix Checks:** Prohibit checks such as `origin.includes("example.com")` or unsafe suffix matching that can authorize attacker-controlled domains such as `example.com.attacker.tld` or `attackerexample.com`.

- **Subdomain Wildcards Require Justification:** Avoid broad `*.example.com` trust for credentialed private APIs unless all matching subdomains are controlled to the same security standard and subdomain-takeover/orphaned-DNS risk has been assessed.

- **Normalize Through a URL Parser:** Where custom matching is required, parse and compare origins using a standards-compliant URL/origin representation rather than ad-hoc string manipulation. Reject malformed origins.

- **`null` Origin:** Deny `Origin: null` by default for private/credentialed APIs unless a specific legitimate use case has been reviewed and explicitly allowlisted. Do not treat `null` as equivalent to "no restriction."



### 20.4 Reflected-Origin Defense



- **Never Blindly Reflect:** Do NOT set `Access-Control-Allow-Origin` to the incoming `Origin` value unless that origin first passes the trusted-origin validation policy.

- **Validated Reflection Only:** When multiple trusted origins are supported, the server MAY return the validated requesting origin as the single `Access-Control-Allow-Origin` value after exact allowlist verification.

- **Credentials Only After Origin Approval:** Set `Access-Control-Allow-Credentials: true` only for routes that actually require credentialed cross-origin access and only when the requesting origin has passed the relevant trust policy.

- **No "Scanner Bypass" Reflection:** Replacing `*` with unconditional reflection is not remediation. It is equivalent to authorizing arbitrary origins for response access and is a blocking defect for private/credentialed APIs.



### 20.5 Cache Correctness



- **Vary by Origin:** When `Access-Control-Allow-Origin` is selected dynamically based on the requesting origin, return `Vary: Origin` so shared caches do not reuse a response/header decision across different origins.

- **Review CDN/Proxy Behavior:** Verify that reverse proxies, CDNs, API gateways, and application middleware preserve the intended CORS and `Vary` behavior and do not cache one tenant/origin's CORS response for another.

- **Do Not Cache Sensitive Cross-Origin Responses Unsafely:** Apply appropriate private/no-store/cache-control behavior to sensitive responses independent of CORS when their contents must not be shared through intermediary caches.



### 20.6 Preflight, Methods, and Headers



- **Allow Only Required Methods:** Limit `Access-Control-Allow-Methods` to methods genuinely needed by approved browser clients. Do not publish unnecessarily broad mutation methods merely for convenience.

- **Allow Only Required Request Headers:** Limit `Access-Control-Allow-Headers` to required headers. Review authorization, custom tenant/context, idempotency, upload, and privileged headers carefully.

- **Expose Only Required Response Headers:** Limit `Access-Control-Expose-Headers` to response headers browser clients legitimately need.

- **Preflight Is Not Authorization:** A successful OPTIONS/preflight request does not authorize the subsequent operation. The actual request MUST undergo normal authentication, authorization, tenant, validation, financial, and integrity controls.

- **Preflight Caching:** If `Access-Control-Max-Age` is used, choose a bounded value consistent with the ability to change/revoke CORS policy. Do not rely on preflight caching as a security control.



### 20.7 Environment Separation



- **Production Origins:** Production private APIs SHOULD allow only required production origins.

- **Local Development Origins:** `localhost`, loopback, local ports, preview domains, temporary tunnels, and development frontends MUST NOT be automatically carried into production allowlists.

- **Preview Deployments:** Do not use unrestricted wildcard or broad hostname matching merely to support ephemeral preview environments. Use controlled preview-origin registration or a provider-supported trusted pattern with explicit risk review.

- **Credentials by Environment:** CORS configuration must align with the directive's environment-isolation rules. A development origin must not gain production API access simply because the same cookie, token, OAuth client, or API credential is reused across environments.



### 20.8 Middleware and Routing Consistency



- **One Authoritative Policy:** Prefer a centralized CORS policy/middleware for APIs sharing one trust model. Avoid route-by-route configuration drift unless route classes intentionally require different cross-origin policies.

- **Route-Specific Exceptions:** Public endpoints, private browser APIs, webhook endpoints, OAuth callbacks, file/CDN resources, and internal service APIs may need different cross-origin behavior. Document intentional exceptions rather than applying one permissive policy globally.

- **Error Responses:** Where browser clients need to receive safe application errors cross-origin, ensure CORS handling remains consistent without leaking additional internal details or accidentally broadening origin access.

- **Framework Defaults Are Not Evidence:** Inspect the effective production headers. Do not assume a framework/package configuration produces the intended result merely because the code appears correct.



### 20.9 Mandatory CORS Negative Verification



For private or credentialed browser APIs, test as applicable:

- allowed production origin -> receives intended CORS headers and can read the authorized response;

- unlisted attacker origin -> receives no usable cross-origin authorization and browser JavaScript cannot read the protected response;

- arbitrary reflected origin attempt -> rejected/not reflected;

- `https://example.com.attacker.tld` -> rejected;

- `https://attackerexample.com` -> rejected;

- wrong scheme -> rejected when not explicitly trusted;

- wrong port -> rejected when not explicitly trusted;

- `Origin: null` -> rejected unless explicitly justified;

- malformed origin -> rejected safely;

- credentialed request with wildcard configuration -> treated as invalid configuration and not relied upon as a security mechanism;

- public non-credentialed endpoint -> wildcard allowed only when intentionally designed as public;

- disallowed method -> preflight/actual request not authorized through CORS policy;

- disallowed request header -> preflight rejected/not authorized;

- dynamic allowlisted origin -> response includes correct `Vary: Origin`;

- missing `Origin` -> handled according to endpoint design; absence MUST NOT automatically grant authorization;

- development/localhost/preview origin -> rejected by production unless explicitly authorized;

- state-changing cookie-authenticated route -> CSRF behavior tested independently of CORS;

- direct non-browser request -> server-side authentication/authorization still blocks unauthorized access regardless of CORS headers;

- reverse proxy/CDN/API gateway -> preserves the intended CORS decision and cache variation.



### 20.10 CORS Release Gate



Do NOT mark a private browser API's cross-origin policy **secure** merely because:

- there is no literal `Access-Control-Allow-Origin: *`;

- an automated scanner passes;

- the server echoes the request origin;

- preflight succeeds;

- cookies use `SameSite`;

- requests work from the intended frontend.

Before approval, verify:

- sensitive routes do not expose responses to arbitrary origins;

- trusted origins are exact, reviewed, environment-specific, and fail safely;

- reflected origins are validated before being returned;

- credentialed CORS is enabled only when required;

- CORS is not being used as authentication, authorization, tenancy, or CSRF protection;

- `Vary: Origin` is present when dynamic origin selection is cacheable;

- allowed methods/headers/exposed headers are appropriately scoped;
- production does not inherit unnecessary development/preview origins;

- proxy/CDN/framework layers do not override or broaden policy;

- applicable negative tests above were actually executed or explicitly reported as unverified.

A CORS allowlist is a browser response-sharing control. The real security boundary still requires server-side authentication, authorization, tenant isolation, CSRF protection where applicable, and verified production configuration.


---
