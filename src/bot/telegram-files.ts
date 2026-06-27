import type { Context } from "telegraf";

export type DownloadedTelegramPhoto = {
  base64: string;
  mimeType: string;
  fileId: string;
  size: number;
};

export async function downloadTelegramPhoto(ctx: Context): Promise<DownloadedTelegramPhoto> {
  const message = ctx.message as { photo?: Array<{ file_id: string; file_size?: number }> };
  const photos = message.photo;

  if (!photos || photos.length === 0) {
    throw new Error("No Telegram photo found on message");
  }

  const bestPhoto = photos[photos.length - 1];
  const fileLink = await ctx.telegram.getFileLink(bestPhoto.file_id);
  const response = await fetch(fileLink.href);

  if (!response.ok) {
    throw new Error(`Telegram file download failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = detectImageMimeType(buffer, response.headers.get("content-type"));

  return {
    base64: buffer.toString("base64"),
    mimeType,
    fileId: bestPhoto.file_id,
    size: buffer.length
  };
}

function detectImageMimeType(buffer: Buffer, headerMimeType: string | null): string {
  if (headerMimeType?.startsWith("image/")) {
    return headerMimeType;
  }

  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "image/jpeg";
  }

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.subarray(0, 3).toString("ascii") === "GIF") {
    return "image/gif";
  }

  return "image/jpeg";
}
