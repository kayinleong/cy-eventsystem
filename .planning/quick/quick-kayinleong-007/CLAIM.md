# Claim: quick-kayinleong-007
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-07
- completed: 2026-06-07
- status: done
- summary: Location tracking for checked-out items — staff scans individual item barcode or group barcode, selects location, updates item location field

## What changed

- Created `app/(app)/scan/actions.ts` — `updateItemsLocationAction` Server Action with Zod validation (`barcodeValue` min 1, `location` max 100), `requireSession()` auth gate, 3-step barcode resolution (inventory doc by ID, inventory by externalBarcode, checkoutGroups by doc ID), `adminDb.batch()` write, `revalidatePath` for affected inventory routes.
- Created `components/feature/scan/LocationPanel.tsx` — self-contained scan UI owning local state (`idle | preview | submitting`), reads from `useInventoryLive` for instant item preview, passes `eventRequired={false}` and `onScan` override to `ScannerWidget`, calls `updateItemsLocationAction` on confirm, shows success/error toasts, resets to idle on success.
- Modified `components/feature/scan/scan-session.tsx` — `ScanMode` widened to `"checkout" | "checkin" | "location"`; sessionStorage validation guard and cross-tab sync guard both updated to accept `"location"`.
- Modified `components/feature/scan/ScannerWidget.tsx` — `eventRequired?: boolean` (default `true`) and `onScan?: (value: string) => void` props added; `isPaused` now gates on `(eventRequired ? !selectedEvent : false)`; Start button `disabled` and placeholder copy updated; `handleScan` dispatches to `onScan` when provided, else `addLine` (backward-compatible).
- Modified `app/(app)/scan/page.tsx` — third `<TabsTrigger value="location">Location</TabsTrigger>` tab added; `PageHeader` description extended for location mode; `mode === "location"` conditionally renders `<LocationPanel />` while checkout/checkin content block is unchanged.

## Auto-fixed deviations

1. **[Rule 1] Fixed `adminDb.writeBatch()` → `adminDb.batch()`** — the plan specified the wrong Admin SDK method name; TypeScript TS2339 caught it; fixed before first commit.
2. **[Rule 1] Fixed `useInventoryLive` return value** — plan's interface comment described `{ items }` destructuring but the hook returns `InventoryItem[]` directly; fixed inline.

## Verification

### What was tested

- `npx tsc --noEmit` — exits 0 (zero TypeScript errors) after both tasks
- `npm run lint` — exits 0 errors (12 pre-existing TanStack/rhf warnings, out-of-scope per scope boundary, same as prior quick tasks)
- `npm run build` — exits 0; 32 routes (unchanged from pre-task count); `/scan` route confirmed dynamic

### What passed

- TypeScript strict mode passes across all 5 modified/created files
- ESLint passes with zero new errors or warnings
- Production build exits 0; route table matches prior quick-kayinleong-006 count (32 routes)
- All 3 stages of Server Action barcode resolution are present and correctly typed:
  1. `adminDb.collection("inventory").doc(barcodeValue).get()` — O(1) SKU/doc-id
  2. `.where("externalBarcode", "==", barcodeValue).limit(1).get()` — externalBarcode match
  3. `adminDb.collection("checkoutGroups").doc(barcodeValue).get()` — group barcode
- `requireSession()` auth gate is the first statement before any Firestore read (T-007-01 mitigated)
- Zod `z.string().max(100)` on `location` prevents oversized writes (T-007-02 mitigated)
- `ScannerWidget` existing callers (`ScannerWidget` on checkout page and on `/scan` checkout/checkin modes) do not pass `eventRequired` or `onScan` — default props preserve prior behavior exactly

### What was ruled out and why

- Regression on checkout/checkin scan flows: `ScannerWidget` default `eventRequired=true` preserves the `!selectedEvent` gate that existed before; `onScan` is absent at existing call sites so `addLine` is called as before. No behavioral change.
- Regression on `ScanMode` sessionStorage persistence: `"location"` mode added to both the validation guard and the cross-tab sync guard. If a user persists a location-mode session and refreshes, it rehydrates correctly. Checkout/checkin session persistence is unchanged (same conditions checked before and after the widen).
- Regression on `scan-session.tsx` cross-tab sync: the additional `parsed.mode !== "location"` check is in the same guard chain; existing checkout/checkin messages are unaffected.
