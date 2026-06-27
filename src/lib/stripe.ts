import Stripe from "stripe";
import { env, requireSecret } from "../config.js";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(requireSecret("STRIPE_SECRET_KEY"));
  }

  return client;
}

export async function createTopupCheckoutSession(input: {
  telegramId: number;
  amountCents: number;
  currency?: string;
}): Promise<Stripe.Checkout.Session> {
  const currency = input.currency ?? env.WALLET_CURRENCY;

  return getStripe().checkout.sessions.create({
    mode: "payment",
    submit_type: "pay",
    success_url: `${env.APP_BASE_URL}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_BASE_URL}/stripe/cancel`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: input.amountCents,
          product_data: {
            name: "Needle wallet top-up",
            description: "Wallet balance for simulated Needle purchases"
          }
        }
      }
    ],
    metadata: {
      telegram_id: String(input.telegramId),
      purpose: "needle_wallet_topup"
    },
    payment_intent_data: {
      metadata: {
        telegram_id: String(input.telegramId),
        purpose: "needle_wallet_topup"
      }
    }
  });
}

export function constructStripeWebhookEvent(
  payload: Buffer,
  signature: string | string[] | undefined
): Stripe.Event {
  if (!signature || Array.isArray(signature)) {
    throw new Error("Missing Stripe signature header.");
  }

  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    requireSecret("STRIPE_WEBHOOK_SECRET")
  );
}
