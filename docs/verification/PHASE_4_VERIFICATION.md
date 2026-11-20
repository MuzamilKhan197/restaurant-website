# Phase 4 verification — 2026-11-17

## Delivered

- `/admin/menu`: real categories/products, search, category filters, pagination,
  display order, prices, dietary/allergen metadata and availability controls.
- `/admin/menu/[id]`: dish details, private processed photographs, variant CRUD,
  atomic default selection and reusable add-on group linking/reordering.
- Add-on group and extra CRUD with choice limits and exact minor-unit pricing.
- Verified owner/menu permission guards on every mutation, tenant scoping, RLS,
  database audit triggers and restrictions preserving historical order snapshots.
- Controlled form drafts survive validation failures and refresh when saved
  server records change, including replacement of the default variant.
- Sharp 0.35.5 pinned directly; npm normalized and verified the lockfile offline.
  Photos are decoded, dimension-limited, oriented, resized and stripped of EXIF
  before private WebP storage. Short-lived signed previews avoid a public bucket.
- Schema readiness v4 and migration `20261117115323_menu_variant_updates.sql`,
  applied to the already selected hosted restaurant project.

## Passed

| Check | Result |
| --- | --- |
| Foundation/auth/menu validation | 21 passed |
| PostgreSQL RLS/integrity/staff/menu/seed tests | 53 passed |
| Raster processing tests | 3 passed |
| Preserved legacy tests | 30 passed |
| Total automated tests | 107 passed |
| TypeScript, ESLint, source formatting | Passed |
| Local generated type drift | Passed |
| Hosted/local public schema comparison | Table columns, enums and RPC names match |
| Hosted schema version | 4 |
| Hosted owner/menu/default-variant transaction probe | Passed; rolled back |
| Verification category/product rows left in hosted database | 0 / 0 |
| Production compilation, TypeScript, static generation and traces | Passed using isolated Webpack build |

The positive hosted probe ran with the designated owner's database role context,
created temporary records, switched defaults, asserted exactly one default, and
rolled the entire transaction back. It verifies database behavior, not an Auth
login or browser session. No example dishes were permanently added to the live menu.

## Build environment

The managed Windows runner stalled during Turbopack compilation. Webpack rejects
`!` in the original workspace path. An isolated copy in the approved user Temp
directory avoided that path, using the existing exact dependency files. Output
folders were pre-created and `cleanDistDir:false` applied only in that temporary
configuration to avoid concurrent directory-creation EPERM errors in the runner.
The application's source/configuration in the real project was not renamed.

The finalizer compares all source files after canonical formatting before copying
the successful `.next` build back to the project. It excludes build caches and
retains a successful build log. Source equivalence was verified after the final
form-state fix. Production build flags/configuration elsewhere should be tested
again in the final deployment environment.

## Preview handoff and remaining integration checks

An older host process owns port 3003. This managed runner cannot inspect/control
that host listener or connect to loopback: HTTP checks fail with `EACCES`, while
another start attempt returns `EADDRINUSE`. An isolated child HTTP attempt was
also blocked and its owned process was stopped. No successful live HTTP/browser
or signed-in Storage upload acceptance check is claimed for this phase.

Run **`npm run preview:restart` in a normal Windows project terminal**. It verifies
that the listener command belongs to this project's Next server before stopping
it, then serves the verified build on 127.0.0.1:3003. It refuses to kill an
unverified listener. Sign in as the configured owner and visit `/admin/menu`.
If the original server is in a visible terminal, stopping it there and running
`npm start` is also sufficient.

The real owner is confirmed/active. Site URL and confirmation/recovery callbacks
were saved and verified in the preceding dashboard session. This phase did not
publish the restaurant or enable ordering. The public storefront still uses the
explicitly labeled sample catalog; Phase 5 connects customer reads and account
features. Actual signed-in CRUD, Storage round-trips, recovery email and release
acceptance remain to be verified in the user's normal runtime.

## Hosted security advisory

The menu migration introduced no new RLS/function warnings. The advisor currently
reports the pre-existing [leaked-password protection setting as disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Enable it when supported by the project plan before production release. Expected
informational notices remain for the private backend tables with deny-all RLS.
