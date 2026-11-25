# Rust reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** High-performance services and systems applications using the current stable Rust toolchain and Rust 2021/2024 editions (Axum, Actix-web, Tower)  
**Related modules:** M01, M02, M04, M05, M08, M09, M10, M12, M21  
**Companion supplements:** Cryptography and key management; API protocol security; container and cloud runtime  

This profile defines security standards for applications built with Rust, leveraging type-system memory safety, enforcing strict concurrency guarantees, timing-safe cryptographic comparisons, and dependency auditing.

## Unsafe code minimization and memory safety

- Enforce `#![forbid(unsafe_code)]` at the crate root wherever technically feasible. If `unsafe` blocks are required for foreign function interfaces (FFI) or hardware-specific operations, isolate them in dedicated modules, audit them, and accompany them with `// SAFETY:` explanatory comments.
- Use AddressSanitizer, MemorySanitizer or ThreadSanitizer where the selected compiler channel, target and toolchain support them. Some sanitizer configurations require nightly Rust or specific platform/toolchain combinations; record the exact command and do not claim sanitizer coverage when the job did not run.
- Use checked arithmetic (`checked_add`, `checked_sub`, checked conversions) when overflow or underflow must be rejected at a security boundary. Use saturating arithmetic only when saturation is the explicitly intended business behaviour; it is not a substitute for validation.

## HTTP server hardening and resource protection

- Enforce explicit request size limits (such as Axum's `DefaultBodyLimit` or Actix-web's `PayloadConfig`) to prevent memory exhaustion from oversized request bodies.
- Configure connection timeouts and keep-alive limits on HTTP listeners using Tower timeout layers or server settings.
- Enforce secure headers and CORS boundaries using middleware layers (`tower-http::cors`, `tower-http::set_header`).
- Prohibit panics on untrusted input: handle fallible parsing using `Result` types and descriptive error enums rather than calling `unwrap()` or `expect()`.

## Cryptography and secret handling

- Use constant-time equality comparisons (`subtle::ConstantTimeEq`) for cryptographic signatures, HMAC digests, and secret tokens.
- Protect sensitive data in memory: wrap cryptographic keys and credentials in zeroing wrappers (such as `zeroize::ZeroizeOnDrop`) to ensure secret material is erased when dropped.
- Use `rustls` (or audited OpenSSL wrappers) enforcing TLS 1.2/1.3 with secure cipher suites for all network communication.
- Sanitize structured log statements (`tracing`, `log`): implement custom `Debug` or `Display` implementations that mask sensitive fields.

## Supply chain and build verification

- Commit `Cargo.lock` to version control for application binaries and services.
- Run `cargo audit` in CI to detect known security vulnerabilities in transitive crates from the RustSec advisory database.
- Use `cargo deny` to enforce license compliance, detect duplicate dependencies, and prohibit untrusted source registries.
- Pin build toolchains in `rust-toolchain.toml` to guarantee reproducible compiler outputs.


## Identity, input and network boundaries

- Enforce authentication and authorization in handlers/middleware, not only in route registration or frontend state. Bind resource access to the authenticated principal and tenant.
- Limit request bodies, decompressed sizes, multipart counts, concurrent connections and per-request work. Apply timeouts and cancellation to outbound requests and database operations.
- Treat outbound URLs and redirect chains as SSRF input. Validate hostnames and resolved addresses, re-check redirects, and block private, loopback, link-local and metadata destinations unless explicitly allowlisted.
- Avoid panic paths on attacker-controlled data. Convert parse, conversion and deserialization errors into explicit failures without leaking internal details.

## Required application tests

- Fuzz parsers, deserializers, URL validation and protocol boundary code.
- Test authorization and tenant isolation using forged identifiers.
- Test oversized/decompressed bodies, timeouts, cancellation and resource exhaustion.
- Test SSRF redirects and DNS rebinding.
- Run `cargo test --locked`, `cargo audit`, and the applicable sanitizer jobs; record toolchain limitations.

## Verification record required before marking this profile validated

Record the consuming repository and exact commit, `rustc`/`cargo` versions, edition and MSRV, framework and crate versions, lockfile digest, target triples, unsafe/FFI inventory, sanitizer/fuzz commands and results, deployment/container assumptions and independent reviewer identity.

## Primary references

- [Rust release channels and editions](https://www.rust-lang.org/tools/install)
- [RustSec Advisory Database and cargo-audit](https://rustsec.org/)
- [Cargo audit documentation](https://github.com/rustsec/rustsec/tree/main/cargo-audit)
