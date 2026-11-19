# React and TypeScript reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Single-Page Applications (SPAs) and component frontends using React 18/19 with TypeScript  
**Related modules:** M01, M02, M03, M04, M05, M09, M12, M21  
**Companion supplements:** API protocol security; authentication and federation; data lifecycle and privacy  

This profile specifies client-side security architecture and verification standards for React and TypeScript applications. Client-side controls provide user experience and early validation, but can never replace authoritative server-side security checks.

## DOM security and client rendering

- Avoid `dangerouslySetInnerHTML`. If rendering user-supplied HTML is strictly necessary, sanitize it through DOMPurify with an explicit element and attribute allowlist.
- Prevent URL pseudoprotocol injection by validating dynamic href links and redirection targets against strict schemes (`https:`, `mailto:`, relative path). Reject `javascript:` and data URIs.
- Enforce `rel="noopener noreferrer"` on all external links opening in new browsing contexts (`target="_blank"`) to mitigate window opener manipulation.
- Set a strict Content Security Policy (CSP) at the web server/CDN layer: restrict `script-src` without `unsafe-inline` or `unsafe-eval`, define explicit `connect-src` API origins, and prohibit embedding via `frame-ancestors 'none'` or specific origins.

## Authentication, sessions and token management

- Prefer HttpOnly, Secure, SameSite cookies for session management to eliminate JavaScript token exposure to Cross-Site Scripting (XSS).
- If Bearer tokens must be handled in client JavaScript, store short-lived access tokens in memory and use silent refresh mechanisms backed by HttpOnly refresh cookies.
- Prohibit storing persistent refresh tokens, client secrets, or sensitive passwords in browser `localStorage` or `sessionStorage` (which are accessible to any script running in the application origin).
- Implement proactive session expiry timers and prompt re-authentication before clearing sensitive views or submitting critical changes.

## Tenant isolation and client authorisation boundaries

- Client-side route guards, permission hooks, and conditionally hidden UI components are user experience aids only. All tenant isolation, role checks, and object access authorization MUST be enforced authoritatively by the backend API.
- Ensure tenant context is bound to the server-verified session, not editable or spoofable via client-side state, URL parameters, or local storage.
- When rendering multi-tenant data, verify that shared caching (e.g. React Query or SWR caches) does not leak records across tenant context switches.

## Input validation and API transport security

- Use runtime schema validation (e.g. Zod, Yup) on client forms and on incoming API responses to enforce contract integrity and reject unexpected payload formats.
- Enforce HTTPS for all backend API communication. Reject insecure HTTP fallback.
- Mask sensitive form inputs (passwords, PINs, cardholder details) using appropriate input types (`type="password"`) and suppress sensitive field logging in frontend analytics or error monitoring tools (e.g. Sentry).

## Environment variables, secrets and build hygiene

- Never embed backend secret keys, private API credentials, or database passwords in client environment variables (e.g. `VITE_*` or `REACT_APP_*`). Any variable bundled into client bundles is publicly readable by anyone inspecting JavaScript assets.
- Disable production source map deployment to public CDN origins or restrict source maps to internal debugging and error tracking systems.
- Pin frontend dependencies in `package-lock.json` and run `npm audit` or automated supply-chain scanners in CI.
