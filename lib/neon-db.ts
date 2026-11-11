import dns from "node:dns";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Client } from "pg";
import { isR2Configured } from "./r2-storage";

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
    const env = ctx?.env as Record<string, { connectionString?: string }> | undefined;
    const hd = env?.["bd-manga"];
    if (hd && typeof hd.connectionString === "string" && hd.connectionString.length > 0) {
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
  if (getHyperdriveConnectionString()) {
    return true;
  }
  const url = getDatabaseUrl();
  return (
    (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
    !url.includes("tu_password")
  );
}

/**
 * Ejecuta una consulta SQL parametrizada contra Neon PostgreSQL:
 * 1) Si existe un binding activo de Cloudflare Hyperdrive ("bd-manga"), intenta usar pg Client sobre Hyperdrive.
 * 2) En caso contrario (o como fallback automático), usa el endpoint HTTP Serverless de Neon (https://<host>/sql).
 */
export async function executeNeonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<{ rows: T[]; ok: boolean; error?: string }> {
  // Durante el paso de compilación estática de Next.js, usar semilla rápida sin bloquear el prerender
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

  // 1. Intentar por Cloudflare Hyperdrive si el binding "bd-manga" está presente en el Worker
  const hyperdriveConn = getHyperdriveConnectionString();
  if (hyperdriveConn) {
    const client = new Client({ connectionString: hyperdriveConn });
    try {
      await client.connect();
      const result = await client.query(query, params);
      await client.end();
      return { rows: (result.rows as T[]) ?? [], ok: true };
    } catch {
      try {
        await client.end();
      } catch {
        // ignore
      }
      // Si Hyperdrive falla, continuar automáticamente al endpoint HTTP de Neon
    }
  }

  // 2. Endpoint HTTP Serverless de Neon (https://<host>/sql)
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
  const configured = isNeonConfigured();
  const hasHyperdrive = Boolean(getHyperdriveConnectionString());
  return {
    neonConfigured: configured,
    neonDatabaseName: hasHyperdrive
      ? "BD-mangas (Hyperdrive + Neon)"
      : process.env.NEON_DATABASE_NAME || "BD-mangas",
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
    r2Bucket: process.env.R2_BUCKET_NAME || "db-mangas",
    r2PublicUrl:
      process.env.R2_PUBLIC_URL ||
      "https://pub-fb2319e68bce48608493b3d987bfdd68.r2.dev",
  };
}
