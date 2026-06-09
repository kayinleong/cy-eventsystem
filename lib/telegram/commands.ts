import "server-only";
// lib/telegram/commands.ts
// quick-kayinleong-018 — read-only Telegram bot command handlers.
//
// Security layer 2 (allowlist) lives here; layer 1 (secret token) is handled
// by grammY's webhookCallback in the route. The allowlist gate runs as the
// first middleware so it precedes every command — unknown chats are silently
// dropped (no reply = HTTP 200 = no info leak, and Telegram won't retry).
//
// READ-ONLY by construction: every handler only reads via the session-free
// lib/data/*.server.ts fetchers + getActiveEventsStats. No Firestore writes,
// no new collection, no mutation. The session-gated paged events reader is
// intentionally NOT used (it requires a browser session the webhook lacks);
// /events instead reads via getActiveEventsStats.
//
// SECRETS HYGIENE (CLAUDE.md): never log the bot token, chat ids, or message
// contents. Error logs are a static string + error object only.

import type { Bot } from "grammy";
import { getDashboardKpis } from "@/lib/data/aggregations.server";
import { getInventoryPage } from "@/lib/data/inventory.server";
import { getMissingPage } from "@/lib/data/missing.server";
import { getActiveEventsStats } from "./stats.server";

// Allowlist of permitted Telegram chat/user ids. Env value is a comma-separated
// string; ctx.chat.id is a number, so we compare via String(id).
const allowed = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// HTML parse_mode escape — only &, <, > need escaping (far more forgiving than
// MarkdownV2). Applied to every interpolated dynamic value (names, SKUs, reasons).
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function registerCommands(bot: Bot): void {
  // Allowlist gate — runs before every command. Silent drop on unknown chat.
  bot.use(async (ctx, next) => {
    const id = ctx.chat?.id ?? ctx.from?.id;
    if (id == null || !allowed.has(String(id))) return; // drop → HTTP 200, no reply
    await next();
  });

  // /stats — inventory snapshot KPIs (TG-01).
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

  // /lowstock — repurchase candidates (TG-02).
  bot.command("lowstock", async (ctx) => {
    const { items } = await getInventoryPage({
      filters: { isLowStock: true },
      limit: 20,
    });
    if (items.length === 0) {
      await ctx.reply("No low-stock items.", { parse_mode: "HTML" });
      return;
    }
    const lines = items.map(
      (it) =>
        `${esc(it.name)} (${esc(it.sku)}) — available ${it.availableQty} / threshold ${it.lowStockThreshold}`,
    );
    await ctx.reply(["<b>Low stock</b>", ...lines].join("\n"), {
      parse_mode: "HTML",
    });
  });

  // /events — active events with per-event checked-out + open-missing (TG-03).
  bot.command("events", async (ctx) => {
    const events = await getActiveEventsStats({ limit: 10 });
    if (events.length === 0) {
      await ctx.reply("No active events.", { parse_mode: "HTML" });
      return;
    }
    const lines = events.map(
      (e) =>
        `${esc(e.name)} — checked-out ${e.checkedOutQty}, open-missing ${e.openMissing}`,
    );
    await ctx.reply(["<b>Active events</b>", ...lines].join("\n"), {
      parse_mode: "HTML",
    });
  });

  // /missing — open missing-item records (TG-04).
  bot.command("missing", async (ctx) => {
    const { missing } = await getMissingPage({
      filters: { status: "open" },
      limit: 20,
    });
    if (missing.length === 0) {
      await ctx.reply("No open missing items.", { parse_mode: "HTML" });
      return;
    }
    const lines = missing.map(
      (m) =>
        `${esc(m.itemName)} @ ${esc(m.eventName)} — qty ${m.qty}, reason ${esc(m.reason)}`,
    );
    await ctx.reply(["<b>Open missing items</b>", ...lines].join("\n"), {
      parse_mode: "HTML",
    });
  });

  // /start + /help — short usage.
  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply("Commands: /stats /lowstock /events /missing", {
      parse_mode: "HTML",
    });
  });

  // Unknown command / non-command text fallback.
  bot.on("message", async (ctx) => {
    await ctx.reply("Unknown command. Try /help", { parse_mode: "HTML" });
  });
}
