import OpenAI from "openai";
import { requireSecret } from "../config.js";

let client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: requireSecret("OPENAI_API_KEY")
    });
  }

  return client;
}
