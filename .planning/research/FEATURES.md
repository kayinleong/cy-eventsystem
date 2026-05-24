# Features Research

**Project:** Basic Event Inventory System
**Domain:** Event-based physical inventory tracking (rental/lend-out of AV gear, marketing materials, demo units, displays for short-term events)
**Researched:** 2026-05-24
**Confidence:** MEDIUM-HIGH (competitor analysis from Cheqroom, EZRentOut, Rentman, Snipe-IT, Asset Panda; UX patterns from documented behavior + reviews)

---

## Executive Summary

The user's nine v1 requirements (inventory CRUD, events, check-out/in, missing tracking, repurchase reminder, QR scanning, reports, roles) align well with what mainstream products consider **table stakes** for equipment-checkout-for-events. The QR-first scanner pages and the explicit "missing reason" enum are particularly well-aligned with Cheqroom / EZRentOut UX.

However, **three category gaps stand out** as commonly-expected features the user omitted:

1. **Item lifecycle state** (Available / Reserved / Checked-out / In-repair / Retired) — without this, "damaged" items returned from an event sit ambiguously between "missing" and "available."
2. **Audit log / activity history** — every competitor logs who-did-what-when on every check-in/check-out. Critical for accountability with multiple teams.
3. **Reservations / holds** — the user has events that hold items between create and check-out. Without holds, two events scheduled overlapping dates can both "check out" the last unit, with the conflict only surfacing at the warehouse.

A pragmatic v1 should bake in **(1) and (2)** because they are nearly free to add at the schema level and prevent rewrites; **(3) holds** can be deferred to v2 if explicitly accepted as a known limitation.

---

## Table Stakes (must have for v1)

| # | Feature | Complexity | Depends on | v1/v2 | Notes |
|---|---------|-----------|------------|-------|-------|
| TS-01 | Item CRUD (name, SKU, barcode/QR, qty) | Low | — | v1 | Per user req #1. Bulk-quantity model (not unique-asset model) — see Gaps for trade-off. |
| TS-02 | Event CRUD (name, date, location) | Low | — | v1 | Per user req #2. |
| TS-03 | Check-out: select items + qty, decrement stock, prevent negative | Med | TS-01, TS-02, TS-09 | v1 | Must be atomic — race condition risk if two staff scan same SKU simultaneously. |
| TS-04 | Check-in: record returns, compare to checked-out | Med | TS-03 | v1 | Returned qty + remaining = "missing" qty. |
| TS-05 | Missing item tracking with reason enum (Lost / Damaged / Not returned / Unknown) | Low | TS-04 | v1 | Reason on the line, not the event — different items can have different reasons. |
| TS-06 | Repurchase / low-stock alert | Low | TS-01 | v1 | Threshold per SKU, dashboard badge + list. Email is v2 unless explicitly needed. |
| TS-07 | Barcode/QR scanner (web-based, camera) | Med | TS-01 | v1 | Use `BarcodeDetector` API or `zxing-js` library; iOS Safari camera permissions are the main pitfall. |
| TS-08 | Dedicated QR check-out and QR check-in pages (scanner-first) | Med | TS-07, TS-03, TS-04 | v1 | Per user clarification. Scan first, then choose event from a list. |
| TS-09 | Event-assignment after scan ("which event?") | Low | TS-08 | v1 | Per user clarification. Show only events in "open" status. |
| TS-10 | Return-to-inventory flow on check-in | Low | TS-04 | v1 | Per user clarification. Returned qty flows back to available stock atomically with the check-in record. |
| TS-11 | Multi-team assignment per event (primary + backup) | Low | TS-02 | v1 | Per user clarification. Many-to-many event ↔ user/team. |
| TS-12 | Reports: current stock, items out, missing list, event history | Med | TS-01..05 | v1 | Read-only queries; complexity comes from filter UX, not data. |
| TS-13 | Roles: Admin (manage inventory + view all) / Staff (check in/out) | Low-Med | auth | v1 | Two-role RBAC is straightforward; deeper permissions (per-event) is v2. |
| TS-14 | Admin-invite-only registration | Low | auth, TS-13 | v1 | Per user clarification. Invite token sent by admin; `/register` accepts only valid token. |
| TS-15 | **Audit log / activity history** (who scanned what, when) | Low | all of TS-03/04 | **v1 (added)** | Every competitor logs every check-in/check-out. Cheap to add at write time, expensive to retrofit. Strongly recommended in v1. |
| TS-16 | **Item lifecycle state** (`available` / `checked_out` / `damaged` / `retired`) | Low | TS-01 | **v1 (added)** | Without this, "damaged on return" has nowhere to live. Bulk-qty model means state is per-quantity-pool (e.g. 8 available, 2 damaged of SKU X). |

**Subtotal v1 features:** 16 (9 user-requested + 5 clarifications + 2 strongly recommended additions)

---

## Differentiators (competitive edge — defer to v2+)

| # | Feature | Complexity | Why it's a differentiator |
|---|---------|-----------|---------------------------|
| DF-01 | **Reservations / holds** between event creation and check-out | Med-High | Prevents double-booking. Cheqroom and Shelf both make this a flagship feature. Reservation = soft-decrement of available qty for an event before physical check-out. |
| DF-02 | **Kits / bundles** (parent SKU composed of components, single scan checks out all) | High | Standard in Rentman, Cheqroom, Party Track. Useful when your AV trolley = laptop + cable + adapter + clicker. Requires recursive availability calc — non-trivial. |
| DF-03 | **Asset condition tracking** (good / fair / poor / needs-repair, with photo on return) | Med | Cheqroom + EZRentOut allow photo + note on check-in. Strong UX for "this came back scratched." |
| DF-04 | **Unique-asset mode** (serial-tracked items vs bulk-tracked) | High | Toggle per SKU: "track each unit individually" vs "track as a pool." High-value items (cameras) need this; promo flyers don't. Major schema impact — decide pre-v1 even if not building. |
| DF-05 | Maintenance / repair workflow (item leaves available pool, returns when fixed) | Med | Natural extension of TS-16 lifecycle states. |
| DF-06 | Sub-locations / warehouse zones (Shelf A / Shelf B / Van 1) | Med | Useful at scale, overkill for v1. |
| DF-07 | Email / Slack notifications (low stock, overdue returns, event check-out scheduled) | Med | Most competitors offer this; in-app dashboard alerts are acceptable for v1. |
| DF-08 | Digital check-out agreement / signature (CYA paper trail) | Med | Cheqroom auto-generates PDF + e-sign. Not needed for internal use; relevant if lending to external partners. |
| DF-09 | Mobile-native app (iOS / Android) | High | Web-based scanner works fine for v1; native app is a v3 conversation. |
| DF-10 | Calendar view of events + equipment timeline (Gantt-style) | Med | Rentman's killer feature. Requires DF-01 reservations to be meaningful. |
| DF-11 | Custom fields per item type | Med | Snipe-IT staple. Defer until users ask. |
| DF-12 | Import/export (CSV) for bulk loading inventory | Low | Hugely valuable on day 1 of adoption. Consider for v1.5. |
| DF-13 | Overdue-return reminders (event ended, items not yet checked in) | Low | Useful and cheap; could sneak into v1 as a dashboard widget. |
| DF-14 | Cost / depreciation tracking | Med | Relevant for accounting, not operations. Skip unless asked. |
| DF-15 | Per-event permissions ("Staff X can only check in/out for events they're assigned to") | Med | TS-13 gives blanket Staff access. This is a v2 tightening. |

---

## Anti-Features (deliberately NOT building)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|--------------------|
| **Customer-facing rental storefront / public booking** | This is an internal ops tool, not Booqable / TWICE. Adding a public site doubles surface area (PCI, account management, branding). | Keep behind login. If external partners need visibility, share read-only event reports. |
| **Payment processing / invoicing** | Items are lent, not sold. Adding Stripe / payment flows changes compliance posture (PCI), audit needs, and increases scope 3-5x. | If reimbursement for damages is needed, generate a damages report; settle outside the system. |
| **Multi-tenant SaaS architecture** | Building for one company. Multi-tenant changes data isolation, auth, billing, and admin overhead from day 1. | Single-tenant deploy. If a second org ever needs the tool, fork or evaluate multi-tenant retrofit then. |
| **Full ERP / accounting integration (SAP, NetSuite, QuickBooks)** | Niche need; integration code is brittle and version-specific. | Expose CSV export of inventory + event history; let accounting consume it. |
| **CRM / customer management** | This is asset tracking, not Salesforce. | If "who borrowed it" matters, it's the assigned team/user, captured in audit log. |
| **Logistics / transport scheduling** (vehicle routing, crew assignment) | Rentman's territory. Massive scope creep. | Event has a location field; that's enough. |
| **Multi-currency, tax, contracts** | Not a rental-business product. | Out of scope, full stop. |
| **Native iOS / Android apps in v1** | Doubles delivery effort. Modern web + camera API handles scanning well. | PWA with camera scanner; install-to-home-screen for "feels native." |
| **AI-powered demand forecasting** | Cool, but you don't have data yet. Cold-start problem. | Manual reorder thresholds in v1. Revisit when you have ~12 months of history. |
| **Sub-rental / borrowing from other organizations** | Rentman-class feature. Out of scope. | Skip. |
| **Free public signup** | Per user req — registration is invite-only. | Already locked: `/register` requires admin-issued token. |

---

## Gaps in User's Requirements

These are commonly-expected in the domain but missing from the v1 list. Listed in priority order.

### Gap 1: Item lifecycle states (HIGH priority — recommend adding to v1)

**Why it matters:** When 2 of 10 items return damaged, the user's current model says: "8 returned, 2 missing, reason: Damaged." But the 2 damaged units are now in a limbo state — they're physically here, they're not "missing," but they're also not "available" for the next event. Without an explicit `damaged` / `in_repair` state, those 2 units will show as available in next week's check-out screen.

**Recommendation:** Model item availability as a per-SKU pool with state buckets:
```
SKU-LAPTOP-01:
  total: 10
  available: 6        (checkout-able)
  checked_out: 2      (currently at an event)
  damaged: 1          (back from event, not usable)
  retired: 1          (written off)
```
States transition explicitly. The "missing" reason captured at check-in tells the system whether to put units back into `available` (lost/unknown — they're gone forever, decrement total) or into `damaged` (returned-but-broken).

**Cost:** ~half a day at the schema level. Significant rewrite if added in v2.

### Gap 2: Audit log / activity history (HIGH priority — recommend adding to v1)

**Why it matters:** With multiple teams (primary + backup) able to check items in and out, "who scanned this in?" becomes a recurring question. Disputes about missing items will arise. Every competitor (Cheqroom, Snipe-IT, EZRentOut, Asset Panda) logs every state transition.

**Recommendation:** Append-only `audit_log` table: `(timestamp, user_id, action, entity_type, entity_id, before_value, after_value, event_id)`. Write on every check-in, check-out, missing-flag, manual inventory adjustment. Read in v1 as a per-item history page; full search UI is v2.

**Cost:** Cheap to add at write-time. Effectively impossible to backfill later — you'd lose all history before the feature shipped.

### Gap 3: Reservations / holds (MEDIUM priority — defer to v2 if scoped tight)

**Why it matters:** User creates Event A on Jun 1 (needs 5 laptops). User creates Event B on Jun 1 (needs 5 laptops). Total laptops: 8. Today, both events "look fine" until check-out day — then whoever scans second hits "insufficient stock." Reservations prevent this by soft-decrementing on event creation.

**Recommendation if deferring:** Make the trade-off explicit in v1 docs ("v1 does not prevent overlapping event assignment; reconcile at check-out"). Add a v1.5 ticket. The schema should accommodate it: include a `reservations` table even if unused, or design `event_items` to support an `intended_qty` distinct from `checked_out_qty`.

### Gap 4: Kits / bundles (MEDIUM priority — defer)

**Why it matters:** AV setups frequently bundle (laptop + power brick + HDMI + clicker = "Presenter Kit"). One scan, all four come out together.

**Recommendation:** Defer to v2. Document the request as a known v2 feature. Schema-wise, leaving room means making `event_items` a join table on `items` (not embedding qty into events).

### Gap 5: Unique-asset mode (DECISION REQUIRED pre-v1)

**Why it matters:** The user said "quantity" — implying bulk tracking ("we have 10 of these"). But if any item is high-value (e.g., a $3K camera), the team will want to know **which specific unit** went out and came back. This is a fundamental schema decision:
- **Bulk mode:** Item has `total_qty`, scanning bumps counters.
- **Unique-asset mode:** Each physical unit gets its own DB row with its own barcode.
- **Hybrid:** Per-item flag `is_serialized`.

**Recommendation:** Start bulk-only for v1. Add `is_serialized` flag in v2 if needed. **But** explicitly ask the user before locking this in — getting it wrong means a migration.

### Gap 6: Overdue-return tracking (LOW priority — easy win for v1)

**Why it matters:** Event ended 3 days ago, items still showing checked out. Today there's no signal.

**Recommendation:** Dashboard widget — "Overdue returns" = items where `event.end_date < today AND check_in_complete = false`. Half a day of work. Strong UX win.

### Gap 7: Bulk CSV import for inventory (LOW priority — defer to v1.5)

**Why it matters:** Day 1 of adoption, the user has ~50–500 items to enter. Manual data entry is the #1 reason teams abandon inventory software.

**Recommendation:** Defer to v1.5, but plan the UI so a CSV import button can slot into the inventory page.

### Gap 8: Self-audit / cycle count (LOW — defer)

**Why it matters:** Occasionally the team should physically verify the database matches reality. A "start audit" flow scans every item, flags discrepancies.

**Recommendation:** Defer to v2.

### Gap 9: Notification destinations (LOW — partial v1)

**Why it matters:** Low stock alert needs to land somewhere. Dashboard-only alerts work but get missed.

**Recommendation:** v1 = dashboard + badge in nav. v2 = email digest. Avoid Slack/SMS for v1 (adds external dependencies and secrets).

---

## UX Patterns Worth Borrowing

### From Cheqroom — "scan and go" check-out flow

The Cheqroom mobile flow is the gold standard for scanner-first UX. Pattern to replicate:

1. **Big primary "Scan" button** on the check-out page — opens camera immediately, no intermediate menu.
2. **After scan**, the item card slides up from the bottom with: item name, photo, current available qty, qty stepper (default 1).
3. **Confirm adds to a "cart"** at the bottom of the screen — running list of items being checked out.
4. **Continue scanning** — each scan adds to the cart. Camera stays open between scans.
5. **Single confirm button** at the end commits the whole cart to the event in one transaction.

This is dramatically faster than scan → confirm → return-to-list → scan → confirm. The "cart" pattern keeps the camera-in-hand workflow uninterrupted.

**For this project:** The user already wants dedicated QR check-out and check-in pages. Apply the cart-style flow on both. Crucially, **assign-to-event happens once at the start** (before scanning) or **once at the end** (before commit) — not per-item.

### From EZRentOut — Bluetooth / handheld scanner support

EZRentOut supports both phone-camera scanning and Bluetooth handheld scanners (acting as keyboard input). For warehouse / loading-dock use, a wired/Bluetooth scanner is 5x faster than a phone camera.

**For this project:** Make the scan input field a focused text input that accepts both:
- Programmatic input from `BarcodeDetector` (camera)
- Keystroke input from a Bluetooth scanner (treated as a fast typist that ends with `Enter`)

Same handler code, two input modalities. Low cost, big UX win.

### From Snipe-IT — Audit log presentation

Snipe-IT shows per-asset history as a chronological list:
```
2026-05-23 14:02  Sarah K.  checked out to "Summer Conf 2026"
2026-05-25 09:14  Mike R.   checked in (10 returned, 0 missing)
2026-05-29 11:00  Sarah K.  edited item — quantity: 10 → 9 (reason: written off)
```

**For this project:** Same pattern, on the item detail page. Free accountability.

### From multiple competitors — Low stock alert presentation

The pattern that works:
- **Badge on nav** ("Low stock (3)") visible from any page.
- **Dedicated /alerts page** listing every SKU below threshold, with: current qty, threshold, reorder suggestion, last reorder date.
- **One-click "mark as ordered"** — moves the alert off the active list without changing inventory (separates "I know about it" from "the stock arrived").

What does *not* work: an email per low-stock event (notification fatigue) or a modal that interrupts other work.

### From Cheqroom — Missing item modeling on check-in

Pattern: at check-in, the form shows every line item from the original check-out with the originally checked-out qty pre-filled in the "returned qty" field. The user **decrements** if anything didn't come back, then picks a reason from a dropdown. The delta is automatically flagged as missing.

```
Item              Checked out   Returned    Missing   Reason
Laptop X          10            [8     ]    2         [Damaged   ▾]
HDMI cable        20            [20    ]    0         —
Power strip       5             [4     ]    1         [Lost      ▾]
```

This is faster than asking the user to enter the missing qty directly — humans count what they see, not what's absent.

### From Rentman — Event timeline view (defer, but design for it)

Rentman shows a Gantt-style timeline: x-axis = dates, y-axis = item categories, bars = events using those items. Conflicts (over-allocation) glow red.

**For this project:** Out of scope for v1, but worth designing the data model so this view is achievable in v2 without rework. Specifically: store check-out and check-in timestamps as ranges, not just events.

### From Asset Panda — Photo on damage report

When a user marks an item Damaged on check-in, prompt for a photo. This single workflow detail prevents 80% of "who did this?" disputes downstream.

**For this project:** v1 stretch goal — file upload on the missing-item reason form when reason = Damaged.

---

## Open Questions

1. **Serialization decision (Gap 5):** Are any items individually serial-tracked (high-value cameras, etc.) or is bulk-qty tracking sufficient for all items? **This must be answered before schema lock.**

2. **Reservations vs first-come-first-served (Gap 3):** When two events on overlapping dates both want the same items, does the system prevent it (reservations) or detect at check-out (current plan)? Pragmatic for v1 to do the latter — but the user should explicitly accept this trade-off.

3. **"Team" definition:** User mentioned "backup team support — events can have multiple teams." Is "team" a first-class entity (a group of users), or is it just multiple users assigned to an event? Affects the data model.

4. **Notification mechanism for low stock:** Dashboard-only sufficient for v1, or is email/Slack expected?

5. **Photo storage:** If damage photos are in v1 stretch, where do they live? Local FS, S3, embedded base64? Has implications for backup/migration.

6. **Item categories / tags:** No mention in requirements. Real inventories of 100+ items need filtering by category (AV / Marketing / Demo / Display). Add to v1?

7. **Soft-delete vs hard-delete on items:** When admin "deletes" an item that has historical check-out records, do we hard-delete (breaks history) or soft-delete (preserves audit)? Strong recommendation: soft-delete via `retired` lifecycle state (see TS-16).

8. **Event status lifecycle:** Implied but not specified — does an event have states (`draft` → `open` → `in_progress` → `closed`)? Affects which events show up in the QR check-out flow.

9. **Time zones:** Events have dates; are events single-day or date-ranges? Are times tracked, or just dates? Affects overdue calculations.

10. **Invite-only registration mechanics:** Email-based invite (admin enters email, system sends magic link) or admin-shares-link (admin clicks "generate invite" and copies a URL)? Affects whether SMTP is a v1 dependency.

---

## Sources

- [Cheqroom Equipment Checkout Software](https://www.cheqroom.com/features/equipment-checkout-software/)
- [Cheqroom Equipment Booking & Reservations](https://www.cheqroom.com/features/equipment-booking-software/)
- [Cheqroom — Equipment Checkout Workflows for Enterprise Teams](https://www.cheqroom.com/blog/equipment-checkout-workflows-for-enterprise-teams/)
- [EZRentOut Equipment Rental Software](https://ezo.io/ezrentout/)
- [EZRentOut — Scan Items with the Mobile App](https://ezo.io/ezrentout/blog/guide-scanning-ezrentout-mobile-app/)
- [Snipe-IT Product Features](https://snipeitapp.com/product)
- [Snipe-IT PR #16679 — Logging Audit on Check-in/out](https://github.com/grokability/snipe-it/pull/16679)
- [Rentman — Inventory Management](https://rentman.io/solutions/inventory-management)
- [Rentman — Rental Reservation Software](https://rentman.io/blog/rental-reservation-software)
- [Alert Rental — Bundling and Component Tracking](https://alertrental.com/)
- [Party Track — Kit / Component Inventory](https://partytrack.com/features/inventory-management)
- [Booqable — Trackable vs Bulk Inventory](https://booqable.com/blog/the-ultimate-guide-to-rental-inventory-management/)
- [Asset Panda — Lifecycle States](https://www.assetpanda.com/solutions/lifecycle-management/)
- [Shelf — Equipment Reservation & Double-Booking Prevention](https://www.shelf.nu/solutions/equipment-reservations)
- [NetSuite — Causes of Inventory Discrepancies (Loss/Damage/Theft)](https://www.netsuite.com/portal/resource/articles/inventory-management/inventory-discrepancies.shtml)
- [Cryotos — Low Stock Alerts in Inventory Management](https://www.cryotos.com/blog/low-stock-alerts-inventory-management)
- [BoxHero — Low Stock Alerts UX](https://docs-en.boxhero.io/other-features/low-stock-alert)
- [QR-Assets — Asset Lifecycle States Reference](https://qr-assets.com/asset-lifecycle-management)
