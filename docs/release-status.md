# Standalone release status — 2026-11-01

Initial standalone implementation, MIT licensed. This replaces the former hosted
backend distribution. No hosted instance or original database was changed.

Verified locally: frontend build and lint; extracted domain/provider unit tests;
API lifecycle against actual temporary SQLite; admin login and logout; anonymous
and ordinary-user access denial; self-promotion denial; CSRF origin/header checks;
shared login throttling; persisted records after reopening; two independent SQLite
workers racing the same slot; conflicts and buffer protection on create and move.
External providers are mocked in tests.

Known limits:

- Single organization per installation; persistent local disk required.
- Calendar OAuth/credential connection and MCP are not implemented. Provider business
  code remains isolated, with no credentials or connection enabled by default.
- No email signup, SSO or browser recovery. Operators create/reset accounts locally.
- Reminder scheduling is an optional operator job; no durable worker queue is included.
- Booking management links are bearer credentials without automatic expiry/revocation
  beyond changing/removing their stored tokens. Share them only with the guest.
- Daily quotas are checked by availability rules; only interval overlap is arbitrated
  atomically in SQLite. Concurrent non-overlapping bookings may exceed a daily quota.
- Overlap protection uses buffers captured when the booking is first written.
- Large-volume CRM reconciliation and provider pagination need workload-specific tests.
- Provider notification delivery, external-account sync, backup/restore operations,
  container deployment and multi-host installs are not verified by the local suite.
- Legacy JavaScript UI is not fully type-checked. Vite reports a large frontend bundle.
- npm audit reports eight moderate findings in the ESLint/minimatch development toolchain,
  zero high/critical findings; the production-only audit reports zero vulnerabilities.

No production availability or security guarantee is implied by making the source
public. Use the documented limitations to scope pilots and contributions.
