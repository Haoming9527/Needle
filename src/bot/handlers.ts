import type { Context, Telegraf } from "telegraf";
import { runNeedleAgent } from "../agent/needle-agent.js";
import {
  confirmPurchaseIntent,
  createPurchaseIntent,
  formatCents,
  getLatestSearchResults,
  getPurchaseIntent,
  getRecentSearches,
  getRecentSimulatedOrders,
  getWalletSummary,
  voidSimulatedOrder
} from "../db/database.js";
import { env } from "../config.js";
import { logger } from "../lib/logger.js";
import { isSgdCurrency } from "../lib/currency.js";
import { createTopupCheckoutSession } from "../lib/stripe.js";
import { ABOUT_MESSAGE, HELP_MESSAGE, sendNeedleReport } from "./messages.js";
import { downloadTelegramPhoto } from "./telegram-files.js";
import { classifyTextIntent, type TextIntent } from "./intent-router.js";

const DEMO_QUERY = "Find a black magnetic silicone cable organizer for desk wires";

export function registerHandlers(bot: Telegraf<Context>): void {
  bot.help((ctx) => ctx.reply(HELP_MESSAGE));
  bot.command("about", (ctx) => ctx.reply(ABOUT_MESSAGE));
  bot.command("balance", async (ctx) => {
    const telegramId = getTelegramId(ctx);

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for wallet balance.");
      return;
    }

    await sendWalletSummary(ctx, telegramId);
  });

  bot.command("topup", async (ctx) => {
    const telegramId = getTelegramId(ctx);

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for top-up.");
      return;
    }

    const amount = parseCommandAmount(ctx);

    if (!amount || amount <= 0) {
      await ctx.reply("Usage: /topup 10\nThis creates a Stripe Checkout link for SGD 10.00.");
      return;
    }

    await sendTopupLink(ctx, telegramId, amount);
  });

  bot.action(/^topup:(\d+)$/, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const amount = Number(ctx.match[1]);

    logger.info(
      { telegramId, amountCents: amount, callbackData: getCallbackData(ctx) },
      "Top-up button clicked"
    );

    await ctx.answerCbQuery("Creating Stripe Checkout link...");

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for top-up.");
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      await ctx.reply("That top-up button has an invalid amount. Send /balance and try again.");
      return;
    }

    await sendTopupLink(ctx, telegramId, amount);
  });

  bot.action(/^buy:(\d+)$/, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const index = Number(ctx.match[1]);

    await ctx.answerCbQuery();

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for simulated purchase.");
      return;
    }

    await prepareSandboxPurchase(ctx, telegramId, index);
  });

  bot.action(/^view:(\d+)$/, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const index = Number(ctx.match[1]);

    await ctx.answerCbQuery();

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for that result.");
      return;
    }

    const result = getLatestSearchResults(telegramId)[index - 1];

    if (!result) {
      await ctx.reply("No recent result found. Search for a product again.");
      return;
    }

    await ctx.reply(
      [
        "Product info lead",
        "",
        result.title,
        `Source: ${result.marketplace ?? result.source ?? "Web"}`,
        "",
        "This page is useful for identifying the item, but Needle did not find a checkout price there.",
        "Choose a priced result, or use a manual amount:",
        `/buy ${index} 12.90`,
        "",
        result.url
      ].join("\n"),
      {
        link_preview_options: {
          is_disabled: true
        }
      }
    );
  });

  bot.action(/^confirm:(\d+)$/, async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const purchaseId = Number(ctx.match[1]);

    await ctx.answerCbQuery();

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for purchase confirmation.");
      return;
    }

    await confirmSandboxPurchase(ctx, telegramId, purchaseId);
  });

  bot.action("wallet:balance", async (ctx) => {
    const telegramId = getTelegramId(ctx);

    await ctx.answerCbQuery();

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for wallet balance.");
      return;
    }

    await sendWalletSummary(ctx, telegramId);
  });

  bot.action("orders:list", async (ctx) => {
    const telegramId = getTelegramId(ctx);

    await ctx.answerCbQuery();

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for orders.");
      return;
    }

    await sendOrdersList(ctx, telegramId);
  });

  bot.on("callback_query", async (ctx) => {
    const callbackData = getCallbackData(ctx);

    logger.warn({ callbackData }, "Unhandled Telegram callback query");

    await ctx.answerCbQuery("That button is stale. Send /balance and use the new buttons.", {
      show_alert: true
    });
    await ctx.reply("That button did not match the current bot actions. Send /balance and tap a fresh top-up button.");
  });

  bot.command("buy", async (ctx) => {
    const telegramId = getTelegramId(ctx);

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for simulated purchase.");
      return;
    }

    const args = getCommandArgs(ctx);
    const index = Number(args[0]);
    const manualAmount = args[1] ? parseAmountToCents(args[1]) : undefined;

    if (!Number.isInteger(index) || index < 1 || index > 3) {
      await ctx.reply("Usage: /buy 1\nIf the result has no SGD price, use /buy 1 12.90.");
      return;
    }

    await prepareSandboxPurchase(ctx, telegramId, index, manualAmount);
  });

  bot.command("confirm", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const purchaseId = Number(getCommandArgs(ctx)[0]);

    if (!telegramId || !Number.isInteger(purchaseId)) {
      await ctx.reply("Usage: /confirm <purchase_id>");
      return;
    }

    await confirmSandboxPurchase(ctx, telegramId, purchaseId);
  });

  bot.command("orders", async (ctx) => {
    const telegramId = getTelegramId(ctx);

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for orders.");
      return;
    }

    await sendOrdersList(ctx, telegramId);
  });

  bot.command("void", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const orderId = Number(getCommandArgs(ctx)[0]);

    if (!telegramId || !Number.isInteger(orderId)) {
      await ctx.reply("Usage: /void <order_id>");
      return;
    }

    await voidSandboxOrder(ctx, telegramId, orderId);
  });

  bot.command("demo", async (ctx) => {
    await ctx.reply("Running the demo search...");

    const report = await runNeedleAgent({
      telegramId: ctx.from?.id ?? 0,
      username: ctx.from?.username,
      text: DEMO_QUERY
    });

    await sendNeedleReport(ctx, report);
  });

  bot.command("history", async (ctx) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply("I could not read your Telegram ID for history.");
      return;
    }

    const searches = getRecentSearches(telegramId, 5);

    if (searches.length === 0) {
      await ctx.reply("No searches yet. Send a product photo, link, or description to start.");
      return;
    }

    const lines = searches.map((search, index) => {
      const confidence =
        typeof search.confidence === "number" ? `${Math.round(search.confidence * 100)}%` : "n/a";
      return `${index + 1}. ${search.product_name ?? "Unknown product"} (${confidence}) - ${search.created_at}`;
    });

    await ctx.reply(["Recent Needle searches:", "", ...lines].join("\n"));
  });

  bot.on("photo", async (ctx) => {
    await ctx.reply("Got the image. Looking for the needle...");

    try {
      const photo = await downloadTelegramPhoto(ctx);
      const caption = (ctx.message as { caption?: string }).caption;

      logger.debug({ size: photo.size, mimeType: photo.mimeType }, "Downloaded Telegram photo");

      const report = await runNeedleAgent({
        telegramId: ctx.from?.id ?? 0,
        username: ctx.from?.username,
        text: caption,
        imageBase64: photo.base64,
        imageMimeType: photo.mimeType,
        imageFileId: photo.fileId
      });

      await sendNeedleReport(ctx, report);
    } catch (error) {
      logger.error({ error }, "Photo handler failed");
      await ctx.reply(
        "I had trouble reading that image. Try sending a clearer photo or add a short description."
      );
    }
  });

  bot.on("text", async (ctx) => {
    const text = (ctx.message as { text?: string }).text?.trim();

    if (!text || text.startsWith("/")) {
      return;
    }

    const telegramId = getTelegramId(ctx);

    if (telegramId && (await handleNaturalCommandIntent(ctx, telegramId, text))) {
      return;
    }

    await ctx.reply("Looking for the needle...");

    try {
      const report = await runNeedleAgent({
        telegramId: telegramId ?? 0,
        username: ctx.from?.username,
        text
      });

      await sendNeedleReport(ctx, report);
    } catch (error) {
      logger.error({ error }, "Text handler failed");
      await ctx.reply(
        "I hit a problem while searching. Try a shorter description or send a clearer product photo."
      );
    }
  });

  bot.on("message", async (ctx) => {
    await ctx.reply(
      "I can currently read photos, screenshots, product links, and text descriptions. Voice notes are coming soon."
    );
  });
}

async function handleNaturalCommandIntent(
  ctx: Context,
  telegramId: number,
  text: string
): Promise<boolean> {
  try {
    const intent = await classifyTextIntent(text);

    if (await handleClassifiedTextIntent(ctx, telegramId, intent)) {
      return true;
    }
  } catch (error) {
    logger.warn({ error, telegramId, text }, "LLM text intent routing failed");
  }

  return false;
}

async function handleClassifiedTextIntent(
  ctx: Context,
  telegramId: number,
  intent: TextIntent
): Promise<boolean> {
  if (intent.confidence < 0.45) {
    return false;
  }

  switch (intent.intent) {
    case "wallet_balance":
      await sendWalletSummary(ctx, telegramId);
      return true;
    case "wallet_topup": {
      if (!intent.amountSgd) {
        await ctx.reply("How much do you want to top up? Try `top up 10` for SGD 10.00.");
        return true;
      }

      await sendTopupLink(ctx, telegramId, Math.round(intent.amountSgd * 100));
      return true;
    }
    case "orders":
      await sendOrdersList(ctx, telegramId);
      return true;
    case "confirm_purchase":
      if (!intent.purchaseId) {
        await ctx.reply("Which purchase should I confirm? Use `confirm <purchase_id>`.");
        return true;
      }

      await confirmSandboxPurchase(ctx, telegramId, intent.purchaseId);
      return true;
    case "void_order":
      if (!intent.orderId) {
        await ctx.reply("Which simulated order should I void? Use `void <order_id>`.");
        return true;
      }

      await voidSandboxOrder(ctx, telegramId, intent.orderId);
      return true;
    case "help":
      await ctx.reply(HELP_MESSAGE);
      return true;
    case "product_search":
      return false;
  }
}

async function sendWalletSummary(ctx: Context, telegramId: number): Promise<void> {
  const wallet = getWalletSummary(telegramId);
  const lines = [
    "Needle wallet",
    "",
    `Available: ${formatCents(wallet.availableCents, wallet.currency)}`,
    "",
    "Top-up history:"
  ];

  if (wallet.recentEntries.length === 0) {
    lines.push("- No top-ups yet.");
  } else {
    wallet.recentEntries.forEach((entry) => {
      lines.push(`- ${formatLedgerEntry(entry, wallet.currency)}`);
    });
  }

  await ctx.reply(lines.join("\n"), {
    reply_markup: {
      inline_keyboard: await topupKeyboard(telegramId)
    }
  });
}

async function sendOrdersList(ctx: Context, telegramId: number): Promise<void> {
  const orders = getRecentSimulatedOrders(telegramId, 5);

  if (orders.length === 0) {
    await ctx.reply("No simulated orders yet. Search, tap Buy, then confirm the purchase.");
    return;
  }

  const lines = ["Recent simulated orders:", ""];
  orders.forEach((order) => {
    lines.push(
      `${order.id}. ${order.status.toUpperCase()} ${formatCents(order.amount_cents, order.currency)} - ${order.title}`,
      `   Receipt: ${order.receipt_code}`
    );
  });

  await ctx.reply(lines.join("\n"));
}

async function prepareSandboxPurchase(
  ctx: Context,
  telegramId: number,
  index: number,
  manualAmount?: number
): Promise<void> {
  const results = getLatestSearchResults(telegramId);
  const result = results[index - 1];

  if (!result) {
    await ctx.reply("No recent result found. Search for a product first, then choose a buy button.");
    return;
  }

  const demoPrice = getDemoPriceCents(result.currency, result.price_value);
  const amountCents = manualAmount ?? demoPrice.amountCents;

  if (!amountCents || amountCents <= 0) {
    await ctx.reply(
      [
        "This result does not have a reliable SGD price.",
        `Result: ${result.title}`,
        "",
        "Use the command version with a manual price:",
        `/buy ${index} 12.90`
      ].join("\n")
    );
    return;
  }

  const purchase = createPurchaseIntent({
    telegramId,
    resultId: result.id,
    amountCents,
    currency: env.WALLET_CURRENCY,
    expiresAtMs: Date.now() + 15 * 60 * 1000
  });

  await ctx.reply(
    [
      "Shopping agent prepared a simulated purchase",
      "",
      `Purchase ID: ${purchase.id}`,
      `Item: ${purchase.title}`,
      `Amount: ${formatCents(purchase.amount_cents, purchase.currency)}`,
      demoPrice.note,
      `Marketplace lead: ${purchase.marketplace ?? "unknown"}`,
      `Risk: ${purchase.risk ?? "unknown"}`,
      "",
      "This will not place a real marketplace order. It only spends your Needle wallet balance."
    ].join("\n"),
    {
      link_preview_options: {
        is_disabled: true
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Confirm simulated purchase (${formatCents(purchase.amount_cents, purchase.currency)})`,
              callback_data: `confirm:${purchase.id}`
            }
          ],
          [
            {
              text: "Check balance",
              callback_data: "wallet:balance"
            }
          ]
        ]
      }
    }
  );
}

async function confirmSandboxPurchase(
  ctx: Context,
  telegramId: number,
  purchaseId: number
): Promise<void> {
  try {
    const { order, availableCents } = confirmPurchaseIntent({
      telegramId,
      purchaseIntentId: purchaseId,
      nowMs: Date.now()
    });

    await ctx.reply(
      [
        "SIMULATED_ORDER created",
        "",
        `Receipt: ${order.receipt_code}`,
        `Order ID: ${order.id}`,
        `Item: ${order.title}`,
        `Debited: ${formatCents(order.amount_cents, order.currency)}`,
        `Remaining wallet: ${formatCents(availableCents, order.currency)}`,
        "",
        "No real item was purchased. This is a simulated receipt only.",
        order.url
      ].join("\n"),
      {
        link_preview_options: {
          is_disabled: true
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "View simulated orders",
                callback_data: "orders:list"
              },
              {
                text: "Check balance",
                callback_data: "wallet:balance"
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    logger.warn({ error }, "Confirm simulated purchase failed");
    const message = error instanceof Error ? error.message : "Could not confirm simulated purchase.";
    const topupButtons = message.includes("Insufficient wallet balance")
      ? await insufficientFundsKeyboard(telegramId, purchaseId)
      : [
          [
            {
              text: "Check balance",
              callback_data: "wallet:balance"
            }
          ]
        ];

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: topupButtons
      }
    });
  }
}

async function voidSandboxOrder(ctx: Context, telegramId: number, orderId: number): Promise<void> {
  try {
    const { order, availableCents } = voidSimulatedOrder({ telegramId, orderId });

    await ctx.reply(
      [
        "Simulated order voided",
        "",
        `Order ID: ${order.id}`,
        `Restored: ${formatCents(order.amount_cents, order.currency)}`,
        `Available wallet: ${formatCents(availableCents, order.currency)}`,
        "",
        "This only reverses the simulated Needle order."
      ].join("\n")
    );
  } catch (error) {
    logger.warn({ error }, "Void simulated order failed");
    await ctx.reply(error instanceof Error ? error.message : "Could not void simulated order.");
  }
}

async function sendTopupLink(ctx: Context, telegramId: number, amountCents: number): Promise<void> {
  try {
    const session = await createTopupCheckoutSession({
      telegramId,
      amountCents,
      currency: env.WALLET_CURRENCY
    });

    if (!session.url) {
      throw new Error(`Stripe Checkout Session ${session.id} did not include a hosted URL.`);
    }

    logger.info(
      { telegramId, amountCents, checkoutSessionId: session.id },
      "Stripe top-up Checkout Session created"
    );

    await ctx.reply(
      [
        "Stripe top-up",
        "",
        `Amount: ${formatCents(amountCents, env.WALLET_CURRENCY)}`,
        "Use Stripe test card: 4242 4242 4242 4242.",
        "",
        session.url
      ].join("\n"),
      {
        link_preview_options: {
          is_disabled: true
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Open Stripe Checkout",
                url: session.url
              }
            ],
            [
              {
                text: "Check balance after payment",
                callback_data: "wallet:balance"
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    logger.error({ error }, "Top-up link creation failed");
    await ctx.reply(
      "I could not create a Stripe top-up link. Check STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and APP_BASE_URL in .env."
    );
  }
}

async function insufficientFundsKeyboard(telegramId: number, purchaseId: number) {
  try {
    const purchase = getPurchaseIntent(purchaseId, telegramId);
    const exactAmount = Math.max(100, purchase.amount_cents);
    const exactTopup = await createTopupButton(telegramId, exactAmount, `Top up ${formatCents(exactAmount, purchase.currency)}`);
    const tenDollarTopup = await createTopupButton(telegramId, 1000, "Top up SGD 10");

    return [
      [
        exactTopup
      ],
      [
        tenDollarTopup,
        {
          text: "Check balance",
          callback_data: "wallet:balance"
        }
      ]
    ];
  } catch (error) {
    logger.error({ error, telegramId, purchaseId }, "Could not create insufficient-funds top-up URLs");
    return topupKeyboard(telegramId);
  }
}

async function topupKeyboard(telegramId: number) {
  try {
    const [sgd10, sgd50, sgd100] = await Promise.all([
      createTopupButton(telegramId, 1000, "Top up SGD 10"),
      createTopupButton(telegramId, 5000, "Top up SGD 50"),
      createTopupButton(telegramId, 10000, "Top up SGD 100")
    ]);

    return [[sgd10, sgd50], [sgd100]];
  } catch (error) {
    logger.error({ error, telegramId }, "Could not create direct Stripe top-up URLs");

    return [
      [
        {
          text: "Type /topup 10",
          callback_data: "topup:1000"
        },
        {
          text: "Type /topup 50",
          callback_data: "topup:5000"
        }
      ],
      [
        {
          text: "Type /topup 100",
          callback_data: "topup:10000"
        }
      ]
    ];
  }
}

async function createTopupButton(telegramId: number, amountCents: number, text: string) {
  const session = await createTopupCheckoutSession({
    telegramId,
    amountCents,
    currency: env.WALLET_CURRENCY
  });

  if (!session.url) {
    throw new Error(`Stripe Checkout Session ${session.id} did not include a hosted URL.`);
  }

  logger.info(
    { telegramId, amountCents, checkoutSessionId: session.id },
    "Stripe top-up button Checkout Session created"
  );

  return {
    text,
    url: session.url
  };
}

function getTelegramId(ctx: Context): number | undefined {
  return ctx.from?.id;
}

function getCallbackData(ctx: Context): string | undefined {
  const callbackQuery = ctx.callbackQuery;

  if (callbackQuery && "data" in callbackQuery) {
    return callbackQuery.data;
  }

  return undefined;
}

function getCommandArgs(ctx: Context): string[] {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  return text.trim().split(/\s+/).slice(1);
}

function parseCommandAmount(ctx: Context): number | undefined {
  return parseAmountToCents(getCommandArgs(ctx)[0]);
}

function parseAmountToCents(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/^S\$|^SGD/i, "").trim();
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  return Math.round(amount * 100);
}

function formatLedgerEntry(
  entry: { amount_cents: number; type: string; created_at: string },
  currency: string
): string {
  const amount = formatCents(Math.abs(entry.amount_cents), currency);
  const timestamp = formatWalletTimestamp(entry.created_at);

  if (entry.type === "credit") {
    return `Top up ${amount} - ${timestamp}`;
  }

  if (entry.type === "debit") {
    return `Simulated purchase ${amount} - ${timestamp}`;
  }

  if (entry.type === "void_credit") {
    return `Voided order refund ${amount} - ${timestamp}`;
  }

  return `${humanizeLedgerType(entry.type)} ${amount} - ${timestamp}`;
}

function formatWalletTimestamp(value: string): string {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore"
  }).format(date);
}

function humanizeLedgerType(type: string): string {
  return type
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function getDemoPriceCents(
  currency?: string | null,
  priceValue?: number | null
): { amountCents?: number; note: string } {
  if (!priceValue || !Number.isFinite(priceValue)) {
    return {
      note: "Price source: no reliable listing price detected."
    };
  }

  if (isSgdCurrency(currency ?? undefined)) {
    return {
      amountCents: Math.round(priceValue * 100),
      note: "Price source: detected SGD listing price."
    };
  }

  return {
    amountCents: Math.round(priceValue * 100),
    note: `Price source: detected ${currency ?? "foreign"} ${priceValue.toFixed(2)}; using the same numeric amount as SGD for this demo.`
  };
}
