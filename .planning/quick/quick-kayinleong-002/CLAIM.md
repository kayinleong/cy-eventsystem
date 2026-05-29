# Claim: quick-kayinleong-002

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-29
- status: done
- completed: 2026-05-29
- summary: Fix Firebase Storage rule for DO uploads — `match /delivery-orders/{doId}/document.{ext}` is invalid path-glob syntax (Storage rules don't support `.{ext}` extension globbing); rewrite as single-segment match with `fileName.matches()` validation.

## Root cause

User hit `Firebase Storage: User does not have permission to access 'delivery-orders/<uuid>/document.jpg'. (storage/unauthorized)` when uploading a DO file.

The rule shipped in `quick-kayinleong-001` (commit `31a4d70`):

```javascript
match /delivery-orders/{doId}/document.{ext} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && ...;
}
```

Firebase Storage rules path-segment matching only supports:
- `{singleSegment}` — one path segment
- `{multi=**}` — recursive multi-segment

The `.{ext}` token at the end of the segment is **not extension globbing** — the rule engine looks for a literal filename `document.{ext}`. Real uploads use `document.jpg` / `document.pdf` / `document.png`, none of which match the literal, so the rule never fires and the deny-by-default catch-all at line 52 catches the request → "storage/unauthorized".

This risk was explicitly flagged in `quick-kayinleong-001/PLAN.md` ("Risks & mitigations") and `RESEARCH.md` Pitfalls list — recommended fallback was three explicit blocks. We're taking the cleaner equivalent: single segment match + `fileName.matches()` validator.

## What will change

- `storage.rules` — replace the `match /delivery-orders/{doId}/document.{ext}` block with a single-segment match and a `fileName.matches('document\\.(pdf|jpg|png)')` validator on the write rule.

## What has changed

- `storage.rules` — `match /delivery-orders/{doId}/document.{ext}` replaced with `match /delivery-orders/{doId}/{fileName}` + `fileName.matches('document\\.(pdf|jpg|png)')` validator on the `allow write` clause. Read clause unchanged (signed-in only). Size cap + content-type allowlist preserved verbatim.

## Verification

### Visual rule-syntax check
- `fileName.matches('document\\.(pdf|jpg|png)')` — `matches()` is the documented `string` method on Firebase Storage rules CEL strings; same call shape already used in the photo rule above (`request.resource.contentType.matches('image/.*')` at line 33).
- Regex escape: `\\.` in the rules-language string literal yields the regex `\.` (literal dot). Matches `document.pdf`, `document.jpg`, `document.png`. Rejects `document.exe`, `evil.pdf`, `document.PDF` (case-sensitive), `subpath/document.pdf` (only one path segment allowed by `{fileName}`).

### Upload-path / rule cross-check
- `lib/storage/upload-delivery-order.ts:47` writes `delivery-orders/${doId}/document.${ext}` where `ext ∈ {pdf, jpg, png}` (line 21-25 allowlist). Every shape the helper can produce now matches the rule; no other code path uploads to this prefix.

### What was ruled out
- **Photo upload regression:** photo block at `match /items/{itemId}/photo.jpg` (lines 29-34) is **unchanged** by this fix. No impact on the photo flow.
- **Deny-by-default catch-all** (lines 53-55) unchanged. Paths outside `/delivery-orders/{doId}/document.{ext}` and `/items/{itemId}/photo.jpg` still deny.
- **Auth state:** the error message ("does not have permission") is a rules denial, not an unauthenticated 401 — the auth path was fine; the rule path-glob was the only defect.
- **Server-side admin gate** at `app/(app)/delivery-orders/actions.ts` (`requireAdmin()` on `createDeliveryOrder`) is unaffected — the Server Action still gates DO creation to admins. The Storage rule continues to enforce signed-in + filename shape + size + content-type only, per the documented cross-service-rule limitation.

### Manual verification needed (after rules deploy)
- User must run `firebase deploy --only storage` to push `storage.rules` to the deployed bucket. The build does not auto-deploy rules.
- Then: as admin, upload a JPG DO → succeeds. Upload a `.txt` (after temporarily relaxing the helper) → Storage rejects. Photo upload regression → still works.

## Notes

- This risk was explicitly called out in `quick-kayinleong-001/PLAN.md` "Risks & mitigations" and `RESEARCH.md` Pitfalls. Recommended mitigation was "fall back to three explicit match blocks (one per extension)" — single-segment + `.matches()` is the equivalent that keeps the rule a single block (cleaner diff, same security envelope).
- Logged as a v2 follow-up to add Firebase Storage rule unit tests using the emulator (project currently has none per Phase 2 SUMMARY).