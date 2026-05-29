# Claim: quick-kayinleong-001

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-29
- status: claimed
- summary: Audit + implement four user-feedback features on inventory items — photo upload, Delivery-Order (DO) upload, location field, and label printing (QR/barcode, local-print support).

## Scope (from user feedback)

1. **Photo upload** — items must have a photo (audit existing `photoUrl`/`ItemPhotoField.tsx` to confirm coverage; close any gap).
2. **DO (Delivery Order) upload** — when a vendor delivers, an admin uploads the DO so we know what items came from which vendor. Enables tracing "where is the item from".
3. **Location field** — admin sets the storage location of each item (input field on item form, displayed in lists/detail).
4. **Label printing — local print** — print a QR or barcode label for an item. REST-API printer integration is **out of scope for this claim**; v1 of this feature is browser-based print (audit `LabelPreview.tsx` / `PrintLabelButton.tsx` to confirm coverage). REST-API printer integration captured for v2.

## What will change

To be filled after audit + research:
- [ ] `lib/types/item.ts` — add `location` + DO refs if missing
- [ ] `app/inventory/new` + `app/inventory/[id]/edit` forms — location input, DO upload control
- [ ] Server actions — `createItem` / `updateItem` / new `uploadDeliveryOrder` action
- [ ] Firestore rules — extend write validators for new fields
- [ ] Firebase Storage rules — add path for DO uploads (admin-only)
- [ ] Components — confirm/extend `ItemPhotoField`, `LabelPreview`, `PrintLabelButton`
- [ ] Detail page — display location + DO history block
- [ ] Mock data + tests as needed

(Final delta written by planner after audit.)

## What has changed

(Filled during execution.)

## Verification

(Filled at the end. Will include:
- `npm run build` (typecheck + lint baseline)
- `npm run lint`
- Manual smoke: create item with photo + location, upload DO, print label
- Regression report: confirm v1 inventory flows still work — checkout, checkin, low-stock, missing-items, scan, reports)
