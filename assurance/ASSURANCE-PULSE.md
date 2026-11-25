# USS Assurance Pulse

The Assurance Pulse aggregates existing structured security assessments into a portfolio view. It does not scan code or infer that unassessed controls pass.

## Generate a report

From the USS repository root:

```sh
node tools/assurance-pulse.mjs --file path/to/project-assessment.json
node tools/assurance-pulse.mjs --file safe-sellz-assessment.json --file smmtai-assessment.json --file choir-assessment.json --out assurance/portfolio-pulse.md
```

Use one current assessment per repository. The input format is the control-catalog format used by templates/security-evidence.example.json and tools/validate-evidence.mjs. The project commit must be a full 40-character SHA.

## What the report shows

- PASS, FAIL, UNKNOWN and NOT_APPLICABLE separately.
- PASS controls that lack successful evidence.
- Evidence older than the configured freshness threshold (default 90 days) or missing observation dates.
- Open findings, including P0/P1 blockers and accepted residual risks.
- Per-project state and portfolio totals.

Use --stale-days 60 to tighten the evidence freshness window, or --help for command syntax.

## Operating rules

1. Create an application-specific assessment. Do not copy the example template and call it an audit.
2. Record UNKNOWN until a control has been assessed with current evidence.
3. Run tools/validate-evidence.mjs against each assessment before aggregating it.
4. Generate the pulse after each baseline assessment and during the weekly portfolio review.
5. Keep sensitive evidence in access-controlled storage. The report should contain only safe references and summary findings.
6. Treat the pulse as reporting, not a security scanner, certification, release gate replacement or automated approval.

The pulse deliberately avoids a single blended security score. A high PASS count must never hide a P0/P1 finding or a large UNKNOWN surface.
