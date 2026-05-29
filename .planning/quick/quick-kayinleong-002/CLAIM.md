# Claim: quick-kayinleong-002

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-05-29
- status: claimed
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

(Filled during execution.)

## Verification

(Filled after fix. Will include:
- Visual rule-syntax check against Firebase Storage rules docs
- Manual smoke from the user: upload a JPG DO → succeeds; upload a `.exe` rename test → rejected
- User runs `firebase deploy --only storage` to push the fix to the deployed bucket
- Regression: photo upload at `items/{itemId}/photo.jpg` still works — rule unchanged)