# USS release trust root

**Status:** The owner's public verification key and SSH allowed-signers entry are published. GitHub verified the signed key-publication commit `4f05a3e730aa8491795a6d9cff179ff58219fcb6`. The signed SHA-256 release manifest and signed v1.0.0 release tag remain pending.

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

The fingerprint was obtained locally with `ssh-keygen -lf`. The key successfully produced GitHub-verified commit `cead9b6ebb6c904d71604134535083d89f0e8c75`. The owner subsequently published the public key and allowed-signers entry in signed commit `4f05a3e730aa8491795a6d9cff179ff58219fcb6`; GitHub verified that commit, and the owner locally verified it with `git verify-commit` using `.security/allowed_signers`. This proves the commit signature validates against the published key. It is **not** a signed USS release tag and does not complete release verification.

The corresponding raw public key is stored as `SECURITY-ROOT.pub`. The SSH allowed-signers entry is stored as `.security/allowed_signers` in this form:

```text
jude_m2003@yahoo.com namespaces="git,USS-SHA256SUMS" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA2fInUDvAZFW5E8KuFh6YsjBuqHaz8wBsujComEYF71
```

The `namespaces` directive restricts key validity strictly to `git` (for commit and tag verification) and `USS-SHA256SUMS` (for release checksum manifests), enforcing signature domain separation and preventing cross-protocol signature reuse.

Both files are public verification material. Never store the private key or its passphrase in this repository.

## Limits of repository self-validation

A repository cannot authenticate its own trust instructions merely by storing them beside the files they protect:

1. **Self-referential validation is circular.** An attacker who can modify repository files can modify both the policy and the validation scripts that assert the policy is intact.
2. **Local tools authenticate consistency, not authority.** Running `node tools/validate.mjs` proves that the repository's modules match its own generator, manifest and tests. It does not prove that the generator, manifest or tests are genuine or uncompromised.
3. **In-repo trust markers cannot bootstrap trust.** Storing a public key, allowed-signers file or hash list in the repository proves only that those files exist in that commit. Without independent verification of the signing identity from an out-of-band channel, a repository cannot authenticate itself.

## Principles of external trust

1. **Root of trust must be external.** The authoritative instruction to use USS, the expected repository URL, the expected commit SHA, and the signing identity's public-key fingerprint must be delivered through an independent, trusted channel outside this repository.
2. **Pin the full commit SHA, never a mutable branch or unannotated tag.** A branch reference (`main`) or mutable tag can be pointed to arbitrary commits without warning. Consuming projects must pin an immutable 40-character commit SHA in their `.uss-version` file.
3. **Cryptographic verification requires an independently trusted key.** A signature proves only that the signer possessed the private key corresponding to the public key used for verification. It is meaningful only if the verifier independently trusts that specific public key.
4. **Protect the consuming project's pin.** Require review from the consuming project's authorised maintainers before changing its expected USS SHA or signing fingerprint.
5. **Vendor the reviewed copy.** Agents must read the pinned local copy, not download mutable policy at task runtime.
6. **Verify release signatures.** Verify the detached signature on `SHA256SUMS` and verify every file digest before relying on repository policy.

## What USS checks can and cannot prove

| Check | What it can establish | What it cannot establish by itself |
|---|---|---|
| Source/archive equality | The checked-in archive matches the checked-in root source | Authenticity of either copy |
| Module regeneration | Generated modules match the checked-in source and generator | That the source or generator is trustworthy |
| Resolver and policy tests | Tested routing and invariants behave as expected | Absence of all routing or policy defects |
| Evidence validator | Submitted evidence records follow the declared schema and gate logic | Truth or completeness of the underlying evidence |
| GitHub Actions | A specific revision passed configured workflow steps | Authenticity of the revision or adequacy of all checks |
| External commit pin | The consumer expects one exact repository revision | That the initial pin was obtained through a trusted channel |
| Independently verified signature | The signed artefact was signed by the trusted identity | That the signed content is secure or correct |

## Trust-bootstrap rule

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

The checksum tool supports repository checkouts, vendored subdirectories (`--root vendor/uss`), extracted release snapshots and generated bundle directories:

```sh
node tools/checksums.mjs verify
node tools/checksums.mjs verify --root vendor/uss
node tools/checksums.mjs create --root dist/bundles --filesystem
ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS dist/bundles/SHA256SUMS
ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s dist/bundles/SHA256SUMS.sig < dist/bundles/SHA256SUMS
node tools/checksums.mjs verify --root dist/bundles --filesystem
```

In Git mode, the tool hashes committed Git blob bytes from `HEAD`, not the platform-dependent working-tree representation, so Windows CRLF checkout settings do not change the digest. The repository must be clean and all release files must already be committed before creating the source manifest.

The `--filesystem` mode is for generated artifacts such as `dist/bundles/`, which are intentionally not Git-tracked. It hashes every regular file in the selected directory. The signature must be verified separately before trusting the checksum file.

### Owner workstation test evidence (2026-11-19)

The owner tested this workflow against a disposable `dist/p1-4-sign-test/` directory on Windows PowerShell. Manifest creation succeeded; `ssh-keygen -Y sign` created a detached signature in namespace `USS-SHA256SUMS`; verification using the published `.security/allowed_signers` succeeded; checksum verification succeeded. After modifying the sample file, verification failed with `SHA-256 mismatch: sample.txt`. After appending a forged entry to the manifest, SSH verification failed with `incorrect signature`; restoring the original manifest made signature verification succeed again. This validates the tested signing and tamper-detection path. It does not replace final source/bundle manifests, signed release commit/tag verification, or hosted CI.

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

## Repository control plane

The following controls require repository-owner configuration and cannot be established by Markdown policy or local validation tools:

- Protect the default branch against direct and force pushes (enforced by the active `Protect Main` ruleset on `main`).
- Require pull requests for updates to `main` (enforced by `Protect Main`).
- Require conversation resolution for pull requests before merge (enforced by `Protect Main`).
- Require the USS validation workflow and security status checks once hosted CI is confirmed.
- Require CODEOWNERS review for policy sources, modules, resolver/validator tools, release-integrity and workflow files.
- Require 2FA for maintainers and minimise administrator access.
- Restrict workflow permissions to least privilege (`contents: read` default).
- Enable secret scanning and dependency/security alerts.

### Pinned scanner and CI action provenance

All actions and reusable workflows in `.github/workflows/` are pinned to immutable 40-character commit SHAs or container image digests. Their provenance is verified against upstream canonical sources:
- `google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@d3c1414ded37de590f207572e37a7d180f1d0ef7`: verified as official commit on `google/osv-scanner-action` main branch (reviewed 2026-11-11).
- `actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803`: official release commit for GitHub Checkout action.
- `actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38`: official release commit for Node.js setup action.
- `gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`: official release commit for Gitleaks action.
- `github/codeql-action/init@33d7b85da1a04171e211befe2c739303b9a4c066` and `analyze@33d7b85da1a04171e211befe2c739303b9a4c066`: official CodeQL v4.39.3 action commits.
- `semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493`: official Semgrep immutable image digest.

## Release signing procedure

For each official release:

1. Complete the full release checklist and resolve all P0/P1 findings.
2. Generate `SHA256SUMS` from the exact release candidate commit and sign it with the owner's SSH key.
3. Build the task bundles and create a separate manifest for `dist/bundles/` with `node tools/checksums.mjs create --root dist/bundles --filesystem`; sign and verify that manifest too.
4. Commit the source manifest and detached signature. Sign the release commit.
5. Create an annotated, signed version tag with `git tag -s`.
6. Push the tag and publish the release from that exact tag.
7. Independently verify the GitHub commit/tag signature, the trusted fingerprint, both checksum-manifest signatures and every listed file digest.
8. Attach the compiled task bundles, their signed manifest and verification evidence to the release.

No release is trusted solely because it is published from `main`, carries a version label or passes CI.

## Key custody, rotation and incident response

- The private key remains on the owner's trusted workstation and is protected by its passphrase.
- Never share the private key or passphrase with Claude, Gemini, ChatGPT, CI or another developer.
- Keep an encrypted, access-controlled backup if the owner chooses to maintain one.
- If the key is lost or suspected compromised, stop issuing releases, revoke the key in GitHub, generate a replacement, publish the new fingerprint through an independently trusted channel, and re-establish the trust root before the next release.
- Do not silently replace the fingerprint or accept an unexpected signing identity.
