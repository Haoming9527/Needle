import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../config.js";
import { parseJsonWithSchema } from "../lib/json.js";
import { logger } from "../lib/logger.js";
import { getOpenAI } from "../lib/openai.js";
import { withTimeout } from "../lib/timeout.js";

const TextIntentSchema = z.object({
  intent: z.enum([
    "wallet_balance",
    "wallet_topup",
    "orders",
    "confirm_purchase",
    "void_order",
    "help",
    "product_search"
  ]),
  amountSgd: z.number().positive().nullable(),
  purchaseId: z.number().int().positive().nullable(),
  orderId: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

export type TextIntent = z.infer<typeof TextIntentSchema>;

const INTENT_ROUTER_SYSTEM_PROMPT = `
You route Telegram messages for Needle, an AI shopping agent with a wallet and simulated purchases.

Return exactly one intent:
- wallet_balance: user asks how much wallet money, balance, remaining funds, available credit, "how much now?", "how much left?", or similar. Treat vague money/balance questions as Needle wallet questions unless a specific non-Needle bank/account is named.
- wallet_topup: user wants to add/top up/recharge wallet funds. Extract amountSgd if present.
- orders: user wants recent Needle simulated orders or receipts.
- confirm_purchase: user approves/confirms a pending simulated purchase. Extract purchaseId when present.
- void_order: user wants to cancel/void/refund a simulated order. Extract orderId when present.
- help: user asks what Needle can do or asks for commands.
- product_search: user is describing, linking, pricing, comparing, or looking for a real product/listing.

Important distinctions:
- "how much now?", "how much do I have?", "my balance?", "wallet?" => wallet_balance.
- "how much is iphone 15?", "price of lays chips", "find this bag" => product_search.
- If no product is named and the message is mostly about money available to the user, choose wallet_balance.
- Do not invent IDs or amounts; use null when absent.
`.trim();

export async function classifyTextIntent(text: string): Promise<TextIntent> {
  const response = await withTimeout(
    getOpenAI().responses.create({
      model: env.OPENAI_MODEL,
      stream: false,
      text: {
        format: zodTextFormat(TextIntentSchema, "needle_text_intent")
      },
      input: [
        {
          role: "system",
          content: INTENT_ROUTER_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Message: ${text}`
        }
      ]
    }),
    6_000,
    "OpenAI text intent routing"
  );

  const intent = parseJsonWithSchema(response.output_text, TextIntentSchema);
  logger.debug({ text, intent }, "Text intent classified");
  return intent;
}
