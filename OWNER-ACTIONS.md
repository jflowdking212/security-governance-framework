# Owner actions required before USS v1.0.0 release

These items require repository-owner or rights-holder decisions. The correction branch does not make these changes automatically.

## 1. Protect the default branch

**Observed state on 2026-11-18:** GitHub reports main as unprotected, branch-protection enforcement disabled, and no repository rulesets.

Recommended configuration:
- Require pull requests for changes to main.
- Require at least one approval from an authorised human reviewer.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution.
- Require the USS validation job and all active security-scan jobs before merge.
- Require CODEOWNERS review for canonical directives, generated modules, resolver/validator tools and GitHub workflow files.
- Block force pushes and branch deletion.
- Restrict bypass permissions to explicitly authorised administrators.
- Require 2FA for maintainers and review repository administrator access.

The owner should verify the final required status-check names from a successful run before saving the ruleset or branch-protection policy.

## 2. Enable dependency graph access

**Observed state:** GitHub Dependency Review returned HTTP 403 from the dependency-graph comparison endpoint. The job was removed from the active workflow rather than reported as passing.

Owner action:
- Open repository Settings.
- Open Code security and analysis.
- Confirm or enable the dependency graph.
- Re-run a pull-request dependency review test.
- Re-enable the optional job only after the API call succeeds.

OSV-Scanner remains active, but this repository currently has no supported package manifest/lockfile. Do not infer application dependency coverage from an empty scan.

## 3. Choose a software licence

**Observed state:** GitHub reports no licence for the repository. No licence file has been created.

The owner must decide what rights to grant for:
- policy and documentation;
- code and validation tools;
- templates and stack profiles;
- commercial and non-commercial reuse;
- modification and redistribution;
- attribution, patent and warranty terms.

Possible licence families have materially different consequences. Do not select MIT, Apache-2.0, GPL, Creative Commons or a custom licence without the rights-holder's explicit decision and, where appropriate, legal advice. Until a licence is added, the repository remains without an express reuse grant.

## 4. Establish release signing

**Observed state:** No owner-controlled signing identity or signed v1.0.0 release tag/artefact is configured.

Owner action:
- Choose GPG signing or a Sigstore/keyless release-signing process.
- Protect the signing identity and recovery process.
- Publish the signer fingerprint or expected certificate identity through an independent trusted channel.
- Sign the exact release tag or artefact.
- Publish a verification command and verify the release from a clean environment.
- Keep the full commit SHA pinned by consuming projects.

A GitHub-generated signature on an individual commit does not establish that the owner has configured an independently trusted release-signing process.

## 5. Optional repository naming decision

The current repository name is seurity-layer. If this is a typo and the owner wants it corrected, decide on a new name before the v1.0.0 release. Renaming may affect clone URLs, badges, links, webhooks and consuming-project pins. This is optional and must not be changed without owner approval.

## Release rule

Until the required owner actions are completed or explicitly documented as retained limitations, USS may be technically validated as a candidate but must not be represented as a fully approved, independently authenticated production release.
