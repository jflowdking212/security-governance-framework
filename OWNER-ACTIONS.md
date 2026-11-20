# Owner actions required before USS v1.0.0 release

These items track repository-owner and rights-holder governance decisions.

## 1. Protect the default branch

**Status: COMPLETED**  
**Observed state:** GitHub ruleset `Protect Main` (ruleset ID `27612394`) is active on `~DEFAULT_BRANCH` (`main`).
Enforced rules:
- Requires pull requests for changes to `main`.
- Requires review thread resolution before merge (`required_review_thread_resolution: true`).
- Blocks force pushes (`non_fast_forward`).
- Blocks branch deletion (`deletion`).

Rules not configured in the active ruleset:
- Linear history is not required (`allowed_merge_methods` permits `merge`, `squash`, and `rebase`).
- CODEOWNERS approval is not enforced (`require_code_owner_review: false`, `required_approving_review_count: 0`), preserving single-owner operations without self-blocking.
- Required status checks are not currently configured (see Section 7 for owner option).

## 2. Enable dependency graph access and scanner execution

**Status: COMPLETED**  
**Observed state:** Dependency graph is enabled on the repository.
- A pinned `package.json` and `package-lock.json` for `yaml@2.9.1` has been committed, resolving the previous empty-lockfile concern with zero OSV vulnerabilities verified against the OSV API.
- Continuous security scanning workflows are operational: Gitleaks full-history scanning, Semgrep SAST (pinned by immutable SHA256 digest `semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493`), CodeQL, and OSV-Scanner.

## 3. Choose a software licence

**Status: COMPLETED**  
**Observed state:** Personal Non-Commercial Use Licence (PNCUL 1.0) was selected and published in `LICENSE` (PR #4).
- The repository owner (Jude O. Richard / Jay Bliss Tech Limited) has explicitly confirmed authorization for commercial use of his original USS intellectual property in his own commercial applications, including Choir SaaS.
- The licence remains strictly unmodified during this engineering assignment.

## 4. Establish release signing

**Status: COMPLETED**  
**Observed state:** Owner SSH release-signing identity is established and published in `SECURITY-ROOT.md`, `SECURITY-ROOT.pub`, and `.security/allowed_signers`.
- Signing identity: `jude_m2003@yahoo.com`
- Public key fingerprint: `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`
- Deterministic checksum and signature verification tooling is implemented in `tools/checksums.mjs`, supporting both Git working trees and extracted release archives.
- Final release tag `v1.0.0` and SHA256SUMS.sig will be signed by the owner personally before publication.

## 5. Repository naming decision

**Status: COMPLETED**  
**Observed state:** The repository has been renamed from `seurity-layer` to `security-governance-framework`.
- Authoritative URL: `https://github.com/jflowdking212/security-governance-framework`
- All documentation, clone commands, and consuming references have been updated.

## 6. Release signing ceremony (U-01)

**Status: PENDING OWNER EXECUTION**  
The release candidate `v1.0.0-rc.1` is fully implemented and tested. To finalize the official `v1.0.0` release:
1. Merge the remediation PR into `integration/uss-pr3-pr8-hardening`.
2. Fast-forward merge `integration/uss-pr3-pr8-hardening` into `main` after owner review.
3. On the owner's workstation (where the private SSH key resides):
   ```sh
   git checkout main
   git pull origin main
   node tools/checksums.mjs create
   ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS SHA256SUMS
   git add SHA256SUMS SHA256SUMS.sig
   git commit -S -m "release: Universal Security Standard v1.0.0"
   git tag -s -m "Universal Security Standard v1.0.0" v1.0.0
   git push origin main v1.0.0
   ```
4. Verify the published release commit and tag on GitHub.

## 7. Main branch required status checks (U-08)

**Status: OWNER DECISION RECORDED**  
- The active `Protect Main` ruleset (ID `27612394`) enforces pull requests, conversation resolution, and blocks force pushes and deletion.
- In accordance with the owner's directive, mandatory second-person approval remains disabled.
- Once hosted GitHub Actions runners are confirmed active and the workflow name `USS validation` is verified in GitHub checks, the owner can optionally add `USS validation` as a required status check in `Protect Main` ruleset.
- No repository settings were modified by engineering agents.

## Release rule

The `v1.0.0-rc.1` implementation candidate has passed its current hosted CI checks, including 136 automated tests and the configured security scans. Claude's second independent audit is still pending. This candidate is not a final release. The U-01 signing ceremony remains owner-only, and the U-08 required-status-check decision remains with the owner.
