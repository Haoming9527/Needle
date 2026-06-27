import type { z, ZodType } from "zod";

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1]?.trim() ?? trimmed;
}

function extractJsonSubstring(raw: string): string | undefined {
  const text = stripCodeFence(raw);
  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  const firstArray = text.indexOf("[");
  const lastArray = text.lastIndexOf("]");

  if (firstObject >= 0 && lastObject > firstObject) {
    return text.slice(firstObject, lastObject + 1);
  }

  if (firstArray >= 0 && lastArray > firstArray) {
    return text.slice(firstArray, lastArray + 1);
  }

  return undefined;
}

export function parseJsonWithSchema<T extends ZodType>(
  raw: string,
  schema: T
): z.infer<T> {
  const directText = stripCodeFence(raw);
  const candidates = [directText, extractJsonSubstring(directText)].filter(
    (candidate): candidate is string => Boolean(candidate)
  );

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return schema.parse(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to parse JSON response");
}
