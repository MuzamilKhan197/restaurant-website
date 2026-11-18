# Checkout and order management

Phase 6 implements a real cash-order workflow. Ordering is available only for a
published restaurant in normal mode. The live restaurant remains unpublished
with orders paused until the owner deliberately configures and enables it.

## Customer flow

Dish detail lets customers select an active size and permitted extras, then add
to a persistent cart. Cart quantities are limited to 20 per selection and 30
selections. Stored names/prices are display estimates and are never trusted.

At /cart customers choose pickup or delivery, enter contact details, optionally
select their saved address, review the authoritative total and place the order.
Pickup uses pay-at-pickup; delivery uses cash-on-delivery. Delivery requires an
enabled, active area and the configured minimum. Fees and tax come from settings.

The SQL quote/creation functions enforce published/active/available records,
variant ownership, linked extras, choice limits, exact minor-unit arithmetic,
address limits and matching expected total. Prices changing after review require
another review. Caller identity determines customer association; clients cannot
choose a customer ID or financial snapshots.

The order, items, extras, unpaid cash payment, initial event and idempotency entry
are inserted in one transaction. Existing integrity triggers validate totals.
Menu changes never rewrite previous order snapshots.

## Retry and guest privacy

The browser generates a cryptographically random 32-byte checkout token. A
session-stored token keyed by a digest of checkout fields supports retrying the
same submission after a lost response or reload. Personal details are not stored
in that retry key. The database stores hashes, binds retries to the request and
verified actor, serializes creation on restaurant settings, and returns the same
order for an unchanged token/request. Changed payloads cannot reuse that token.
The database also caps creation at 60 orders per restaurant per minute.

Guest orders get a private 30-day capability. Tracking links put the secret in
the URL fragment, avoiding server URL/query/referrer logs. The tracking RPC
requires matching tenant, reference, secret and live capability, and returns
only status, snapshot dishes, totals, cash status and minimal event history.
It never exposes contact or delivery details. Guest updates poll every 15 seconds
while the page is visible.

Registered orders get no guest capability and are tracked through their own
account. Confirmed Auth identity supplies the saved customer email.

## Staff

/admin/orders supports status filtering and pagination. Order details show
contact/fulfilment information, immutable selections, allergens, totals and
status history. orders.update is required for accept/reject, preparing, ready,
complete and cancel actions. Rejections/cancellations require a reason.
Optimistic previous-state checks prevent overwriting another staff update;
database triggers enforce the transition graph independently.

payments.manage is separately required to record actual cash receipt or refund.
Payment records keep the authenticated staff actor. Controls use previous-state
checks and existing payment integrity rules.

Signed-in clients subscribe only to the existing minimal order_status_events
Realtime publication, protected by RLS. No full order/contact records are added
to the publication. A visible-page 15-second fallback refresh covers dropped
subscriptions and payment updates; refresh pauses during form editing.

## Acceptance

After restarting the preview, sign in as owner and add real menu records.
Publication and ordering mode changes must be deliberate. Delivery zones,
business hours and website-mode controls are completed in Phase 9.

Test guest pickup, registered pickup and configured delivery. Change a menu
price after obtaining a quote to confirm checkout requires review. Retry the
same request and verify exactly one order/payment. Move an order through the
allowed states and check account/private tracking updates. Confirm support-only
staff cannot update orders or cash.

Live database verification uses temporary transaction rows and always rolls
back. Browser, live Auth session, Storage round trip and live Realtime delivery
remain acceptance checks because the managed runner cannot reach localhost.
