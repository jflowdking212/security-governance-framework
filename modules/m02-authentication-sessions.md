# M02 Authentication, identity and sessions

**Source sections:** GLOBAL:1.B authentication, GLOBAL:3:Layer1  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### B. Authentication, Authorization & Session Management**

\- **\*\*Cryptographic Storage:\*\*** Passwords must be hashed using modern password hashing/KDFs such as Argon2id or bcrypt with an appropriate work factor. Never store plain-text or reversibly encrypted passwords.


\- **\*\*Session Tokens & Cookies:\*\***

  - Enforce \`HttpOnly\`, \`Secure\`, and an appropriate \`SameSite\` policy on authentication/session cookies.

  - Prevent sensitive session tokens from leaking via URLs, query strings, logs, analytics, browser \`localStorage\`, or front-end error reporting where XSS can compromise them.

  - Prefer HttpOnly cookie sessions over browser-stored bearer tokens when architecture permits.

  - Rotate or invalidate sessions when privilege, password, or critical account state changes.


\- **\*\*Authentication Abuse Controls:\*\*** Apply rate limiting, lockout/backoff, replay protection, and monitoring to login, reset, OTP, MFA, invite, and token-exchange endpoints.

**### Layer 1 — Identity & Session Security**



Review registration, login, logout, password reset, MFA/2FA readiness, password hashing, account recovery, session issuance/expiration/invalidation/rotation, cookie security, bearer-token exposure, brute-force/credential-stuffing controls, OTP/reset abuse, and stale sessions after privilege/account changes.
