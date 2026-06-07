---
phase: quick-kayinleong-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/types/delivery-order.ts
  - lib/schemas/delivery-order.ts
  - components/feature/delivery-orders/DeliveryOrderForm.tsx
  - components/feature/delivery-orders/DoTypeBadge.tsx
  - app/(app)/delivery-orders/page.tsx
  - app/(app)/delivery-orders/[doId]/page.tsx
  - app/(app)/delivery-orders/actions.ts
autonomous: true
requirements:
  - quick-kayinleong-004
must_haves:
  truths:
    - "The DO creation form has a Type dropdown defaulting to External — Inbound"
    - "The DO list page shows a Type column with a labelled badge per row"
    - "The DO detail page shows the type value"
    - "Legacy DOs without doType render a dash, not a crash"
    - "tsc, lint, and build all pass after the change"
  artifacts:
    - path: lib/types/delivery-order.ts
      provides: "DeliveryOrderType union + doType field on DeliveryOrder"
    - path: lib/schemas/delivery-order.ts
      provides: "DoTypeEnum on all three Zod schemas; .default on read schema"
    - path: components/feature/delivery-orders/DoTypeBadge.tsx
      provides: "Shared badge component used by list and detail pages"
    - path: components/feature/delivery-orders/DeliveryOrderForm.tsx
      provides: "doType Controller-bridged Select field + updated defaultValues + updated onSubmit"
    - path: app/(app)/delivery-orders/actions.ts
      provides: "doType passed through to tx.set()"
    - path: app/(app)/delivery-orders/page.tsx
      provides: "Type column in the list table"
    - path: app/(app)/delivery-orders/[doId]/page.tsx
      provides: "Type row in the detail grid"
  key_links:
    - from: components/feature/delivery-orders/DeliveryOrderForm.tsx
      to: app/(app)/delivery-orders/actions.ts
      via: "createDeliveryOrder({ ..., doType: values.doType })"
      pattern: "doType.*values\\.doType"
    - from: app/(app)/delivery-orders/actions.ts
      to: "deliveryOrders/{doId} Firestore doc"
      via: "tx.set — doType field"
      pattern: "doType.*data\\.doType"
---

<objective>
Add a `doType` enum field (`internal` | `external-outbound` | `external-inbound`) to the Delivery
Order module — type definition, Zod schemas, form Select, server action write, and badge display
on the list and detail pages.

Purpose: Lets admins classify DOs at upload time so staff can distinguish internal allocations from
vendor inbound and outbound shipments at a glance.

Output: 7 modified/created files; existing DOs without the field show "—" instead of crashing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/quick-kayinleong-004/quick-kayinleong-004-RESEARCH.md

<interfaces>
<!-- Current shapes the executor must preserve and extend. -->

From lib/types/delivery-order.ts (current):
```typescript
export type DeliveryOrderContentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export type DeliveryOrder = {
  id: string;
  vendor: string;
  fileUrl: string;
  filePath: string;
  originalFilename: string;
  contentType: DeliveryOrderContentType;
  itemIds: string[];
  notes: string;
  uploadedAt: string;
  uploadedBy: string;
};
```

From lib/schemas/delivery-order.ts (current):
- `DeliveryOrderSchema` — full read boundary (z.object with id, vendor, fileUrl, filePath, originalFilename, contentType, itemIds, notes, uploadedAt, uploadedBy)
- `CreateDeliveryOrderSchema` — server-action input (doId, vendor, fileUrl, filePath, originalFilename, contentType, itemIds, notes)
- `DeliveryOrderFormSchema` — client form (vendor, itemIds, notes)
- Exported types: `DeliveryOrderInput`, `CreateDeliveryOrderInput`, `DeliveryOrderFormInput`

From DeliveryOrderForm.tsx (current):
- `useForm<DeliveryOrderFormInput>` with `defaultValues: { vendor: "", itemIds: [], notes: "" }`
- `Controller` already used for `itemIds` (pattern to copy for `doType` Select)
- `onSubmit` calls `createDeliveryOrder({ doId, vendor, fileUrl, filePath, originalFilename, contentType, itemIds, notes: values.notes ?? "" })`

From actions.ts (current):
- `tx.set(doRef, { id, vendor, fileUrl, filePath, originalFilename, contentType, itemIds, notes, uploadedAt: serverTimestamp(), uploadedBy })`

From app/(app)/delivery-orders/page.tsx (current):
- `DoRow` type: `{ id, vendor, itemCount, originalFilename, fileUrl, uploadedAt }`
- `fetchRecentDeliveryOrders` builds rows from raw Firestore data with `?? ""` fallbacks

From app/(app)/delivery-orders/[doId]/page.tsx (current):
- `DoDetail` type: `{ id, vendor, fileUrl, originalFilename, contentType, itemIds, notes, uploadedAt, uploadedBy }`
- `fetchDeliveryOrder` builds DoDetail from raw Firestore data with `?? ""` fallbacks
- Detail rendered in two Cards (Document + Uploaded) + Items Card + optional Notes Card
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add DeliveryOrderType to types and schemas</name>
  <files>lib/types/delivery-order.ts, lib/schemas/delivery-order.ts</files>
  <behavior>
    - `DeliveryOrderType` union covers exactly three values: "internal", "external-outbound", "external-inbound"
    - `DeliveryOrder.doType` field is `DeliveryOrderType`
    - `DoTypeEnum` schema validates the three values
    - `DeliveryOrderSchema` includes `doType: DoTypeEnum.default("external-inbound")` so legacy docs without the field don't fail Zod validation
    - `CreateDeliveryOrderSchema` includes `doType: DoTypeEnum` (required, no default — admin must pick)
    - `DeliveryOrderFormSchema` includes `doType: DoTypeEnum` (required, no default — form always has a value via defaultValues)
    - All three exported input types (`DeliveryOrderInput`, `CreateDeliveryOrderInput`, `DeliveryOrderFormInput`) continue to be inferred via `z.input<...>` so the new field flows through automatically
  </behavior>
  <action>
    In `lib/types/delivery-order.ts`:
    1. Add `export type DeliveryOrderType = "internal" | "external-outbound" | "external-inbound";` after `DeliveryOrderContentType`.
    2. Add `doType: DeliveryOrderType;` to the `DeliveryOrder` type.

    In `lib/schemas/delivery-order.ts`:
    1. Add `export const DoTypeEnum = z.enum(["internal", "external-outbound", "external-inbound"]);` after `DeliveryOrderContentTypeEnum`.
    2. Add `doType: DoTypeEnum.default("external-inbound"),` to `DeliveryOrderSchema`.
    3. Add `doType: DoTypeEnum,` to `CreateDeliveryOrderSchema`.
    4. Add `doType: DoTypeEnum,` to `DeliveryOrderFormSchema`.
    No other schema fields change.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    Both files compile cleanly. `DeliveryOrderType` and `DoTypeEnum` exported. All three schemas include `doType`. `DeliveryOrder.doType` is typed as `DeliveryOrderType`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add DoTypeBadge helper and doType field to form + action + pages</name>
  <files>
    components/feature/delivery-orders/DoTypeBadge.tsx,
    components/feature/delivery-orders/DeliveryOrderForm.tsx,
    app/(app)/delivery-orders/actions.ts,
    app/(app)/delivery-orders/page.tsx,
    app/(app)/delivery-orders/[doId]/page.tsx
  </files>
  <behavior>
    - `DoTypeBadge` renders the right badge variant and human label for each doType value
    - `internal` → variant="default" label "Internal"
    - `external-outbound` → variant="outline" label "Outbound"
    - `external-inbound` → variant="secondary" label "Inbound"
    - `DoTypeBadge` accepts `type: DeliveryOrderType` (required, not nullable — callers guard before rendering)
    - Form has a "Type" Select field between the Vendor field and the DO file field; defaultValue is "external-inbound"
    - Form onSubmit passes `doType: values.doType` to `createDeliveryOrder`
    - `createDeliveryOrder` action passes `doType: data.doType` to `tx.set()`
    - List page `DoRow` includes `doType: DeliveryOrderType | null`
    - List `fetchRecentDeliveryOrders` extracts `doType: (data.doType as DeliveryOrderType) ?? null`
    - List table has a "Type" `<TableHead>` column between "File" and "Items"
    - List row renders `<DoTypeBadge type={r.doType} />` when `r.doType` is non-null, else `<span className="text-muted-foreground text-xs">—</span>`
    - Detail `DoDetail` includes `doType: DeliveryOrderType | null`
    - Detail `fetchDeliveryOrder` extracts `doType: (data.doType as DeliveryOrderType) ?? null`
    - Detail renders a new "Type" row — add a third Card alongside "Document" and "Uploaded" displaying the badge (or "—" for null)
  </behavior>
  <action>
    **`components/feature/delivery-orders/DoTypeBadge.tsx`** — new file:
    ```
    "use client" — NOT needed (no hooks); make it a plain function component importable
    from server pages too.
    ```
    Import `Badge` from `@/components/ui/badge` and `DeliveryOrderType` from `@/lib/types/delivery-order`.
    Define `DO_TYPE_LABELS` and `DO_TYPE_VARIANTS` Record maps per the RESEARCH spec.
    Export `DoTypeBadge({ type }: { type: DeliveryOrderType })`.

    **`components/feature/delivery-orders/DeliveryOrderForm.tsx`**:
    1. Add imports: `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` from `@/components/ui/select`.
    2. Update `useForm` generic to `DeliveryOrderFormInput` (already correct) — add `doType: "external-inbound"` to `defaultValues`.
    3. Add the `doType` `<Controller>` field between the Vendor `<Field>` and the DO file `<Field>`. Use label "Type" and id "do-type". Follow the existing `itemIds` Controller pattern exactly.
    4. In `onSubmit`, add `doType: values.doType` to the `createDeliveryOrder(...)` argument object.

    **`app/(app)/delivery-orders/actions.ts`**:
    Add `doType: data.doType,` to the `tx.set(doRef, { ... })` call body. No other change.

    **`app/(app)/delivery-orders/page.tsx`**:
    1. Add import: `import type { DeliveryOrderType } from "@/lib/types/delivery-order"` and `import { DoTypeBadge } from "@/components/feature/delivery-orders/DoTypeBadge"`.
    2. Add `doType: DeliveryOrderType | null` to `DoRow`.
    3. In `fetchRecentDeliveryOrders` row mapper add `doType: (data.doType as DeliveryOrderType) ?? null,`.
    4. Add `<TableHead>Type</TableHead>` after the "File" TableHead.
    5. Add the `<TableCell>` for `doType` in the row: `{r.doType ? <DoTypeBadge type={r.doType} /> : <span className="text-muted-foreground text-xs">—</span>}`.

    **`app/(app)/delivery-orders/[doId]/page.tsx`**:
    1. Add import: `import type { DeliveryOrderType } from "@/lib/types/delivery-order"` and `import { DoTypeBadge } from "@/components/feature/delivery-orders/DoTypeBadge"`.
    2. Add `doType: DeliveryOrderType | null` to `DoDetail`.
    3. In `fetchDeliveryOrder` add `doType: (data.doType as DeliveryOrderType) ?? null,`.
    4. Add a third Card in the grid alongside "Document" and "Uploaded":
       ```tsx
       <Card>
         <CardHeader><CardTitle className="text-sm">Type</CardTitle></CardHeader>
         <CardContent>
           {doc.doType ? <DoTypeBadge type={doc.doType} /> : <span className="text-sm text-muted-foreground">—</span>}
         </CardContent>
       </Card>
       ```
       The existing `grid-cols-1 md:grid-cols-2` wrapper already handles three items gracefully (last card takes full width on md, three across on lg is fine).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>
    tsc exits 0, lint exits 0, build exits 0 (32 routes). DoTypeBadge renders correct variant+label for all three values. Form default is "external-inbound". New DOs written to Firestore include doType. List shows Type column. Detail shows Type card.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - doType Select field on the DO upload form (defaulting to "External — Inbound")
    - DoTypeBadge in the list table "Type" column
    - DoTypeBadge in the detail page "Type" card
    - Legacy DOs without the field render "—" in both list and detail
  </what-built>
  <how-to-verify>
    1. Run `npm run dev` and open http://localhost:3000/delivery-orders/new as an admin.
    2. Confirm the form shows "Type" dropdown between Vendor and DO File fields, defaulting to "External — Inbound (from vendor)". Check all three options are selectable.
    3. Upload a new DO and select "Internal (staff allocation)". Submit.
    4. On the list page http://localhost:3000/delivery-orders, confirm the new row shows an "Internal" badge in the Type column.
    5. Click into the new DO — confirm the detail page shows a "Type" card with the "Internal" badge.
    6. If there are existing DOs uploaded before this change, confirm they show "—" in both the list Type column and the detail Type card.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues found.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client form → createDeliveryOrder Server Action | `doType` arrives as user-supplied string; must be validated by Zod before write |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-004-01 | Tampering | createDeliveryOrder — doType field | mitigate | `CreateDeliveryOrderSchema.safeParse` already gates the action; `DoTypeEnum` is a closed enum — any value outside the three members fails Zod validation before tx.set() |
| T-004-02 | Information disclosure | DoTypeBadge on list/detail | accept | doType is non-sensitive metadata; detail page already requires `requireSession()`, list already requires `requireAdmin()` |
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0 (32 routes, same count as before — no new routes)
- Manual: form renders Type Select, new DO saved with doType field, list column and detail card show badge, legacy rows show "—"
</verification>

<success_criteria>
- All seven files compile without type errors
- `doType` is persisted to Firestore on new DO creation
- List and detail pages display the type badge
- Legacy docs without the field do not crash — they render "—"
- No regressions: existing vendor, file, items, notes, and back-reference flows unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-004/quick-kayinleong-004-SUMMARY.md` and update `.planning/STATE.md` with the quick task row.
</output>
