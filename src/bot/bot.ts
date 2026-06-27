import { Telegraf } from "telegraf";
import { requireSecret } from "../config.js";
import { logger } from "../lib/logger.js";
import { START_MESSAGE } from "./messages.js";
import { registerHandlers } from "./handlers.js";

export function createBot(): Telegraf {
  const bot = new Telegraf(requireSecret("TELEGRAM_BOT_TOKEN"));

  bot.start((ctx) => ctx.reply(START_MESSAGE));
  registerHandlers(bot);

  bot.catch((error, ctx) => {
    logger.error({ error, update: ctx.update }, "Unhandled bot error");
  });

  return bot;
}
