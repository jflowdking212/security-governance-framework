## Summary

Describe the security problem, policy gap or documentation change.

## Scope and traceability

- [ ] Affected modules and control IDs are identified.
- [ ] Canonical source sections are referenced.
- [ ] `manifest.json`, task routing and dependencies are updated where needed.
- [ ] `source/traceability-matrix.csv` is updated where needed.
- [ ] Generated modules were rebuilt with `node tools/build-modules.mjs`.
- [ ] Original source directives and archive copies remain intact.

## Validation

- [ ] `node tools/build-bundles.mjs`
- [ ] `node tools/validate.mjs`
- [ ] `node --test tests/*.test.mjs`
- [ ] CI passes.

List the exact commands run and their results:

## Security and release impact

- [ ] No secrets, credentials or private data are included.
- [ ] P0/P1 findings remain non-waivable release blockers.
- [ ] Risk acceptance, if any, is limited to P2/P3.
- [ ] Unknown controls are not reported as PASS.
- [ ] Operational, migration and rollback implications are documented.

## Review

- [ ] Independent review completed where required.
- [ ] Owner approval obtained for changes to canonical policy.
