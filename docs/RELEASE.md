# Version 1 release candidate

The application uses the Next.js preset from the root of a private GitHub
repository. Import that repository into the intended Vercel team and select
Node.js 24. The included GitHub workflow runs lint, types, tests, a fixture
restore drill and a production build. Run the workflow on the final release commit.

| Environment variable | Value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL for this environment |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable key for that project |
| RESTAURANT_ID | Restaurant UUID in that database |
| APP_URL | Stable HTTPS origin of this deployment |

Use a separate test project for staging transactions. The production database
is on schema version 9 and already has the support-files Edge Function deployed.
For a fresh environment apply migrations in order. Deploy the support-files
function from supabase/functions with the checked-in function configuration.
Use Supabase Auth URL Configuration to set the production Site URL and allow
the exact APP_URL/auth/callback and APP_URL/auth/callback?next=/reset-password
URLs. Use the verified sender configuration for live email acceptance.

## Acceptance

- Run npm run test:auth:http -- https://your-deployment.example and confirm
  protected pages redirect to login and /api/health reports schema version 9.
- In staging verify registration, confirmation, sign-in, recovery and staff
  invitation acceptance using controlled accounts.
- Test guest pickup and delivery, signed-in checkout, retries, order status
  updates, account history, guest tracking and cash receipt/refund.
- Use separate staff and customer sessions to confirm Realtime isolation,
  restricted roles, and that internal support notes and attachments stay private.
- Upload a menu photo and support attachment, then verify authorized reads and
  denied reads using a different account and an invalid guest link.
- Check small and wide viewports and keyboard navigation for menu, checkout,
  order tracking, reports, ticket replies and the website mode controls.
- Check Normal, Orders Paused and Maintenance before production publication.
  The production storefront is currently unpublished and orders are paused.

## Backup and rollback

The source archive includes migrations and function source. It contains no
database backup or credentials. npm run test:restore restores a local PostgreSQL
fixture backup and checks the schema version, order totals and RLS isolation.

Before production launch, retain a hosted backup or logical database dump and
export private Storage objects separately. Restore into a staging project and
verify memberships, order totals, private attachments and Auth configuration.
The local fixture drill does not exercise hosted backup, Auth or Storage restore.
See [Supabase backups](https://supabase.com/docs/guides/platform/backups) and
[Storage exports](https://supabase.com/docs/guides/storage/management/download-objects).

If a release introduces an issue, pause orders from Website Controls and
promote the last known working Vercel deployment compatible with the hosted
schema. Assess data recovery independently before any database restore.

## Release evidence

168 automated tests passed. The local PostgreSQL fixture backup restored
successfully. The workspace has no GitHub remote or authenticated Vercel
deployment connection. The runner rejected loopback HTTP connections with
EACCES, so browser workflow and hosted application acceptance are pending.
