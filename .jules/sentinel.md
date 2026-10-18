## 2026-10-18 - Timing Side-Channel in Cron Secret Comparison
**Vulnerability:** `CronController.safeEqual` compared secrets using a custom character-by-character loop with an early exit on string length inequality (`if (a.length !== b.length) return false`), creating a timing side-channel.
**Learning:** Early length checks and custom JS loops leak secret length and character alignment information via timing measurements.
**Prevention:** Always hash secrets to fixed 32-byte SHA-256 digests before using `crypto.timingSafeEqual` in Node.js to guarantee constant-time string comparisons regardless of length.
