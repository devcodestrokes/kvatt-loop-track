---
name: A/B Testing API field semantics
description: Distinguishes per-design checkouts vs orders in shopify.kvatt.com/api/get-alaytics response
type: feature
---
The `get-alaytics` API returns per-store fields with subtle but distinct meanings:
- `total_checkouts` (store-level): total checkout impressions across the store.
- `opt_ins` / `opt_outs` (store-level): customer choice counts (orders).
- `ab_testing.<DesignName>` = `{ in, out, total }`: per-design ORDER counts (in+out=total). NOT checkouts.
- `total_checkout_count.<DesignName>`: per-design ACTUAL CHECKOUT IMPRESSIONS. This is the real "checkouts per design" — use this for "Checkouts by Design" widgets, not `ab_testing.total`.

Rule: when displaying "checkouts by design", use `total_checkout_count[name]` (mapped to `variant.checkouts`). Use `ab_testing.X.total` only for "Orders" and opt-in rate calculations.
