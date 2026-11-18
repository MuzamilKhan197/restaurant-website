# Phase 4 — menu management

The verified owner and authorized menu staff can manage the live restaurant menu
at `/admin/menu`. All mutations use verified-user Server Actions, fresh restaurant
permissions, Zod validation, user-scoped Supabase clients and database RLS. No
service secret is used. Read-only menu roles can inspect data without edit forms.

## Available workflows

1. Create a category with its slug, active state and display order.
2. Create a dish in that category. Set its description, exact PKR price, dietary
   labels, allergens, featured flag, availability and display order.
3. Open the dish editor to manage photographs, sizes/variants and linked extras.
4. Create reusable add-on groups on the menu page, define minimum/maximum choices,
   and add priced extras. Link or reorder those groups on individual dishes.
5. Search/filter dishes by name/category. Dish results are paginated in batches
   of 30 with stable ordering. Category/group management uses Supabase's configured
   result cap (currently 1,000 rows); larger catalogs need dedicated pagination.
6. Edit or deactivate existing records. Delete unused records or unlink extras.
   Historical order foreign keys block destructive product/variant/add-on removal;
   archive/deactivate referenced menu items instead. Photographs must be removed
   before deleting an unused dish.

Display order uses smaller numbers first. Variant prices are complete item prices,
not additional charges. Changing the default variant locks the parent product and
updates defaults in one transaction; failed edits cannot clear the old default.
The new RPC is SECURITY INVOKER and retains RLS, checks `menu.manage`, and validates
the restaurant/product/variant relationship. It cannot move variants across dishes.

Amounts are parsed from decimal strings into integer paisa without floating-point
price arithmetic. Saved orders retain their original item/variant/add-on snapshots.
Required add-on groups must have enough available options before real ordering is
enabled; full cart/choice validation belongs to the Phase 6 checkout transaction.

## Food photographs

- Inputs: JPEG, PNG or WebP, at most 5 MiB and 20 megapixels.
- The server checks signatures and MIME, decodes the content with pinned Sharp,
  applies orientation, limits dimensions to 2,400px and re-encodes as WebP without
  EXIF metadata. SVG, corrupt raster content and decompression-size excess fail.
- Object names use restaurant/product UUIDs and a fresh random filename. Original
  filenames are not used as paths. The `menu-images` bucket remains private.
- Alt text and sort order are editable. Staff previews use signed URLs lasting
  180 seconds. Refresh the editor after a preview URL expires.
- Storage and metadata writes cannot share a PostgreSQL transaction. Failed
  metadata insertion triggers a file-removal attempt. Deletion removes the object
  before metadata; if metadata cleanup fails, retry removal. Operators must review
  orphan/missing-object cleanup after service outages or concurrent edits.
- The Next.js Server Action body limit is 6 MB to accommodate the 5 MiB upload
  plus form overhead. Content decoding and dimensional limits provide additional
  controls; this is not a general document/attachment uploader.

Menu/category forms retain controlled field values after validation failures.
Server feedback reports duplicates, records still in use and permission failures.
File inputs must be selected again after a failed upload submission.

## Phase boundary

The hosted menu remains empty until the owner adds actual items. No demo dishes,
prices, test accounts or fake Storage objects were imported automatically. The
customer storefront still displays the existing clearly labeled sample catalog.
Connecting customer reads to this database is Phase 5; ordering is still paused.

Owner access and the local Auth origin/callbacks from Phase 3 are configured.
Actual signed-in menu browser acceptance, Storage HTTP round-trips and release
checks still require the user's owner session. Browser automation was unavailable
in this phase; no screenshot or signed-in end-to-end claim is made.

## Verification

`npm run test:all` includes decimal/image input checks, real PostgreSQL role/RLS
tests, atomic default replacement and rollback, cross-tenant rejection, read-only
role rejection, add-on relationship constraints, raster processing, and preserved
legacy checks. `npm run db:types:check` and `npm run db:types:hosted:check` verify
local and hosted schema contracts. The database readiness version is now 4.

The hosted security advisor currently flags a pre-existing Auth configuration:
[leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Enable it in the project's password/security settings when supported by the plan.
This phase did not weaken Auth settings. The two private deny-all tables also
retain expected informational RLS notices.
