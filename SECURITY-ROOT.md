# USS trust root and integrity model

**Status:** Trust model documented; independent release signing and repository protection are not yet configured or verified.  
**Applies to:** USS source, modules, supplements, tools, adapters, CI workflows and consuming repositories.

## 1. The self-trust limitation

USS cannot authenticate itself.

A validator, checksum file, README, policy module, workflow or test stored in the same repository cannot independently prove that the repository has not been maliciously changed. An attacker who can change the policy may also change the validator and its tests.

A green CI run proves only that the checked-out revision passed the configured checks. It does not prove that the revision is authentic, that the checks are complete, or that the policy source was not compromised before the run.

Do not describe source/archive equality, generated-file checks, SHA-256 hashes stored beside the files they describe, or passing tests as a cryptographic trust root.

## 2. Required external trust anchors

A consuming project must establish trust independently of the USS checkout:

1. **Pin the exact full commit SHA.** Store the approved USS version and commit in the consuming repository, deployment configuration or another independently controlled source of truth.
2. **Obtain the expected SHA through a trusted channel.** Do not select a new SHA merely because it is currently at the repository main branch or appears in its own README.
3. **Review updates as dependency changes.** Compare the pinned commit with the proposed commit and inspect policy, source, tooling, workflow and dependency changes.
4. **Protect the consuming pin.** Require review from the consuming project's authorised maintainers before changing its expected USS SHA.
5. **Vendor the reviewed copy.** Agents must read the pinned local copy, not download mutable policy at task runtime.
6. **Verify release signatures when configured.** A signed tag or signed release artefact is useful only when the signer identity and verification key are independently trusted and the verification is actually performed.

## 3. Release-signing state

No trusted signing identity, public-key fingerprint, Sigstore certificate identity or signed v1.0.0 release has been established in this repository's current configuration.

Therefore:
- Do not claim that the current candidate is cryptographically signed or independently authenticated.
- Do not invent a signing identity or public key.
- Before a signed release is claimed, the owner must choose and protect a signing identity, publish its verification identity through an independent channel, sign the exact release tag or artefact, and document a reproducible verification command.
- A GitHub Verified label, a branch name, a release asset or a checksum file is not by itself a substitute for an independently trusted signer identity.

## 4. Repository control plane

The following controls require repository-owner configuration and cannot be established by a Markdown policy or the USS validator:

- Protect the default branch against direct and force pushes.
- Require pull requests and at least one authorised human review.
- Require the USS validation workflow and any additional security checks before merge.
- Dismiss stale approvals when the reviewed commit changes.
- Require CODEOWNERS review for policy sources, modules, resolver/validator tools and workflow files.
- Require 2FA for maintainers and minimise administrator access.
- Restrict workflow permissions and protect release/tag creation.
- Enable secret scanning and dependency/security alerts where available.

**Verified on 2026-11-18:** the GitHub API reports main as unprotected, branch-protection enforcement disabled and no repository rulesets. These controls are therefore NOT CONFIGURED at the time of inspection. The owner must configure and verify them directly in repository settings.

## 5. Consumer bootstrap procedure

Before using a new USS revision:

1. Read the approved version and full commit SHA from the consuming project's independently protected pin.
2. Fetch that exact commit, not a moving branch.
3. Confirm the fetched commit SHA matches the pin exactly.
4. Review the diff from the previously approved commit, including canonical sources, generated modules, supplements, tools, adapters and workflows.
5. If a trusted signature is configured, verify the tag or release artefact against the independently published signer identity.
6. Vendor the exact reviewed revision and record the pin in the .uss-version file.
7. Run the local validation and evidence tools from that pinned copy.
8. Record the pinned SHA in the security assessment and release evidence.

If the pin, signer identity or expected revision cannot be independently confirmed, stop and mark the USS dependency NOT VERIFIED. Do not silently fall back to the main branch.

## 6. What USS checks can and cannot prove

| Check | What it can establish | What it cannot establish by itself |
|---|---|---|
| Source/archive equality | The checked-in archive matches the checked-in root source | Authenticity of either copy |
| Module regeneration | Generated modules match the checked-in source and generator | That the source or generator is trustworthy |
| Resolver and policy tests | Tested routing and invariants behave as expected | Absence of all routing or policy defects |
| Evidence validator | Submitted evidence records follow the declared schema and gate logic | Truth or completeness of the underlying evidence |
| GitHub Actions | A specific revision passed configured workflow steps | Authenticity of the revision or adequacy of all checks |
| External commit pin | The consumer expects one exact repository revision | That the initial pin was obtained through a trusted channel |
| Independently verified signature | The signed artefact was signed by the trusted identity | That the signed content is secure or correct |

## 7. Current release blockers

The v1.0.0 candidate remains under correction and owner review. The repository has not yet established:
- a signed release tag or artefact with an independently published signer identity;
- verified branch protection and required human-review rules;
- an owner-approved software licence.

These are distinct decisions. Passing technical validation does not silently resolve them.
