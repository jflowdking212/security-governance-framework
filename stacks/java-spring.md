# Java and Spring Boot reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Enterprise applications using supported Java LTS releases (Java 17+) and maintained Spring Boot 3.5.x/4.x with the matching supported Spring Security 6.5.x/7.x line  
**Related modules:** M01, M02, M03, M04, M05, M06, M08, M09, M10, M12, M21  
**Companion supplements:** Authentication and federation; API protocol security; container and cloud runtime  

This profile defines security standards for enterprise services built with Java and Spring Boot, addressing Spring Security configuration, deserialization vulnerabilities, injection defenses, and dependency scanning.

## Spring Security configuration and access control

- Enforce Spring Security via explicit `SecurityFilterChain` bean definitions. Keep CSRF protection for browser-session and other ambient-credential endpoints. Disable it only after proving an endpoint is stateless and does not authenticate via automatically attached cookies or other ambient credentials; a bearer-token API still needs an explicit threat-model review.
- Implement fine-grained authorization with method security (`@EnableMethodSecurity`, `@PreAuthorize`) enforcing Role-Based Access Control (RBAC) and Object-Level Authorization (BOLA/IDOR protection).
- Secure actuator endpoints: prohibit exposing sensitive Spring Boot Actuator management endpoints (`/actuator/env`, `/actuator/heapdump`, `/actuator/configprops`) to untrusted networks. Require administrative authentication on all exposed actuator metrics.
- Enforce secure headers via Spring Security defaults (`HSTS`, `X-Content-Type-Options`, `Content-Security-Policy`, `Frame-Options`).

## Deserialization defense and XML security

- Prohibit the use of Java native serialization (`ObjectInputStream`) on untrusted data streams.
- Do not activate Jackson polymorphic default typing for untrusted input. If polymorphic deserialization is unavoidable, use a strict `PolymorphicTypeValidator` allowlist, constrain types and payload size, and test the exact Jackson major version; avoid relying on deprecated `disableDefaultTyping()` APIs.
- Secure XML parsers against XML External Entity (XXE) attacks: explicitly disable `DOCTYPE` declarations, external general entities, and external parameter entities on all `DocumentBuilderFactory`, `SAXParserFactory`, and `XMLInputFactory` instances.

## Data access and injection prevention

- Use Spring Data JPA or parameterized JDBC queries (`PreparedStatement`, `NamedParameterJdbcTemplate`) for all database operations. Prohibit string concatenation in HQL, JPQL, or native SQL queries.
- Validate incoming request DTOs using Jakarta Validation annotations (`@Valid`, `@NotNull`, `@Size`, `@Pattern`).
- Sanitize output rendered in server-side templates (Thymeleaf, JSP) using contextual HTML/JS escaping.

## Cryptography and sensitive data protection

- Use constant-time array comparison (`MessageDigest.isEqual()`) when validating webhook signatures, API tokens, or cryptographic message digests.
- Enforce modern cryptographic algorithms: use Argon2id or BCrypt (`BCryptPasswordEncoder`) for password hashing. Prohibit MD5, SHA-1, or DES.
- Never log plain credentials, JWT tokens, or PANs: configure logback/log4j masking patterns or redact sensitive parameters in logging filters.

## Supply chain and runtime security

- Enforce dependency verification using Gradle dependency verification metadata (`verification-metadata.xml`) or Maven dependency plugin checksum enforcement.
- Run automated vulnerability scanning (such as OWASP Dependency-Check or Snyk) in CI to identify CVEs in third-party JARs.
- Containerize using minimal, rootless container images (Eclipse Temurin / Chainguard distroless Java images) with least-privilege user accounts.


## Runtime support and version verification

- Record the exact JDK vendor and patch version, Spring Boot, Spring Framework, Spring Security, Jackson and servlet-container versions. Use a maintained JDK/Spring release combination and verify it against the official system-requirements and support matrix at review time.
- Spring Boot 4.x is the current generation and requires Java 17 or later; maintained 3.5.x deployments may remain valid where the corresponding Spring Security and dependency lines are still supported. Do not assume every Spring Boot 3.x application is on Spring Security 6.x.
- Keep Actuator management endpoints on a private management interface or restrict them through explicit authentication and network policy. Expose only the health details required for the relevant probe.

## Required application tests

- Authentication, CSRF and method/object authorization tests, including cross-tenant object substitution.
- Actuator endpoint exposure and authorization tests.
- Jackson polymorphic-type rejection, payload-size and untrusted deserialization tests.
- XXE tests for each XML parser factory in use.
- SQL/JPQL injection and DTO validation tests.
- Password hashing, webhook signature and sensitive-log redaction tests.
- Dependency verification and vulnerability scan results for the exact resolved dependency graph.

## Verification record required before marking this profile validated

Record the consuming repository and exact commit, JDK vendor/version, Spring Boot/Framework/Security/Jackson/container versions, build-tool version, lockfile or dependency verification metadata, security filter chains, CSRF/session model, actuator exposure, negative test commands/results, deployment topology and independent reviewer identity.

## Primary references

- [Spring Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Spring Boot supported versions](https://docs.spring.io/spring-boot/)
- [Spring Security reference](https://docs.spring.io/spring-security/reference/)
- [Jackson polymorphic deserialization security](https://github.com/FasterXML/jackson-docs/wiki/JacksonPolymorphicDeserialization)
