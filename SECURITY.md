# Security Policy

## Scope

This repository contains the Universal Security Standard (USS), its source directives, modules, tooling and validation workflow. Reports may concern defects in the standard itself, unsafe guidance, missing security controls, source-to-module omissions, resolver/build tooling, or repository supply-chain and CI configuration.

This policy does not authorise testing against any application, service, account, infrastructure or third-party system. Only test systems for which you have explicit authorisation.

## Supported version

The v1.0.0 candidate is currently under independent review and has not yet been approved as a final release. Until a release is published, report issues against the exact branch, commit or file path you inspected.

## Reporting a vulnerability

Please report suspected vulnerabilities privately. Do not open a public issue or pull request containing exploit details, credentials, tokens, private user data or a working attack chain.

1. If private vulnerability reporting is enabled for this GitHub repository, use the repository's **Security** tab and select **Report a vulnerability**.
2. If that option is unavailable, contact the repository owner through an established private channel and include the repository, affected commit, file/module, impact and a safe reproduction summary.
3. Share proof-of-concept material only when necessary, minimise sensitive data, and never include live credentials.

Do not assume a public issue is a confidential reporting channel.

## What to include

- Affected version, branch and commit SHA.
- Affected module, tool, workflow or source directive.
- Security impact and realistic attack prerequisites.
- Minimal reproduction steps or a safe proof of concept.
- Suggested mitigation, if known.
- Whether the issue is known to be actively exploited.

Please allow the owner time to assess and coordinate a fix before public disclosure.

## Handling

The repository owner will assess severity, determine affected versions, coordinate remediation and decide on disclosure timing. P0/P1 findings are production-release blockers under USS policy and cannot be waived by an agent or operator.

This document does not promise a particular response time or bug-bounty reward.
