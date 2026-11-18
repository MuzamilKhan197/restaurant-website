# Phase 5 verification — 2026-11-17

Implemented connected catalogue, dish options/price preview, owner publication,
customer profiles, saved addresses, order history and staff customer management.
See [CUSTOMER_EXPERIENCE.md](CUSTOMER_EXPERIENCE.md).

| Check | Result |
| --- | --- |
| Foundation/auth/menu/customer validation | 24 passed |
| PostgreSQL security, integrity, staff, menu, customers and seed | 61 passed |
| Raster processing | 3 passed |
| Preserved legacy application | 30 passed |
| Total | 118 passed |
| TypeScript and ESLint | Passed |
| Production Webpack compilation, typecheck, page generation and traces | Passed |
| Hosted schema version | 5 |
| Hosted test customer/product records left behind | 0 / 0 |

Migration 20261117132806_customer_profiles_and_addresses.sql is applied to
project tafldffgwyywhuymkiee. Local history matches the hosted version.
The owner-context profile probe used a rolled-back transaction.
The restaurant remains unpublished and orders remain paused.

The isolated build workaround documented in Phase 4 remains necessary.
The runner cannot reach the host preview on port 3003: HTTP smoke checks fail
with connect EACCES. Signed-in browser and full Auth/Storage round-trip
verification are not claimed.

Security advisors report no new database warnings. The existing Auth setting
for leaked password protection remains disabled. See
[Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Private guest-access and idempotency tables intentionally have deny-all RLS.
