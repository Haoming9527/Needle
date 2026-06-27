import type { Context } from "telegraf";
import { logger } from "../lib/logger.js";
import { collectRiskNotes } from "../agent/risk-check.js";
import type { NeedleReport, RankedProductCandidate } from "../types/needle.js";

export const START_MESSAGE = `
Welcome to Needle.

Send me a product photo, screenshot, listing link, or description.

I will build a product fingerprint, search live listings, compare price signals, and return buying leads with risk notes.

Try:
"Find this"
"Find this but black"
"Is this overpriced?"
"Find the cheapest authentic one"
`.trim();

export const HELP_MESSAGE = `
Needle can read:
- Product photos or screenshots
- Text descriptions
- Product listing URLs

Commands:
/start - Start Needle
/help - Show this help
/history - Show your recent searches
/demo - Run a stable demo search
/balance - Show wallet balance
/topup 10 - Add wallet funds with Stripe Checkout
/buy 1 - Prepare a simulated purchase from the latest result
/confirm <id> - Approve and debit a simulated purchase
/orders - Show recent simulated orders
/void <id> - Void a simulated order and restore wallet balance
/about - About this hackathon build
`.trim();

export const ABOUT_MESSAGE = `
Needle is an AI product finder bot built for the Trust, Commerce & Fraud track.

It combines visual product identification, live web discovery, deterministic listing scoring, price extraction, and lightweight search history.
`.trim();

export function formatNeedleReport(report: NeedleReport): string {
  const identification = report.identification;
  const confidencePercent = Math.round(identification.confidence * 100);
  const lines = [
    "Needle search report",
    "",
    "Product fingerprint:",
    identification.likelyProductName,
    "",
    `Category: ${identification.productCategory}`,
    `Confidence: ${confidencePercent}%`,
    "",
    "Why:",
    identification.reasoning
  ];

  if (report.candidates.length > 0) {
    lines.push("", "Best matches:");

    report.candidates.slice(0, 3).forEach((candidate, index) => {
      lines.push(
        "",
        `${index + 1}. ${candidate.title}`,
        `   Match: ${Math.round(candidate.matchConfidence * 100)}%`,
        `   Price: ${candidate.priceText ?? "unknown"}`,
        `   Source: ${candidate.marketplace ?? candidate.source}`,
        `   Risk: ${candidate.buyingRisk}`,
        `   Evidence: ${candidate.matchReasons.slice(0, 2).join(" ")}`,
        `   ${candidate.url}`
      );
    });
  } else {
    lines.push("", "I did not find strong live matches yet.");
  }

  lines.push(
    "",
    "Price read:",
    report.priceInsight.typicalRangeText,
    report.priceInsight.overpricedThresholdText
  );

  const notes = collectRiskNotes(report.candidates);

  if (notes.length > 0) {
    lines.push("", "Buying notes:");
    notes.slice(0, 3).forEach((note) => lines.push(`- ${note}`));
  }

  lines.push("", "Search it yourself:");
  report.suggestedSearchLinks.forEach((link) => {
    lines.push(`${link.label}: ${link.url}`);
  });

  if (report.needsClarification && report.clarifyingQuestion) {
    lines.push("", "Quick check:", report.clarifyingQuestion);
  }

  lines.push("", "Advice:", report.finalAdvice);

  return truncateMessage(lines.join("\n"));
}

export async function sendNeedleReport(ctx: Context, report: NeedleReport): Promise<void> {
  await sendBestCandidatePhoto(ctx, report);

  const message = formatNeedleReport(report);
  await replyInChunks(ctx, message);
  await sendShoppingChoiceButtons(ctx, report);
}

async function sendShoppingChoiceButtons(ctx: Context, report: NeedleReport): Promise<void> {
  if (!shouldOfferShoppingActions(report)) {
    return;
  }

  await ctx.reply("Choose a result for the shopping agent:", {
    reply_markup: {
      inline_keyboard: [
        report.candidates.slice(0, 3).map((candidate, index) => ({
          text: candidate.priceText
            ? `Buy #${index + 1} (${candidate.priceText})`
            : `View #${index + 1} (no price)`,
          callback_data: candidate.priceText ? `buy:${index + 1}` : `view:${index + 1}`
        }))
      ]
    }
  });
}

async function sendBestCandidatePhoto(ctx: Context, report: NeedleReport): Promise<void> {
  if (!shouldOfferShoppingActions(report)) {
    return;
  }

  const candidate = report.candidates.find((item) => isHttpImageUrl(item.imageUrl));

  if (!candidate?.imageUrl) {
    return;
  }

  try {
    const photo = await fetchTelegramPhotoInput(candidate.imageUrl);

    await ctx.replyWithPhoto(photo, {
      caption: formatCandidatePhotoCaption(candidate)
    });
  } catch (error) {
    logger.warn(
      { error, imageUrl: candidate.imageUrl, candidateUrl: candidate.url },
      "Telegram could not send candidate image"
    );
  }
}

async function fetchTelegramPhotoInput(url: string): Promise<{ source: Buffer; filename: string }> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; NeedleBot/1.0; +https://example.local/needle)",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(8_000)
  });

  if (!response.ok) {
    throw new Error(`Image fetch failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (!contentType.startsWith("image/") && !looksLikeImage(buffer)) {
    throw new Error(`URL did not return image bytes (${contentType || "unknown content type"})`);
  }

  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error(`Image is too large for Telegram preview upload (${buffer.length} bytes)`);
  }

  return {
    source: buffer,
    filename: `needle-preview.${extensionForImage(contentType, buffer)}`
  };
}

function formatCandidatePhotoCaption(candidate: RankedProductCandidate): string {
  return truncateMessage(
    [
      "Top visual lead",
      candidate.title,
      `Match: ${Math.round(candidate.matchConfidence * 100)}%`,
      `Price: ${candidate.priceText ?? "unknown"}`,
      `Source: ${candidate.marketplace ?? candidate.source}`,
      candidate.url
    ].join("\n")
  );
}

function isHttpImageUrl(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeImage(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP")
  );
}

function extensionForImage(contentType: string, buffer: Buffer): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return "jpg";
}

function shouldOfferShoppingActions(report: NeedleReport): boolean {
  return (
    report.candidates.length > 0 &&
    !report.needsClarification &&
    report.identification.confidence >= 0.55 &&
    report.identification.likelyProductName.trim().length > 1
  );
}

export async function replyInChunks(ctx: Context, text: string): Promise<void> {
  const chunks = chunkText(text, 3800);

  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      link_preview_options: {
        is_disabled: true
      }
    });
  }
}

function truncateMessage(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.length > 900 ? `${line.slice(0, 897)}...` : line))
    .join("\n");
}

function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const splitAt = remaining.lastIndexOf("\n", maxLength);
    const index = splitAt > 0 ? splitAt : maxLength;
    chunks.push(remaining.slice(0, index));
    remaining = remaining.slice(index).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}
