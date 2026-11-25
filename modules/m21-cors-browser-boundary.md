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

## USS implementation guidance: Local Network Access (LNA), legacy Private Network Access (PNA), and browser trust boundaries

> This section provides implementation and verification guidance authored specifically for the Universal Security Standard. It supplements the foundational CORS requirements above.

**Terminology and status (reviewed 2026-11-20):**

- **Local Network Access (LNA)** is the current permission-based browser proposal for restricting website access to local-network and loopback destinations. The WICG LNA specification is a **Draft Community Group Report dated 7 August 2026**, not a W3C Recommendation. Treat its requirements as a developing specification and distinguish them from each browser's shipped implementation.
- **Private Network Access (PNA 1.0)** refers to the earlier special-preflight approach using `Access-Control-Request-Private-Network` and `Access-Control-Allow-Private-Network`. Chrome put that rollout on hold and subsequently moved to the permission-based LNA approach. New implementations MUST NOT rely on those legacy headers as the browser's access-control mechanism. Existing devices may retain legacy header handling for compatibility, but it is not a substitute for current browser permission controls or server-side security.
- **Chromium implementation is version-specific.** Chrome documentation announced the permission prompt rollout in Chrome 142; Chrome 145 split the permission into `local-network` and `loopback-network`; Chrome 147 release material describes expansion to WebSocket and WebTransport connections. Do not assume that every browser, version, API or request type implements the same restrictions. Verify the supported browser/version matrix for the consuming application.
- The current WICG draft notes that Chromium's implemented checks cover public-to-local and public-to-loopback requests, and that cross-origin local-to-local checks are not currently enforced. Do not claim complete protection for every private-network communication path.

**Browser implementation matrix (reviewed 2026-11-25):**

| Browser | Evidence and rollout | Scope and limitations |
|---|---|---|
| Chrome | Permission prompt rollout announced for Chrome 142; granular local and loopback permissions in 145; WebSocket and WebTransport coverage described in 147 release material. | Fetch, subresources and subframe navigation are documented; WebSocket and WebTransport are version-specific. Do not infer WebRTC or main-frame navigation coverage. |
| Microsoft Edge | Microsoft Learn says restrictions ship by default from Edge 143. | Subresources, Fetch and subframe navigation are in scope. WebSocket, WebTransport and WebRTC are listed as planned in the March 2026 guidance. Main-frame navigation is not in scope in that guidance. Re-check current Edge documentation and deployed build because the documentation metadata and rollout dates can differ. |
| Firefox | Mozilla says LNA protections are enabled by default for Desktop users from Firefox 153. The enterprise LocalNetworkAccess policy is documented separately. | The reviewed Mozilla pages do not specify a complete request-type matrix. The policy reference lists Firefox 145, ESR 153 and Enterprise 149 compatibility. Do not infer mobile or API coverage from the desktop statement. |
| Safari / WebKit | WebKit bug 250607 remains the top-level LNA implementation tracker. Bug 324190 records permission decisions and Permissions API support landed on WebKit main in September 2026. | These engineering changes do not by themselves prove that a particular Safari release ships user-facing LNA prompts or enforcement. Verify the exact Safari/WebKit build and platform before making a support claim. |

**Cross-browser verification rule:** Treat Chromium, Edge, Firefox and Safari/WebKit as separate implementations. Record browser product, exact version, operating system, request API, source and destination address spaces, permission state, enterprise policy and observed outcome. If a vendor source does not state a request type or platform, record it as unverified rather than assuming parity.

**Additional vendor sources checked 2026-11-25:**

- Mozilla Support, [Control personal device and local network permissions in Firefox](https://support.mozilla.org/en-US/kb/control-personal-device-local-network-permissions-firefox), including the Firefox 153 Desktop default-on statement.
- Mozilla Enterprise, [LocalNetworkAccess policy reference](https://firefox-admin-docs.mozilla.org/reference/policies/localnetworkaccess/), including policy compatibility and affected preferences.
- Microsoft Learn, [Adapting your website for new Local Network Access restrictions in Microsoft Edge](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access), last updated 9 March 2026.
- WebKit Bugzilla, [Bug 250607: Implement Local Network Access](https://bugs.webkit.org/show_bug.cgi?id=250607), the top-level implementation tracker.
- WebKit Bugzilla, [Bug 324190: Record Local Network Access permission decisions](https://bugs.webkit.org/show_bug.cgi?id=324190), resolved to a WebKit mainline commit in September 2026. This is not proof of a shipped Safari release.

**LNA implementation requirements:**

- **Secure contexts and permission:** Where the browser implements LNA, local-network requests require a secure context and the applicable user permission. The current permission names are `local-network` for local address space and `loopback-network` for loopback. The former combined `local-network-access` permission remains an alias in Chromium. Apply `Permissions-Policy` deliberately; do not delegate these capabilities to untrusted embedded origins.
- **Address-space boundaries:** Treat public, local and loopback as distinct address spaces. Review public-to-local, public-to-loopback and local-to-loopback paths separately. Do not assume that a hostname alone proves the destination's address space; DNS resolution, redirects, proxies and address changes can affect the final destination.
- **User mediation:** Explain why local-device or companion-service access is needed and request it only in the expected user flow. In Chromium, the initial permission-triggering request should be initiated from a document with an explicit user action, not silently from page load or a service/shared worker. Handle denied or unavailable permissions without weakening server controls.
- **CORS remains separate:** LNA permission does not authenticate the user, authorise an operation, establish tenant ownership or make a response readable by JavaScript. Apply normal CORS origin/method/header policy for response access, and independently enforce authentication, authorisation, CSRF protection, tenant isolation and request validation on the server. A cross-origin request can still cause a state change even when the browser prevents the caller from reading its response.
- **Mixed content and target classification:** Chrome documents specific cases in which known local targets (such as private IP literals, `.local` hostnames, or an explicitly declared `targetAddressSpace: "local"`) receive special mixed-content treatment. This is browser-specific behaviour, not a universal permission to use insecure transport. Do not generalise it to other browsers or arbitrary public hostnames.
- **Local and loopback services:** Local companion APIs, agents, daemons, routers and internal services MUST still require appropriate authentication and authorisation. Bind only to intended interfaces, minimise exposed routes, validate `Host` and `Origin` where applicable, defend against DNS rebinding and CSRF, and never treat a request as trusted merely because it arrived from a private IP address.
- **Workers and non-Fetch APIs:** Check the current browser support for service workers, shared workers, WebSockets, WebTransport, WebRTC, navigations and embedded frames individually. Do not infer support for one API from another or claim cross-browser coverage without current evidence.

**Required verification:**

- Test allowed and denied local-network and loopback permission states in each supported browser/version.
- Test public-to-local and public-to-loopback requests separately, including private IPv4, IPv6 local/loopback and `.local` names where relevant.
- Test permission denial, revocation, insecure top-level contexts, embedded-frame Permissions Policy and worker-initiated requests.
- Test CORS response readability separately from whether a state-changing request was sent or processed.
- Test DNS rebinding, unexpected `Host` values, redirects and proxy resolution against local services.
- Test WebSocket, WebTransport, WebRTC and navigation behaviour only where the consuming browser/version claims support; record unsupported or unverified cases explicitly.
- Do not mark LNA/PNA protection as verified from a static configuration review alone. Record the browser, exact version, operating system, test origin, target address space, permission state and observed result.

**Primary sources checked 2026-11-20:**

- WICG, [Local Network Access specification](https://wicg.github.io/local-network-access/), Draft Community Group Report, 7 August 2026. This is a draft specification, not a W3C Recommendation.
- Chrome for Developers, [New permission prompt for Local Network Access](https://developer.chrome.com/blog/local-network-access), including the Chrome 142 launch and the move away from the paused legacy PNA preflight approach.
- Chrome for Developers, [Local Network Access implementation guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access), last updated 7 October 2026, covering secure contexts, granular permissions, address spaces, WebSocket/WebTransport behaviour and legacy-header guidance.
- Chrome for Developers, [Chrome 145 release notes](https://developer.chrome.com/release-notes/145), documenting the split from the legacy `local-network-access` permission into `local-network` and `loopback-network`.
- Chrome for Developers, [Chrome 147 release notes](https://developer.chrome.com/release-notes/147), documenting LNA restrictions for WebSockets and WebTransport. The same release notes separately describe the limited `WindowClient.navigate()` behaviour: the restriction applies to subframe navigations, not main-frame navigations.
- Chrome for Developers, [Chrome 147 beta announcement](https://developer.chrome.com/blog/chrome-147-beta), corroborating the WebSocket and WebTransport rollout.

**Version-scope caution:** These are Chromium/Chrome implementation statements, not a cross-browser guarantee. Verify the exact supported browser build, platform, API and enterprise-policy configuration in each consuming application.
