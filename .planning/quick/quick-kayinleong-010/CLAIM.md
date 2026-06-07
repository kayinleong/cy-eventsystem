# Claim: quick-kayinleong-010
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-07
- status: done
- completed: 2026-06-07
- summary: Three post-ship bug fixes — print window approach for checklist/DO dialogs, auto-create DO on checkout, item location shown in event detail and DO detail

## What Will Change

1. **Print dialogs (Fix 1):** Replace `@media print + window.print()` with `window.open()` in both `CheckoutChecklistDialog` and `CheckoutDOPrintDialog`. The Radix Dialog portal causes the backdrop to print as a separate page; `window.open()` produces a clean self-contained HTML document.

2. **Auto-create DO on checkout (Fix 2):** Schema changes to allow nullable file fields (`fileUrl`, `filePath`, `originalFilename`, `contentType`) and new `sourceType` / `eventId` fields. New `createCheckoutDeliveryOrderAction` Server Action (staff-gated). `checkout-client.tsx` calls it in the background on commit success with a toast. DO detail page handles null `fileUrl` with contextual text.

3. **Item location display (Fix 3):** DO detail page `fetchItemSummaries` now reads `location` and shows it below the SKU. `EventAssignedItemsTab` adds a `useItemLocations` hook (Firestore `where(documentId(), "in", ids)` + `onSnapshot`) and shows location below the SKU for each open checkout item.

## What Has Changed

### Fix 1 — window.open() print (commit 13c48b0)
- `CheckoutChecklistDialog.tsx`: removed `@media print` style block + `window.print()`; added `handlePrint` function that opens `window.open('', '_blank', 'width=900,height=700')`, writes self-contained HTML with inline CSS (shared `PRINT_CSS` constant), calls `w.document.close()`, `w.focus()`, `w.print()`, `w.close()`
- `CheckoutDOPrintDialog.tsx`: same pattern; DO-specific HTML with "External — Outbound" badge and txIds reference footer

### Fix 2 — Auto-create DO on checkout (commit d5bd0ee)
- `lib/types/delivery-order.ts`: `fileUrl`/`filePath`/`originalFilename`/`contentType` changed to nullable; added `sourceType: "manual" | "checkout"` and `eventId: string | null`
- `lib/schemas/delivery-order.ts`: full-doc schema file fields are `.nullable().default(null)`; added `sourceType` + `eventId` to `DeliveryOrderSchema` and `CreateDeliveryOrderSchema`
- `app/(app)/delivery-orders/actions.ts`: added `createCheckoutDeliveryOrderAction` (requireSession, writeBatch, FieldValue.arrayUnion for item back-references, revalidatePath)
- `app/(app)/events/[eventId]/checkout/_components/checkout-client.tsx`: imports `createCheckoutDeliveryOrderAction` + `toast`; fires action in `.then()` callback on commit success; shows "Delivery order created" toast on success
- `app/(app)/delivery-orders/[doId]/page.tsx`: `DoDetail` type updated with nullable file fields + `sourceType` + `eventId`; `fetchDeliveryOrder` maps the new fields; Document card renders contextual text for null fileUrl

### Fix 3 — Item location (commit 8df1188)
- `app/(app)/delivery-orders/[doId]/page.tsx`: `ItemSummary` adds `location: string`; `fetchItemSummaries` reads `d.location`; items display changed from Badge grid to `<ul>/<li>` list showing location below SKU; removed unused `Badge` import
- `components/feature/events/EventAssignedItemsTab.tsx`: adds `useItemLocations` hook (Firestore `where(documentId(), "in", ids)` onSnapshot, keyed by sorted `idsKey`); passes `locationMap` to list; shows location below SKU per open checkout item

## Verification

### Automated gates
- `npx tsc --noEmit`: exit 0 (0 errors)
- `npm run lint`: 0 errors, 12 pre-existing TanStack warnings (same count as prior quick tasks; no new errors)

### Regression surface
- Print dialogs: the `handlePrint` function replaces only the button handler; the preview `<div>` structure is unchanged. DoTypeBadge still renders in the preview. No shared state touched.
- Schema/type changes: `fileUrl` made nullable does not break existing manual-upload flow because `CreateDeliveryOrderSchema` still requires `fileUrl: z.url()` for the manual-upload action. The full-doc `DeliveryOrderSchema` used for reads now accepts null (existing docs all have string values — nullable accepts both). The existing `createDeliveryOrder` action was not modified.
- DO detail page: the document card now branches on `doc.fileUrl` truthiness. Existing uploaded DOs have a non-null `fileUrl` and will render the anchor tag as before. The `Badge` import removal is safe — only `DoTypeBadge` remains and it was not imported from `@/components/ui/badge`.
- `checkout-client.tsx`: `createCheckoutDeliveryOrderAction` is called in `.then()` — non-blocking. The commit success path (setting `groupPayload`) runs synchronously as before; the DO creation is a fire-and-forget side effect with no effect on checkout navigation.
- `EventAssignedItemsTab`: `useItemLocations` is additive; the open checkout list logic is unchanged. Hook subscribes only when `idsKey` is non-empty. setState is called inside async `onSnapshot` callback — not synchronous in effect body (verified by lint passing).
