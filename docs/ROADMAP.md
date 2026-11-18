# Restaurant platform implementation roadmap

The approved scope is the user's complete Restaurant Management & Online Ordering
System specification. Work is deliberately phased; this is not a claim that the
entire system is complete.

## Phase 1 — Foundation and design system

- One Next.js App Router application in the project root.
- React, strict TypeScript, Tailwind CSS v4 and shadcn-compatible source components.
- Local fonts and food assets, preserving the original catalogue.
- Customer cream/orange/charcoal theme and separate navy/blue workspace theme.
- Customer layout, home, searchable sample menu, dish details, story, contact
  information and help center.
- Workspace layout, navigation, section finder, roadmap and design-system page.
- Honest loading, empty, disabled, error and not-found states.
- Lint, type checking, menu/configuration tests and a production build.
- Preserve the previous local application and SQLite records separately.

**No Supabase connection, authentication, real ordering, live dashboard metrics,
RBAC or RLS is claimed in this phase.** Workspace pages are publicly accessible
design/foundation pages containing no customer records. Upcoming sections are
explicitly marked with their implementation phase. Do not add real records to
these pages before the appropriate server authentication and policies exist.

## Phase 2 — Database and security

Create Supabase migrations and relationships for restaurants, profiles, staff
memberships, roles, permissions, categories, products, product variants, add-ons,
orders, order-item snapshots, cash payment records, addresses, support tickets,
messages, attachments, website settings and audit events. Every operational row
must be restaurant-scoped. Add and test RLS and private Storage policies. Review
the existing SQLite data before a deliberate, separately verified data migration.

## Phase 3 — Authentication and permissions

Supabase SSR/browser clients, registration, login, password recovery, staff
invitations and session validation. Built-in Owner, Admin, Manager, Support Agent,
Developer and Customer roles; custom staff roles. Permission checks must run in
the backend and database, not merely hide menu items. Test cross-role and
cross-restaurant access, including owner-only staff/role management.

## Phase 4 — Menu management

Implemented: protected live menu CRUD, search/category filters, dish pagination,
sorting and availability, atomic default variants, reusable add-on groups and
private image processing/uploads. See [MENU_MANAGEMENT.md](MENU_MANAGEMENT.md).

Categories, dishes, prices, availability, image uploads, variant sizes and add-ons.
Validate all inputs with Zod. Audit writes. Preserve historical order snapshots.

## Phase 5 — Customer experience

Implemented: published catalogue, size/extra price previews, owner publication,
verified profiles, atomic saved addresses, snapshot order history and staff
customer management. See [CUSTOMER_EXPERIENCE.md](CUSTOMER_EXPERIENCE.md) and
[PHASE_5_VERIFICATION.md](PHASE_5_VERIFICATION.md) for checks and manual acceptance.

Connect storefront reads to Supabase. Add account/profile pages, saved addresses
and registered order history. Keep guest checkout available. Product details
must present actual options and availability without exposing private fields.

## Phase 6 — Checkout and order management

Implemented: persistent cart, guest/account cash checkout, authoritative quotes,
atomic immutable orders, idempotent retries, private capability tracking,
staff status/cash workflows and minimal Realtime updates with polling fallback.
See [CHECKOUT_AND_ORDERS.md](CHECKOUT_AND_ORDERS.md) and
[PHASE_6_VERIFICATION.md](PHASE_6_VERIFICATION.md).

Delivery/pickup, COD/pay-at-pickup, trusted server pricing, immutable line-item
snapshots, duplicate-request protection and inventory/availability checks relevant
to V1. Workflow: Pending → Accepted → Preparing → Ready → Completed; Rejected and
Cancelled have explicit permitted transitions. Private guest references, secure
tracking, authorized Realtime updates and staff order tools.

## Phase 7 — Support

Implemented: guest/account private tickets, order ownership, idempotent requests
and replies, internal notes, assignments, priorities, escalation/resolution/
reopen and private attachments. See [SUPPORT_SYSTEM.md](SUPPORT_SYSTEM.md) and
[PHASE_7_VERIFICATION.md](PHASE_7_VERIFICATION.md) for remaining transport checks.

Guest/customer tickets with unique numbers, category, priority, status, thread
messages and optional private attachments. Staff replies, assignment, escalation
and resolution. Prevent unauthorized order, ticket and attachment access.

## Phase 8 — Reports and activity

Implemented: permission-aware operational dashboard, aggregate sales/cash
reports, timezone-aware dates/charts, exact CSV downloads, popular dishes,
filtered activity log and paginated customer order history. See
[REPORTS_AND_ACTIVITY.md](REPORTS_AND_ACTIVITY.md) and
[PHASE_8_VERIFICATION.md](PHASE_8_VERIFICATION.md) for checks and remaining browser
acceptance.

Actual order/sales statistics, basic charts, recent orders, popular products,
customer history and audit logs. Use real data and separate unpaid/cancelled
orders from collected revenue. Restrict report/customer access by permission.

## Phase 9 — Website controls

Implemented in /admin/website and /admin/settings. Staff with the assigned
permissions can change website mode, maintenance copy, contact details,
opening hours, tax and delivery settings. Delivery areas can be deactivated
while preserving order history. Opening hours are informational and the mode
controls checkout. A reopening time is displayed in the restaurant timezone.
Existing account orders, private tracking and support stay available during
maintenance. Hosted schema version 9 includes migration
20261118115106_website_controls.sql.

Normal, Orders Paused and Maintenance modes. Check mode on the server before
checkout. The maintenance page supports logo, message and optional reopening
time. Staff must still be able to manage existing operations securely.

## Phase 10 — Verification and release

End-to-end customer/staff flows, RLS and permissions, private attachments, guest
tracking, Realtime isolation, responsive accessibility checks, backup/restore and
release documentation. Connect the user's GitHub repository and Vercel project
when their accounts and deployment configuration are available.

## Deferred versions

V2: kitchen dashboard, delivery operations, online payments, coupons, inventory,
reservations, loyalty, advanced analytics, attendance and shifts. Existing legacy
reservations remain available in the preserved application, but are not part of
the new V1 implementation.

V3: multiple branches/restaurants, subscriptions, onboarding, custom domains,
platform super admin and full multi-tenant management. V1 data relationships must
leave room for these, without shipping a website builder or QR table ordering.
