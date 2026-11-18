# Contributing to USS

Thank you for helping improve the Universal Security Standard. Changes must preserve source traceability, fail-closed behaviour and the owner-approved release policy.

## Before changing anything

1. Read [AGENTS.md](AGENTS.md) and [KERNEL.md](KERNEL.md).
2. Identify the affected module and its dependencies in `manifest.json`.
3. Read the relevant canonical source directive(s) and traceability rows.
4. Confirm that the proposed change is within the authorised scope.
5. Never include credentials, tokens, private customer data or production secrets in commits, issues, logs or tests.

## Policy and module changes

- Do not silently weaken or remove a security requirement.
- Do not edit generated files in `modules/` by hand. Update the approved source-generation logic or source inputs through a reviewed, versioned policy change, then run `node tools/build-modules.mjs`.
- Keep source references in each module and update `source/traceability-matrix.csv` and `manifest.json` when coverage, module routing or dependencies change.
- Update task indexes and tests when module/task routing changes.
- Preserve the original source documents and their archive copies. Changes to canonical policy require explicit owner approval and a versioned amendment.
- Project-specific stack profiles may add stricter controls but must not weaken universal controls.
- P0/P1 findings remain non-waivable production-release blockers. Risk acceptance is limited to P2/P3.

## Required local checks

Use Node.js 20 or later. No third-party packages are required.

```sh
node tools/build-modules.mjs
git diff --exit-code -- modules/
node tools/build-bundles.mjs
node tools/validate.mjs
node tools/validate-evidence.mjs --file templates/security-evidence.example.json
node --test tests/*.test.mjs
```

GitHub Actions also runs full-history secret scanning, Semgrep, CodeQL, OSV-Scanner and pull-request dependency review. Keep third-party actions pinned to full commit SHAs. Review scanner output and false positives; do not suppress findings merely to make CI green.

If you intentionally changed generated modules through the approved source process, inspect and commit the resulting module changes. The `git diff` check is intended to detect stale or hand-edited generated output, not to suppress legitimate source-derived changes.

## Pull request expectations

A pull request should explain:

- The security problem or policy gap being addressed.
- Affected modules, controls, source sections and task routes.
- Whether the change strengthens, clarifies or changes existing policy.
- Tests and validation commands actually run, with results.
- Any unresolved questions, compatibility concerns or residual risk.
- Any migration, operational or rollback implications.

Do not claim that an application is secure or production-ready solely because USS validation passes. USS repository checks validate this policy library and its tooling, not the implementation of a consuming application.

## Review and release

Keep changes on a feature branch and request independent review for policy changes. Do not merge, tag or publish a release until required checks pass, required findings are resolved or documented, and the owner approves.
