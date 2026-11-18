# M08 Secrets, keys and credential lifecycle

## Controls
- Never commit passwords, API keys, webhook signing secrets, private keys, access tokens, database credentials, or production configuration secrets.
- Keep secrets server-side and out of client bundles, URLs, query strings, logs, analytics, error reporting, source maps, build artifacts, and support exports.
- Use least-privilege credentials, environment separation, scoped access, revocation, rotation, and auditability.
- Treat real credentials found in source control or history as compromised. Remove exposure and rotate/revoke through an authorised incident process; deleting the visible file alone is insufficient.
- Fail closed when required production secrets are missing, empty, malformed, placeholder, or wrong-environment.
- Do not introduce a central secret manager or automated rotation service as an unverified runtime dependency. Justify availability, access, recovery, cost, and outage behaviour.
- Rotate secrets safely with documented overlap windows where providers support them. Remove expired credentials promptly.
- Never log secret values. Log secret access/rotation events with safe metadata where supported.
- Keep development, test, staging, and production credentials distinct.

## Verification
Scan current files, relevant Git history, client bundles, logs, build artifacts, CI variables and configuration. Verify access scope, rotation/revocation procedures, and environment isolation.

## Source basis
Global directive Sections 1.F, 17; APES Layers 4, 8, 9, 10; payment supplement A5, A15.
