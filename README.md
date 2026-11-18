# Saffron & Ember — Restaurant Platform

A phased migration to **one Next.js App Router application** for the customer
website and restaurant management dashboard. The approved scope and implementation
sequence are recorded in [docs/ROADMAP.md](docs/ROADMAP.md).

## Current stage: Phase 9 - Website controls

The user-created Supabase restaurant project is connected and thirteen reviewed
migrations are applied. Registration, sign-in, password recovery, verified
sessions, protected workspace routes, employee invitations and custom roles are
implemented. See [AUTHENTICATION.md](docs/AUTHENTICATION.md) for Auth redirect
configuration and verified owner bootstrap, and [DATABASE.md](docs/DATABASE.md)
for the data model.

The designated owner is verified and active, and local Auth callbacks are saved.
Menu staff can now manage categories, dishes, private photographs, variants and
reusable add-ons at `/admin/menu`. See [MENU_MANAGEMENT.md](docs/MENU_MANAGEMENT.md).
The hosted schema is v9. The storefront reads actual published menu records;
profiles, addresses, private order history and staff customer management are
connected. Guest/account cash checkout, server pricing, duplicate protection,
private tracking and staff order/payment tools are implemented. See
[customer experience](docs/CUSTOMER_EXPERIENCE.md) and
[checkout and orders](docs/CHECKOUT_AND_ORDERS.md).
Private support tickets, conversations, internal notes, assignments, resolution
and private attachments are implemented. See [support system](docs/SUPPORT_SYSTEM.md).
Live dashboard metrics, sales/cash reports, interactive charts, popular dishes,
CSV downloads and activity logs are implemented. See
[reports and activity](docs/REPORTS_AND_ACTIVITY.md).
Restaurant settings and website controls are available in the workspace.
The [release runbook](docs/RELEASE.md) records deployment configuration,
acceptance checks and backup recovery. The application is a release candidate
pending hosted deployment and browser acceptance.
The restaurant stays unpublished with ordering paused. The legacy application
is preserved.

## Run the new application

Requires Node.js 22.13 or newer and npm. Dependencies are pinned in package.json
and package-lock.json.

```sh
npm ci
npm run dev
```

- Customer website: http://localhost:3003
- Account registration: http://127.0.0.1:3003/register
- Sign in: http://127.0.0.1:3003/login
- Workspace (verified staff only): http://127.0.0.1:3003/admin
- Public setup status: http://127.0.0.1:3003/setup
- Component showcase: http://localhost:3003/admin/design-system
- Health route: http://localhost:3003/api/health

Port 3003 keeps the new application separate from the preserved previous version.
Both customer and workspace pages use this single Next.js process.

To replace an older restaurant preview on port 3003, run `npm run preview:restart`
from a normal Windows project terminal. It verifies the listener belongs to this
project before stopping it. The managed runner cannot access the existing host
listener; see [PHASE_4_VERIFICATION.md](docs/PHASE_4_VERIFICATION.md) for the build
workaround, test evidence and remaining owner-session acceptance checks.

## Verification and production build

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:all
npm run db:types:check
npm run build
npm start
```

`npm start` serves the production build on port 3003. The environment doesn't need
Supabase credentials to preview the application. Images and fonts are local; compilation does
not require a remote font service. Sample pages are marked noindex until the
business setup is real.

## Project structure

```text
src/app/
  (customer)/            Shared customer layout and public pages
    menu/[id]/           Dish detail routes
  admin/                 Separate workspace layout and overview
    [module]/            Explicit upcoming-phase pages
    design-system/       Shared component and interaction showcase
    database/            Connection readiness and security setup
  api/health/            Minimal application readiness response
  globals.css            Tailwind v4 and scoped design tokens
src/components/
  ui/                    Editable shadcn-style component source
  customer/              Storefront navigation, cards and menu browser
  admin/                 Workspace navigation, header and previews
  shared/                Brand and empty-state components
src/features/menu/       Typed sample data, filtering and formatting
src/lib/                 Configuration, public environment schema and helpers
supabase/                SQL migrations, private bucket policies and development seed
tests/                   Foundation, PostgreSQL policy and seed checks
public/assets/           Local photographs, fonts and license notices
docs/ROADMAP.md          Approved implementation sequence and boundaries
```

The primitives follow shadcn/ui's editable-source convention, using Tailwind,
class-variance-authority and Radix primitives. `components.json` contains the
aliases and Tailwind v4 configuration. Components include Button, Badge, Card,
Input, Skeleton and Dialog. The component showcase verifies interaction, focus,
loading, empty and disabled states.

## Design tokens

- Customer: cream `#FAF7F2`, orange `#F97316`, charcoal `#171717`.
- Workspace: navy `#111827`, action blue `#2563EB`, light canvas `#F6F7FB`.
- Shared spacing, focus styles and reduced-motion support.
- DM Sans and Playfair Display are served locally through next/font.

Orange primary buttons use dark text for readable contrast. Workspace dialog
portals receive the scoped admin theme explicitly.

## Configuration and the next phase

`.env.local.example` documents the public Supabase URL and publishable-key pair
for Phase 2. Do not put service-role credentials in any NEXT_PUBLIC variable.
The public configuration validator selects only explicitly allowed values and
rejects partial or insecure configuration.

No Supabase project, GitHub repository or Vercel deployment has been created or
connected yet. Phase 2 will add reviewed migrations and RLS, followed by
Supabase Authentication, Storage and authorized Realtime in their relevant phases.

## Previous working application — preserved

All previous HTML/JavaScript files, API modules, original assets, `.env`, backups
and SQLite records remain in place. The Next.js app does not import the legacy
SQLite server or expose its records. The old package scripts and documentation
are preserved in docs/legacy-package.json and docs/legacy.md.

```sh
npm run legacy:dev
npm run legacy:test
npm run legacy:check
npm run legacy:build
npm run backup
```

The previous server normally uses port 3000. Its administrator credentials and
data still belong to that installation; they do not authenticate the new app.
The old `dist/` output is separate from the Next.js `.next/` build.

The old catalog is carried into typed sample fixtures without changing original
prices. No SQLite records have been migrated or deleted. Data migration will be
explicitly reviewed and tested after the Supabase schema is ready.

## Version scope

V1 includes connected ordering, customer accounts, custom staff roles and
permissions, support tickets, reports and the three website modes. V2/V3 are
listed in the roadmap; they are not being built into Phase 1. Existing legacy
reservations remain preserved while the new platform follows the agreed V1 scope.
