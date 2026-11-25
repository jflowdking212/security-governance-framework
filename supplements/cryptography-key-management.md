# Cryptography and key management supplement

**Status:** Supplemental implementation guidance  
**Applies to:** Encryption at rest, application-level encryption, token signing, certificates, key rotation, encrypted backups and cryptographic storage  
**Related modules:** M08, M09, M12  
**Reviewed:** 2026-11-18

## Design principles

- Start with a data and threat model. Identify what must be protected, from whom, in which environments and for how long.
- Prefer well-maintained platform and library implementations of established cryptographic protocols. Do not invent ciphers, modes, key derivation schemes or home-grown encryption formats.
- Use authenticated encryption for application data where encryption is required. Suitable modern choices include AES-GCM or ChaCha20-Poly1305 when supported by a maintained library and the deployment's cryptographic requirements.
- Ensure nonce/IV requirements are met for the selected algorithm. For AES-GCM, nonce uniqueness under a given key is a critical invariant. Do not generate nonces with timestamps or ad hoc counters unless the construction is formally safe for distributed concurrency.
- Separate encryption from password hashing. Passwords require a password hashing/KDF scheme, not reversible encryption.
- Use separate keys for separate purposes, environments and trust boundaries. Do not reuse one key for token signing, data encryption, password reset and unrelated services.
- Select algorithms and parameters according to current authoritative guidance, protocol compatibility and any required certification profile. Do not hard-code a universal cryptographic algorithm list into every project.

## Key hierarchy and storage

- Prefer a platform key-management service, HSM or protected key vault when the threat model and deployment support it.
- Keep key-encryption keys separate from data-encryption keys. Envelope encryption can use a key-encryption key to wrap independently generated data-encryption keys.
- Keep raw key material out of application source, client bundles, logs, build artefacts, container images and ordinary database rows.
- Restrict key-use permissions separately from key-administration permissions. An application that needs to encrypt data should not automatically be able to export or administer root keys.
- Use workload identity or short-lived scoped credentials to access key services where supported.
- Record key identifiers and algorithm/version metadata with ciphertext so rotation and decryption remain manageable. Never store the raw key beside the ciphertext.
- Define startup, outage, timeout, caching, recovery and break-glass behaviour for remote key services. A key-service outage must not trigger plaintext fallback or a default key.

## Rotation and recovery

- Define key creation, distribution, activation, use, monitoring, rotation, retirement, revocation and destruction procedures before production use.
- Support rotation without disabling verification or losing access to existing data. During a controlled overlap, new writes should use the active key while old keys remain available only for the documented decrypt/verify window.
- Test recovery of encrypted backups with the required historical key material. A backup that cannot be decrypted is not a recoverable backup.
- Rotate or revoke immediately when compromise is suspected, while preserving service continuity where safe and possible.
- Document how old ciphertext will be re-encrypted or how retired keys will remain available for a limited, justified recovery period.
- Make cryptographic agility possible. Plan how algorithms, formats, key sizes and provider integrations can be changed without data loss.

## Post-quantum planning

For systems with long confidentiality lifetimes or migration requirements, track current NIST post-quantum standards and provider/library support. ML-KEM is a key-encapsulation mechanism for establishing shared secrets; it does not replace symmetric encryption for stored application data. Do not deploy experimental or custom hybrid cryptography without a reviewed protocol and maintained implementation.

## Negative tests and evidence

- Tampered ciphertext, tag, nonce or key identifier is rejected without releasing plaintext.
- Nonce uniqueness is enforced for the selected algorithm and key scope.
- A key from another environment or purpose cannot decrypt or sign the data.
- Missing, unavailable, revoked or malformed key material fails closed.
- Rotation preserves access to the intended historical data and new writes use the active key.
- Retired or revoked credentials fail as expected.
- Encrypted backups can be restored using documented key recovery procedures.
- Logs and error responses do not reveal plaintext, raw keys or sensitive cryptographic internals.

## Primary references

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [NIST FIPS 203: ML-KEM](https://csrc.nist.gov/pubs/fips/203/final)

Review the current errata and algorithm-specific usage limits before selecting parameters.
