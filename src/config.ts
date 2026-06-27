import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  ENABLE_MODEL_RERANK: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  DATABASE_PATH: z.string().default("./needle.db"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  WALLET_CURRENCY: z.string().toLowerCase().default("sgd"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000)
});

export const env = EnvSchema.parse(process.env);

export type SecretEnvName =
  | "TELEGRAM_BOT_TOKEN"
  | "OPENAI_API_KEY"
  | "EXA_API_KEY"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_WEBHOOK_SECRET";

export function requireSecret(name: SecretEnvName): string {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env before running this feature.`);
  }

  return value;
}
