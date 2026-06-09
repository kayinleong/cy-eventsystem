import "server-only";
// app/api/telegram/webhook/route.ts
// quick-kayinleong-018 — read-only Telegram bot webhook entry point.
//
// grammY's webhookCallback(bot, "std/http", ...) returns a Web
// (request: Request) => Promise<Response> — the App-Router adapter (NOT
// "next-js", which targets the Pages router). It constant-time-compares the
// X-Telegram-Bot-Api-Secret-Token header against secretToken and auto-returns
// 401 on mismatch before any command runs. timeoutMilliseconds: 8000 keeps
// grammY's response under Netlify's ~10s function kill so Telegram doesn't
// retry and produce duplicate replies.
//
// Bot + handler are built lazily inside POST behind a module-scope singleton.
// This keeps the missing-token guard a strict RUNTIME check (it throws on the
// first request when TELEGRAM_BOT_TOKEN is unset) while letting `next build`
// import the module without the env var present (the build collects route
// metadata by importing this file; force-dynamic means it is never invoked or
// prerendered at build time).
//
// NEVER hardcode or log the bot token / secret. Webhook registration is a
// one-time manual curl against Telegram's API (documented in the SUMMARY);
// no GET handler or registration trigger is shipped in this route.

import { Bot, webhookCallback } from "grammy";
import { registerCommands } from "@/lib/telegram/commands";

export const runtime = "nodejs"; // Admin SDK + grammY require Node; never Edge.
export const dynamic = "force-dynamic"; // never cache the webhook.

type Handler = (request: Request) => Promise<Response>;

let cached: { ready: Promise<void>; handle: Handler } | null = null;

function getHandler(): { ready: Promise<void>; handle: Handler } {
  if (cached) return cached;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is unset");

  const bot = new Bot(token);
  registerCommands(bot);

  // Await init once per cold start so botInfo is ready before any update.
  const ready: Promise<void> = bot.init();

  const handle = webhookCallback(bot, "std/http", {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    timeoutMilliseconds: 8000,
  });

  cached = { ready, handle };
  return cached;
}

export async function POST(request: Request): Promise<Response> {
  const { ready, handle } = getHandler();
  await ready; // ensure bot.init() completed before dispatching the update
  return handle(request); // grammY verifies the secret token + returns 200/401
}
