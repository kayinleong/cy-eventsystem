# Quick Task quick-kayinleong-004 - Research

**Researched:** 2026-06-07
**Domain:** Delivery Order module — doType enum field addition
**Confidence:** HIGH

## Summary

Adding `doType` (enum: `internal` | `external-outbound` | `external-inbound`) is a narrow,
additive change across five touch-points. No schema migration is required — Firestore reads that
return a doc without `doType` are handled by a safe `.default()` in the Zod schema, and the UI
falls back to a string sentinel. The existing `DeliveryOrderForm` uses `react-hook-form` +
`DeliveryOrderFormSchema` and already has the shadcn `Select` component available; the form just
needs a new controlled `<Select>` field wired to a new `doType` key.

**Primary recommendation:** Add `doType` as a required field with default `"external-inbound"` in
all three Zod schemas, a `<Select>` in the form, a helper badge component for the list/detail
pages, and write the value to Firestore in the server action.

## Touch-Point Map

| File | Change |
|------|--------|
| `lib/types/delivery-order.ts` | Add `DeliveryOrderType` union type; add `doType` to `DeliveryOrder` |
| `lib/schemas/delivery-order.ts` | Add `DoTypeEnum`; add `doType` to all three schemas with `.default("external-inbound")` on the read schema |
| `components/feature/delivery-orders/DeliveryOrderForm.tsx` | New `doType` field (shadcn `<Select>`), wired via `Controller`; pass value to `createDeliveryOrder` call |
| `app/(app)/delivery-orders/page.tsx` | Add `doType` to `DoRow`; add "Type" column with `DoTypeBadge` |
| `app/(app)/delivery-orders/[doId]/page.tsx` | Add `doType` to `DoDetail`; render `DoTypeBadge` in the details grid |
| `app/(app)/delivery-orders/actions.ts` | Pass `doType` through from `CreateDeliveryOrderSchema` to `tx.set(...)` |

## Type and Schema Changes

### New type (`lib/types/delivery-order.ts`)

```typescript
// [VERIFIED: codebase grep]
export type DeliveryOrderType =
  | "internal"
  | "external-outbound"
  | "external-inbound";

// Add to DeliveryOrder:
doType: DeliveryOrderType;
```

### Schema additions (`lib/schemas/delivery-order.ts`)

```typescript
// [VERIFIED: codebase grep — existing pattern mirrors DeliveryOrderContentTypeEnum]
export const DoTypeEnum = z.enum([
  "internal",
  "external-outbound",
  "external-inbound",
]);

// DeliveryOrderSchema (read boundary) — .default() handles legacy docs without the field
doType: DoTypeEnum.default("external-inbound"),

// CreateDeliveryOrderSchema (server-action input) — required, no default
doType: DoTypeEnum,

// DeliveryOrderFormSchema (client form) — required, no default (form select always has a value)
doType: DoTypeEnum,
```

Default for new form: `"external-inbound"` — matches the original DO module intent (vendor
delivers items into inventory).

## Form Field

The shadcn `Select` component is already installed at `components/ui/select.tsx`. [VERIFIED:
codebase grep] The form is a `"use client"` component using `react-hook-form` + `Controller` for
non-native inputs. Pattern: mirror the existing `itemIds` `<Controller>` pattern.

```tsx
// [VERIFIED: existing Controller usage in DeliveryOrderForm.tsx lines 145-155]
<Field data-invalid={!!errors.doType}>
  <FieldLabel htmlFor="do-type">Type</FieldLabel>
  <Controller
    control={control}
    name="doType"
    render={({ field }) => (
      <Select value={field.value} onValueChange={field.onChange}>
        <SelectTrigger id="do-type" className="w-full" aria-invalid={!!errors.doType}>
          <SelectValue placeholder="Select type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="external-inbound">External — Inbound (from vendor)</SelectItem>
          <SelectItem value="external-outbound">External — Outbound (to vendor)</SelectItem>
          <SelectItem value="internal">Internal (staff allocation)</SelectItem>
        </SelectContent>
      </Select>
    )}
  />
  <FieldError errors={errors.doType ? [{ message: errors.doType.message }] : undefined} />
</Field>
```

Form `defaultValues` addition: `doType: "external-inbound"`.

Pass `doType: values.doType` in the `createDeliveryOrder(...)` call body.

## Badge Display

The `Badge` component has variants: `default`, `secondary`, `destructive`, `outline`, `ghost`,
`link`. [VERIFIED: components/ui/badge.tsx] No semantic colour variants (e.g., green/yellow) exist
— Tailwind utility overrides via `className` are the correct approach for type-specific colours.

Recommended mapping:

| doType | Badge variant | Tailwind override | Rationale |
|--------|--------------|-------------------|-----------|
| `external-inbound` | `secondary` | none | neutral — receiving is the common case |
| `external-outbound` | `outline` | none | distinct from inbound without alarm |
| `internal` | `default` | none | primary colour signals internal allocation |

A small helper is cleaner than inline ternaries across two pages:

```tsx
// [ASSUMED — helper pattern, no existing equivalent to copy from]
// Place inline in each page or extract to
// components/feature/delivery-orders/DoTypeBadge.tsx

const DO_TYPE_LABELS: Record<DeliveryOrderType, string> = {
  "external-inbound": "Inbound",
  "external-outbound": "Outbound",
  internal: "Internal",
};
const DO_TYPE_VARIANTS: Record<
  DeliveryOrderType,
  "default" | "secondary" | "outline"
> = {
  "external-inbound": "secondary",
  "external-outbound": "outline",
  internal: "default",
};

function DoTypeBadge({ type }: { type: DeliveryOrderType }) {
  return (
    <Badge variant={DO_TYPE_VARIANTS[type]}>
      {DO_TYPE_LABELS[type]}
    </Badge>
  );
}
```

## List Page Changes (`page.tsx`)

1. Add `doType: DeliveryOrderType | null` to `DoRow` type.
2. In `fetchRecentDeliveryOrders`, extract `doType: (data.doType as DeliveryOrderType) ?? null`.
3. Add a "Type" `<TableHead>` column.
4. In the row, render `{r.doType ? <DoTypeBadge type={r.doType} /> : <span className="text-muted-foreground text-xs">—</span>}`.

Using `null` (not a default) in the list fetch is intentional: legacy docs without `doType` should
render "—" rather than silently pretending they were `external-inbound`, so users can see which
records predate the field.

## Detail Page Changes (`[doId]/page.tsx`)

1. Add `doType: DeliveryOrderType | null` to `DoDetail` type.
2. In `fetchDeliveryOrder`, extract `doType: (data.doType as DeliveryOrderType) ?? null`.
3. Add a new `<Card>` (or a `<dl>` row inside the existing "Uploaded" card) showing "Type" with
   `<DoTypeBadge>` or "—" for null.

## Migration Concern for Existing Docs

No migration script needed. [ASSUMED — Firestore does not enforce schema; missing fields return
`undefined` on reads, not errors.]

- **Server reads (Admin SDK):** Cast with `?? null` / `?? ""` pattern already used throughout the
  detail and list pages — extend the same pattern to `doType`.
- **Zod boundary reads:** `DoTypeEnum.default("external-inbound")` on `DeliveryOrderSchema` means
  any doc without `doType` validates as `"external-inbound"` if data is passed through Zod. But the
  pages read raw Firestore data (not through `DeliveryOrderSchema`), so the `?? null` fallback in
  the page fetch functions is the operative safety net.
- **No back-fill required for v1:** The `—` display for legacy rows is acceptable. If a back-fill
  is later needed it is a separate task.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firestore silently omits missing fields (no error on read) | Migration Concern | Low — standard Firestore behaviour, but if SDK version has a quirk the null-coalescing fallback still covers it |
| A2 | `DoTypeBadge` helper pattern — no existing equivalent to copy | Badge Display | Negligible — if an equivalent exists we reuse it; if not we add the helper |

## Sources

### Primary (HIGH confidence)
- Codebase grep — `lib/schemas/delivery-order.ts`, `lib/types/delivery-order.ts`, `DeliveryOrderForm.tsx`, `page.tsx` (list + detail), `actions.ts`, `components/ui/badge.tsx`, `components/ui/select.tsx` [VERIFIED: file reads in this session]
