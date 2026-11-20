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
The release candidate `v1.0.0-rc.1` is not yet release-ready. Claude's second independent audit on 2026-11-20 identified findings A2-02 through A2-12 with different dispositions. The follow-up implementation record is maintained in `REVIEW-CORRECTION-LOG.md`. As of the current remediation work: A2-03 checksum code/tests and A2-09 checksum documentation have owner-issued updates; A2-04 README status and A2-10 collaboration protocol have been corrected; Gemini has implemented A2-02/A2-07 on commit `33186db096265b1affe908931132dfefa1a5f646` with hosted checks passing on that SHA. These are not independently closed until the current combined head passes CI and the assigned independent reviews are complete. Claude's A2-06/A2-11/A2-12 implementation handback is still pending. A2-08 remains an owner identity/provenance decision because the connected bot account is read-only. A2-05 ruleset evidence is verified. Resolve all remaining work and independently verify the follow-up changes before beginning the owner signing ceremony. To finalize the official `v1.0.0` release:
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

The `v1.0.0-rc.1` candidate is NOT APPROVED FOR RELEASE and is not a final release. Gemini's A2-02/A2-07 commit `33186db096265b1affe908931132dfefa1a5f646` passed its configured hosted validation and security scans. At head `a52b22e337a3fc44f5cb0931004e63c1a2f77068`, hosted USS validation run `44714438971` passed 155/155 tests and security-scans run `44714439491` completed successfully. All 7 reported check runs passed: Gitleaks reported no leaks, Semgrep scanned 26 tracked files with 237 rules and no skipped files/findings, CodeQL scanned 18/18 JavaScript files and 2/2 GitHub Actions files, and OSV scanned one package with no issues. This green run does not close the remaining A2-02/A2-07 mutation gaps found in supervisory review, nor the pending Claude A2-06/A2-11/A2-12 handback. The candidate remains blocked pending those corrections and independent review. A2-03/A2-09/A2-04/A2-10 owner-issued follow-up changes remain subject to current-head CI and independent cross-review. Claude's A2-06/A2-11/A2-12 implementation and independent follow-up review remain pending. The U-01 signing ceremony remains owner-only, and the U-08 required-status-check decision remains with the owner.
