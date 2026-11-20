# Phase 8 verification - 2026-11-18

Implemented live operational overview, aggregate sales/cash reports, date
filters, interactive charts, exact CSV exports, popular products, activity log
and complete paginated customer order history. Also corrected refund controls.
See [REPORTS_AND_ACTIVITY.md](../REPORTS_AND_ACTIVITY.md).

| Check | Result |
| --- | --- |
| Pure application validation/logic | 35 passed |
| PostgreSQL security/integrity/ordering/support/reporting/seed | 93 passed |
| Raster processing | 3 passed |
| Support file handler | 6 passed |
| Preserved legacy application | 30 passed |
| Total automated tests | 167 passed |
| TypeScript, ESLint and source formatting | Passed |
| Production Webpack build, typecheck, page generation and traces | Passed |
| Hosted schema | Version 8, twelve migrations |
| Live cash-versus-completed-sale probe | Passed, rolled back |
| Live anonymous/foreign-tenant report denial | Passed |
| Verification orders/products left behind | 0 / 0 |

Migration 20261118113542_reporting_and_activity.sql is applied to the selected
restaurant project. Generated local types match migrated PostgreSQL. Hosted
comparison covers public columns, enum names and RPC names.

New tests cover inclusive local midnight boundaries, a 23-hour daylight-saving
day, leap-year limits, refunds for older orders, negative net cash, unchanged
historical sold names/prices, report-only/audit-only roles, immediate permission
revocation, activity filtering/pagination and safe exact CSV generation.

The production build uses the isolated Windows workaround documented in Phase 4.
The source-matched successful build is copied into the project for restart.
The local HTTP smoke attempt still fails with connect EACCES 127.0.0.1:3003.
It is not counted as a passed browser test. Signed-in interactions and actual
browser download/visual checks remain outstanding.

The restaurant remains unpublished with orders paused. No test restaurant
records, orders or products were permanently inserted.
Security advisors report no new database warnings; the pre-existing Auth
leaked-password-protection warning remains. See
[Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
