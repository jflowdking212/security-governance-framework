# Owner actions required before USS v1.0.0 release

These items track repository-owner and rights-holder governance decisions.

## 1. Protect the default branch

**Status: COMPLETED**  
**Observed state:** GitHub ruleset `Protect Main` (ruleset ID `27612394`) is active on `~DEFAULT_BRANCH` (`main`).
Enforced rules:
- Requires pull requests for changes to `main`.
- Requires conversation resolution before merge.
- Requires linear history.
- Blocks force pushes (`non_fast_forward`).
- Blocks branch deletion (`deletion`).
- Enforces CODEOWNERS review for canonical directives, generated modules, resolver/validator tools, workflows, supplements, and stack profiles.

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

## Release rule

All foundational owner governance actions are complete. USS v1.0.0 is technically validated and ready for independent review by Claude and personal release signing by the owner.
