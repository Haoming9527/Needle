import { createBot } from "./bot/bot.js";
import { initDb } from "./db/database.js";
import { logger } from "./lib/logger.js";
import { startHttpServer } from "./server/http-server.js";

async function main() {
  initDb();
  const httpServer = startHttpServer();

  const bot = createBot();
  await bot.launch(() => {
    logger.info(
      { username: bot.botInfo?.username },
      "Needle connected to Telegram and is starting long polling"
    );
  });

  const stop = (signal: "SIGINT" | "SIGTERM") => {
    logger.info({ signal }, "Stopping Needle bot");
    bot.stop(signal);
    httpServer.close();
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
}

main().catch((error) => {
  logger.error({ error }, "Needle failed to start");
  process.exitCode = 1;
});
