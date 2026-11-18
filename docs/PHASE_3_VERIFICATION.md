# Phase 3 verification — 2026-11-16

## Connected database

The user explicitly selected the newly created `restaurant` project. It contained
no public/private application tables before changes. Seven reviewed migrations
were applied; local filenames now match hosted migration history. The database
contains one unpublished sample restaurant with orders paused. No test Auth
users, customers, orders, tickets or uploaded files were inserted into hosted
Supabase. No secret/service-role key was stored in the application.

## Automated checks

| Check | Result |
| --- | --- |
| Foundation and authentication validation tests | 17 passed |
| PostgreSQL RLS, integrity, seed and staff RPC tests | 49 passed |
| Preserved legacy tests | 30 passed |
| TypeScript and final production build | Passed |
| ESLint and source formatting | Passed |
| Generated local database type drift | Passed |
| Hosted/local type comparison | Public table columns, enum names and RPC names match |
| Hosted schema RPC with publishable key | HTTP 200, schema version 3 |
| Anonymous order reads | HTTP 401, PostgreSQL permission denied |
| Anonymous staff access RPC | HTTP 401, PostgreSQL permission denied |
| Hosted Auth settings | Email provider enabled; signup enabled; automatic email confirmation disabled |
| Live application health | Database ready, schema v3, authentication configured |
| HTTP auth smoke checks | Sign-in 200/no-store; account/admin/staff anonymous requests redirected to sign-in |

Staff tests cover owner-only operations, unconfirmed/anonymous accounts,
cross-restaurant denial, verified-email invitation binding, one-time acceptance,
expiry/revocation, reissued links, disabled roles, protected owner/customer roles,
atomic role permission replacement, suspension and operator-only owner bootstrap.
An ACL regression test ensures authenticated public RPCs are invoker wrappers
and anonymous callers cannot execute staff/bootstrap RPCs.

`node --use-system-ca scripts/smoke-auth.mjs` runs read-only HTTP checks against
the configured local origin. `docs/verification/` contains hosted type output,
advisor summaries and HTTP evidence. It contains no user tokens or passwords.

## Browser verification

- Desktop sign-in page rendered with email/password controls and recovery link.
- Visiting localhost sign-in navigated to the configured 127.0.0.1 account origin
  without a redirect loop. The final implementation uses browser navigation
  because Next.js normalizes loopback hosts in server redirect URLs.
- Registration navigation and name/email/password/confirmation fields worked.
- At 390px viewport width the document measured 375px; no horizontal overflow.
- Show/hide password changed its accessible label correctly. An empty signup
  submission was blocked by native validation and focused the required name field.
- No credentials were entered and no signup/recovery email was sent during QA.
- Temporary viewport override was reset. The final registration preview is open.

## Hosted advisors

Security, performance and health advisors have **no WARN or ERROR findings**.
Remaining informational notices are intentional/currently expected:

- Two private backend tables use RLS with no client policies (deny-all) and no
  client grants. Only service/operator operations can access them.
  [RLS policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- New indexes are currently reported unused on an empty database. They cover
  tenant lookups and foreign keys; removing them before real traffic would be
  premature. [Unused-index notice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

The earlier privileged-public-RPC warnings were resolved by moving implementations
to private and exposing invoker wrappers. Multiple-policy performance warnings
were resolved by combining equivalent authenticated predicates. Eighteen covering
foreign-key indexes resolved the missing-index notices. All database tests passed
after those changes.

## Remaining acceptance steps

Update on 2026-11-17: the designated owner is now email-verified with active Owner
access. Site URL and both local callbacks were saved and verified in the preceding
dashboard session. The paragraph below records the earlier Phase 3 handoff;
only signed-in integration/release checks remain outstanding.

The connector cannot change Supabase Auth URL settings. The browser dashboard
required sign-in, so Site URL/callback configuration remains pending. Follow
[AUTHENTICATION.md](AUTHENTICATION.md), then register and verify the actual owner.
The operator must confirm the intended email/UUID before assigning ownership.
Signed-in account/staff browser flows, actual email delivery/recovery, Storage
HTTP transfer and Realtime subscriptions are not claimed as end-to-end verified.
Ordering remains paused. Phase 4 is menu management; this is not a release of the
complete restaurant product.
