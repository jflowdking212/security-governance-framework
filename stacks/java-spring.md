# Java and Spring Boot reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Enterprise web applications and microservices using Java 21+ and Spring Boot 3.x / Spring Security 6.x  
**Related modules:** M01, M02, M03, M04, M05, M06, M08, M09, M10, M12, M21  
**Companion supplements:** Authentication and federation; API protocol security; container and cloud runtime  

This profile defines security standards for enterprise services built with Java and Spring Boot, addressing Spring Security configuration, deserialization vulnerabilities, injection defenses, and dependency scanning.

## Spring Security configuration and access control

- Enforce Spring Security via explicit `SecurityFilterChain` bean definitions. Prohibit disabling CSRF protection (`csrf.disable()`) on endpoints serving browser sessions with cookies; only stateless API endpoints authenticated via bearer tokens may selectively disable CSRF.
- Implement fine-grained authorization with method security (`@EnableMethodSecurity`, `@PreAuthorize`) enforcing Role-Based Access Control (RBAC) and Object-Level Authorization (BOLA/IDOR protection).
- Secure actuator endpoints: prohibit exposing sensitive Spring Boot Actuator management endpoints (`/actuator/env`, `/actuator/heapdump`, `/actuator/configprops`) to untrusted networks. Require administrative authentication on all exposed actuator metrics.
- Enforce secure headers via Spring Security defaults (`HSTS`, `X-Content-Type-Options`, `Content-Security-Policy`, `Frame-Options`).

## Deserialization defense and XML security

- Prohibit the use of Java native serialization (`ObjectInputStream`) on untrusted data streams.
- Configure JSON object mappers (Jackson `ObjectMapper`) securely: disable default typing (`disableDefaultTyping()`) to prevent polymorphic gadget chain deserialization attacks.
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
