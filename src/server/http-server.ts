import express, { type Request, type Response } from "express";
import type { Server } from "node:http";
import Stripe from "stripe";
import { env } from "../config.js";
import { formatCents, recordStripeTopup } from "../db/database.js";
import { logger } from "../lib/logger.js";
import { constructStripeWebhookEvent, getStripe } from "../lib/stripe.js";

export function startHttpServer(): Server {
  const app = express();

  app.post(
    "/stripe/webhook",
    express.raw({ type: "application/json" }),
    (request: Request, response: Response) => {
      try {
        const event = constructStripeWebhookEvent(
          request.body as Buffer,
          request.headers["stripe-signature"]
        );

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          handleCheckoutSessionCompleted(session);
        }

        response.json({ received: true });
      } catch (error) {
        logger.warn({ error }, "Stripe webhook rejected");
        response.status(400).send("Webhook error");
      }
    }
  );

  app.get("/stripe/success", async (request: Request, response: Response) => {
    const sessionId = typeof request.query.session_id === "string" ? request.query.session_id : undefined;
    let amountText: string | undefined;
    let paymentStatus: string | undefined;

    if (sessionId) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);

        if (session.amount_total && session.currency) {
          amountText = formatCents(session.amount_total, session.currency);
        }

        paymentStatus = session.payment_status;
      } catch (error) {
        logger.warn({ error, sessionId }, "Could not retrieve Stripe success Checkout Session");
      }
    }

    response.type("html").send(
      renderStripeResultPage({
        variant: "success",
        title: "Top-up successful",
        message:
          "Stripe accepted the test payment. Needle credits your wallet from the verified webhook, then your Telegram balance will update.",
        amountText,
        paymentStatus,
        sessionId
      })
    );
  });

  app.get("/stripe/cancel", (_request: Request, response: Response) => {
    response.type("html").send(
      renderStripeResultPage({
        variant: "cancel",
        title: "Top-up cancelled",
        message: "No wallet balance was changed. You can return to Telegram and start another top-up."
      })
    );
  });

  app.get("/health", (_request: Request, response: Response) => {
    response.json({ ok: true, service: "needle" });
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Needle HTTP server is listening");
  });

  return server;
}

function renderStripeResultPage(input: {
  variant: "success" | "cancel";
  title: string;
  message: string;
  amountText?: string;
  paymentStatus?: string;
  sessionId?: string;
}): string {
  const isSuccess = input.variant === "success";
  const statusLabel = isSuccess ? "Payment complete" : "Payment cancelled";
  const sessionReference = input.sessionId ? `Session ${input.sessionId.slice(-10)}` : undefined;
  const amountRow = input.amountText
    ? `<div class="row"><span>Top-up amount</span><strong>${escapeHtml(input.amountText)}</strong></div>`
    : "";
  const paymentRow = input.paymentStatus
    ? `<div class="row"><span>Stripe status</span><strong>${escapeHtml(input.paymentStatus)}</strong></div>`
    : "";
  const referenceRow = sessionReference
    ? `<div class="row"><span>Reference</span><strong>${escapeHtml(sessionReference)}</strong></div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)} | Needle</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17201b;
        --muted: #5d6a62;
        --line: #dbe3dd;
        --surface: #ffffff;
        --page: #f6f8f5;
        --good: #177245;
        --good-bg: #e7f6ee;
        --warn: #8a4f08;
        --warn-bg: #fff3dc;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px 18px;
        background:
          radial-gradient(circle at 20% 0%, rgba(23, 114, 69, 0.10), transparent 28rem),
          var(--page);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        width: min(100%, 560px);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 32px;
        box-shadow: 0 18px 55px rgba(23, 32, 27, 0.10);
      }

      .badge {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        margin-bottom: 22px;
        background: ${isSuccess ? "var(--good-bg)" : "var(--warn-bg)"};
        color: ${isSuccess ? "var(--good)" : "var(--warn)"};
        font-weight: 800;
        letter-spacing: 0;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: ${isSuccess ? "var(--good)" : "var(--warn)"};
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.1;
        letter-spacing: 0;
      }

      p {
        margin: 14px 0 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.6;
      }

      .details {
        margin-top: 24px;
        border: 1px solid var(--line);
        border-radius: 8px;
        overflow: hidden;
      }

      .row {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 14px 16px;
        border-top: 1px solid var(--line);
      }

      .row:first-child {
        border-top: 0;
      }

      .row span {
        color: var(--muted);
      }

      .row strong {
        text-align: right;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 26px;
      }

      a,
      button {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        padding: 0 16px;
        font: inherit;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }

      a {
        background: var(--ink);
        color: #ffffff;
      }

      button {
        border: 1px solid var(--line);
        background: #ffffff;
        color: var(--ink);
      }

      .note {
        margin-top: 18px;
        font-size: 13px;
      }

      code {
        padding: 2px 6px;
        border-radius: 6px;
        background: #edf1ee;
        color: var(--ink);
      }

      @media (max-width: 520px) {
        main {
          padding: 24px;
        }

        h1 {
          font-size: 26px;
        }

        .row {
          display: grid;
          gap: 6px;
        }

        .row strong {
          text-align: left;
        }

        a,
        button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="badge">${isSuccess ? "OK" : "!"}</div>
      <p class="eyebrow">${statusLabel}</p>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      <section class="details" aria-label="Payment details">
        ${amountRow}
        ${paymentRow}
        ${referenceRow}
        <div class="row"><span>Environment</span><strong>Stripe test mode</strong></div>
      </section>
      <div class="actions">
        <a href="https://t.me/NeedleSearchBot">Return to Telegram</a>
        <button type="button" onclick="window.close()">Close page</button>
      </div>
      <p class="note">In Telegram, send <code>/balance</code> or type <code>how much i have?</code> after the webhook lands.</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): void {
  if (session.metadata?.purpose !== "needle_wallet_topup") {
    logger.info({ sessionId: session.id }, "Ignoring non-Needle Checkout Session");
    return;
  }

  const telegramId = Number(session.metadata.telegram_id);
  const amountCents = session.amount_total;
  const currency = session.currency;

  if (!Number.isInteger(telegramId) || telegramId <= 0 || !amountCents || !currency) {
    throw new Error(`Invalid top-up Checkout Session metadata for ${session.id}`);
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  const result = recordStripeTopup({
    telegramId,
    checkoutSessionId: session.id,
    paymentIntentId,
    amountCents,
    currency
  });

  logger.info(
    {
      telegramId,
      sessionId: session.id,
      credited: result.credited,
      amount: formatCents(amountCents, currency),
      available: formatCents(result.availableCents, currency)
    },
    "Stripe top-up processed"
  );
}
