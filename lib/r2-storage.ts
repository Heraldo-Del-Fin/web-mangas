import { createHash, createHmac } from "node:crypto";
import dns from "node:dns";
import fs from "node:fs/promises";
import path from "node:path";

try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // En entornos Edge/Cloudflare Workers donde node:dns es un stub, ignorar
}

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

let cachedCloudflareAccountId: string | null = null;

async function resolveCloudflareAccountId(): Promise<string | null> {
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCOUNT_ID.trim() !== "") {
    return process.env.R2_ACCOUNT_ID.trim();
  }
  if (cachedCloudflareAccountId) {
    return cachedCloudflareAccountId;
  }
  const apiToken = process.env.R2_API_TOKEN?.trim();
  if (!apiToken) return null;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/accounts", {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { id: string; name: string }[];
    };
    const foundId = data.result?.[0]?.id ?? null;
    if (foundId) {
      cachedCloudflareAccountId = foundId;
    }
    return foundId;
  } catch {
    return null;
  }
}

export function isR2Configured(): boolean {
  return Boolean(
    (process.env.R2_ACCOUNT_ID || process.env.R2_API_TOKEN) &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL
  );
}

/**
 * Sube un archivo de imagen (portada o página de capítulo) al bucket "bd-mangas"
 * en Cloudflare R2 usando AWS Signature V4 nativa y devuelve la URL pública
 * (https://pub-fb2319e68bce48608493b3d987bfdd68.r2.dev/...).
 * Si no hay conexión de red o falta Account ID, guarda en public/uploads/ como respaldo.
 */
export async function uploadMangaImage(
  file: File,
  subFolder: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = path.extname(file.name) || ".webp";
  const safeName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}${ext}`;
  const objectKey = `${subFolder}/${safeName}`;

  if (isR2Configured()) {
    try {
      const accountId = await resolveCloudflareAccountId();
      if (accountId) {
        const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
        const bucket = process.env.R2_BUCKET_NAME!;
        const publicBaseUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

        const host = `${accountId}.r2.cloudflarestorage.com`;
        const region = "auto";
        const service = "s3";

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);

        const payloadHash = sha256Hex(buffer);
        const contentType = file.type || "image/webp";
        const canonicalUri = `/${bucket}/${objectKey}`;
        const canonicalHeaders =
          `content-type:${contentType}\n` +
          `host:${host}\n` +
          `x-amz-content-sha256:${payloadHash}\n` +
          `x-amz-date:${amzDate}\n`;
        const signedHeaders =
          "content-type;host;x-amz-content-sha256;x-amz-date";

        const canonicalRequest = [
          "PUT",
          canonicalUri,
          "",
          canonicalHeaders,
          signedHeaders,
          payloadHash,
        ].join("\n");

        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = [
          "AWS4-HMAC-SHA256",
          amzDate,
          credentialScope,
          sha256Hex(canonicalRequest),
        ].join("\n");

        const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
        const kRegion = hmacSha256(kDate, region);
        const kService = hmacSha256(kRegion, service);
        const kSigning = hmacSha256(kService, "aws4_request");
        const signature = createHmac("sha256", kSigning)
          .update(stringToSign, "utf8")
          .digest("hex");

        const authorizationHeader =
          `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
          `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const res = await fetch(`https://${host}${canonicalUri}`, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
            Authorization: authorizationHeader,
          },
          body: buffer,
        });

        if (res.ok) {
          return `${publicBaseUrl}/${objectKey}`;
        }
      }
    } catch {
      // Fallback automático al almacenamiento local si no hay salida a internet
    }
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", subFolder);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, safeName), buffer);

  return `/uploads/${subFolder}/${safeName}`;
}
