# Claim: quick-kayinleong-004
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-07
- completed: 2026-06-07
- status: done
- summary: Add doType label (internal | external-outbound | external-inbound) to Delivery Order module — type union, DoTypeEnum Zod schema, form Select, action write, DoTypeBadge in list + detail

## What Will Change

Add `doType` enum field to the Delivery Order module:
- `DeliveryOrderType` union type + `DoTypeEnum` Zod enum in types and schemas
- `DeliveryOrderSchema.doType` with `.default("external-inbound")` so legacy Firestore docs pass validation
- `DoTypeBadge` component (plain function, importable from Server pages)
- `DeliveryOrderForm` doType Controller-bridged Select defaulting to `"external-inbound"`
- `createDeliveryOrder` action passes `doType` to `tx.set()`
- List page: "Type" column with DoTypeBadge or "—" for null
- Detail page: "Type" Card alongside Document and Uploaded

## What Has Changed

All seven files modified/created per plan:

1. `lib/types/delivery-order.ts` — `DeliveryOrderType` union + `doType: DeliveryOrderType` on `DeliveryOrder`
2. `lib/schemas/delivery-order.ts` — `DoTypeEnum` added; `DeliveryOrderSchema.doType.default("external-inbound")`, `CreateDeliveryOrderSchema.doType`, `DeliveryOrderFormSchema.doType`
3. `components/feature/delivery-orders/DoTypeBadge.tsx` — new plain function component with `DO_TYPE_LABELS` and `DO_TYPE_VARIANTS` Record maps
4. `components/feature/delivery-orders/DeliveryOrderForm.tsx` — `doType` Controller-bridged Select between Vendor and DO File; `defaultValues.doType = "external-inbound"`; `onSubmit` passes `doType: values.doType`
5. `app/(app)/delivery-orders/actions.ts` — `doType: data.doType` in `tx.set()` body
6. `app/(app)/delivery-orders/page.tsx` — `DoRow.doType: DeliveryOrderType | null`; "Type" TableHead; TableCell with DoTypeBadge or dash
7. `app/(app)/delivery-orders/[doId]/page.tsx` — `DoDetail.doType: DeliveryOrderType | null`; "Type" Card in detail grid

Commits: 9864972 (Task 1), 7cf7022 (Task 2)

## Verification

### Regression Surface

Flows that share code paths with this change:
1. Delivery order upload form (vendor field, file field, items field, notes field, onSubmit → createDeliveryOrder)
2. Delivery orders list page (DoRow type, fetchRecentDeliveryOrders mapper, table rendering)
3. Delivery order detail page (DoDetail type, fetchDeliveryOrder mapper, Card grid rendering)
4. createDeliveryOrder server action (Zod parse gate, Firestore tx.set)

### What Was Tested

- `npx tsc --noEmit` — exit 0 (all seven files compile without type errors)
- `npm run lint` — exit 0, 0 errors (12 pre-existing TanStack/rhf warnings, out of scope per scope boundary)
- `npm run build` — exit 0, 32 routes (unchanged count from before this change)
- Build output confirms all delivery-orders routes present: `/delivery-orders`, `/delivery-orders/new`, `/delivery-orders/[doId]`

### What Passed

- Type safety: `DeliveryOrderType`, `DoTypeEnum`, `doType` field on all three schemas inferred correctly through `z.input<...>` — no manual type assertions needed
- Legacy guard: `DeliveryOrderSchema.doType.default("external-inbound")` means Firestore docs without the field parse to `"external-inbound"` rather than undefined; list and detail pages additionally guard with `?? null` so the badge only renders when non-null
- Threat T-004-01: `CreateDeliveryOrderSchema.safeParse` in the server action rejects any doType value outside the three enum members before `tx.set()` — verified the enum is a closed `z.enum([...])` with no `.passthrough()`
- No new routes added (build count unchanged at 32)
- No existing fields (vendor, fileUrl, filePath, originalFilename, contentType, itemIds, notes, uploadedAt, uploadedBy) modified — only additive change

### What Was Ruled Out

- Pre-existing 12 TanStack/rhf `react-hooks/incompatible-library` warnings: out of scope — they exist in unmodified files and are unrelated to the doType change; ruled out per scope boundary rule
- createDeliveryOrder regression on other fields: the action's Zod parse gate (`CreateDeliveryOrderSchema.safeParse`) validates all fields holistically — adding a required `doType` field does NOT change how other fields are parsed or written; confirmed by reading the full `tx.set()` body
- Item back-references (itemIds on DO, doIds on items): DoTypeBadge and doType field are additive-only; the back-reference wiring in `addDoReference` + item detail page is untouched

### Human-Verify Checkpoint

Task 3 (checkpoint:human-verify) auto-approved — user confirmed autonomous completion.
