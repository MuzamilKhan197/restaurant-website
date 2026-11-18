# Customer support

Phase 7 implements private support conversations in the same application and
database as ordering. No support emails are sent automatically.

## Customer and guest workflow

- /support/new creates a unique ticket, category, normal initial priority and
  first message. Categories cover order problems, cancellation, complaints,
  delivery and general questions.
- /account/support shows registered customers their own tickets. Confirmed Auth
  identity determines email and customer association, never client IDs.
- Guests receive 30-day private links with random 32-byte secrets in the URL
  fragment. Only hashes are stored. Creation and replies use idempotency tokens.
- Order links require the customer's own order or its matching guest capability.
  An order reference or matching email alone never grants access.
- Existing customers/orders retain support during maintenance or a draft.
  New general guest requests require a published restaurant.
- Conversations paginate 50 messages, refresh every 15 seconds while visible,
  and preserve typed replies. Resolved/closed tickets require staff reopening.
- A support request does not automatically cancel an order or refund payment.

## Staff

/admin/support supports subject search, status/priority/assignment filters and
25-ticket pagination. Details show conversations and customer contacts.
Linked orders additionally require orders.read permission.

| Operation | Required permissions |
| --- | --- |
| Read tickets/internal notes | support.read |
| Reply or write internal notes | support.read and support.reply |
| Assign/prioritize/escalate/resolve/close/reopen | support.read and support.manage |

Only active support staff with active roles may be assigned. Previous-update
timestamps prevent overwriting another staff change.
Public staff replies move active tickets to waiting_customer; customer replies
move waiting_customer to in_progress. Internal notes preserve status, and
escalation remains until deliberately changed.

Read-only staff cannot use a fabricated guest token to bypass reply permissions.
Internal messages and attachment metadata are excluded from customer/guest reads
and message counts. Audit records contain action metadata, not message bodies.

## Attachments

Authors can attach evidence to their own messages: JPEG, PNG, WebP, PDF or UTF-8
text, up to 5 MiB and five files per message. Signature/type/encoding and request
byte limits are checked. HTML/SVG files are rejected. Files download as
attachments rather than being embedded as active documents.

The ticket-attachments bucket remains private. A quota/authorization-checked RPC
mints metadata; clients cannot directly insert attachment rows. Pending files
cannot be downloaded.

The support-files Edge Function verifies user sessions or ticket capabilities
through a caller-scoped database RPC. Only after authorization does it use its
Supabase-provided server credential for that exact Storage operation. No secret
key is added to the Next.js environment or browser.

The gateway JWT check is disabled because guests prove resource capabilities.
Authenticated sessions are independently checked with getUser, confirmed email
and fresh database permissions. Invalid authenticated sessions cannot fall back
to guest access.

Successful files become ready; failed uploads become rejected. Finalization
failures remove uploaded bytes. Downloads require fresh authorization and use
60-second signed URLs with a forced download filename.

## Acceptance

Run npm run test:all and npm run check. Restart the preview with
npm run preview:restart in a normal project terminal.
The external smoke script is:
node --use-system-ca scripts/smoke-support-files.mjs

In the browser, create guest support from private order tracking, save the
ticket link, reply, attach and download evidence. Repeat as registered customer.
Confirm another account and invalid/expired tokens fail. As staff, add internal
notes/files and confirm they remain hidden from customers. Assign/escalate/
resolve, verify reply blocking, then reopen. Test read-only staff permissions.

The managed runner cannot reach localhost and external project DNS resolution
failed. SQL/deployment probes succeeded through the connected management service.
A complete live Auth/Storage/browser round trip remains an acceptance check.
