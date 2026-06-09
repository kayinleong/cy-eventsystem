# Claim: quick-kayinleong-018

- owner: kayinleong
- session: claude-code
- branch: main
- started: 2026-06-09
- status: done
- summary: Telegram bot for business users to query inventory/event stats from their phone (Next.js Route Handler webhook + shared stats data layer), deployed on Netlify.

## What will change

(To be filled after audit + planning.) Brainstorm stats use cases queryable via Telegram, then implement a Telegram bot webhook on the existing Next.js 16 / Firebase / Netlify deployment so business users can query stats from their phone.

## What has changed

Read-only Telegram stats bot added to the existing Next.js 16 / Firebase / Netlify app. Four commands (`/stats`, `/lowstock`, `/events`, `/missing`) plus `/start`/`/help` and an unknown-message fallback, gated by a chat allowlist + Telegram webhook secret-token header.

- `package.json` / `package-lock.json` — added `grammy@1.43.0` (pinned, no caret).
- `.env.example` — added three `TELEGRAM_*` env var NAMES (no values).
- `proxy.ts` — excluded `api/telegram` from the auth matcher's negative-lookahead so the cookieless webhook POST is not 307-redirected to `/login` (the #1 critical edit). Only the second matcher line changed; `/api/auth/:path*` untouched.
- `lib/telegram/stats.server.ts` (new) — `getActiveEventsStats()`: active-events read via `adminDb` + per-event open-checkout qty (via `getOpenCheckoutsForEventServer`) + open-missing `count()` aggregation, capped to 10 events, parallelized.
- `lib/telegram/commands.ts` (new) — `registerCommands(bot)`: allowlist gate (`String(id)` compare, silent drop), four command handlers using the verified session-free fetchers, `/start`/`/help`, unknown-message fallback; all HTML `parse_mode` with `esc()`.
- `app/api/telegram/webhook/route.ts` (new) — Node-runtime, `force-dynamic` POST handler delegating to grammY `webhookCallback("std/http")` with `secretToken` + 8000ms timeout; Bot built lazily behind a singleton so `next build` runs without `TELEGRAM_*` env vars while keeping the missing-token guard at runtime.

Commits: `90c0036` (deps/env/proxy), `821a264` (stats helper + commands), `ee22242` (webhook route).

## Verification

### Automated gates (all passed)

- `npx tsc --noEmit` — clean (0 errors).
- `npm run lint` — 0 errors; 12 pre-existing warnings (React-Compiler / TanStack / RHF in unrelated `components/feature/*` files — out of scope, untouched). No warnings in any new file.
- `npm run build` — compiled successfully; route table lists `ƒ /api/telegram/webhook` alongside all existing routes (none removed).
- Read-only guard grep — no `.set/.update/.delete/.add/runTransaction` anywhere in `lib/telegram/*` or the route. Only "write" is `ctx.reply()` (Telegram, not Firestore).
- `getEventsPage` (session-gated) is never called.
- `proxy.ts` — `api/telegram` appears exactly once (in the matcher); the negative-lookahead gained only the `|api/telegram` token.

### Regression surface (self-audited)

- **Auth proxy:** The proxy edit only *adds* one alternative (`api/telegram`) to the existing negative-lookahead. No existing token (`_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, `robots.txt`) was removed, and the first matcher entry (`/api/auth/:path*`) is byte-for-byte unchanged. All existing app routes (`/`, `/inventory`, `/events`, `/reports/*`, `/users`, `/settings`, etc.) still match the proxy and remain auth-protected — confirmed by the build route table still rendering every route and by the fact only paths starting `api/telegram` are now excluded. Ruled out: accidental broadening (verified `api/telegram` count == 1).
- **No existing code touched** beyond the single proxy matcher line — `lib/data/*`, components, and other routes are untouched (git diff confirms only the 6 planned files changed).
- **Build-time safety:** Lazy Bot construction means the module-scope token throw fires only at request time (first webhook POST), not during `next build` — confirmed by a green build with no `TELEGRAM_*` vars present. The runtime guard is not weakened (token unset still throws before any update is processed).

### Manual (NOT an automated gate — requires real secrets + live Netlify deploy)

Documented in `quick-kayinleong-018-SUMMARY.md`: set the three `TELEGRAM_*` env vars in Netlify + redeploy, run the one-time `setWebhook` curl, then verify `/stats` `/lowstock` `/events` `/missing` reply from an allowlisted chat and produce no reply from a non-allowlisted chat.
