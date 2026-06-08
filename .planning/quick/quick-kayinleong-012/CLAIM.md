# Claim: quick-kayinleong-012
- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-08
- status: in-progress
- summary: Fix barcode-not-recognised in Location check-in scan mode; surface check-in location updates in history across event, item, and DO modules.

## What will change
Audit findings in AUDIT.md; plan in PLAN.md. Three atomic commits:
1. Bug: minimal `LocationPanel.tsx` patch so group barcodes resolve instead of
   false "not recognised".
2. History data: `"location"` transaction type + `deliveryOrderId`;
   `updateItemsLocationAction` writes location transactions (event/DO stamped
   for group resolutions); new `transactions(deliveryOrderId, at)` index;
   `useTransactionsLive` deliveryOrderId scope.
3. History display: location label/tone/verb in Item & Event tabs; new DO
   history tab on the DO detail page.

Confirmed decisions: minimal client patch / group-link attribution / precise
DO history (stamped deliveryOrderId + index + tab).

## What has changed
(pending)

## Verification
(pending)
