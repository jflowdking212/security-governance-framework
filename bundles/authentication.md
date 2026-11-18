# USS authentication bundle

Version: 1.0.0

Modules: M01, M02

Generated from manifest dependencies. Do not edit manually.


---

# M01 Engineering workflow and secure development

## Scope
Applies to all code, configuration, infrastructure, AI-assisted changes, reviews, and maintenance.

## Controls
- Treat AI-generated code, architecture, tests, and configuration as unverified until inspected and tested.
- Audit before repeatedly patching isolated symptoms. Maintain one remediation register and prioritise by exploitability, likelihood, impact, exposure, and dependencies, not recency or fix count.
- Preserve existing business behaviour unless a verified defect requires change. Identify destructive, migration-sensitive, and operationally risky work before implementation.
- Work only within explicitly authorised systems and environments.
- Use least privilege, secure defaults, explicit trust boundaries, defence in depth, and fail-closed behaviour for security-sensitive decisions.
- Do not use shortcuts that disable TLS, CSRF where applicable, authentication, authorisation, tenant isolation, validation, or release gates.
- Review sibling code paths when a systemic defect is found. Fix root causes and add regression tests.
- Separate prototype success from production engineering completeness.
- Preserve human approval for deployment, destructive migration, data deletion, credential rotation/revocation, paid services, and production policy changes.
- Every change must have an evidence trail and rollback/recovery consideration.

## Required workflow
1. Establish scope, authority, architecture, and environment.
2. Inspect existing code/configuration before changing it.
3. Identify applicable modules and resolve dependencies.
4. Record findings before remediation except for urgent containment of active P0 threats.
5. Make minimal, reviewable changes.
6. Run targeted regression and adversarial tests, then relevant project checks.
7. Reassess affected assurance layers and update finding statuses from evidence.
8. Report residual risk and unverified controls.

## Source basis
Global directive core persona/constraints; Sections 5, 13, 14, 19.1-19.7.


---

# M02 Authentication, identity and sessions

## Scope
Registration, login, logout, passwords, account recovery, MFA/2FA, OTP, invitations, token exchange, sessions, cookies, and identity-provider callbacks.

## Controls
- Hash passwords with a modern password KDF such as Argon2id or bcrypt at an appropriate work factor. Never store plaintext or reversibly encrypted passwords.
- Rate-limit and monitor login, password reset, OTP, MFA, invitation, and token-exchange flows. Apply backoff/lockout and replay protections appropriate to the flow.
- Use secure session lifecycle controls: issue, expire, invalidate, rotate, and revoke sessions after password, privilege, or critical account changes.
- Session cookies must use HttpOnly, Secure, and an appropriate SameSite policy. Avoid leaking tokens through URLs, query strings, logs, analytics, browser localStorage, or error reporting.
- Prefer HttpOnly cookie sessions over browser-stored bearer tokens where architecture permits. If bearer tokens are necessary, document threat model, storage, expiry, refresh, rotation, revocation, and XSS/CSRF implications.
- Recovery and MFA flows must not permit account takeover through weak identity proof, predictable codes, replay, enumeration, race conditions, or unbounded attempts.
- Verify identity-provider callback state, nonce, issuer, audience, redirect URI, and token signature/claims as applicable.
- Do not trust client-supplied user IDs, roles, verified flags, MFA status, or account state.
- Re-authenticate or require step-up verification for sensitive account/security changes where appropriate.
- Audit security-factor enrolment/removal, recovery, session revocation, privilege changes, and suspicious authentication events without logging secrets.

## Negative tests
Invalid credentials, expired/replayed OTP, missing/invalid MFA, session fixation, revoked session reuse, password reset token replay, user enumeration, brute-force attempts, forged identity claims, and privilege changes with stale sessions.

## Source basis
Global directive Section 1.B; APES Layer 1; Self-audit vectors 3, 4, 8, 11, 14-16.
