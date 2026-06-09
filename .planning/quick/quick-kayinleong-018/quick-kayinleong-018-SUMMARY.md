---
phase: quick-kayinleong-018
plan: 01
subsystem: telegram-bot
tags: [telegram, grammy, webhook, read-only, firebase-admin, netlify]
dependency_graph:
  requires:
    - lib/data/aggregations.server.ts (getDashboardKpis)
    - lib/data/inventory.server.ts (getInventoryPage)
    - lib/data/missing.server.ts (getMissingPage)
    - lib/data/events.server.ts (getOpenCheckoutsForEventServer)
    - lib/firebase/admin.ts (adminDb)
  provides:
    - app/api/telegram/webhook/route.ts (public webhook POST entry point)
    - lib/telegram/commands.ts (registerCommands)
    - lib/telegram/stats.server.ts (getActiveEventsStats)
  affects:
    - proxy.ts (auth matcher excludes api/telegram)
tech_stack:
  added:
    - grammy@1.43.0
  patterns:
    - grammY webhookCallback("std/http") in a Next 16 Route Handler
    - chat allowlist + Telegram secret-token header (two-layer auth)
    - lazy module-scope Bot singleton (build-safe, runtime-guarded)
key_files:
  created:
    - app/api/telegram/webhook/route.ts
    - lib/telegram/commands.ts
    - lib/telegram/stats.server.ts
  modified:
    - package.json
    - package-lock.json
    - .env.example
    - proxy.ts
decisions:
  - "Lazy Bot construction behind a module-scope singleton so `next build` runs without TELEGRAM_* env vars while keeping the missing-token throw at request time."
  - "std/http grammY adapter (App-Router Web Request), NOT next-js (Pages router)."
  - "HTML parse_mode with esc() over MarkdownV2 (only &,<,> need escaping; forgiving for names/SKUs)."
  - "/events reads active events directly via adminDb + count() because the paged events reader is session-gated (EVT-08) and unusable from a cookieless webhook."
metrics:
  duration: ~12 min
  completed: 2026-06-09
requirements: [TG-01, TG-02, TG-03, TG-04, TG-05, TG-06]
---

# Phase quick-kayinleong-018 Plan 01: Read-only Telegram stats bot Summary

A read-only Telegram bot (grammY webhook in a Next.js 16 Route Handler) lets allowlisted business users query live inventory and event stats from their phone via `/stats`, `/lowstock`, `/events`, `/missing` — reusing the existing session-free `lib/data/*.server.ts` fetchers through `adminDb`, with zero Firestore writes, no new collection, and no UI changes beyond a single auth-proxy matcher exclusion.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Dependency + env names + critical proxy bypass | `90c0036` | package.json, package-lock.json, .env.example, proxy.ts |
| 2 | Telegram stats helper + command handlers | `821a264` | lib/telegram/stats.server.ts, lib/telegram/commands.ts |
| 3 | Webhook route handler + full build gate | `ee22242` | app/api/telegram/webhook/route.ts |

## Files Changed

**Created**
- `app/api/telegram/webhook/route.ts` — Node-runtime, `force-dynamic` POST handler delegating to grammY `webhookCallback("std/http", { secretToken, timeoutMilliseconds: 8000 })`. Bot + handler built lazily behind a module-scope singleton; `bot.init()` awaited once per cold start. No GET / registration trigger.
- `lib/telegram/commands.ts` — `registerCommands(bot)`: first middleware = allowlist gate (`String(id)` compare against `TELEGRAM_ALLOWED_CHAT_IDS`, silent drop = HTTP 200, no info leak); `/stats`, `/lowstock`, `/events`, `/missing` handlers; `/start`+`/help`; unknown-message fallback. All replies use HTML `parse_mode` with an `esc()` helper applied to every dynamic value.
- `lib/telegram/stats.server.ts` — `getActiveEventsStats({ limit })`: active-events read via `adminDb`, then per-event open-checkout qty (sum over `getOpenCheckoutsForEventServer`) + open-missing `count()` aggregation, capped to 10 events and parallelized with `Promise.all`.

**Modified**
- `package.json` / `package-lock.json` — added `grammy@1.43.0` (pinned, no caret).
- `.env.example` — added a Telegram section with three env var NAMES only (no values): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_IDS`, `TELEGRAM_WEBHOOK_SECRET`.
- `proxy.ts` — **critical edit**: added `|api/telegram` to the second matcher's negative-lookahead so the cookieless Telegram webhook POST bypasses the auth middleware (otherwise 307-redirected to `/login`). First matcher (`/api/auth/:path*`) untouched; `api/telegram` appears exactly once.

## Deviations from Plan

The plan executed as written. The only adjustments were **wording-only edits to code comments** to satisfy the tasks' regression-check greps (the greps match raw substrings across the whole file, so explanatory comments were tripping them). No functional behavior changed:

- **[Rule 3 - Blocking]** Reworded the `proxy.ts` comment so the literal `api/telegram` appears exactly once (only in the matcher), satisfying the "appears exactly once" assertion.
- **[Rule 3 - Blocking]** Reworded comments in `lib/telegram/*` that mentioned `getEventsPage` and the literal write-method list (`.set/.update/.delete/.add/runTransaction`) so the read-only / no-session-fetcher greps pass. The code never calls those — only the comment text was changed.
- **[Rule 3 - Blocking]** Reworded the `route.ts` comment that mentioned `setWebhook` so the "no setWebhook trigger" grep passes. No registration trigger exists in the route; the curl is documented here in the SUMMARY only.

**Build-time guard (as anticipated by the plan):** rather than a module-scope `new Bot(token)` with an unconditional throw, the Bot/handler are built lazily inside `POST` behind a cached singleton. This keeps `next build` green without `TELEGRAM_*` env vars present while preserving the runtime guard — the `throw new Error("TELEGRAM_BOT_TOKEN is unset")` still fires on the first request when the token is missing. This is the smallest change that keeps the build green without weakening the runtime guard.

## Verification

### Automated gates (all passed)
- `npx tsc --noEmit` — clean (0 errors).
- `npm run lint` — 0 errors; 12 pre-existing warnings in unrelated `components/feature/*` (React Compiler / TanStack / RHF). No warnings in any new file. Out of scope per scope boundary; not touched.
- `npm run build` — compiled successfully; route table lists `ƒ /api/telegram/webhook` (dynamic function) alongside every existing route (none removed).
- Read-only grep — no `.set/.update/.delete/.add/runTransaction` in `lib/telegram/*` or the route.
- `getEventsPage` never called; `proxy.ts` `api/telegram` count == 1.

### Self-audits
- **Read-only:** confirmed. Only outbound write is `ctx.reply()` (Telegram API), never Firestore.
- **Proxy:** confirmed minimal. Only `|api/telegram` added to the existing negative-lookahead; no existing token removed; `/api/auth/:path*` unchanged; all existing routes still auth-gated (build route table intact).

## Manual setup & verification (requires real secrets + live Netlify deploy)

These are NOT automated gates — they need runtime secrets the executor cannot generate and a deployed URL.

### 1. Set Netlify environment variables
In the Netlify dashboard → **Site settings → Environment variables**, add the three values, then **redeploy** so the serverless function picks them up:

- `TELEGRAM_BOT_TOKEN` — from Telegram **@BotFather** (`/newbot` or `/token`). Server-only secret; never log or commit.
- `TELEGRAM_ALLOWED_CHAT_IDS` — comma-separated Telegram chat/user ids permitted to use the bot (e.g. from **@userinfobot**).
- `TELEGRAM_WEBHOOK_SECRET` — a random string you generate (`openssl rand -hex 32`); passed verbatim as `setWebhook`'s `secret_token`.

### 2. Register the webhook ONCE (run locally; token pasted inline, NEVER committed)
Replace the `<...>` placeholders with the real values locally:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=https://cy-eventsystem.netlify.app/api/telegram/webhook" \
  --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  --data-urlencode "allowed_updates=[\"message\"]"
```

`allowed_updates=["message"]` limits delivery to messages (no edited/channel noise). To inspect or clear: `getWebhookInfo` / `deleteWebhook`.

### 3. Live-bot verification checklist
From an **allowlisted** chat:
- [ ] `/stats` → inventory snapshot (active items / items out / low stock / active events).
- [ ] `/lowstock` → low-stock items with available qty / threshold (or "No low-stock items.").
- [ ] `/events` → active events with per-event checked-out + open-missing (or "No active events.").
- [ ] `/missing` → open missing-item records: item @ event — qty, reason (or "No open missing items.").
- [ ] `/start` or `/help` → "Commands: /stats /lowstock /events /missing".
- [ ] Any non-command text → "Unknown command. Try /help".

From a **non-allowlisted** chat:
- [ ] Any message → **no reply at all** (silent drop, HTTP 200, no info leak).

Security:
- [ ] A POST to `/api/telegram/webhook` with a wrong/absent `X-Telegram-Bot-Api-Secret-Token` is rejected **401** by grammY before any command runs.
- [ ] Firestore shows **zero writes** from the bot (read-only).

## Self-Check: PASSED
- FOUND: app/api/telegram/webhook/route.ts
- FOUND: lib/telegram/commands.ts
- FOUND: lib/telegram/stats.server.ts
- FOUND: commit 90c0036
- FOUND: commit 821a264
- FOUND: commit ee22242
