# Phase 6 verification — 2026-11-17

Implemented cart, guest/account cash checkout, authoritative quote and atomic
order creation, secure guest tracking, staff order/cash workflow and minimal
Realtime updates. See [CHECKOUT_AND_ORDERS.md](CHECKOUT_AND_ORDERS.md).

| Check | Result |
| --- | --- |
| Foundation, auth, menu, customer and checkout validation | 26 passed |
| PostgreSQL security, integrity, staff, customer, checkout and seed | 72 passed |
| Raster processing | 3 passed |
| Preserved legacy application | 30 passed |
| Total automated tests | 131 passed |
| TypeScript and ESLint | Passed |
| Production Webpack build | Passed |
| Hosted schema | Version 6, ten migrations |
| Hosted checkout, duplicate retry, private tracking and deferred integrity probe | Passed and rolled back |
| Hosted verification orders/products remaining | 0 / 0 |
| Restaurant publication | Unpublished; orders paused |

Migration 20261117135136_checkout_and_guest_orders.sql is applied to the selected
restaurant project. Generated public table/enum/RPC names match the hosted schema.
Private helpers implement the intentionally public guest checkout capability API;
public wrappers run as invoker and direct financial table creation stays denied.

The isolated build approach from Phase 4 is still used for the managed Windows
runner. Restart the verified production preview in the normal project terminal
with npm run preview:restart.

No signed-in browser or live Realtime/Storage transport success is claimed:
localhost connections from the runner remain blocked with EACCES.
The pre-existing leaked-password-protection Auth warning remains; see
[Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
