# Rust reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** High-performance web services and systems applications using Rust 2021+ (Axum, Actix-web, Tower)  
**Related modules:** M01, M02, M04, M05, M08, M09, M10, M12, M21  
**Companion supplements:** Cryptography and key management; API protocol security; container and cloud runtime  

This profile defines security standards for applications built with Rust, leveraging type-system memory safety, enforcing strict concurrency guarantees, timing-safe cryptographic comparisons, and dependency auditing.

## Unsafe code minimization and memory safety

- Enforce `#![forbid(unsafe_code)]` at the crate root wherever technically feasible. If `unsafe` blocks are required for foreign function interfaces (FFI) or hardware-specific operations, isolate them in dedicated modules, audit them, and accompany them with `// SAFETY:` explanatory comments.
- Utilize compiler sanitizers (`AddressSanitizer`, `MemorySanitizer`, `ThreadSanitizer`) during CI testing for crates containing FFI or unsafe code.
- Prevent integer overflows: enforce overflow checks or use checked arithmetic methods (`checked_add`, `saturating_sub`) when handling untrusted user numbers or memory allocations.

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
