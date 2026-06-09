# quick-kayinleong-018 — Research: grammY Telegram webhook on Next.js 16 / Netlify

**Researched:** 2026-06-09
**Domain:** Telegram bot webhook (grammY) inside a Next.js 16.2.6 App Router Route Handler, Netlify serverless (Node runtime), read-only stats.
**Confidence:** HIGH (grammY current docs/source + local Next 16 docs verified; Netlify timeout MEDIUM — community-sourced).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Library:** grammY (`webhookCallback` adapter). One new dependency, approved.
- **Entry point:** Route Handler at `app/api/telegram/webhook/route.ts` (Node runtime), NOT a Server Action.
- **Auth:** chat allowlist via `TELEGRAM_ALLOWED_CHAT_IDS` (comma-separated) + Telegram webhook secret-token header. No new Firestore collection, no passphrase/linking.
- **Commands (read-only, all four):** `/stats` → `getDashboardKpis()`; `/lowstock` → `getInventoryPage({ filters: { isLowStock: true } })`; `/events` → `getEventsPage()` + per-event checkout/missing counts; `/missing` → `getMissingPage({ status: "open" })`.
- Stat logic reuses existing `lib/data/*.server.ts` functions via the already-initialized `adminDb`. `requireSession()`/`requireAdmin()` are NOT usable (no browser cookie).

### Claude's Discretion
- Message formatting (parse_mode, layout), command-not-found, `/start` + `/help`, secret-token verification, one-time `setWebhook` mechanism.

---

## Summary

Next 16 Route Handlers are Web-standard: `export async function POST(request: Request): Promise<Response>` (verified in `node_modules/next/dist/docs/.../15-route-handlers.md`). grammY's `webhookCallback(bot, "std/http", options)` returns a `(request: Request) => Promise<Response>` — a direct drop-in for the `POST` export. `nodejs` runtime is the **default** for route handlers, but we set `export const runtime = "nodejs"` explicitly because both `firebase-admin` and grammY require Node APIs and must never land on Edge.

The single biggest serverless gotcha is **bot init on cold start**: grammY needs `botInfo` (its own id/username) before processing updates. `webhookCallback` lazily calls `await bot.init()` on the first request per module instance, so it works without intervention — but to be safe and explicit, await `bot.init()` once at module scope behind a singleton promise.

Security is two layers: grammY's `secretToken` option (constant-time compares the `X-Telegram-Bot-Api-Secret-Token` header, auto-returns 401 on mismatch) plus an in-handler chat-allowlist gate before any command runs.

**Primary recommendation:** Module-scope `Bot` singleton + awaited `bot.init()`; `webhookCallback(bot, "std/http", { secretToken, timeoutMilliseconds: 8000 })`; HTML `parse_mode`; allowlist guard via `bot.use(...)`; register webhook once via guarded `GET` handler or curl.

---

## Standard Stack

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `grammy` | **1.43.0** (latest) | Telegram bot framework + `webhookCallback` | `[VERIFIED: npm view grammy version]` |

**Engines:** `node ^12.20.0 || >=14.13.1` `[VERIFIED: npm view grammy engines]` — fine on Netlify's Node 18/20.
**Deps (light):** `@grammyjs/types`, `abort-controller`, `debug`, `node-fetch@2` `[VERIFIED: npm view grammy dependencies]`. No heavy/native deps.

```bash
npm install grammy@1.43.0
```

---

## 1. grammY webhook in a Next 16 route handler

**Adapter:** `"std/http"` — the adapter for Web-standard `Request`/`Response` runtimes; it returns a `Response`. `[CITED: grammy.dev/guide/deployment-types]` (`std/http` listed alongside fetch-style runtimes; there is also a `next-js` adapter, but it targets Pages-router `NextApiRequest`/`res`, NOT App-router Web `Request` — use `std/http` here.) `webhookCallback` returns `(req: Request) => Promise<Response>`, so it is assigned directly to `POST`.

Next 16 route handlers receive a Web `Request` and return a Web `Response` `[VERIFIED: node_modules/next/dist/docs/.../15-route-handlers.md]`.

```typescript
// app/api/telegram/webhook/route.ts
import "server-only";
import { Bot, webhookCallback } from "grammy";
import { registerCommands } from "@/lib/telegram/commands"; // see §4

// --- module-scope singleton (survives across warm invocations) ---
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is unset");

const bot = new Bot(token);
registerCommands(bot); // bot.use(allowlist) + bot.command(...) — §3, §4

// Await init once per cold start so botInfo is ready before any update. §2
const ready: Promise<void> = bot.init();

const handle = webhookCallback(bot, "std/http", {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET, // §3
  timeoutMilliseconds: 8000,                        // §5 — under Netlify's 10s
});

export const runtime = "nodejs";       // §6 — Admin SDK + grammY are Node, never Edge
export const dynamic = "force-dynamic"; // never cache; every update is unique

export async function POST(request: Request): Promise<Response> {
  await ready;            // ensure bot.init() completed (§2)
  return handle(request); // grammY verifies secret + returns 200/401 (§3, §5)
}
```

`webhookCallback(bot, adapter, webhookOptions?)` — Overload 1 takes an options object `{ secretToken, timeoutMilliseconds, onTimeout }`. (Overloads 2/3 accept the same as positional args.) `[CITED: grammy.dev/ref/core/webhookcallback]`

---

## 2. Cold-start gotcha — `bot.init()`

In serverless, grammY must know its own `botInfo` (id/username) before dispatching updates. `webhookCallback` lazily runs this once per module instance: `if (!initialized) { await bot.init(); initialized = true; }` `[VERIFIED: github.com/grammyjs/grammY/blob/main/src/convenience/webhook.ts]`. So it works with zero extra code — but lazy init means a `getMe` call on the first request after each cold start, and any race if init throws mid-flight.

**Recommendation:** await `bot.init()` once at module scope (`const ready = bot.init()` then `await ready` in `POST`, as above). This makes initialization explicit and reuses the cached `botInfo` across warm invocations. The Vercel doc omits this and exports `webhookCallback(bot, "https")` directly `[CITED: grammy.dev/hosting/vercel]` — that relies on the lazy path; the explicit await is strictly safer. `[ASSUMED]` that awaiting at module scope vs. lazy init is materially better — both are correct; the explicit form just removes a per-cold-start `getMe` from the request critical path. (Alternative: pass `new Bot(token, { botInfo })` with a hardcoded `botInfo` object to skip the network call entirely.)

---

## 3. Webhook security (two layers)

**Layer 1 — secret token (grammY-handled).** Set a secret when registering (`setWebhook(url, { secret_token })`); Telegram echoes it on every update as header `X-Telegram-Bot-Api-Secret-Token`. Pass `secretToken` to `webhookCallback`; grammY compares it **constant-time** (XOR byte loop, timing-attack safe) and auto-returns **401** on mismatch — no manual header reading needed. `[VERIFIED: grammY webhook.ts source — compareSecretToken]`

**Layer 2 — chat allowlist (our code).** Reject updates whose chat/user id is not in `TELEGRAM_ALLOWED_CHAT_IDS`. Implement as middleware so it runs before any command:

```typescript
// lib/telegram/commands.ts
const allowed = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean),
);

export function registerCommands(bot: Bot) {
  // Allowlist gate — silently drop unknown chats (no reply = no info leak).
  bot.use(async (ctx, next) => {
    const id = ctx.chat?.id ?? ctx.from?.id;
    if (id == null || !allowed.has(String(id))) return; // drop, return 200
    await next();
  });
  // ... bot.command(...) handlers below (§4)
}
```

Note: env ids are strings; `ctx.chat.id` is a number → compare via `String(id)`. Returning without replying still yields HTTP 200, so Telegram won't retry.

---

## 4. Command routing + replies

Use HTML `parse_mode` — **safer than MarkdownV2** for dynamic data. MarkdownV2 requires escaping `_ * [ ] ( ) ~ \` > # + - = | { } . !` in every interpolated value; missing one throws a 400 from Telegram. HTML needs only `&`, `<`, `>` escaped and is far more forgiving for names/SKUs. `[CITED: core.telegram.org/bots/api#formatting-options]`

```typescript
// lib/telegram/commands.ts (continued)
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

bot.command("stats", async (ctx) => {
  const k = await getDashboardKpis();
  await ctx.reply(
    [
      "<b>Inventory snapshot</b>",
      `Active items: <b>${k.totalItems}</b>`,
      `Items out: <b>${k.itemsOut}</b>`,
      `Low stock: <b>${k.lowStockCount}</b>`,
      `Active events: <b>${k.activeEvents}</b>`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

// /lowstock, /events, /missing follow the same shape; esc() any dynamic name/SKU.
bot.command(["start", "help"], (ctx) =>
  ctx.reply("Commands: /stats /lowstock /events /missing", { parse_mode: "HTML" }),
);
// Unknown command / non-command text:
bot.on("message", (ctx) => ctx.reply("Unknown command. Try /help"));
```

Data layer functions (`getDashboardKpis`, `getInventoryPage`, `getEventsPage`, `getMissingPage`) take no session and read via `adminDb` — callable directly `[VERIFIED: AUDIT.md §2, §9]`.

---

## 5. Always return 200 fast (retries / duplicates)

Telegram **retries the webhook** if it doesn't get a timely 200, producing duplicate replies. grammY's `webhookCallback` resolves the `Response` for you and supports `timeoutMilliseconds` (**default 10,000ms** `[VERIFIED: webhook.ts WebhookOptions]`) with `onTimeout: "throw" | "return"`.

**Key risk:** grammY's default 10s timeout == Netlify's default 10s function limit (§6). If a query runs long, Netlify can kill the function before grammY responds → Telegram retries → duplicate replies. **Mitigation:** set `timeoutMilliseconds: 8000` so grammY returns before Netlify's hard kill. Our four queries are small aggregations and complete well under that. For genuinely heavy work the pattern is "return 200 immediately, do work after" — **not needed here**; await inline.

---

## 6. Netlify specifics

- A Next.js route handler on Netlify runs as a **Node serverless function automatically** via the official Next runtime (`@netlify/plugin-nextjs`, auto-detected — AUDIT §7 confirms no `netlify.toml`). `[CITED: docs.netlify.com Next.js runtime]`
- **Set `export const runtime = "nodejs"`** in the route. Node is the default for route handlers `[VERIFIED: Next 16 runtime.md]`, but stating it explicitly guarantees `firebase-admin` + grammY never get bundled to **Edge** (Edge lacks the Node APIs both require). `firebase-admin` must run on Node, never Edge.
- **Default function timeout: 10 seconds** `[CITED: answers.netlify.com — multiple "Task timed out after 10.01s"]` `[MEDIUM]`. Paid plans can raise it; do not rely on more than 10s. This is why §5 sets `timeoutMilliseconds: 8000`.
- **No `netlify.toml` change required** for basic operation. Optional: add `[functions] node_bundler = "esbuild"` only if bundling issues arise — not expected for grammY (pure JS, light deps).

---

## 7. Webhook registration (one-time)

Register the webhook URL + secret with Telegram **once**. Keep the token out of code (env only). Simplest reliable option: a one-off curl (run locally with the token pasted inline), e.g.

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=https://cy-eventsystem.netlify.app/api/telegram/webhook" \
  --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  --data-urlencode "allowed_updates=[\"message\"]"
```

`allowed_updates=["message"]` limits delivery to messages (no edited/channel noise). To inspect/clear: `getWebhookInfo`, `deleteWebhook`.

**Alternative (self-documenting):** a guarded `GET` on the same route that calls `bot.api.setWebhook(...)` only when a one-time admin secret query param matches an env value. Convenient but adds an internet-reachable trigger; if used, guard strictly and consider removing after setup. **Recommendation: curl** for v1 (zero attack surface, nothing to secure).

---

## 8. Env vars + dependency

| Env var | Purpose | Notes |
|---------|---------|-------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | server-only secret; never log |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Comma-separated chat/user ids | string compare, see §3 |
| `TELEGRAM_WEBHOOK_SECRET` | Random string == `setWebhook` secret_token | passed to `webhookCallback` |

Add all three to `.env.example` (names only) and to Netlify env settings. Dependency: `grammy@1.43.0`, Node 18+.

---

## 9. Pitfalls

- **Cold-start init:** don't assume `bot` "just knows" itself — await `bot.init()` (or pass `botInfo`). Lazy init works but adds `getMe` to the first request per cold start. (§2)
- **Edge vs Node:** `firebase-admin` and grammY break on Edge. Always `export const runtime = "nodejs"`. (§6)
- **Secret verification:** rely on grammY's `secretToken` option (constant-time, auto-401) — don't hand-roll header comparison (timing-attack risk). (§3)
- **Retry/duplicate:** anything slower than the function timeout → Telegram resends → duplicate replies. Keep `timeoutMilliseconds` (8000) under Netlify's 10s. (§5)
- **MarkdownV2 escaping:** unescaped `. - ( )` etc. in dynamic data → Telegram 400. Use HTML + `esc()`. (§4)
- **Allowlist type mismatch:** env ids are strings, `ctx.chat.id` is a number — compare via `String(id)`. (§3)
- **Webhook path exposure:** the path is public; the **secret token is the gate** (plus allowlist). Don't rely on path obscurity. Limit `allowed_updates` to `["message"]`. (§3, §7)
- **Wrong adapter:** `next-js` adapter is for Pages-router `NextApiRequest`/`res`, not App-router Web `Request` — use `std/http`. (§1)
- **Caching:** set `dynamic = "force-dynamic"`; never cache the webhook. (§1)

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Module-scope `await bot.init()` is meaningfully safer than grammY's lazy init | §2 | Low — both correct; explicit form only removes a per-cold-start `getMe` |
| A2 | Netlify default function timeout is 10s on this plan | §6, §5 | Medium — community-sourced; if higher, `timeoutMilliseconds: 8000` is still safe (just conservative) |

## Sources

**Primary (HIGH):**
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Web `Request`/`Response` handler signature.
- `node_modules/next/dist/docs/.../02-route-segment-config/runtime.md` — `runtime = 'nodejs'` default + edge opt-in.
- [grammY webhookCallback API ref](https://grammy.dev/ref/core/webhookcallback) — signature + options.
- [grammY webhook.ts source](https://github.com/grammyjs/grammY/blob/main/src/convenience/webhook.ts) — lazy `bot.init()`, `WebhookOptions`, constant-time secret compare, 10000ms default.
- `npm view grammy` — version 1.43.0, engines, deps.

**Secondary (MEDIUM):**
- [grammY deployment types](https://grammy.dev/guide/deployment-types) — `std/http` adapter list.
- [grammY on Vercel](https://grammy.dev/hosting/vercel) — serverless pattern (lazy-init form).
- [Telegram Bot API — formatting](https://core.telegram.org/bots/api#formatting-options) — HTML vs MarkdownV2 escaping.
- [Netlify Support — 10s function timeout](https://answers.netlify.com/t/timeout-10-seconds/83146) — default timeout.

**Metadata:** Research date 2026-06-09. Valid until ~2026-07-09 (grammY stable; re-verify version + Netlify timeout if revisited).
