# Saffron & Ember

A complete local restaurant application with a responsive customer website, a
SQLite backend and a password-protected management dashboard. No npm packages
need installing. Requires **Node.js 22.13 or newer** (Node 25 is used here).

## Start

```sh
npm run setup
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin.
The first setup creates `.env` with a unique administrator password. Open that
file locally for the initial email/password. They are never served over HTTP or
printed in server logs. Change the password in Business settings after signing
in. Setup preserves an existing `.env` and does not reset database credentials.
After a password change, use the new password; the original `.env` password is no
longer valid.

Stop the server with Ctrl+C. Set `PORT` for another port. The server listens only
on 127.0.0.1. Open via HTTP, not by double-clicking index.html.

## Customer features

- Home, searchable menu, story, reservations, contact, gallery and FAQs.
- Responsive mobile navigation, keyboard focus, reduced-motion support and dialogs.
- Twelve sample dishes, category and vegetarian/vegan filters, dietary/allergen
  information, featured dishes and sold-out states.
- Persistent bag, quantity controls, item removal and cross-tab synchronization.
- Pickup/delivery checkout, supported delivery areas, minimum order, order notes,
  server-calculated prices, tax and delivery fees.
- Payment on collection/delivery. No card details or online payments are collected.
- Database-backed order, table and message submission with loading/error/retry states.
- Reservation hours in Asia/Karachi, closed dates, booking window, guest limits and
  overlapping-visit capacity checks. New requests start as pending for staff review.
- Request references and private access keys; status lookup, eligible cancellation,
  saved browser references, downloadable order summaries and printing.
- Local image and font assets, original favicon, web manifest, custom 404, page
  titles, descriptions and operational privacy/ordering information.

## Management features

- Hashed administrator password, eight-hour HTTP-only sessions, logout and password
  change that revokes all sessions.
- Overview with actual record counts and collected payments (not invented metrics).
- Searchable and paginated orders, reservations and contact inbox.
- Order workflow: pending, confirmed, preparing, ready, out for delivery, completed
  or cancelled. Pickup orders cannot go out for delivery.
- Record cash collection and completed refunds. Cancelling a paid order flags
  refund due; the software does not transfer money itself.
- Reservation workflow: pending, confirmed, seated, completed, no-show or cancelled.
- Contact inbox: new, read, archived.
- Menu creation/editing, prices, images, labels, featured dishes, sold-out switches
  and archiving. Existing orders keep a snapshot of original names and prices.
- Editable business contact details, ordering/delivery switches, delivery areas,
  fees, tax, guest limits, seat capacity, visit duration, closed dates and daily hours.
- CSV exports, spreadsheet formula protection, activity log and SQLite backups.
- Concurrent edits are version checked; stale changes require refreshing.

## Data and configuration

Runtime data lives in `storage/restaurant.sqlite`, with SQLite WAL sidecars while
running. Do not commit or publicly serve storage, backups or `.env`.
`data.js` seeds a new database once. After that, edit menu/settings in management;
changing the seed file does not overwrite existing records.

Only dish IDs/quantities and up to 20 request references/private keys are stored in
the browser. Contact information is stored in the server database and is visible
to authenticated administrators. Public tracking responses omit contact details.
Private keys are sent in authorization headers, not URL query strings.

Reservation capacity models seats across overlapping visits. It does not assign
individual physical tables. Changing hours/capacity does not cancel existing
requests; review existing reservations when changing operating settings.

Environment options are listed in `.env.example`:

| Setting | Purpose |
| --- | --- |
| ADMIN_EMAIL / ADMIN_PASSWORD | Initial administrator, used only when database credentials have not been initialized |
| PORT | Local server port (default 3000) |
| DB_PATH | Database location (default storage/restaurant.sqlite) |
| PUBLIC_ORIGIN | Exact public HTTPS origin when intentionally deployed behind a reverse proxy; enables Secure cookies |
| SERVE_DIST=1 | Serve built frontend assets while keeping the same Node API/database |

## Checks, build and backup

```sh
npm run check
npm test
npm run build
npm run backup
```

The build copies public assets to `dist/`; it never copies `.env`, server source or
customer records. This application needs its Node backend for transactions.
Uploading only `dist/` to a static host gives browsing, not working submissions.

To run the built site in PowerShell:

```powershell
$env:SERVE_DIST = '1'
npm start
```

Backups are consistent SQLite snapshots in `backups/`. To restore a backup, stop
all server processes, preserve the current storage directory, and restore the
selected snapshot as `storage/restaurant.sqlite` in a fresh storage directory.
Do not mix an old snapshot with newer WAL/SHM sidecars. Keep backups private.

Tests use isolated in-memory or temporary databases. They never create test orders
or change administrator credentials in the working restaurant database.

## Before a real business launch

This is still a **sample restaurant**, with fictional branding, sample city,
illustrative food photographs, sample prices/fees and sample delivery areas.
Orders/reservations are real saved local records, not acceptance by an operating
restaurant. Staff confirmation is required.

The implementation is complete for local cash-order and reservation management.
The following require real business inputs or external services:

1. Replace the sample name, actual street address, phone, email, photos, story,
   operating hours, menu/allergens, tax and delivery settings. Static editorial
   copy, SEO metadata and manifest branding are in index.html/manifest.webmanifest.
2. Select a payment provider and add its hosted checkout plus verified webhooks
   if online payments are required. Never accept a browser-reported paid status.
3. Select an email/SMS provider, add server-side credentials, and implement/review
   delivery and retry handling before enabling outgoing notifications. No messages
   are sent by this installation.
4. Deploy the Node server and persistent database storage, configure HTTPS and
   PUBLIC_ORIGIN, and arrange private backups and monitoring. Do not use ephemeral
   hosting storage for the SQLite database or run independent SQLite copies across
   multiple server instances.
5. Publish the operator's actual privacy, retention, ordering/refund/cancellation
   terms. The current pages describe this local installation's behaviour.

No hosting was purchased, domain registered, live payment taken or message sent.

## Source map

| Path | Purpose |
| --- | --- |
| index.html / styles.css | Customer pages and responsive design |
| app.js | Menu, bag, requests and API connection |
| extras.js | Tracking, cancellation, summaries and gallery |
| admin.html / admin.css / admin.js | Authenticated management UI |
| data.js | Initial business/menu seed |
| lib/domain.js | Shared totals and booking rules |
| server/store.js | SQLite schema, transactions, hashing and sessions |
| server/service.js | Business validation and workflows |
| server/http.js | HTTP API, access controls and public file serving |
| server/setup.js | Initial private configuration |
| scripts/ | Startup, build, syntax checks, backups and optional photo downloads |
| test/ | Automated domain, storage, API and asset checks |
| assets/ | Local photos/fonts and license notices |

Photo sources are recorded in scripts/fetch-assets.mjs and assets/CREDITS.md.
The asset downloader is optional and needs internet access. Normal use is offline.
