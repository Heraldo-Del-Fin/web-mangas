import dns from "node:dns";
import { isR2Configured } from "./r2-storage";

dns.setDefaultResultOrder("ipv4first");

export function isNeonConfigured(): boolean {
  const url = process.env.DATABASE_URL || "";
  return (
    (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
    !url.includes("tu_password")
  );
}

/**
 * Ejecuta una consulta SQL parametrizada contra el endpoint HTTP Serverless de Neon
 * (https://<host>/sql) usando fetch nativo.
 */
export async function executeNeonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<{ rows: T[]; ok: boolean; error?: string }> {
  if (!isNeonConfigured()) {
    return {
      rows: [],
      ok: false,
      error: "DATABASE_URL de Neon aún no está configurada en .env.local",
    };
  }

  try {
    const cleanConnectionString = process.env.DATABASE_URL!.replace(
      "&channel_binding=require",
      ""
    );
    const dbUrl = new URL(cleanConnectionString);
    const host = dbUrl.hostname;
    const endpoint = `https://${host}/sql`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": cleanConnectionString,
      },
      body: JSON.stringify({ query, params }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        rows: [],
        ok: false,
        error: `Neon HTTP ${res.status}: ${errText}`,
      };
    }

    const data = (await res.json()) as { rows?: T[] };
    return { rows: data.rows ?? [], ok: true };
  } catch (err) {
    return {
      rows: [],
      ok: false,
      error: err instanceof Error ? err.message : "Error de conexión con Neon",
    };
  }
}

export async function ensureNeonStoreTable(): Promise<boolean> {
  const res = await executeNeonQuery(`
    CREATE TABLE IF NOT EXISTS kuramanga_store (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  return res.ok;
}

export function getCloudInfrastructureStatus() {
  return {
    neonConfigured: isNeonConfigured(),
    neonDatabaseName: process.env.NEON_DATABASE_NAME || "BD-mangas",
    neonHost: isNeonConfigured()
      ? (() => {
          try {
            return new URL(process.env.DATABASE_URL!).hostname;
          } catch {
            return "ep-soft-meadow-aojjnt3c-pooler.c-2.ap-southeast-1.aws.neon.tech";
          }
        })()
      : null,
    r2Configured: isR2Configured(),
    r2Bucket: process.env.R2_BUCKET_NAME || "db-mangas",
    r2PublicUrl:
      process.env.R2_PUBLIC_URL ||
      "https://pub-fb2319e68bce48608493b3d987bfdd68.r2.dev",
  };
}
