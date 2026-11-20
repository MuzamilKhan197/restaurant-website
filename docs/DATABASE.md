# Phase 2: database and security

**Current update:** Phase 3 connected the user-created restaurant project and
applied seven migrations. See [AUTHENTICATION.md](AUTHENTICATION.md) and
[PHASE_3_VERIFICATION.md](verification/PHASE_3_VERIFICATION.md) for current setup and evidence.

The Next.js app now has a versioned Supabase PostgreSQL schema, table grants,
Row Level Security, private Storage policies and typed client factories.
The existing SQLite application and records remain unchanged. No live Supabase
project was connected or modified during this phase.

## Verify locally

```sh
npm ci
npm run test:database
npm run db:types:check
npm run test:all
npm run check
npm run build
```

Database tests execute the actual migration SQL on an embedded PostgreSQL
instance (PGlite). The test-only bootstrap supplies the Supabase-owned `auth`
and `storage` schemas, roles and a Realtime publication. It is **not** a mock SQL
parser, but it is also **not** the complete Supabase service stack. Auth email
delivery, SSR session refresh, Storage HTTP uploads, malware scanning, Realtime
WebSocket delivery and hosted security advisors require separate integration
verification. Never apply `tests/helpers/supabase-bootstrap.sql` to Supabase.

`npm run db:types` derives public table, enum and relationship types from the
migrated PostgreSQL catalog. It does not expose the private schema. Supabase's
own hosted type generation should also be compared after deployment. Generated
Insert/Update shapes describe column types; grants, RLS and triggers deliberately
restrict operations further.

## Data model

| Area | Tables | Important guarantees |
| --- | --- | --- |
| Identity | profiles, restaurants, restaurant_customers, customer_addresses | Global profiles are self-only. Customer contact records are restaurant-scoped. |
| Team | permissions, roles, role_permissions, staff_memberships, staff_invitations | Active roles/memberships only; trusted restaurant owner; invitations store token hashes. |
| Menu | categories, products, product_images, product_variants, addon_groups, product_addon_groups, addons | Composite restaurant foreign keys; inactive/draft products hidden from guests. |
| Operations | restaurant_settings, delivery_zones | Normal, paused and maintenance modes; published restaurants require an owner. |
| Ordering | orders, order_items, order_item_addons, payments, order_status_events | Immutable snapshots, legal status transitions, matching cash payment, deferred total checks. |
| Support | support_tickets, support_messages, support_attachments | Order/customer relationship checks, private internal notes, scoped support assignments. |
| Audit | audit_logs | Append-only events with minimal metadata; no copied contact/address snapshots. |
| Private backend | private.guest_access, private.idempotency_keys | SHA-256 hashes, expiry/revocation and tenant-scoped resources; no client grants. |

All amounts are integer **minor units**: PKR 1,950 = 195,000 paisa. Taxes use
basis points and database rounding. An order preserves product names, variants,
allergens, add-on names/prices, customer contact, address and totals. Editing the
menu cannot rewrite previous purchases. Order creation must insert the order,
line snapshots, add-ons and matching cash payment in one transaction. Deferred
constraints reject empty orders and incorrect subtotal/add-on sums at commit.

Phase 6 will add a narrowly scoped checkout transaction that loads current prices
on the server, validates availability, modes, hours, variants, add-on selection
limits, delivery settings and idempotency. **No client role, including the owner,
can directly insert financial records or set order prices.** These migrations
are the foundation for checkout; they do not enable checkout yet.

## Access rules

| Actor | Access |
| --- | --- |
| Unauthenticated visitor | Published restaurant information; active menu except in maintenance. No customer, order, staff, payment or support records. |
| Customer | Own profile, tenant customer record, saved addresses, orders, public ticket messages and ready attachments. Cannot update order/payment states. |
| Support Agent | Restaurant tickets, internal notes, replies and assignments; no menu prices, staff management or reports. |
| Manager | Restaurant operations, menu, customer history and reports according to preset grants. Cannot manage roles or staff. |
| Developer | Business settings and website permissions; no automatic customer/order/support access. |
| Admin | Broad restaurant operations; owner-only staff/role powers remain excluded. |
| Owner | Owner identity is verified from restaurants.owner_user_id, not metadata or a role label. Manages custom roles and staff. |
| Service backend | RLS bypass; must authorize every operation before using the server-only client. Currently unused by application routes. |

Every application table has RLS enabled and explicit grants. Composite foreign
keys reject cross-restaurant references even from trusted writes. RLS helpers
live in `private`, use empty search paths and restricted execution. Do not add
`private` to the exposed API schemas. Auth metadata contributes only a display
name and cannot grant privileges. Role changes and suspensions take effect on
subsequent database statements; no permission claims are trusted from the UI.

`staff.manage` and `roles.manage` are intentionally owner-only in Version 1,
even when a custom role contains those permission keys. Website mode is not
directly writable through the client; Phase 9 will introduce its restricted
backend operation. Maintenance hides menu data from visitors while existing
customer orders and authorized staff operations stay available.

Status transitions: pending -> accepted/rejected/cancelled; accepted ->
preparing/cancelled; preparing -> ready/cancelled; ready -> completed/cancelled.
Terminal states cannot be reopened. Rejection/cancellation requires a reason.
Cancelled paid orders move to refund_due; recording a refund is a separate action.
Payment updates record the authenticated actor rather than trusting a submitted
user ID. Realtime publishes only minimal order status events with RLS, never
the full order contact/address rows. Guest Realtime access is not exposed.

## Guest access and private files

Guest order/ticket access uses a cryptographically random 32-byte bearer token,
encoded as 64 lowercase hexadecimal characters. Only its SHA-256 hash is stored.
The server-only `resolve_guest_access` RPC checks resource kind, reference,
hash, expiration and revocation. `anon` and `authenticated` cannot execute it.
No public endpoint exposes guest records in this phase. Phase 6/7 must add
rate limits, redacted logs, secure HTTP-only guest cookies, explicit origin checks
for mutations and a minimal response allowlist. Do not put bearer tokens in
analytics, referrers or URLs.

Both buckets are private, limited to 5 MiB per object:

- `menu-images`: JPEG/PNG/WebP; path `restaurant_uuid/products/product_uuid/filename`.
- `ticket-attachments`: JPEG/PNG/WebP/PDF/plain text; path `restaurant_uuid/tickets/ticket_uuid/filename`.

Menu objects require matching metadata and public product visibility, or a
restaurant menu permission. Ticket upload requires a matching pending metadata
reservation owned by the uploader. Downloads require ready metadata and access
to that message; internal-note files remain staff-only. Clients cannot mark files
ready or replace/delete support evidence. Phase 7 must verify actual file content
and moderate/scan uploads before marking ready. MIME allowlists alone do not
provide content safety. Use short-lived signed URLs only after server access
checks; a signed URL remains usable until expiry.

## Connecting the intended project

1. Confirm the target Supabase project and environment before applying changes.
   Inspect existing schema, take a backup and test these migrations on a clean
   development project first. Do not assume this schema can replace an existing
   unrelated database.
2. For a new environment, review and apply all ordered files in `supabase/migrations/`. Do not
   apply the test bootstrap or test fixtures. `supabase/seed.sql` is optional
   development data only; it creates an unpublished ownerless sample with paused
   ordering, no people, orders or fake Storage objects. Do not seed client production.
3. Copy `.env.example` to `.env.local` and set the public HTTPS URL and
   `sb_publishable_` key. Restart Next.js. A server secret is optional and unused
   by readiness checks. Never expose it with `NEXT_PUBLIC_`.
4. Visit `/admin/database` and `/api/health`. The expected schema version is 2.
   A successful version check is not a security audit or an authentication test.
5. Run hosted security/performance advisors; verify generated types, Storage
   policies with actual uploads, anonymous/customer/staff access and Realtime
   subscriptions. Review any existing default grants/policies on that project.
6. Phase 3 creates/verifies the real owner account and securely bootstraps its
   membership. Ownership and restaurant publication cannot be claimed by clients.
   Keep ordering paused until checkout and release verification are complete.

The official Supabase CLI 3.1.0 is pinned. Phase 3 resolved its state-directory
issue by setting SUPABASE_HOME to the ignored workspace .supabase directory.
New Phase 3 migration files were created with the CLI, then aligned to the hosted
versions recorded by MCP. Full local Docker/Supabase services were not run. Use
the installed CLI --help before local/remote operations; never reset a live DB.

The public setup page exposes readiness only. Workspace routes now require verified
accounts and active restaurant permissions, with sensitive reads guarded on the backend.
