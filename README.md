# Saffron & Ember — Restaurant Platform

The customer website and restaurant workspace share **one Next.js App Router application**. The approved scope and implementation
sequence are recorded in [docs/ROADMAP.md](docs/ROADMAP.md).

## V1 status

The [production site](https://restaurant-website-two-indol.vercel.app) is deployed
on Vercel from GitHub `main` and connected to Supabase. V1 features are implemented.
Final signed-in browser acceptance, responsive accessibility checks and hosted
recovery verification are tracked in the [release runbook](docs/RELEASE.md).

- [Authentication and roles](docs/AUTHENTICATION.md) cover verified accounts,
  staff invitations and permission-scoped workspace access.
- [Menu management](docs/MENU_MANAGEMENT.md), [customer accounts](docs/CUSTOMER_EXPERIENCE.md)
  and [checkout and orders](docs/CHECKOUT_AND_ORDERS.md) cover catalogue updates,
  saved addresses, guest and account checkout, and staff order workflows.
- People Access groups account profiles, staff and customers. Customer details
  show order and ticket history according to permissions.
- The [support inbox](docs/SUPPORT_SYSTEM.md) supports ticket search by number,
  opener name or subject, plus replies, assignments and private attachments.
- [Reports and activity](docs/REPORTS_AND_ACTIVITY.md) include sales and cash
  summaries, CSV exports and audit events. Website Controls manages storefront
  availability and checkout modes.

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
    people/              Account, staff and customer directory
    support/             Staff support inbox and ticket conversations
    design-system/       Shared component and interaction showcase
    database/            Connection readiness and security setup
  api/health/            Minimal application readiness response
  globals.css            Tailwind v4 and scoped design tokens
src/components/
  ui/                    Editable shadcn-style component source
  customer/              Storefront navigation, cards and menu browser
  admin/                 Workspace navigation, header and management controls
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

## Configuration

Use `.env.local.example` for the Supabase URL, publishable key, restaurant ID
and app origin. See the [release runbook](docs/RELEASE.md) for deployment setup
and [database documentation](docs/DATABASE.md) for migrations.

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
prices. Legacy SQLite records remain separate. Any migration of those records requires a reviewed data import.

## Version scope

V1 includes connected ordering, customer accounts, custom staff roles and
permissions, support tickets, reports and the three website modes. V2/V3 are
listed in the roadmap; they are outside the current V1 release. Existing legacy
reservations remain preserved while the new platform follows the agreed V1 scope.
