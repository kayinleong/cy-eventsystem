# Quick Task quick-kayinleong-018 — Context

**Gathered:** 2026-06-09
**Status:** Ready for research + planning

## Task Boundary

Build a Telegram bot so business users can query inventory/event stats from their phone. Implemented on the existing Next.js 16 / Firebase / Netlify deployment (cy-eventsystem.netlify.app). Read-only stats queries — no mutations.

## Locked Decisions (from user, via AskUserQuestion)

### Commands (v1 scope — all four selected)
- `/stats` — inventory snapshot: total active items, items currently out, low-stock count, active events. → `getDashboardKpis()`
- `/lowstock` — items at/below reorder threshold with available qty (what to buy). → `getInventoryPage({ filters: { isLowStock: true } })`
- `/events` — active events with per-event checked-out + open-missing counts. → `getEventsPage()` + transaction/missing counts
- `/missing` — open unresolved missing-item records (item, event, qty, reason). → `getMissingPage({ status: "open" })`

### Access control — Chat allowlist via env var
- `TELEGRAM_ALLOWED_CHAT_IDS` env var (comma-separated Telegram chat/user IDs). Bot ignores any chat not on the list.
- No new Firestore collection. No passphrase/linking flow.

### Bot library — grammY
- Modern TS-first framework with `webhookCallback` adapter for route handlers. One new dependency (approved — surfaced per stack rules).

## Architecture (dictated by Telegram)

- Webhook **entry point** must be a Next.js Route Handler at `app/api/telegram/webhook/route.ts` (Node runtime), NOT a Server Action — external services cannot invoke RSC server actions.
- Stat-computing logic reuses the existing `lib/data/*.server.ts` functions (the "server-action logic"), called directly from the route handler via `adminDb`.
- `requireSession()`/`requireAdmin()` are NOT usable (no browser cookie). Auth = chat allowlist + a Telegram webhook secret-token header check.

## Claude's Discretion
- Message formatting (parse_mode, layout), command-not-found handling, `/start` + `/help` text, webhook secret-token verification, and the one-time `setWebhook` registration mechanism — choose sensible defaults; research to confirm grammY + Netlify serverless specifics.

## Canonical References
- AUDIT.md (this dir) — data model, data-layer functions, Admin SDK, route-handler pattern, deployment config, env var names.
