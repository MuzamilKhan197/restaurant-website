# Customer experience

Phase 5 connects the public storefront to the same Supabase database used by
menu management. It does not enable checkout; that is Phase 6.

- Home, menu and dish routes query actual published records through a fresh
  anonymous client with no staff cookies or service credentials.
- Draft, maintenance, network failure and empty results have explicit states.
  Demo dishes are never substituted for missing live records.
- Search, active categories, vegetarian filtering and stable 24-item pagination.
- Active sizes and linked extras show limits, availability and price estimates.
- Private photographs use signed URLs expiring after 180 seconds; missing
  photographs use a neutral placeholder.
- Only the owner can publish/unpublish from /admin/menu. Publication does not
  change ordering mode. The live restaurant remains unpublished.
- /account allows verified customers to edit their display name and phone.
  Email comes from confirmed Auth identity, never from form input.
- Profile saves explicitly create/update a restaurant customer. New profiles
  at a draft restaurant save the global display name without joining.
- /account/addresses supports create/edit/delete. The default replacement RPC
  locks the customer row; forged IDs fail before clearing the existing default.
- /account/orders shows paginated own orders with snapshot item, size and extra
  names/prices, totals, cash status and event history. Guest orders stay private.
- /admin/customers provides permission-protected search and pagination.
  Details show up to 20 recent orders only with additional orders.read access.
- Every private query includes the verified identity and server-selected tenant.
  Mutations use Zod, caller-scoped clients, RLS and database constraints.

## Manual acceptance

Run npm run preview:restart in a normal project terminal. Sign in, edit your
profile and confirm it persists after reload. On a published restaurant add two
addresses, switch the default, edit/delete one, and confirm another account
cannot access it. Review populated order snapshots.

As owner, add actual menu records and deliberately publish after reviewing
business details. No test customers, orders or dishes are seeded on the hosted
project. The managed runner cannot reach localhost (EACCES), so signed-in browser
acceptance and the full Storage upload/download round trip remain manual checks.
