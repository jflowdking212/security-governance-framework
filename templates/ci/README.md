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
