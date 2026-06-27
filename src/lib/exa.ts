import { Exa } from "exa-js";
import { requireSecret } from "../config.js";

let client: Exa | undefined;

export function getExa(): Exa {
  if (!client) {
    client = new Exa(requireSecret("EXA_API_KEY"));
  }

  return client;
}
