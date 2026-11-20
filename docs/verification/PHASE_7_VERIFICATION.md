# Phase 7 verification - 2026-11-17

Implemented guest/account tickets, private conversations, staff replies/internal
notes, assignments, priorities, escalation/resolution/reopen controls and private
author-owned attachments. See [SUPPORT_SYSTEM.md](../SUPPORT_SYSTEM.md).

| Check | Result |
| --- | --- |
| Application validation and pure logic | 28 passed |
| PostgreSQL security/integrity/staff/ordering/support/seed | 82 passed |
| Raster processing | 3 passed |
| Attachment handler | 6 passed |
| Preserved legacy application | 30 passed |
| Total | 149 passed |
| Next.js TypeScript and ESLint | Passed |
| Edge handler/index typecheck against pinned SDK | Passed |
| Production Webpack build, typecheck, generation and traces | Passed |
| Hosted schema | Version 7, eleven migrations |
| support-files Edge Function | Active, version 1 |
| Hosted creation/retry/internal-note isolation probe | Passed, rolled back |
| Verification tickets/attachments left behind | 0 / 0 |

Migration 20261117143346_customer_support.sql is applied to the selected project.
Local generated types match migrated PostgreSQL. Hosted/local comparison checks
public table columns, enum names and RPC names.
The restaurant remains unpublished with orders paused.

The attachment HTTP smoke attempt failed at DNS resolution (ENOTFOUND) from the
runner and did not reach the function. It is not counted as a passed transport
check. Local handler tests cover denied access before service credentials are
used, signature/type validation, upload/finalization, cleanup and signed downloads.
Signed-in browser and complete live upload/download checks remain outstanding.

The isolated Windows build workaround from Phase 4 remains necessary. The
successful build is copied back only after matching application source files.

Security advisors report no new database warnings. The pre-existing leaked
password protection Auth warning remains:
[Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Private capability/idempotency tables keep intentional deny-all RLS.
