## 2026-10-16 - E2E Access Code Uniqueness & HTTP Security Headers
**Vulnerability:** E2E test helpers hardcoded user `accessCode` ('123456'), causing `IDX_users_access_code` unique constraint collisions when creating multiple test users.
**Learning:** Always use `codigoAcessoUnico` when seeding or creating test users to guarantee access code uniqueness under TypeORM constraints.
**Prevention:** Avoid hardcoded values for database fields protected by UNIQUE indexes in test fixtures.
