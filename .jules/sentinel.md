## 2026-10-30 - Constant-time secret comparison for CronController
**Vulnerability:** CronController used a custom XOR loop with an early `a.length !== b.length` return when comparing the `CRON_SECRET` header, leaking secret length via timing side-channel.
**Learning:** Hand-crafted string comparison routines often leak timing information via length checks or non-constant execution paths.
**Prevention:** Pre-hash secret string inputs to fixed 32-byte buffers using `crypto.createHash('sha256')` before comparing them with Node's native `crypto.timingSafeEqual`.
