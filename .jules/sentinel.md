## 2026-11-07 - Bcrypt Password Length Limit (DoS Prevention)
**Vulnerability:** Authentication and user registration DTOs allowed unbounded password input (`@MinLength(6)` without `@MaxLength(72)`). Bcrypt truncates passwords after 72 bytes and hashes them using computationally intensive rounds; an attacker sending large payloads can exhaust server CPU, resulting in a Denial of Service.
**Learning:** Bcrypt's 72-byte truncation means any characters beyond 72 bytes are never hashed or verified, making large passwords not only redundant but an algorithmic complexity DoS risk.
**Prevention:** Always pair `@MinLength` on password fields with `@MaxLength(72)` in NestJS / `class-validator` DTOs across auth and user management endpoints.
