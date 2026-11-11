import dns from "node:dns";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client } from "pg";
import { getR2Config, isR2Configured } from "./r2-storage";

try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // En entornos Edge/Cloudflare Workers donde node:dns es un stub, ignorar
}

const DEFAULT_NEON_URL =
  "postgresql://neondb_owner:npg_DY9QWUCgoG7v@ep-soft-meadow-aojjnt3c-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

function getHyperdriveConnectionString(): string | null {
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as
      | Record<string, { connectionString?: string }>
      | undefined;
    const hd = env?.["bd-manga"];
    if (
      hd &&
      typeof hd.connectionString === "string" &&
      hd.connectionString.length > 0
    ) {
      return hd.connectionString;
    }
  } catch {
    // Fuera de contexto de request de Cloudflare Workers
  }
  return null;
}

export function getDatabaseUrl(): string {
  try {
    const ctx = getCloudflareContext();
    const env = ctx?.env as Record<string, string | undefined> | undefined;
    if (env?.DATABASE_URL && env.DATABASE_URL.startsWith("postgres")) {
      return env.DATABASE_URL.replace("&channel_binding=require", "");
    }
  } catch {
    // Ignorar fuera de Cloudflare context
  }

  const envUrl = process.env.DATABASE_URL || DEFAULT_NEON_URL;
  return envUrl.replace("&channel_binding=require", "");
}

export function isNeonConfigured(): boolean {
  const url = getDatabaseUrl();
  return (
    (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
    !url.includes("tu_password")
  );
}

/**
 * Ejecuta una consulta SQL parametrizada contra Neon PostgreSQL:
 * 1) Primero utiliza el endpoint HTTP Serverless nativo de Neon (https://<host>/sql),
 *    que no requiere abrir sockets TCP y responde en milisegundos desde Cloudflare Workers.
 * 2) Si el endpoint HTTP no está disponible y existe Hyperdrive ("bd-manga"), usa pg Client.
 */
export async function executeNeonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<{
  rows: T[];
  ok: boolean;
  driver?: "neon-http" | "hyperdrive-pg";
  error?: string;
}> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return { rows: [], ok: false, error: "Build phase skip" };
  }

  if (!isNeonConfigured()) {
    return {
      rows: [],
      ok: false,
      error: "DATABASE_URL de Neon aún no está configurada",
    };
  }

  let httpErrorDetail = "";

  // 1. Endpoint HTTP Serverless de Neon (https://<host>/sql)
  try {
    const cleanConnectionString = getDatabaseUrl();
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
    });

    if (res.ok) {
      const data = (await res.json()) as { rows?: T[] };
      return { rows: data.rows ?? [], ok: true, driver: "neon-http" };
    } else {
      const text = await res.text().catch(() => "");
      httpErrorDetail = `HTTP ${res.status}: ${text.slice(0, 180)}`;
    }
  } catch (err) {
    httpErrorDetail = err instanceof Error ? err.message : "Error HTTP Neon";
  }

  // 2. Fallback a Cloudflare Hyperdrive si el binding "bd-manga" está presente
  const hyperdriveConn = getHyperdriveConnectionString();
  if (hyperdriveConn) {
    const client = new Client({ connectionString: hyperdriveConn });
    try {
      await client.connect();
      const result = await client.query(query, params);
      await client.end();
      return {
        rows: (result.rows as T[]) ?? [],
        ok: true,
        driver: "hyperdrive-pg",
      };
    } catch (err) {
      try {
        await client.end();
      } catch {
        // ignore
      }
      return {
        rows: [],
        ok: false,
        error: `Neon HTTP (${httpErrorDetail}) | Hyperdrive (${
          err instanceof Error ? err.message : "Error"
        })`,
      };
    }
  }

  return {
    rows: [],
    ok: false,
    error: httpErrorDetail || "No se pudo conectar a Neon HTTP ni Hyperdrive",
  };
}

let tableInitialized = false;

export async function ensureNeonStoreTable(): Promise<boolean> {
  if (tableInitialized) return true;
  const res = await executeNeonQuery(`
    CREATE TABLE IF NOT EXISTS kuramanga_store (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  if (res.ok) {
    tableInitialized = true;
  }
  return res.ok;
}

export function getCloudInfrastructureStatus() {
  const configured = isNeonConfigured();
  const hasHyperdrive = Boolean(getHyperdriveConnectionString());
  const r2Cfg = getR2Config();
  return {
    neonConfigured: configured,
    neonDatabaseName: hasHyperdrive
      ? "BD-mangas (Neon HTTP + Hyperdrive)"
      : process.env.NEON_DATABASE_NAME || "BD-mangas (Neon HTTP)",
    neonHost: configured
      ? (() => {
          try {
            return new URL(getDatabaseUrl()).hostname;
          } catch {
            return "ep-soft-meadow-aojjnt3c-pooler.c-2.ap-southeast-1.aws.neon.tech";
          }
        })()
      : null,
    r2Configured: isR2Configured(),
    r2Mode: r2Cfg.hasNativeBinding
      ? "R2 Native Worker Binding (R2_BUCKET)"
      : r2Cfg.hasS3Credentials
        ? "S3 API (AWS Signature V4)"
        : "No configurado",
    r2Bucket: r2Cfg.bucketName,
    r2PublicUrl: r2Cfg.publicUrl,
  };
}
