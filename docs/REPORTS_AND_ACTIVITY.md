# Reports and activity

Phase 8 connects the workspace overview, sales reports and activity log to real
restaurant data. Empty databases show genuine zero/empty states; sample figures
are never substituted.

## Dashboard and permissions

/admin shows current total/pending/in-progress orders, registered customer and
unresolved support counts according to the caller's permissions. Recent orders
require orders.read. Financial cards and the last-seven-days chart require
reports.read. Staff with other roles see their permitted tools.

/admin/reports requires reports.read. A report-only custom role can access
aggregate statistics without gaining raw order/contact access. /admin/activity
separately requires audit.read; neither permission implies the other.

Public RPC wrappers run as invoker. Private aggregate implementations verify
confirmed identity and fresh, restaurant-scoped permissions before reading data.
No service credentials or user-editable Auth metadata authorize reports.

## Financial definitions

| Metric | Meaning |
| --- | --- |
| Completed sales | Full totals of currently completed orders created in the date range, including order tax/delivery |
| Average completed order | Completed sales divided by completed order count, rounded to a minor unit |
| Cash received | Payments whose actual paid_at timestamp falls in the range, including older orders |
| Cash refunded | Payments whose actual refunded_at timestamp falls in the range |
| Net cash flow | Cash received minus cash refunded; it can be negative |
| Awaiting collection | Unpaid accepted/preparing/ready/completed orders created in the range |
| Refunds due | Outstanding refund_due payments for orders created in the range |
| Popular dishes | Top ten products by quantity in completed orders created in the range |

Unaccepted pending orders are excluded from cash awaiting collection. Cancelled
and rejected orders never count as completed sales. Cash receipts remain counted
once after cancellation/refund, while the actual refund is separately recorded.
These reports describe current order states rather than reconstructing their
historical state at an earlier date.

Popular dish names use their latest completed-sale snapshot. Item sales include
extras and exclude order-level delivery/tax. Menu price/name changes do not alter
historical amounts. All amounts cross the RPC boundary as integer strings and
use BigInt formatting to preserve exact cents beyond JavaScript safe integers.

## Dates, charts and export

Filters accept real calendar dates from 2000 through 2100 and an inclusive range
of up to 366 days. Database midnight boundaries use the restaurant timezone,
including daylight-saving changes. Presets cover the last 7, 30 and 90 days.

The interactive chart shows completed sales, receipts, refunds or order counts.
It groups longer ranges by week/month across the entire selected period without
discarding dates. Focus/hover exposes exact values; the daily table remains
available alongside daily and popular-product CSV downloads.

CSV endpoints repeat permission checks, validate filters, use private/no-store
responses and fixed safe download filenames. Amounts use exact decimal strings;
untrusted names are escaped and spreadsheet formula prefixes are neutralized.

## Activity and customer history

The activity log supports date, record type, action and actor filters with stable
50-row pagination. It includes the current staff display name or a neutral
account/system label, action, time and record reference. Links appear only when
the caller also has the corresponding module permission.

Raw audit metadata, message bodies, customer contacts and file contents are not
returned by the activity RPC. Authenticated users cannot alter audit records.
The log covers configured database mutation events, not every page view/login.

Customer details now paginate all relevant order history in 20-row pages and
link to order details, with both customers.read and orders.read checks.

## Refund workflow correction

The existing payment controls offered a refund from paid and omitted refund_due.
They now match the database rules: unpaid -> paid, and refund_due -> refunded.
Cancelling/rejecting a paid order creates refund_due. Cancelled/rejected unpaid
orders no longer offer collection controls. The backend validates the expected
previous state and retains independent payments.manage checks.

## Acceptance

After npm run preview:restart in a normal project terminal:

1. Sign in and review /admin, /admin/reports and /admin/activity.
2. Compare a populated report against orders and actual cash events.
3. Change dates/metrics, inspect the full daily table and download both CSVs.
4. Check report-only and audit-only roles independently and revoke access.
5. Change menu prices and confirm prior sales use their snapshots.
6. Record cash, cancel a paid active order and record the resulting refund.
7. Inspect corresponding audit activity and paginated customer order history.

The managed runner cannot connect to the preview (EACCES). Signed-in browser,
responsive visual review and actual browser download checks remain acceptance
steps. SQL tests and the live rolled-back financial probe are separately verified.
