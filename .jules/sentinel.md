# Sentinel's Journal

## 2026-10-22 - Fail-Open Rate Limiting on Redis Disconnection
**Vulnerability:** When Redis was configured (`redisService.isEnabled === true`) but unreachable, `redisService.incrementWithTtl` caught errors internally and returned `null`. In `RateLimitMiddleware`, the code fell back to `0` (`?? 0`) and called `next()`, completely bypassing rate limits and leaving the application vulnerable to DoS and brute-force attacks when Redis was degraded or disconnected.
**Learning:** Returning default falsy/zero fallbacks (`?? 0`) on service errors can invert security logic from fail-closed to fail-open. Error handling inside service wrapper methods must distinguish between successful operations and swallowed connection failures.
**Prevention:** If Redis operations return `null` or fail, the middleware must fall back to local in-memory counting instead of assuming a count of 0 and permitting requests without enforcement.
