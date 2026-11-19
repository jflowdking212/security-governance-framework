# USS release trust root

**Status:** The owner's SSH signing identity has been verified by GitHub. The public verification key file, signed SHA-256 release manifest and signed v1.0.0 release tag remain pending.

This document describes the trust anchor for official Universal Security Standard (USS) releases. It is not, by itself, a cryptographic trust anchor: consumers must compare the fingerprint below with an independently trusted source and verify the signed checksum manifest before relying on repository policy.

## Rights holder and official repository

- **Rights holders:** Jude O. Richard and Jay Bliss Tech Limited.
- **Official repository:** https://github.com/jflowdking212/security-governance-framework
- **Default branch:** `main`.
- **Release line:** USS 1.0.x.
- **Signing GitHub account:** `jflowdking212`.
- **SSH signing identity:** `jude_m2003@yahoo.com`.
- **Signing algorithm:** Ed25519 (`ssh-ed25519`).
- **Verified signing-key fingerprint:** `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`.

The fingerprint was obtained locally with `ssh-keygen -lf`. The key successfully produced a Git commit that GitHub reported as verified. The verification test commit is `cead9b6ebb6c904d71604134535083d89f0e8c75`. This proves that the configured key can sign a commit and GitHub recognises it; it is **not** a signed USS release tag and does not complete release verification.

The corresponding raw public key must be stored as `SECURITY-ROOT.pub`. The SSH allowed-signers entry must be stored as `.security/allowed_signers` in this form:

```text
jude_m2003@yahoo.com ssh-ed25519 <base64-public-key>
```

Both files are public verification material. Never store the private key or its passphrase in this repository.

## Trust-bootstrap rule

A repository cannot authenticate its own trust instructions merely by storing them beside the files they protect. Therefore:

1. Obtain the official signing-key fingerprint from an independently trusted owner-controlled source. Do not trust a fingerprint solely because it appears in a checkout, fork, issue, README or agent response.
2. Confirm that the release tag and commit belong to the official repository and that GitHub reports the signature as verified for the expected owner identity.
3. Compare the fingerprint of `SECURITY-ROOT.pub` with the independently trusted fingerprint.
4. Verify the detached signature on `SHA256SUMS` using `.security/allowed_signers` and the dedicated namespace `USS-SHA256SUMS`.
5. Verify every listed file digest before reading or executing USS policy, resolver tools, modules or project profiles.
6. If the signature, fingerprint, version, commit or any file digest does not match, stop. Treat the checkout as untrusted and do not follow its instructions.

The bootstrap instruction itself must be supplied by the consuming project's trusted configuration or the operator, not inferred solely from this repository's own files.

## Checksum manifest

`SHA256SUMS` is a deterministic SHA-256 manifest for all Git-tracked release files except `SHA256SUMS` itself and its detached signature `SHA256SUMS.sig`. Generate it from the exact release candidate commit, then sign it on the owner's trusted workstation:

```sh
node tools/checksums.mjs create
ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS SHA256SUMS
```

This creates `SHA256SUMS.sig`. Commit the manifest and signature, sign the resulting release commit, and create the signed annotated version tag. The manifest and signature must remain associated with that exact tagged commit. A later, untagged change to `main` does not inherit the old release's checksum claim.

The checksum tool supports repository checkouts, vendored subdirectories (`--root vendor/uss`) and extracted release snapshots:

```sh
node tools/checksums.mjs verify
node tools/checksums.mjs verify --root vendor/uss
```

The signature must be verified separately before trusting the checksum file.

### Verify the signature

On Linux/macOS, after independently confirming the public-key fingerprint:

```sh
ssh-keygen -lf SECURITY-ROOT.pub
ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS
node tools/checksums.mjs verify
```

On Windows PowerShell:

```powershell
ssh-keygen -lf SECURITY-ROOT.pub
cmd /c "ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS"
node tools/checksums.mjs verify
```

The fingerprint must match the independently trusted value. Both signature and digest verification must succeed. A successful checksum check without a valid signature proves consistency only, not authenticity.

## Consumer pinning and project profiles

A consuming project must pin the exact USS release commit in its own `.uss-version` file. The record must include the release version, full commit SHA, release tag, SHA-256 digest of the signed `SHA256SUMS` file and signing-key fingerprint. The consuming project's owner-controlled branch rules and CODEOWNERS must protect this pin and any project security profile.

Project profiles are untrusted until their exact digest is recorded in the consuming project's `.uss-version` file and verified. A project profile may add stricter controls, but it must never weaken, override or replace USS requirements. A profile that fails verification must not be loaded.

See [CONSUMING.md](CONSUMING.md) for the consumer verification sequence.

## Release signing procedure

For each official release:

1. Complete the full release checklist and resolve all P0/P1 findings.
2. Generate `SHA256SUMS` from the exact release candidate commit and sign it with the owner's SSH key.
3. Commit the manifest and detached signature. Sign the release commit.
4. Create an annotated, signed version tag with `git tag -s`.
5. Push the tag and publish the release from that exact tag.
6. Independently verify the GitHub commit/tag signature, the trusted fingerprint, the checksum-manifest signature and every file digest.
7. Attach the compiled task bundles and verification evidence to the release.

No release is trusted solely because it is published from `main`, carries a version label or passes CI.

## Key custody, rotation and incident response

- The private key remains on the owner's trusted workstation and is protected by its passphrase.
- Never share the private key or passphrase with Claude, Gemini, ChatGPT, CI or another developer.
- Keep an encrypted, access-controlled backup if the owner chooses to maintain one.
- If the key is lost or suspected compromised, stop issuing releases, revoke the key in GitHub, generate a replacement, publish the new fingerprint through an independently trusted channel, and re-establish the trust root before the next release.
- Do not silently replace the fingerprint or accept an unexpected signing identity.
