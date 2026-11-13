# F04: raw funnel capture

This first vertical block records only the allowlisted browser events `visit`,
`menu_view`, `product_view`, `cart_add`, `checkout_start`, and
`fulfillment_selected`. The host enables `analytics_funnel` per franchise and
branch; it defaults to off. The branch response exposes
`branch_info.analytics_funnel_enabled`, so clients can avoid creating or sending
events while disabled. The server checks the gate again at publication.

`POST /client/analytics/events` accepts an event UUID, branch UUID, event name,
optional source type (`direct`, `campaign`, `unknown`), and up to three short
canonical UTM slugs for `campaign`. These labels are unverified client claims,
not proof of an ad visit or revenue. Source labels are internal runtime values;
no manual source administration is needed for this block. Unknown keys,
browser outcomes, amounts, identity fields, URL/referrer, metadata, client
timestamps, long values, and obvious phone-like numeric slugs are rejected.
This is a constrained input format, not a universal PII detector.

The server owns guest identity through a separate signed HttpOnly cookie and
uses authenticated client identity when present. Branch and owner are isolated.
The server assigns session IDs and receipt time. Replayed event IDs return the
original session without extending it; 30 minutes of inactivity starts a new
session. Raw events and empty sessions older than 90 days are pruned in bounded
batches by the daily maintenance worker even if capture is disabled. A single
job removes up to 500 of each; when a batch is full, the core maintenance queue
continues with another bounded job until the backlog is drained.

Remaining F04 work: order lifecycle linkage, immutable first customer source,
attribution rules/window, deduplicated completed-order revenue and activity,
aggregates, dashboard, and advertising links. Created and paid orders are
distinct from completed orders. No browser event asserts paid or completed
revenue.
