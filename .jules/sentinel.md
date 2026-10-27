## 2026-10-27 - Timing Side-Channel in Secret Length Comparison
**Vulnerability:** `CronController.safeEqual` attempted constant-time comparison using a manual bitwise loop, but checked `if (a.length !== b.length) return false;` first, leaking the secret string's length through timing side-channels.
**Learning:** Checking string length equality before comparing bytes creates a timing leak. Node's `crypto.timingSafeEqual` avoids JIT timing issues but throws on unequal buffer lengths.
**Prevention:** Always hash both secret strings using SHA-256 (or similar cryptographic digest) to produce fixed-length buffers before comparing them with `crypto.timingSafeEqual`.
