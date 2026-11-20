# Consumer CI security workflow template

Copy [consumer-security-scans.yml](consumer-security-scans.yml) into the consuming application's .github/workflows directory and adapt it before enabling it as a required check.

## Required adaptation

- Change the CodeQL languages to every language in the deployed application. The supplied JavaScript/TypeScript setting is only an example.
- Select a CodeQL build mode that matches the language. The supplied none mode is for interpreted languages and is not suitable for every compiled application.
- Review Semgrep rules, paths, exclusions and supported languages. Do not exclude security-sensitive code merely to reduce findings.
- Confirm that OSV-Scanner recognises every package ecosystem and lockfile used by the application. Unsupported manifests must be reported as NOT COVERED.
- Add container, infrastructure-as-code, mobile, DAST, API, authorization and deployment checks where the application requires them.
- Enable the repository dependency graph before uncommenting the optional GitHub Dependency Review job. This USS repository's dependency-graph compare endpoint returned HTTP 403, so Dependency Review is not represented as a passing check here.
- Keep actions pinned to full commit SHAs and review updates through pull requests.

## Required repository settings

After verifying that the workflow works on the default branch:

1. Require the relevant security scan jobs and application test jobs before merge.
2. Require pull requests and human review for security-sensitive changes.
3. Protect workflow, policy, build and deployment files with CODEOWNERS.
4. Prevent untrusted pull-request code from accessing production secrets or deployment credentials.
5. Keep workflow token permissions minimal.
6. Review findings and exceptions. P0/P1 remain non-waivable production-release blockers.

## Limitations

This template is a starting point, not a complete security programme. Scanner success does not prove that the application is secure. A green workflow is only evidence that the configured checks ran and passed on the scanned revision.


## Scanner configuration integrity

- Do not add `.gitleaks.toml`, `.gitleaksignore`, `gitleaks.toml`, or Gitleaks allowlist/config overrides without a separately reviewed policy exception and negative regression tests. An ignore entry suppresses a finding; it is not a harmless formatting preference.
- Keep `.semgrepignore` limited to generated/dependency metadata such as `.git/` and `node_modules/`. Never exclude source, tests, workflows, templates, or security-sensitive configuration. Do not add `SEMGREP_RULES`, alternate `--config`, `--exclude`, or rule-exclusion arguments to the scanner job.
- Do not add CodeQL `paths-ignore`, custom query filters, or configuration that silently removes source coverage. If a repository needs a reviewed exclusion, document its path, rationale, owner and compensating scan.
- Keep the OSV reusable workflow inputs limited to the approved failure and SARIF settings. Do not override `scan-args`, `runs-on`, `ref`, or other upstream inputs.


The first-party and consumer workflows run a fail-closed configuration guard before Gitleaks and Semgrep. It rejects unreviewed Gitleaks, Semgrep and CodeQL config/ignore files, and permits `.semgrepignore` only when it contains the two harmless metadata/dependency exclusions `.git/` and `node_modules/`. If an application needs an additional exclusion, obtain an explicit owner-approved exception and update the security tests before changing the guard.


The guard also rejects nested .semgrepignore files and any .gitignore rule that hides a tracked file within the active Semgrep scan scope. Semgrep runs with --strict so scanner/parser errors are fatal, in addition to --error making findings fail the job. Consumer repositories are checked across all tracked files because the template scans the whole repository.


The first-party and consumer Semgrep scan commands use Semgrep's scan-specific --strict flag to make scan errors fatal, together with --error to fail on findings. The --no-suppress-errors flag belongs to semgrep ci, not semgrep scan, and is intentionally not used here.
