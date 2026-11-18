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
