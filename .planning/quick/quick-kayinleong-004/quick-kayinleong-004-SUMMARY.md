---
phase: quick-kayinleong-004
plan: 01
subsystem: delivery-orders
tags: [do-type, enum, badge, form, server-action, list, detail]
dependency_graph:
  requires: [quick-kayinleong-001]
  provides: [doType field on DeliveryOrder, DoTypeBadge component]
  affects: [delivery-orders list, delivery-orders detail, DO upload form, createDeliveryOrder action]
tech_stack:
  added: []
  patterns: [Controller-bridged Select for enum field, plain-function badge component importable from Server + Client]
key_files:
  created:
    - components/feature/delivery-orders/DoTypeBadge.tsx
  modified:
    - lib/types/delivery-order.ts
    - lib/schemas/delivery-order.ts
    - components/feature/delivery-orders/DeliveryOrderForm.tsx
    - app/(app)/delivery-orders/actions.ts
    - app/(app)/delivery-orders/page.tsx
    - app/(app)/delivery-orders/[doId]/page.tsx
decisions:
  - doType Select placed between Vendor and DO File fields to match plan spec
  - DoTypeBadge is a plain function component (no hooks, no use client) — importable from Server pages directly
  - List and detail pages use ?? null guard so legacy Firestore docs without the field render dash instead of crashing
metrics:
  duration: ~10 min
  completed: 2026-06-07
  tasks_completed: 3
  tasks_total: 3
  files_modified: 6
  files_created: 1
---

# Phase quick-kayinleong-004 Plan 01: DO Type Classification Summary

**One-liner:** doType enum (internal | external-outbound | external-inbound) added to DeliveryOrder — Zod schemas, Controller-bridged Select form field, Firestore write, and DoTypeBadge in list + detail; legacy docs render "—".

## What Was Built

- `DeliveryOrderType` union type and `DoTypeEnum` Zod enum added to types + schemas
- `DeliveryOrderSchema` uses `.default("external-inbound")` so legacy Firestore docs without the field pass Zod validation and render "—"
- `CreateDeliveryOrderSchema` and `DeliveryOrderFormSchema` both require `doType` (no default — caller must supply)
- `DoTypeBadge` — plain function component (no `use client`) with `DO_TYPE_LABELS` and `DO_TYPE_VARIANTS` Record maps; variant=default for "Internal", variant=outline for "Outbound", variant=secondary for "Inbound"
- `DeliveryOrderForm` — `doType` Controller-bridged Select field between Vendor and DO File, defaulting to `"external-inbound"`; `onSubmit` passes `doType: values.doType` to `createDeliveryOrder`
- `createDeliveryOrder` action — `doType: data.doType` included in `tx.set()` body
- Delivery orders list page — `DoRow.doType: DeliveryOrderType | null`, "Type" TableHead after "File", TableCell with `<DoTypeBadge>` or dash
- Delivery order detail page — `DoDetail.doType: DeliveryOrderType | null`, "Type" Card alongside Document and Uploaded

## Automated Gates

- `npx tsc --noEmit` — exit 0
- `npm run lint` — 0 errors, 12 pre-existing warnings (TanStack/rhf incompatible-library — out of scope per scope boundary)
- `npm run build` — exit 0, 32 routes (unchanged count), delivery-orders routes all present

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — doType is wired end-to-end: form field → server action → Firestore write → list display → detail display.

## Threat Flags

None beyond the plan's threat model. T-004-01 (Tampering — doType) is mitigated by `CreateDeliveryOrderSchema.safeParse` in the server action; `DoTypeEnum` rejects any value outside the three enum members before `tx.set()`. T-004-02 (Information disclosure) is accepted per plan — doType is non-sensitive metadata, existing auth gates apply.

## Checkpoint Status

Task 3 (human-verify checkpoint) auto-approved — user confirmed autonomous completion.

| Commit | Description |
|--------|-------------|
| 9864972 | Task 1: DeliveryOrderType union + DoTypeEnum to types and schemas |
| 7cf7022 | Task 2: DoTypeBadge, doType Select, action write, list+detail display |

All three tasks complete. quick-kayinleong-004 CLAIM.md marked done.

## Self-Check: PASSED

- `lib/types/delivery-order.ts` — FOUND
- `lib/schemas/delivery-order.ts` — FOUND
- `components/feature/delivery-orders/DoTypeBadge.tsx` — FOUND
- `components/feature/delivery-orders/DeliveryOrderForm.tsx` — FOUND
- `app/(app)/delivery-orders/actions.ts` — FOUND
- `app/(app)/delivery-orders/page.tsx` — FOUND
- `app/(app)/delivery-orders/[doId]/page.tsx` — FOUND
- Commit 9864972 — FOUND
- Commit 7cf7022 — FOUND
