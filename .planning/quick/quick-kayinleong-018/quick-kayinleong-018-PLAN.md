---
phase: quick-kayinleong-018
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - .env.example
  - proxy.ts
  - lib/telegram/stats.server.ts
  - lib/telegram/commands.ts
  - app/api/telegram/webhook/route.ts
autonomous: true
requirements:
  - TG-01  # /stats  — inventory snapshot KPIs
  - TG-02  # /lowstock — repurchase candidates
  - TG-03  # /events — active events with per-event checked-out + open-missing
  - TG-04  # /missing — open missing-item records
  - TG-05  # chat allowlist + webhook secret-token auth
  - TG-06  # webhook route handler (Node runtime) + proxy bypass

user_setup:
  - service: Telegram (BotFather)
    why: "Bot token, allowlisted chat ids, and webhook secret are runtime-only secrets the executor cannot generate. Live-bot verification requires a deployed Netlify URL + setWebhook."
    env_vars:
      - name: TELEGRAM_BOT_TOKEN
        source: "Telegram @BotFather -> /newbot (or /token). server-only secret; NEVER log or commit."
      - name: TELEGRAM_ALLOWED_CHAT_IDS
        source: "Comma-separated Telegram chat/user ids permitted to use the bot (e.g. from @userinfobot)."
      - name: TELEGRAM_WEBHOOK_SECRET
        source: "Random string you generate (e.g. `openssl rand -hex 32`); passed verbatim to setWebhook's secret_token."
    dashboard_config:
      - task: "Set the three TELEGRAM_* env vars in Netlify (Site settings -> Environment variables) and redeploy so the function picks them up."
        location: "Netlify dashboard"
      - task: "Register the webhook ONCE via curl (token pasted inline locally, never committed) — see <success_criteria> for the exact command. NEVER hardcode the token in code."
        location: "Local terminal -> api.telegram.org/bot<token>/setWebhook"

must_haves:
  truths:
    - "An allowlisted Telegram chat receives an inventory snapshot when it sends /stats"
    - "An allowlisted chat receives low-stock items with available qty when it sends /lowstock"
    - "An allowlisted chat receives active events with per-event checked-out + open-missing counts when it sends /events"
    - "An allowlisted chat receives open missing-item records (item, event, qty, reason) when it sends /missing"
    - "A non-allowlisted chat receives no reply (silent drop, HTTP 200, no info leak)"
    - "A POST with a wrong/absent X-Telegram-Bot-Api-Secret-Token is rejected (401) by grammY before any command runs"
    - "Telegram's cookieless POST to /api/telegram/webhook reaches the handler instead of being 307-redirected to /login by the auth proxy"
    - "The bot performs ZERO Firestore writes — every command is read-only"
  artifacts:
    - path: "app/api/telegram/webhook/route.ts"
      provides: "Webhook POST entry point: module-scope Bot singleton, awaited bot.init(), webhookCallback std/http with secretToken + 8000ms timeout"
      contains: "webhookCallback"
    - path: "lib/telegram/commands.ts"
      provides: "registerCommands(bot): allowlist gate + /stats /lowstock /events /missing /start /help handlers + unknown-message fallback, HTML parse_mode with esc()"
      exports: ["registerCommands"]
    - path: "lib/telegram/stats.server.ts"
      provides: "getActiveEventsStats(): active-events fetch + per-event checked-out + open-missing counts (replaces the session-gated getEventsPage)"
      exports: ["getActiveEventsStats"]
    - path: "proxy.ts"
      provides: "auth matcher with api/telegram added to the negative-lookahead so the webhook path is NOT intercepted"
      contains: "api/telegram"
    - path: ".env.example"
      provides: "Three TELEGRAM_* env var NAMES (no values)"
      contains: "TELEGRAM_BOT_TOKEN"
    - path: "package.json"
      provides: "grammy@1.43.0 dependency"
      contains: "grammy"
  key_links:
    - from: "Telegram POST /api/telegram/webhook"
      to: "proxy.ts matcher"
      via: "negative-lookahead exclusion of api/telegram"
      pattern: "api/telegram"
    - from: "app/api/telegram/webhook/route.ts"
      to: "lib/telegram/commands.ts registerCommands"
      via: "import + registerCommands(bot)"
      pattern: "registerCommands"
    - from: "lib/telegram/commands.ts"
      to: "lib/data/*.server.ts + lib/telegram/stats.server.ts"
      via: "direct fetcher calls inside bot.command handlers"
      pattern: "getDashboardKpis|getInventoryPage|getMissingPage|getActiveEventsStats"
---

<objective>
Add a read-only Telegram bot to the existing Next.js 16 / Firebase / Netlify app so allowlisted business users can query inventory and event stats from their phone. Four commands: `/stats`, `/lowstock`, `/events`, `/missing`. Implemented as a grammY webhook in a Next.js Route Handler; stat logic reuses the existing session-free `lib/data/*.server.ts` fetchers via the already-initialized `adminDb`.

Purpose: Give the field/business team a phone-first window into live inventory state without logging into the web app — no new collection, no mutations, no UI changes.
Output: One new dependency, three new TELEGRAM_* env names, a one-token proxy matcher edit, two new `lib/telegram/*` modules, and one new webhook route handler.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/quick-kayinleong-018/CONTEXT.md
@.planning/quick/quick-kayinleong-018/AUDIT.md
@.planning/quick/quick-kayinleong-018/RESEARCH.md
@CLAUDE.md
@AGENTS.md

# Next.js 16 is a breaking major version. Before writing the route handler, confirm
# the App-Router route-handler signature (Web `Request`/`Response`, `runtime`,
# `dynamic`) against:
#   node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
#   node_modules/next/dist/docs/.../02-route-segment-config/runtime.md

<interfaces>
<!-- VERIFIED signatures from the codebase. Use these directly — NO exploration needed. -->

From lib/data/aggregations.server.ts:40 — for /stats (NO args, NO session):
```typescript
export type DashboardKpis = { totalItems: number; itemsOut: number; lowStockCount: number; activeEvents: number };
export async function getDashboardKpis(): Promise<DashboardKpis>;
```

From lib/data/inventory.server.ts:74 — for /lowstock (NO session). Each item has name, sku, availableQty, lowStockThreshold:
```typescript
export type InventoryPage = { items: InventoryItem[]; nextCursor: string | null };
export async function getInventoryPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { category?: string; lifecycleState?: string; isLowStock?: boolean };
}): Promise<InventoryPage>;
// call as: getInventoryPage({ filters: { isLowStock: true }, limit: 20 })
```

From lib/data/missing.server.ts:141 — for /missing (NO session). NOTE filter nesting is { filters: { status } }, NOT { status }:
```typescript
export type MissingItemDoc = {
  id: string; itemId: string; itemName: string; eventId: string; eventName: string;
  qty: number; reason: "Lost" | "Damaged" | "Not returned" | "Unknown";
  reportedBy: string; reportedByName: string; reportedAt: string;
  status: "open" | "found" | "writtenOff"; resolvedAt: string | null; resolvedBy: string | null;
  parentCheckinTxId: string;
};
export async function getMissingPage(opts: {
  cursor?: string | null;
  limit?: number;
  filters?: { status?: "open" | "found" | "writtenOff"; eventId?: string; itemId?: string };
}): Promise<{ missing: MissingItemDoc[]; nextCursor: string | null }>;
// call as: getMissingPage({ filters: { status: "open" }, limit: 20 })
```

From lib/data/events.server.ts:100 — DO NOT CALL. getEventsPage REQUIRES `session: Session` for EVT-08 access filtering; the bot has no session:
```typescript
export async function getEventsPage(opts: { ...; session: Session }): Promise<EventsPage>; // ❌ unusable from webhook
```

From lib/data/events.server.ts:179 — usable for per-event checked-out (NO session). Returns open checkout transactions:
```typescript
export async function getOpenCheckoutsForEventServer(eventId: string): Promise<TransactionDoc[]>;
// each TransactionDoc has: itemName, itemSku, qty, eventId, eventName, type, at, ...
```

From lib/firebase/admin.ts — Firestore Admin (server-only, already initialized):
```typescript
export const adminDb: FirebaseFirestore.Firestore;
```

EventDoc (lib/types/event.ts) fields used by /events: id, name, status ("planned"|"active"|"completed"|"cancelled").
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add dependency, env names, and the CRITICAL proxy matcher bypass</name>
  <files>package.json, .env.example, proxy.ts</files>
  <action>
Three small edits. The proxy edit is the #1 thing you must not miss — without it the webhook never runs.

1. **package.json** — add `grammy@1.43.0` to `dependencies` (alphabetical position, between `firebase-admin` and `lucide-react`). Pin exact `"grammy": "1.43.0"` (no caret) per RESEARCH §Standard Stack. Then run `npm install` so `package-lock.json` updates and `node_modules/grammy` exists. grammy is pure-JS with light deps (Node 18+) — no native build expected.

2. **.env.example** — append a new section at the end with the three env var NAMES only (NEVER values, per CLAUDE.md secrets hygiene). Use this exact block:
```
# ============================================================
# Telegram stats bot (quick-kayinleong-018) — read-only
# ============================================================
# Bot token from @BotFather. server-only secret — NEVER commit or log.
TELEGRAM_BOT_TOKEN=
# Comma-separated Telegram chat/user ids permitted to use the bot.
TELEGRAM_ALLOWED_CHAT_IDS=
# Random string (e.g. `openssl rand -hex 32`) == setWebhook secret_token.
TELEGRAM_WEBHOOK_SECRET=
```

3. **proxy.ts (THE CRITICAL EDIT)** — line 99, the second matcher pattern. It currently MATCHES `/api/telegram/webhook`, so the auth middleware would 307-redirect Telegram's cookieless POST to `/login` and the handler would never execute. Add ONLY the token `|api/telegram` to the end of the existing negative-lookahead group. Change exactly:
   FROM: `"/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt).*)"`
   TO:   `"/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|api/telegram).*)"`
   Add a one-line comment above noting why (Telegram webhook is cookieless; must bypass auth — verified against secret-token + allowlist instead). Do NOT touch the first matcher entry (`"/api/auth/:path*"`) or anything else in the file.
  </action>
  <verify>
<automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit && node -e "const m=require('./package.json'); if(m.dependencies.grammy!=='1.43.0') throw new Error('grammy not pinned to 1.43.0'); const fs=require('fs'); const p=fs.readFileSync('proxy.ts','utf8'); if(!/robots\.txt\|api\/telegram\).\*/.test(p)) throw new Error('proxy matcher missing api/telegram bypass'); if((p.match(/api\/telegram/g)||[]).length!==1) throw new Error('api/telegram appears more than once — over-broad edit'); const e=fs.readFileSync('.env.example','utf8'); ['TELEGRAM_BOT_TOKEN','TELEGRAM_ALLOWED_CHAT_IDS','TELEGRAM_WEBHOOK_SECRET'].forEach(k=>{if(!e.includes(k)) throw new Error('missing env name '+k)}); console.log('Task 1 OK');"</automated>
  </verify>
  <done>grammy@1.43.0 installed and pinned; three TELEGRAM_* names present in .env.example with no values; proxy.ts second matcher excludes api/telegram exactly once and nothing else changed; tsc passes.</done>
</task>

<task type="auto">
  <name>Task 2: Telegram stats helper + command handlers</name>
  <files>lib/telegram/stats.server.ts, lib/telegram/commands.ts</files>
  <action>
Create the two `lib/telegram/*` modules. READ-ONLY: no Firestore writes, no new collection, no mutation anywhere.

**lib/telegram/stats.server.ts** — the one command (`/events`) without a session-free fetcher. Start with `import "server-only";`. Export `getActiveEventsStats(opts?: { limit?: number })`:
   - Query active events directly: `adminDb.collection("events").where("status","==","active").limit(opts?.limit ?? 10).get()`. Cap to ~10 active events to bound time/cost (we must return inside the 8s grammY timeout).
   - For each event doc, compute in parallel:
     - **open-missing count** via a count() aggregation: `adminDb.collection("missingItems").where("eventId","==",id).where("status","==","open").count().get()` then `.data().count`.
     - **checked-out** via `getOpenCheckoutsForEventServer(id)` (import from `@/lib/data/events.server`) — sum each `TransactionDoc.qty` for a total checked-out quantity (and/or use `.length` for line count; sum of qty is the more useful number).
   - Return a typed array, e.g. `Array<{ id: string; name: string; checkedOutQty: number; openMissing: number }>`. Define and export the row type.
   - Use `Promise.all` across events so the whole call stays well under 8s.

**lib/telegram/commands.ts** — start with `import "server-only";`. Import `Bot` from `grammy`, the three session-free fetchers (`getDashboardKpis` from `@/lib/data/aggregations.server`, `getInventoryPage` from `@/lib/data/inventory.server`, `getMissingPage` from `@/lib/data/missing.server`), and `getActiveEventsStats` from `./stats.server`. Export `registerCommands(bot: Bot): void` per RESEARCH §3–4:
   - Module-scope allowlist: `const allowed = new Set((process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "").split(",").map(s=>s.trim()).filter(Boolean));`
   - `esc()` HTML-escape helper: replace `&` `<` `>` (RESEARCH §4). Apply to every interpolated dynamic value (event names, item names, SKUs, reasons).
   - First middleware = allowlist gate: `bot.use(async (ctx, next) => { const id = ctx.chat?.id ?? ctx.from?.id; if (id == null || !allowed.has(String(id))) return; await next(); });` — env ids are strings, `ctx.chat.id` is a number, so compare via `String(id)`. Returning without replying = silent drop, HTTP 200, no info leak.
   - `bot.command("stats", ...)` → `getDashboardKpis()` → HTML reply: Active items / Items out / Low stock / Active events (RESEARCH §4 layout).
   - `bot.command("lowstock", ...)` → `getInventoryPage({ filters: { isLowStock: true }, limit: 20 })` → list each item: `esc(name)` (SKU) — available `availableQty` / threshold `lowStockThreshold`. Handle empty list ("No low-stock items.").
   - `bot.command("events", ...)` → `getActiveEventsStats({ limit: 10 })` → list each active event: `esc(name)` — checked-out `checkedOutQty`, open-missing `openMissing`. Handle empty ("No active events.").
   - `bot.command("missing", ...)` → `getMissingPage({ filters: { status: "open" }, limit: 20 })` → list each record: `esc(itemName)` @ `esc(eventName)` — qty `qty`, reason `esc(reason)`. Handle empty ("No open missing items.").
   - `bot.command(["start","help"], ...)` → short help: "Commands: /stats /lowstock /events /missing".
   - `bot.on("message", ...)` fallback for unknown messages → "Unknown command. Try /help".
   - All replies use `{ parse_mode: "HTML" }`.
   - SECRETS HYGIENE: never `console.log` the token, chat ids, or full message contents. If you add error logging inside a handler, log a static string + error object only.
  </action>
  <verify>
<automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit && node -e "const fs=require('fs'); const c=fs.readFileSync('lib/telegram/commands.ts','utf8'); ['registerCommands','getDashboardKpis','getInventoryPage','getMissingPage','getActiveEventsStats','String(id)','parse_mode'].forEach(s=>{if(!c.includes(s)) throw new Error('commands.ts missing '+s)}); const s=fs.readFileSync('lib/telegram/stats.server.ts','utf8'); ['getActiveEventsStats','getOpenCheckoutsForEventServer','missingItems','server-only'].forEach(t=>{if(!s.includes(t)) throw new Error('stats.server.ts missing '+t)}); if(/getEventsPage/.test(s+c)) throw new Error('getEventsPage must NOT be called (needs session)'); if(/\.set\(|\.update\(|\.delete\(|\.add\(|runTransaction/.test(s+c)) throw new Error('write detected — bot must be read-only'); console.log('Task 2 OK');"</automated>
  </verify>
  <done>Both modules compile under tsc. commands.ts exports registerCommands with allowlist gate (String(id) compare), four command handlers using the verified fetchers, start/help, unknown-message fallback, and HTML parse_mode. stats.server.ts exports getActiveEventsStats using count() for open-missing + getOpenCheckoutsForEventServer for checked-out, capped to ~10 events. getEventsPage is NOT called. No Firestore writes anywhere.</done>
</task>

<task type="auto">
  <name>Task 3: Webhook route handler + full build gate</name>
  <files>app/api/telegram/webhook/route.ts</files>
  <action>
Create the webhook entry point per RESEARCH §1–2,5–6. First verify the Next 16 route-handler signature against `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (Web `Request`/`Response`; `runtime`/`dynamic` segment config).

Structure:
   - `import "server-only";`
   - `import { Bot, webhookCallback } from "grammy";`
   - `import { registerCommands } from "@/lib/telegram/commands";`
   - Module-scope singleton: read `const token = process.env.TELEGRAM_BOT_TOKEN;` and `if (!token) throw new Error("TELEGRAM_BOT_TOKEN is unset");`. `const bot = new Bot(token);` then `registerCommands(bot);`
   - Await init once per cold start: `const ready: Promise<void> = bot.init();` (so `botInfo` is ready before any update; RESEARCH §2).
   - `const handle = webhookCallback(bot, "std/http", { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET, timeoutMilliseconds: 8000 });` — `std/http` is the App-Router Web-`Request` adapter (NOT `next-js`, which is Pages-router; RESEARCH §1). grammY constant-time-compares the `X-Telegram-Bot-Api-Secret-Token` header and auto-returns 401 on mismatch (RESEARCH §3). 8000ms keeps grammY under Netlify's 10s hard kill (RESEARCH §5).
   - `export const runtime = "nodejs";` (Admin SDK + grammy require Node; never Edge — RESEARCH §6) and `export const dynamic = "force-dynamic";` (never cache the webhook — RESEARCH §1).
   - `export async function POST(request: Request): Promise<Response> { await ready; return handle(request); }`
   - Do NOT add a GET handler or any setWebhook trigger — registration is a one-time manual curl (documented in SUMMARY). NEVER hardcode the token.

Then run the full gate: `npx tsc --noEmit`, `npm run lint`, and `npm run build`. The build must still generate ALL existing routes PLUS the new `/api/telegram/webhook`. Note: at build time the TELEGRAM_* env vars are absent — that is fine for `next build` (the module-scope `throw` only fires at request time on Netlify, not during static analysis, because the handler is `force-dynamic` and not invoked during build). If `next build` actually evaluates the module and the missing-token throw breaks the build, gate the throw to runtime only (e.g. construct the Bot lazily inside POST, or guard with `if (!token && process.env.NEXT_PHASE !== 'phase-production-build')`) — prefer the smallest change that keeps the build green without weakening the runtime guard.
  </action>
  <verify>
<automated>cd /Users/ka.yin.leong/Documents/cy-eventsystem && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tee /tmp/tg-build.log; node -e "const fs=require('fs'); const r=fs.readFileSync('app/api/telegram/webhook/route.ts','utf8'); ['webhookCallback','std/http','secretToken','timeoutMilliseconds','runtime','nodejs','force-dynamic','registerCommands'].forEach(s=>{if(!r.includes(s)) throw new Error('route.ts missing '+s)}); if(/setWebhook/.test(r)) throw new Error('no setWebhook trigger allowed in route'); const log=fs.readFileSync('/tmp/tg-build.log','utf8'); if(!/api\/telegram\/webhook/.test(log)) throw new Error('build did not emit /api/telegram/webhook route'); console.log('Task 3 OK');"</automated>
  </verify>
  <done>route.ts exists with Node runtime, force-dynamic, module-scope Bot singleton + awaited bot.init(), webhookCallback("std/http") with secretToken + 8000ms timeout, POST awaiting ready then delegating to handle. No GET/setWebhook trigger. tsc, lint, and build all pass and the build output lists /api/telegram/webhook.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Telegram servers → /api/telegram/webhook | Untrusted public HTTP POST crosses here. Path is public; the secret token + chat allowlist are the gate (not path obscurity). |
| Webhook handler → Firestore (adminDb) | Service-account read access. All reads; no writes by design. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-018-01 | Spoofing | POST /api/telegram/webhook (forged update) | mitigate | grammY `secretToken` constant-time-compares `X-Telegram-Bot-Api-Secret-Token`, auto-401 on mismatch (Task 3); registered via setWebhook with `secret_token`. |
| T-018-02 | Information disclosure | Command handlers replying to arbitrary chats | mitigate | Allowlist gate (`TELEGRAM_ALLOWED_CHAT_IDS`, `String(id)` compare) runs before every handler; unknown chat = silent drop, HTTP 200, no reply (Task 2). |
| T-018-03 | Information disclosure | Logs leaking token / chat ids / message bodies | mitigate | CLAUDE.md secrets hygiene — never log token, chat ids, or message contents; error logs are static string + error object only (Task 2/3). |
| T-018-04 | Tampering / Elevation | Bot mutating inventory/event data | mitigate | Read-only by construction: no `.set/.update/.delete/.add/runTransaction`, no new collection; enforced by Task 2 verify grep. |
| T-018-05 | Denial of service | Slow query → Netlify 10s kill → Telegram retry storm → duplicate replies | mitigate | `timeoutMilliseconds: 8000` < Netlify 10s (Task 3); `/events` capped to ~10 active events with parallel count() aggregations (Task 2). |
| T-018-06 | Spoofing / bypass | Auth proxy redirecting the cookieless webhook to /login | mitigate | proxy.ts matcher excludes `api/telegram` (Task 1); regression check confirms exactly one occurrence, nothing else changed. |
| T-018-07 | Elevation | setWebhook trigger reachable over the internet | accept | No GET/setWebhook handler shipped; registration is a one-time local curl (zero attack surface) — RESEARCH §7. |
</threat_model>

<verification>
Automated (all must pass — these are the completion gates):
- `npx tsc --noEmit` — type-clean.
- `npm run lint` — ESLint clean.
- `npm run build` — generates all existing routes PLUS `/api/telegram/webhook`.
- Read-only guard: no `.set/.update/.delete/.add/runTransaction` anywhere in `lib/telegram/*` or the route (Task 2 verify grep).
- proxy.ts: `api/telegram` appears exactly once, only in the second matcher's negative-lookahead.

Regression surface (self-audit before marking done):
- proxy.ts edit must exclude ONLY `api/telegram*` — confirm `/api/auth/*` and all existing app routes still match the proxy (the edit only adds one alternative to the existing lookahead; no existing token removed).
- No existing route/component/data-layer file touched beyond the proxy matcher line.

Manual (documented, NOT an automated gate — requires real secrets + live deploy):
- Set the three TELEGRAM_* env vars in Netlify; redeploy.
- Run the one-time `setWebhook` curl (see <success_criteria>).
- From an allowlisted chat, send `/stats`, `/lowstock`, `/events`, `/missing` and confirm sensible replies; send from a non-allowlisted chat and confirm no reply.
</verification>

<success_criteria>
- `grammy@1.43.0` pinned in package.json; three TELEGRAM_* names (no values) in .env.example.
- proxy.ts matcher bypasses `api/telegram` (exactly one occurrence, nothing else changed).
- `lib/telegram/stats.server.ts` and `lib/telegram/commands.ts` implement the four read-only commands + allowlist + HTML formatting; `getEventsPage` is never called.
- `app/api/telegram/webhook/route.ts` is a Node-runtime, force-dynamic POST handler using grammY `webhookCallback("std/http")` with secret token + 8000ms timeout.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass; build lists `/api/telegram/webhook`.
- No Firestore writes; no new collection; no UI/route changes beyond the proxy matcher line.

One-time webhook registration (document in SUMMARY; token pasted inline locally, NEVER committed):
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=https://cy-eventsystem.netlify.app/api/telegram/webhook" \
  --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  --data-urlencode "allowed_updates=[\"message\"]"
```
</success_criteria>

<output>
After completion, create `.planning/quick/quick-kayinleong-018/quick-kayinleong-018-SUMMARY.md`.
Include: files changed, the one-time setWebhook curl (with `<TELEGRAM_BOT_TOKEN>`/`<TELEGRAM_WEBHOOK_SECRET>` placeholders — never real values), the Netlify env-var step, and the manual live-bot verification checklist. Update CLAIM.md Verification section per CLAUDE.md before marking the claim done.
</output>
