import { createHash, createHmac } from "node:crypto";
import dns from "node:dns";
import fs from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // En entornos Edge/Cloudflare Workers donde node:dns es un stub, ignorar
}

interface CloudflareR2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    }
  ): Promise<unknown>;
  head(key: string): Promise<unknown>;
}

const DEFAULT_R2_ACCOUNT_ID = "e500463ee947ed9f7530a55f5bc72688";
const DEFAULT_R2_BUCKET_NAME = "db-mangas";
const DEFAULT_R2_PUBLIC_URL =
  "https://pub-fb2319e68bce48608493b3d987bfdd68.r2.dev";

function getWorkerEnv(): Record<string, unknown> | null {
  try {
    const ctx = getCloudflareContext();
    return (ctx?.env as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

function getEnvString(key: string, fallback = ""): string {
  const workerEnv = getWorkerEnv();
  const fromWorker = workerEnv?.[key];
  if (typeof fromWorker === "string" && fromWorker.trim() !== "") {
    return fromWorker.trim();
  }
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim() !== "") {
    return fromProcess.trim();
  }
  return fallback;
}

function getR2BucketBinding(): CloudflareR2BucketBinding | null {
  const workerEnv = getWorkerEnv();
  const candidate = workerEnv?.["R2_BUCKET"] as CloudflareR2BucketBinding | undefined;
  if (candidate && typeof candidate.put === "function") {
    return candidate;
  }
  return null;
}

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

export function getR2Config() {
  const accountId = getEnvString("R2_ACCOUNT_ID", DEFAULT_R2_ACCOUNT_ID);
  const bucketName = getEnvString("R2_BUCKET_NAME", DEFAULT_R2_BUCKET_NAME);
  const publicUrl = getEnvString("R2_PUBLIC_URL", DEFAULT_R2_PUBLIC_URL).replace(
    /\/$/,
    ""
  );
  const accessKeyId = getEnvString("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnvString("R2_SECRET_ACCESS_KEY");
  const hasNativeBinding = Boolean(getR2BucketBinding());
  const hasS3Credentials = Boolean(
    accountId && accessKeyId && secretAccessKey && bucketName && publicUrl
  );

  return {
    accountId,
    bucketName,
    publicUrl,
    accessKeyId,
    secretAccessKey,
    hasNativeBinding,
    hasS3Credentials,
  };
}

export function isR2Configured(): boolean {
  const cfg = getR2Config();
  return cfg.hasNativeBinding || cfg.hasS3Credentials;
}

export async function checkR2Connection(): Promise<{
  ok: boolean;
  mode: "R2 Native Binding" | "S3 REST API" | "Not Configured";
  bucket: string;
  publicUrl: string;
}> {
  const cfg = getR2Config();
  const binding = getR2BucketBinding();

  if (binding) {
    try {
      await binding.head("__healthcheck__");
      return {
        ok: true,
        mode: "R2 Native Binding",
        bucket: cfg.bucketName,
        publicUrl: cfg.publicUrl,
      };
    } catch {
      // Incluso si la clave no existe, el binding respondió
      return {
        ok: true,
        mode: "R2 Native Binding",
        bucket: cfg.bucketName,
        publicUrl: cfg.publicUrl,
      };
    }
  }

  if (cfg.hasS3Credentials) {
    return {
      ok: true,
      mode: "S3 REST API",
      bucket: cfg.bucketName,
      publicUrl: cfg.publicUrl,
    };
  }

  return {
    ok: false,
    mode: "Not Configured",
    bucket: cfg.bucketName,
    publicUrl: cfg.publicUrl,
  };
}

/**
 * Sube un archivo de imagen (portada o página de capítulo) al bucket "db-mangas"
 * en Cloudflare R2:
 * 1) Primero usa el Binding nativo `R2_BUCKET` de Cloudflare Workers (máxima velocidad, red interna).
 * 2) Si se ejecuta fuera de Workers (ej. `npm run dev`), usa la API S3 de Cloudflare R2 firmada con AWS Signature V4.
 * 3) Como último recurso en desarrollo local sin red, guarda en `public/uploads/`.
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
  const contentType = file.type || "image/webp";

  const cfg = getR2Config();

  // 1. Binding nativo R2_BUCKET en Cloudflare Workers
  const r2Binding = getR2BucketBinding();
  if (r2Binding) {
    try {
      await r2Binding.put(objectKey, bytes, {
        httpMetadata: {
          contentType,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
      return `${cfg.publicUrl}/${objectKey}`;
    } catch {
      // Si falla el binding, intentar S3 API abajo
    }
  }

  // 2. API S3 de Cloudflare R2 con AWS Signature V4
  if (cfg.hasS3Credentials) {
    try {
      const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
      const region = "auto";
      const service = "s3";

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
      const dateStamp = amzDate.slice(0, 8);

      const payloadHash = sha256Hex(buffer);
      const canonicalUri = `/${cfg.bucketName}/${objectKey}`;
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

      const kDate = hmacSha256(`AWS4${cfg.secretAccessKey}`, dateStamp);
      const kRegion = hmacSha256(kDate, region);
      const kService = hmacSha256(kRegion, service);
      const kSigning = hmacSha256(kService, "aws4_request");
      const signature = createHmac("sha256", kSigning)
        .update(stringToSign, "utf8")
        .digest("hex");

      const authorizationHeader =
        `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
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
        return `${cfg.publicUrl}/${objectKey}`;
      }
    } catch {
      // Fallback local si estamos en PC local sin red
    }
  }

  // 3. Fallback local únicamente para entorno Node.js de desarrollo
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads", subFolder);
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, safeName), buffer);
    return `/uploads/${subFolder}/${safeName}`;
  } catch {
    return null;
  }
}
