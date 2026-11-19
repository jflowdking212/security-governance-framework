# Authentication and federation supplement

**Status:** Supplemental implementation guidance  
**Applies to:** OAuth 2.0, OpenID Connect, JWT, browser and native clients, refresh-token systems, passkeys and MFA  
**Related modules:** M02, M03, M08  
**Reviewed:** 2026-11-18

This supplement adds protocol-level implementation checks to M02. It does not prescribe a single identity provider or token architecture.

## OAuth 2.0 and OpenID Connect

- Use Authorization Code flow with PKCE for public clients. Use PKCE for confidential clients where supported and appropriate.
- Use the S256 PKCE challenge method. Bind the verifier, state and OIDC nonce to the individual authorization transaction. Do not reuse them across login attempts.
- Register exact redirect URIs and compare them exactly. Do not accept arbitrary redirect destinations or wildcard patterns that permit attacker-controlled hosts.
- Do not use the Implicit grant or Resource Owner Password Credentials grant for new deployments. Migrate legacy use through a planned compatibility change.
- Use OpenID Connect when the requirement is user authentication. Do not treat an OAuth access token as an identity assertion unless the provider's documented protocol explicitly defines that use.
- Validate the authorization response, issuer, audience, signature, nonce, state, expiry and the expected client. Reject issuer mix-ups and tokens from an untrusted authorization server.
- Obtain authorization-server metadata and signing keys only from a preconfigured trusted issuer. Do not follow token-supplied key URLs or metadata locations without an explicit trust policy.
- Keep client secrets out of public clients, mobile binaries, browser bundles and source control. Public clients cannot safely keep a shared secret.

## JWT validation

- Use a maintained JWT/JWS library. Configure an explicit algorithm allowlist for each token type. Never select an algorithm solely from an untrusted token header.
- Bind each verification key to one expected algorithm and intended use. Reject algorithm/key-type confusion and unexpected key identifiers.
- Validate signature, issuer, audience, subject, expiry and not-before claims as applicable to the token profile. Enforce a small, documented clock-skew allowance.
- Use mutually exclusive validation rules for access tokens, ID tokens, password-reset tokens, email-verification tokens and other token classes. Require explicit token typing or distinct audiences/issuers/keys where appropriate.
- Validate key identifiers as data. Never concatenate them into SQL, LDAP or filesystem paths.
- Do not blindly dereference jku or x5u headers. If remote key retrieval is part of a protocol, restrict it to the configured trusted issuer's metadata and JWKS endpoint.
- Reject unsigned or unsecured tokens unless a specific protocol profile explicitly requires them and an independent protection mechanism is documented. Do not introduce a general-purpose acceptance fallback.
- Do not put passwords, payment credentials or unnecessary personal data in JWT claims. A signed token is not confidential unless it is separately encrypted.
- Keep signing keys separate from unrelated encryption keys and rotate them using a planned overlap and verification procedure.

## Access and refresh tokens

- Keep access tokens short-lived according to the application's risk and usability requirements. Enforce audience and scope at the resource server, not only at the client.
- For public clients, use refresh-token rotation with reuse detection or sender-constrained refresh tokens where the authorization server supports it.
- Treat refresh-token reuse as a possible compromise signal. Revoke the affected token family or session according to the provider's documented semantics.
- Where supported and justified, sender-constrain access tokens with DPoP or mutual TLS. Do not claim sender constraint merely because a token is signed.
- Keep bearer tokens out of URLs, browser local storage where a safer architecture is available, analytics, crash reports and logs.
- Design logout, account disablement, password reset, privilege changes and suspected compromise to invalidate or constrain existing sessions and refresh credentials.

## MFA and account recovery

- Prefer phishing-resistant authenticators such as passkeys/WebAuthn for administrators and other high-impact accounts where the client ecosystem supports them.
- Treat MFA enrollment, replacement, recovery and removal as security-sensitive operations. Require recent re-authentication or step-up authentication and notify the account holder.
- Store recovery codes as one-time secrets, display them once, and store only protected verifiers. Invalidate a code immediately after use.
- Rate-limit OTP and recovery attempts, bind codes to the correct account and transaction, enforce expiry, and prevent replay.
- Do not treat SMS as phishing-resistant MFA. Assess SIM-swap, number-reassignment and interception risks before using it for high-impact actions.
- Avoid security questions as a sole recovery factor. Recovery must not be weaker than the account it protects.

## Required negative tests

- Wrong issuer, audience, signature, algorithm, key type, token type, nonce or client must be rejected.
- Expired, not-yet-valid, malformed and replayed tokens must be rejected.
- An authorization code must not be reusable or redeemable by a different client or transaction.
- Redirect URI mismatch, missing PKCE verifier, incorrect state and OIDC nonce mismatch must fail.
- Refresh-token reuse must trigger the documented replay response.
- MFA recovery codes must be single-use; expired and guessed codes must fail under rate limits.
- A disabled user or revoked session must not continue to perform protected actions.

## Primary references

- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
- [NIST SP 800-63B-4: Authentication and Authenticator Management](https://csrc.nist.gov/pubs/sp/800/63/b/4/final)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

Check current errata, provider documentation and applicable assurance requirements before implementation.
