---
phase: quick-kayinleong-005
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/types/item.ts
  - lib/schemas/item.ts
  - lib/data/inventory.server.ts
  - lib/hooks/use-inventory-live.ts
  - app/(app)/inventory/actions.ts
  - app/(app)/inventory/[itemId]/edit/page.tsx
  - components/feature/inventory/BarcodeFieldInput.tsx
  - components/feature/inventory/ItemForm.tsx
  - components/feature/inventory/PrintLabelButton.tsx
  - components/feature/inventory/ItemDetail.tsx
  - components/feature/scan/scan-session.tsx
autonomous: true
requirements: [INV-01, INV-03, INV-10]

must_haves:
  truths:
    - "Inventory item type, all Zod schemas, and both mappers carry externalBarcode as an optional string defaulting to empty string"
    - "ItemForm renders an External Barcode field with a scan-to-capture camera Sheet that populates the input on a successful scan"
    - "PrintLabelButton encodes externalBarcode as the barcode payload when set; the human-readable text under the barcode shows the externalBarcode value (not SKU)"
    - "Scan page addLine resolves items by externalBarcode as a third fallback after SKU and id"
    - "Existing Firestore docs without externalBarcode read cleanly — no migration needed"
  artifacts:
    - path: "lib/types/item.ts"
      provides: "InventoryItem.externalBarcode: string field"
    - path: "lib/schemas/item.ts"
      provides: "externalBarcode in ItemSchema, ItemFormSchema, CreateItemSchema, UpdateItemSchema"
    - path: "components/feature/inventory/BarcodeFieldInput.tsx"
      provides: "Scan-to-capture field component for ItemForm"
    - path: "components/feature/scan/scan-session.tsx"
      provides: "Third-fallback externalBarcode lookup in addLine"
  key_links:
    - from: "BarcodeFieldInput"
      to: "ItemForm register / setValue"
      via: "RHF register + manual setValue on scan callback"
    - from: "ItemDetail"
      to: "PrintLabelButton"
      via: "externalBarcode prop passed alongside sku and name"
    - from: "scan-session.tsx addLine"
      to: "useInventoryLive snapshot"
      via: "items.find(i => i.externalBarcode !== '' && i.externalBarcode === trimmed)"
---

<objective>
Thread externalBarcode through the full inventory stack: type, schemas, mappers, Server Actions, form (with scan-to-capture), label generation (barcode payload + label text), and scan-page item lookup.

Purpose: Physical barcodes on existing equipment can be scanned at check-out/in without requiring manual SKU entry. Labels printed from the app encode the manufacturer barcode so scanners recognise external labels.
Output: 11 modified/created files; no new dependencies; no Firestore index; no data migration.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/quick-kayinleong-005/quick-kayinleong-005-RESEARCH.md

<interfaces>
<!-- Key contracts extracted from codebase. No codebase exploration needed. -->

From lib/types/item.ts:
```typescript
export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  // ... add after sku:
  // externalBarcode: string;
  category: ItemCategory;
  // (all other fields unchanged — see RESEARCH §1.1 for the full list)
};
```

From lib/schemas/item.ts — existing .default("") pattern for optional string fields:
```typescript
location: z.string().max(100).default(""),
brand: z.string().max(100).default(""),
// externalBarcode follows the same shape
```

From components/feature/inventory/ItemForm.tsx — how to add a scan-backed field:
```typescript
// Photo URL is managed outside RHF via local useState, then folded in at submit.
// externalBarcode can live inside RHF directly via register("externalBarcode") +
// setValue("externalBarcode", scannedValue) from the BarcodeFieldInput onChange prop.
// Controller or register — both work; register + setValue is simpler for a plain string.
const { register, handleSubmit, setError, control, watch, setValue, formState: { errors } } = useForm<ItemFormInput>({ ... });
```

From components/feature/inventory/PrintLabelButton.tsx — current props and payload:
```typescript
export function PrintLabelButton({ sku, name }: { sku: string; name: string }) {
  const check = canEncode(sku, format);    // line 43
  // ...
  <LabelPreview value={sku} format={format} />   // line 105
  <p className="font-mono text-sm">{sku}</p>     // line 106 — human-readable text
  <p className="text-sm text-muted-foreground">{name}</p>  // item name
}
```

From components/feature/inventory/ItemDetail.tsx — where PrintLabelButton is called:
```typescript
<PrintLabelButton sku={item.sku} name={item.name} />   // line 86
// item is full InventoryItem; item.externalBarcode is available once type is updated
```

From components/feature/scan/scan-session.tsx — current addLine lookup (lines 294-297):
```typescript
const item =
  items.find((i) => i.sku.toLowerCase() === lower) ??
  items.find((i) => i.id === trimmed);
// Add third fallback: ?? items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed)
```

From components/feature/scan/ScannerWidget.tsx — camera scanner usage:
```typescript
import { Scanner } from "@yudiel/react-qr-scanner";
// Scanner takes: onScan={(detections) => ...}, paused={boolean}
// Detections: IDetectedBarcode[] — each has rawValue: string
// Debounce pattern: lastScan useRef, 1500ms window, navigator.vibrate(50)
// No ScanSessionProvider dependency — it's a plain library component
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add externalBarcode to type, schemas, mappers, and Server Actions</name>
  <files>
    lib/types/item.ts,
    lib/schemas/item.ts,
    lib/data/inventory.server.ts,
    lib/hooks/use-inventory-live.ts,
    app/(app)/inventory/actions.ts
  </files>
  <behavior>
    - InventoryItem has externalBarcode: string (no undefined — always a string)
    - ItemSchema.parse({}) fills externalBarcode with "" via .default("")
    - ItemFormSchema includes externalBarcode: z.string().max(100).default("")
    - CreateItemSchema includes externalBarcode: z.string().max(100).optional()
    - UpdateItemSchema includes externalBarcode: z.string().max(100).optional()
    - toItem mappers in both inventory.server.ts and use-inventory-live.ts default to "" via ?? ""
    - createItem action writes data.externalBarcode ?? "" to Firestore tx.set
    - updateItem action writes data.externalBarcode ?? current.externalBarcode ?? "" to tx.update
    - npx tsc --noEmit exits 0 after changes
  </behavior>
  <action>
    1. lib/types/item.ts — add `externalBarcode: string;` after the `sku` field. Add a JSDoc comment: "Manufacturer / physical barcode value. Empty string when not set. Used as label payload and secondary scan-resolution key."

    2. lib/schemas/item.ts:
       - In ItemSchema, add `externalBarcode: z.string().max(100).default(""),` after the `sku` field.
       - In ItemFormSchema, add `externalBarcode: z.string().max(100).default(""),` after `brand`.
       - In CreateItemSchema, add `externalBarcode: z.string().max(100).optional(),` after `brand`.
       - In UpdateItemSchema, add `externalBarcode: z.string().max(100).optional(),` after `brand`.

    3. lib/data/inventory.server.ts — in the toItem function body, add `externalBarcode: d.externalBarcode ?? "",` following the same pattern as `location` and `brand`.

    4. lib/hooks/use-inventory-live.ts — same addition to the toItem function inside the hook.

    5. app/(app)/inventory/actions.ts:
       - In the createItem action's tx.set payload, add `externalBarcode: data.externalBarcode ?? "",`
       - In the updateItem action's tx.update payload, add `externalBarcode: data.externalBarcode ?? current.externalBarcode ?? "",`

    Run `npx tsc --noEmit` to confirm zero type errors before proceeding to Task 2.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>tsc exits 0; InventoryItem.externalBarcode is typed as string; all four Zod schemas contain the field; both mappers default to ""; both Server Actions write the field.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: BarcodeFieldInput component, ItemForm integration, label update, scan-page fallback</name>
  <files>
    components/feature/inventory/BarcodeFieldInput.tsx,
    components/feature/inventory/ItemForm.tsx,
    app/(app)/inventory/[itemId]/edit/page.tsx,
    components/feature/inventory/PrintLabelButton.tsx,
    components/feature/inventory/ItemDetail.tsx,
    components/feature/scan/scan-session.tsx
  </files>
  <behavior>
    - BarcodeFieldInput renders an Input + "Scan" icon button; clicking Scan opens a Sheet containing a live Scanner; successful scan closes the Sheet and calls onChange(rawValue)
    - BarcodeFieldInput debounces repeated scans with a 1500 ms window (useRef pattern matching ScannerWidget); calls navigator.vibrate(50) on successful capture
    - ItemForm includes an External Barcode field using BarcodeFieldInput wired via register("externalBarcode") + setValue("externalBarcode", v)
    - ItemForm defaultValues includes externalBarcode: initial?.externalBarcode ?? ""
    - ItemForm onSubmit passes externalBarcode from form values to createItem and updateItem calls
    - edit/page.tsx passes externalBarcode: item.externalBarcode to the initial prop
    - PrintLabelButton accepts an optional externalBarcode prop; barcodePayload = externalBarcode?.trim() || sku; the LabelPreview receives barcodePayload; the human-readable text under the barcode shows barcodePayload (the externalBarcode when set, SKU otherwise)
    - ItemDetail passes externalBarcode={item.externalBarcode} to PrintLabelButton alongside sku and name
    - scan-session.tsx addLine adds a third fallback: ?? items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed)
    - npx tsc --noEmit and npm run lint both exit 0
  </behavior>
  <action>
    1. Create components/feature/inventory/BarcodeFieldInput.tsx:
       - "use client" directive (after comment header per D-01-05-A convention)
       - Props: `{ value: string; onChange: (v: string) => void; disabled?: boolean }`
       - State: `const [open, setOpen] = useState(false)` (Sheet open/closed)
       - Debounce ref: `const lastScan = useRef<number>(0)`
       - Render: a flex row with an `<Input>` bound to `value`/`onChange` for manual text entry + a small `<Button type="button" variant="outline" size="icon">` containing `<ScanLine className="size-4" />` from lucide-react that opens the Sheet on click.
       - Sheet content: `<SheetHeader><SheetTitle>Scan barcode</SheetTitle></SheetHeader>` + an inline `<Scanner>` from `@yudiel/react-qr-scanner` with:
         - `formats={["qr_code","code_128","ean_13","upc_a","data_matrix"]}` (same 5 as ScannerWidget)
         - `paused={!open}` — activates camera only when Sheet is open
         - `onScan={(detections) => { if (!detections.length) return; const now = Date.now(); if (now - lastScan.current < 1500) return; lastScan.current = now; navigator.vibrate?.(50); onChange(detections[0].rawValue); setOpen(false); }}`
         - `onError` — silently ignore; camera is optional (manual Input is the fallback)
       - The Input's onChange calls `onChange(e.target.value)` for manual editing.

    2. components/feature/inventory/ItemForm.tsx:
       - Add `setValue` to the useForm destructure (already has `register`, `control`, `watch`, `setError`).
       - Add `externalBarcode: initial?.externalBarcode ?? ""` to defaultValues.
       - Add BarcodeFieldInput import from "./BarcodeFieldInput".
       - Add a `<Field data-invalid={!!errors.externalBarcode}>` block after the Brand field:
         ```
         <FieldLabel htmlFor="item-externalBarcode">External barcode (optional)</FieldLabel>
         <BarcodeFieldInput
           value={watch("externalBarcode") ?? ""}
           onChange={(v) => setValue("externalBarcode", v, { shouldValidate: true })}
           disabled={submitting}
         />
         <FieldError errors={errors.externalBarcode ? [{ message: errors.externalBarcode.message }] : undefined} />
         ```
       - In onSubmit create branch, add `externalBarcode: values.externalBarcode ?? ""` to the createItem call.
       - In onSubmit edit branch, add `externalBarcode: values.externalBarcode ?? ""` to the updateItem call.

    3. app/(app)/inventory/[itemId]/edit/page.tsx — in the `initial` prop object passed to `<ItemForm>`, add `externalBarcode: item.externalBarcode`.

    4. components/feature/inventory/PrintLabelButton.tsx:
       - Change props signature to: `{ sku: string; name: string; externalBarcode?: string }`
       - Derive payload: `const barcodePayload = externalBarcode?.trim() || sku;`
       - Change `canEncode(sku, format)` to `canEncode(barcodePayload, format)`.
       - Change `<LabelPreview value={sku} ...>` to `<LabelPreview value={barcodePayload} ...>`.
       - Change `<p className="font-mono text-sm">{sku}</p>` to `<p className="font-mono text-sm">{barcodePayload}</p>` — the label reads as the external barcode value when set (per constraint: "printed text beneath barcode should show the external barcode value when set").
       - Name line below stays as `{name}`.

    5. components/feature/inventory/ItemDetail.tsx — change `<PrintLabelButton sku={item.sku} name={item.name} />` to `<PrintLabelButton sku={item.sku} name={item.name} externalBarcode={item.externalBarcode} />`.

    6. components/feature/scan/scan-session.tsx — in addLine, extend the item lookup chain:
       ```typescript
       const item =
         items.find((i) => i.sku.toLowerCase() === lower) ??
         items.find((i) => i.id === trimmed) ??
         items.find((i) => i.externalBarcode !== "" && i.externalBarcode === trimmed);
       ```

    After all edits: run `npx tsc --noEmit` (must exit 0) then `npm run lint` (must exit 0 — existing pre-existing TanStack/RHF warnings are acceptable, new errors are not).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint</automated>
  </verify>
  <done>tsc exits 0; lint exits 0; ItemForm renders External barcode field with Scan button; PrintLabelButton uses externalBarcode payload and text when set; scan-session addLine has third fallback.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Full externalBarcode vertical slice: type + schemas + mappers + Server Actions + BarcodeFieldInput component + ItemForm field + label update + scan-page lookup.
  </what-built>
  <how-to-verify>
    Start the dev server: `npm run dev`

    1. Visit http://localhost:3000/inventory/new
       - Confirm "External barcode (optional)" field appears between Brand and Photo fields.
       - Click the scan icon button — a Sheet opens with a live camera feed (or permission prompt).
       - Close the Sheet. Manually type a value in the External barcode Input — it accepts text.

    2. Create a new item (e.g. name "Test Mic", SKU "TEST-001", qty 1) with externalBarcode "4006381333931" (a real EAN-13). Save.
       - Confirm the item detail page loads without errors.

    3. On the item detail page, click "Print label".
       - Select "EAN-13" format.
       - Confirm the barcode renders and the human-readable text below it shows "4006381333931" (the external barcode), NOT "TEST-001".

    4. Visit http://localhost:3000/scan (admin session).
       - Pick any active event.
       - In the Manual entry input, type "4006381333931" and press Enter.
       - Confirm the item "Test Mic" appears in the cart (external barcode match).

    5. Visit http://localhost:3000/inventory/TEST-001/edit
       - Confirm the External barcode field is pre-populated with "4006381333931".
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client form → createItem/updateItem Server Action | externalBarcode is user-supplied free text |
| Scanner callback → form state | Scanner rawValue is an untrusted external barcode payload |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-005-01 | Tampering | externalBarcode field in form | mitigate | Zod max(100) on all four schemas; Server Action validates via CreateItemSchema / UpdateItemSchema before write |
| T-005-02 | Spoofing | Scan page: first-match-wins on duplicate externalBarcode values | accept | No uniqueness enforcement for v1 per planner constraint; first Array.find match resolves deterministically; documented as known limitation |
| T-005-03 | Information Disclosure | Scanner camera Sheet in ItemForm | accept | Camera access requires explicit user gesture (Scan button click); camera is released when Sheet closes (paused prop); no PII captured |
</threat_model>

<verification>
- `npx tsc --noEmit` exits 0 (Task 1 gate + Task 2 gate)
- `npm run lint` exits 0 (Task 2 gate)
- `npm run build` exits 0 — all routes compile, no new TypeScript errors
- Human verify: External barcode field present on /inventory/new; scan icon opens Sheet with camera; label shows externalBarcode text when set; scan page resolves by externalBarcode
</verification>

<success_criteria>
- InventoryItem.externalBarcode: string present in type and all 4 Zod schemas
- Both toItem mappers default the field to "" (safe for pre-existing Firestore docs)
- BarcodeFieldInput component created — Input + scan Sheet
- ItemForm renders External barcode field; onSubmit sends value to Server Action
- PrintLabelButton encodes externalBarcode as barcode payload and label text when set
- scan-session.tsx addLine resolves items by externalBarcode as third fallback
- tsc, lint, and build all pass
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-005/quick-kayinleong-005-SUMMARY.md` following the summary template.

Update `.planning/quick/quick-kayinleong-005/CLAIM.md`:
- status: done
- completed: (today's date)
- Add `## Verification` section with: what was tested, what passed, what was ruled out.

Update `.planning/STATE.md` quick tasks table with quick-kayinleong-005 row.
</output>
