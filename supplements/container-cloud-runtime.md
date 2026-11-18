# Container and cloud runtime supplement

**Status:** Supplemental implementation guidance  
**Applies to:** Docker, OCI containers, Kubernetes, cloud-hosted services, CI runners and service-to-service identity  
**Related modules:** M08, M10, M12  
**Reviewed:** 2026-11-18

## Container build and image provenance

- Use minimal, maintained base images and remove package managers, shells, compilers and debugging utilities from production images when they are not required at runtime.
- Pin production images by immutable digest. Tags alone can move and are not immutable release identifiers.
- Generate and retain an SBOM for released images. Scan base images and application dependencies and track the fix status of material vulnerabilities.
- Build from controlled CI with a reviewed dependency lockfile. Avoid downloading unpinned scripts or binaries during image startup.
- Do not copy source-control metadata, local environment files, private keys, test credentials or build caches into runtime layers.
- Sign images or artifacts and verify provenance where the deployment platform supports it.

## Runtime hardening

- Run as a non-root user. Do not use privileged containers.
- Drop all Linux capabilities by default and add only specifically required capabilities.
- Disable privilege escalation. Use the runtime's default seccomp profile or a stricter reviewed profile; use AppArmor or SELinux where supported.
- Use a read-only root filesystem where compatible with the application. Mount only the specific writable directories required.
- Do not mount the Docker socket or host filesystem into application containers.
- Set CPU, memory, process and ephemeral-storage limits. Apply health checks and graceful shutdown behaviour.
- Restrict container network access to required peers and destinations. Do not assume containers on the same host are isolated merely because they have different names.

## Kubernetes

- Use the Restricted Pod Security Standard as the target baseline where workload compatibility permits. Record and justify any exception.
- Set runAsNonRoot, a fixed non-root UID/GID where practical, allowPrivilegeEscalation false, capabilities drop ALL, seccompProfile and readOnlyRootFilesystem where compatible.
- Disable service-account token automounting for workloads that do not call the Kubernetes API. When access is required, use a dedicated least-privilege service account and narrowly scoped RBAC.
- Apply NetworkPolicies or an equivalent network control to restrict ingress and egress. Validate that the cluster CNI actually enforces them.
- Use resource requests and limits, namespace isolation, admission controls and image provenance policies.
- Keep control-plane and node access separate from application workload identities.

## Cloud identity and secrets

- Prefer workload identity or short-lived federated credentials over long-lived access keys embedded in environment files or images.
- Bind each workload identity to the minimum required resources and actions. Separate deployment identity from runtime identity.
- Restrict metadata-service access to workloads that require it and apply the SSRF supplement to any URL-fetching functionality.
- Store secrets in the platform's protected secret facility or an approved secret manager. Avoid copying the same high-privilege credential across unrelated services.
- Audit role bindings and permissions for privilege creep. Test both allowed and denied actions.
- Do not let untrusted pull-request code access production credentials or deployment permissions.

## Evidence and tests

- Inspect the final built image, not only the Dockerfile.
- Confirm runtime UID, capabilities, filesystem mode, privilege escalation setting and seccomp/AppArmor/SELinux profile.
- Verify the container cannot access the host socket, unintended host paths, cloud metadata or unrelated internal services.
- Confirm Kubernetes NetworkPolicies are enforced by the deployed CNI.
- Verify workload identity cannot access resources outside its explicit scope.
- Confirm image digest, SBOM, signature/provenance and scan results are linked to the deployed artifact.
- Test that resource limits and restart behaviour do not cause unsafe partial processing.

## Primary references

- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

Exact settings depend on the runtime, orchestrator version, cloud provider and workload. Validate against the deployed environment.
