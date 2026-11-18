# Phase 3 — accounts and staff access

## Implemented

- Supabase email/password registration, sign-in, sign-out and password recovery.
- Server Actions with Zod validation, generic account-discovery responses,
  accessible feedback and pending states. Passwords are never echoed into state.
- PKCE callback and optional token-hash confirmation route. Redirect destinations
  are restricted to application paths and a configured trusted origin.
- SSR cookie refresh in Next.js Proxy. Refresh headers are preserved and every
  auth/workspace response is private/no-store. Auth flows use one canonical
  origin so localhost and 127.0.0.1 cannot split PKCE verifier cookies.
- Auth-server-verified users on account/staff routes; no authorization uses
  `getSession()` or editable user metadata. Staff permissions are read from the
  database on each request. React cache only deduplicates within one render.
- Protected `/admin` layout and module guards. Navigation is permission-filtered,
  while Server Actions and database functions independently enforce access.
- Owner-only staff invitations, revocation, role assignment and suspension.
- Atomic custom-role creation/editing/deletion with owner-only permissions
  excluded from delegation. Built-in identities remain protected.
- Invitations use 32 random bytes, SHA-256 hashes, verified recipient emails,
  48-hour expiry, one-time acceptance and a 20/hour/restaurant creation limit.
  Reissuing revokes earlier pending tokens for that email. Existing memberships
  cannot be silently overwritten by accepting an invitation.
- Initial owner bootstrap is operator-only; signup cannot claim ownership.

## Connected development project

The user-created `restaurant` Supabase project is connected. Public URL and
publishable key are in ignored `.env.local`; no server secret was requested or
stored. The project was empty before the seven reviewed migrations were applied.
Local migration filenames match the hosted migration versions. Do not push the
same schema again with a second migration history.

The database contains one **unpublished, sample** restaurant with ordering paused.
No sample customer/order data or test Auth accounts were added to hosted Supabase.
The legacy SQLite records remain separate and unchanged. Menu import/management
belongs to Phase 4; the public catalog remains explicitly marked sample data.

## Required Auth dashboard settings

The local Auth origin and both callback URLs below were saved and verified in
the Supabase dashboard in the preceding setup session. The designated owner
account is email-verified and has an active Owner membership, rechecked on
2026-11-17. For another environment, use [Auth URL configuration](https://supabase.com/dashboard/project/tafldffgwyywhuymkiee/auth/url-configuration).

| Setting | Local value |
| --- | --- |
| Site URL | `http://127.0.0.1:3003` |
| Redirect URL | `http://127.0.0.1:3003/auth/callback` |
| Recovery redirect URL | `http://127.0.0.1:3003/auth/callback?next=/reset-password` |

Keep email confirmations enabled. The app rejects unconfirmed and anonymous
users from protected pages. Before production, configure a verified SMTP sender,
delivery limits and bot protection in Supabase. Built-in email delivery may be
limited to authorized recipients; delivery is not claimed as verified here.
Use real email inboxes for acceptance tests. Auth-provider rate limits apply;
multi-instance application/edge throttling should be configured before release.

For deployment, set `APP_URL` to the actual HTTPS origin and replace development
redirect URLs with exact production callbacks. Do not derive email URLs from
request Host headers. The optional `/auth/confirm` route supports custom email
templates that pass `token_hash` and type `signup`, `email` or `recovery`.

## Set up the real owner

1. The owner creates an account at `/register` and confirms their own email.
   Never enter their password into chat, source files or migration SQL.
2. The project operator verifies the intended owner's email and Auth user UUID.
   Do not assign ownership to the first account that happens to register.
3. Run the service-only `public.bootstrap_restaurant_owner(restaurant_uuid,
   verified_owner_uuid)` using the authorized operator connection. The function
   requires a confirmed non-anonymous account, locks the restaurant, rejects
   replacing another owner, creates an active Owner membership and records audit
   events. It does not publish the restaurant or enable ordering.
4. Sign in and open `/admin/staff`. Create a private invitation link for a named
   employee, then share it yourself through your chosen channel. No automatic
   email or message is sent by the invitation form.
5. The employee registers/confirms using the invited email and opens the original
   invitation URL. Tokens are in URL fragments, not query strings or server logs.
   If login loses the fragment, reopen the original link after signing in.

Operator bootstrap uses the restaurant UUID already in `.env.local`. It is never
granted to `anon` or `authenticated`; no browser-accessible bootstrap exists.
The server-secret client remains unused by app routes. Account editing, addresses
and order history are scheduled for Phase 5.

## Security and operational limits

Public RPCs are SECURITY INVOKER wrappers around narrowly scoped implementations
in the unexposed private schema. Every privileged implementation checks the
verified caller and trusted owner identity, or the invitation's verified email,
hash and validity. Database grants/RLS remain an independent enforcement layer.
Do not expose `private` as a Data API schema.

The application verifies Auth users on protected server requests and uses fresh
database membership permissions. Supabase access JWTs can remain valid until
expiry after global sign-out; the database RPCs do not independently validate
`session_id` against `auth.sessions`. Keep short JWT lifetimes and test this
behavior against the final security requirements before production. Suspending
a membership or changing a role takes effect immediately in database checks.

Full email confirmation, recovery, signed-in browser flows, live file transfer
and Realtime delivery still need integration acceptance tests with the real owner
account after Auth configuration. This phase is not a production release.
