## 2026-10-11 - Timing Side-Channel in Custom Secret Comparison
**Vulnerability:** Early length return in custom string equality check leaked `CRON_SECRET` length via timing side-channel.
**Learning:** Custom timing-safe loop `if (a.length !== b.length) return false;` exposed string length differences before byte comparison. `crypto.timingSafeEqual` throws an error if buffer lengths differ, which developers often try to avoid by adding length checks first.
**Prevention:** Hash secret strings with SHA-256 before comparing with `crypto.timingSafeEqual(bufA, bufB)`. This normalizes all inputs to fixed 32-byte buffers, eliminating length leaks and avoiding `timingSafeEqual` length mismatch exceptions.
