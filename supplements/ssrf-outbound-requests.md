# SSRF and outbound request supplement

**Status:** Supplemental implementation guidance  
**Applies to:** URL previews, remote image/document fetches, importers, webhook test tools, callback URLs, URL-based integrations, proxy services and remote metadata retrieval  
**Related modules:** M04, M05, M08, M10  
**Reviewed:** 2026-11-18

Any feature that makes a server-side request based on user-controlled input creates an SSRF boundary. A URL parser or regular expression alone is not a complete SSRF defence.

## Preferred design

- Prefer a fixed provider integration or strict hostname allowlist over arbitrary URL fetching.
- If arbitrary destinations are not essential to the product, do not build arbitrary URL fetching.
- Restrict schemes to the minimum required, normally HTTPS and only explicitly justified HTTP. Reject file, ftp, gopher, data and other schemes unless a separate reviewed design requires them.
- Restrict ports to the minimum required. Reject embedded credentials and ambiguous URL forms.
- Parse and canonicalise using a maintained URL/IP library. Do not use ad hoc regular expressions as the primary validator.
- Resolve both IPv4 and IPv6 records. Validate every candidate address against the destination policy.
- Reject loopback, private, link-local, unique-local, multicast, unspecified, reserved, IPv4-mapped IPv6 and cloud metadata destinations unless a specifically authorised internal integration requires an explicit exception.
- Prevent DNS rebinding and time-of-check/time-of-use gaps. The actual connection must use an address that was validated. Do not validate one DNS answer and allow the HTTP client to perform an unchecked second lookup.
- Preserve the original hostname for HTTP Host, TLS SNI and certificate verification while binding the network connection to the validated destination address.
- Disable automatic redirects by default. If redirects are a product requirement, validate every redirect target using the full destination policy before following it.
- Apply the same checks to retries, fallback hosts, proxies and alternate address families.
- Enforce outbound network egress controls at the host, container, workload or network layer. Application checks and network controls should reinforce one another.

## Request and response limits

- Use strict connect, TLS handshake, read and total request timeouts.
- Set maximum response bytes, decompressed bytes, redirect count, concurrent fetches and per-user request rates.
- Do not forward inbound cookies, Authorization headers, cloud credentials or internal service headers to the destination.
- Do not attach internal credentials to a user-selected URL.
- Do not expose raw response headers, internal IPs, stack traces or unfiltered upstream errors to the caller.
- Validate content type and file signatures before passing fetched data to parsers or media processors. Apply separate parser limits and malware scanning where the threat model requires it.
- Avoid returning arbitrary fetched HTML directly into an authenticated application origin. Sanitize or isolate previews and active content.

## Cloud metadata and internal services

- Treat cloud metadata endpoints, control-plane APIs, service discovery, loopback services and internal administration interfaces as sensitive destinations.
- Use provider-supported metadata protections, such as AWS IMDSv2 where applicable, as defence in depth. They do not replace SSRF prevention.
- Never assume private-address blocking alone is sufficient. Account for IPv6, alternate encodings, IPv4-mapped IPv6, NAT64 and provider-specific metadata addresses.
- Use network policies or firewall rules to prevent workloads that do not need internal access from reaching metadata and administrative networks.

## Negative test matrix

Test at least the following against the actual URL-fetching implementation:

- Loopback, private, link-local, multicast and reserved IPv4 and IPv6 addresses.
- IPv4-mapped IPv6 and alternate textual representations of blocked addresses.
- DNS answers that change between validation and connection.
- A hostname that resolves to both public and private addresses.
- Redirects from a public host to a blocked address.
- Redirect loops, excessive redirects, disallowed schemes, unusual ports and embedded URL credentials.
- Cloud metadata and internal service hostnames.
- Oversized bodies, decompression expansion, slow responses, connection stalls and excessive concurrency.
- A valid public destination that remains reachable only through the validated connection address.
- Attempts to forward cookies, bearer tokens or internal headers to the target.

A passing unit test for the URL parser is not evidence that DNS resolution, connection pinning, proxy behaviour and network egress are safe.

## Primary reference

- [OWASP Server Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

Review the current guidance and the HTTP client's connection and redirect semantics before implementation.
